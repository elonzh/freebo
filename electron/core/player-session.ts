import { UserFacingError, errorToken } from "../../src/shared/i18n";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { MpvIPC } from "./mpv-ipc";
import { activatePlayer, iinaProcessId } from "./player-focus";
import type { Player, PreparedMedia, PlaybackControl } from "../../src/shared/types";

export interface PlayerSnapshot {
  index: number;
  position: number;
  duration: number;
  paused: boolean;
}
export interface PlaybackSession extends EventEmitter {
  snapshot: PlayerSnapshot;
  start(media: PreparedMedia[], fullscreen: boolean, queuePending?: boolean): Promise<void>;
  enqueue(media: PreparedMedia): Promise<void>;
  completeQueue(): void;
  control(control: PlaybackControl): Promise<void>;
  stop(): Promise<void>;
}
export class PlayerSession extends EventEmitter {
  private child?: ChildProcess;
  private ipc?: MpvIPC;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private modernLoadfile = true;
  private vlcPort = 0;
  private vlcPassword = "";
  private vlcIds: number[] = [];
  private queuePending = false;
  private polling = false;
  private focusedIndex = -1;
  private windowPid?: number;
  snapshot: PlayerSnapshot = { index: 0, position: 0, duration: 0, paused: false };
  constructor(readonly player: Player) {
    super();
  }
  async start(media: PreparedMedia[], fullscreen: boolean, queuePending = false): Promise<void> {
    this.queuePending = queuePending;
    if (this.player.kind === "vlc") return this.startVlc(media, fullscreen);
    const socket =
      process.platform === "win32"
        ? `\\\\.\\pipe\\efp-${randomUUID()}`
        : join(tmpdir(), `efp-${randomUUID()}.sock`);
    const first = media[0];
    const options = [
      `--input-ipc-server=${socket}`,
      "--idle=yes",
      "--keep-open=no",
      "--force-window=yes",
      "--save-position-on-quit=no",
      "--resume-playback=no",
      `--start=${first.startSeconds}`,
      `--force-media-title=${title(first)}`,
      ...(fullscreen ? ["--fullscreen=yes"] : []),
      ...trackArgs(first),
    ];
    const args =
      this.player.kind === "iina"
        ? ["--no-stdin", ...options.map((option) => `--mpv-${option.slice(2)}`), first.url]
        : [...options, first.url];
    this.launch(args);
    const ipc = (this.ipc = new MpvIPC());
    await ipc.open(socket);
    if (this.stopped) {
      await ipc.command(["stop"]).catch(() => {});
      ipc.close();
      return;
    }
    this.windowPid =
      this.player.kind === "iina" && process.platform === "darwin"
        ? await iinaProcessId(this.player, socket)
        : this.child?.pid;
    const version = await ipc.command<string>(["get_property", "mpv-version"]);
    const match = version.match(/(\d+)\.(\d+)/);
    this.modernLoadfile = !match || Number(match[1]) > 0 || Number(match[2]) >= 38;
    if (process.platform === "darwin" && this.player.kind === "mpv" && this.modernLoadfile)
      await ipc.command(["set_property", "focus-on", "all"]).catch(() => {});
    ipc.on("event", (event) => {
      if (event.event === "file-loaded") void this.poll();
      if (event.event === "end-file" && event.reason === "error")
        this.emit("media-error", errorToken("mediaUnreadable"));
    });
    ipc.on("disconnected", () => {
      if (!this.stopped) this.finish();
    });
    for (const next of media.slice(1)) await this.append(next);
    await this.poll();
    this.timer = setInterval(() => void this.poll(), 1_000);
  }
  private launch(args: string[]): void {
    this.child = spawn(this.player.executable, [...this.player.prefixArgs, ...args], {
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });
    this.windowPid = this.child.pid;
    this.child.on("error", () => this.emit("media-error", errorToken("playerStartFailed")));
    if (this.player.kind !== "iina") void activatePlayer(this.player, this.child.pid);
    // iina-cli exits after handing the URL to IINA; IPC remains authoritative.
    if (this.player.kind !== "iina")
      this.child.on("exit", () => {
        if (!this.stopped) this.finish();
      });
  }
  async enqueue(media: PreparedMedia): Promise<void> {
    if (this.stopped) throw new UserFacingError("playerClosed");
    if (this.player.kind === "vlc") {
      const status = await this.vlcRequest("status", {
        command: "in_enqueue",
        input: media.url,
        name: title(media),
        option: [
          `start-time=${media.startSeconds}`,
          ...vlcOptions(media).map((option) => option.slice(1)),
        ],
      });
      await this.refreshVlcPlaylist();
      if (status.state === "stopped")
        await this.vlcRequest("status", { command: "pl_play", id: String(this.vlcIds.at(-1)) });
    } else await this.append(media);
  }
  completeQueue(): void {
    this.queuePending = false;
  }
  private async append(media: PreparedMedia): Promise<void> {
    const opts = mediaOptions(media);
    await this.ipc!.command(
      this.modernLoadfile
        ? ["loadfile", media.url, "append-play", -1, opts]
        : ["loadfile", media.url, "append-play", opts],
    );
  }
  async control(control: PlaybackControl): Promise<void> {
    if (control.action === "stop") {
      await this.stop();
      return;
    }
    if (this.player.kind === "vlc") {
      const commands = {
        pause: "pl_pause",
        next: "pl_next",
        previous: "pl_previous",
        seek: "seek",
        jump: "pl_play",
      };
      await this.vlcRequest("status", {
        command: commands[control.action],
        ...(control.action === "seek"
          ? { val: String(control.seconds) }
          : control.action === "jump"
            ? { id: String(this.vlcIds[control.index]) }
            : {}),
      });
      return;
    }
    const commands: Record<string, unknown[]> = {
      pause: ["cycle", "pause"],
      next: ["playlist-next", "weak"],
      previous: ["playlist-prev", "weak"],
    };
    await this.ipc?.command(
      control.action === "seek"
        ? ["seek", control.seconds, "absolute"]
        : control.action === "jump"
          ? ["set_property", "playlist-pos", control.index]
          : commands[control.action],
    );
  }
  private async poll(): Promise<void> {
    if (this.stopped || this.polling) return;
    this.polling = true;
    try {
      let snapshot: PlayerSnapshot;
      if (this.player.kind === "vlc") {
        const status = await this.vlcRequest("status");
        const current = status.currentplid;
        snapshot = {
          index: Math.max(0, this.vlcIds.indexOf(current)),
          position: Number(status.time ?? 0),
          duration: Number(status.length ?? 0),
          paused: status.state === "paused",
        };
        if (status.state === "stopped" && !this.queuePending) {
          this.finish();
          return;
        }
        if (status.state !== "playing" && status.state !== "paused") return;
        if (!(snapshot.duration > 0)) return;
      } else {
        const results = await Promise.allSettled(
          ["playlist-pos", "time-pos", "duration", "pause", "idle-active"].map((name) =>
            this.ipc!.command(["get_property", name]),
          ),
        );
        const value = (index: number) =>
          results[index].status === "fulfilled" ? results[index].value : undefined;
        if (value(4) === true && this.snapshot.duration > 0 && !this.queuePending) {
          this.finish();
          return;
        }
        snapshot = {
          index: Math.max(0, Number(value(0) ?? this.snapshot.index)),
          position: Number(value(1) ?? this.snapshot.position),
          duration: Number(value(2) ?? 0),
          paused: Boolean(value(3)),
        };
        // IPC can connect before the demuxer opens the video. Do not report a
        // false start or overwrite the resume position with unavailable properties.
        if (value(4) === true || typeof value(1) !== "number" || !(snapshot.duration > 0)) return;
      }
      if (this.stopped) return;
      this.snapshot = snapshot;
      this.emit("snapshot", snapshot);
      if (this.focusedIndex !== snapshot.index) {
        this.focusedIndex = snapshot.index;
        if (this.player.kind !== "iina" || this.windowPid)
          void activatePlayer(this.player, this.windowPid).then((activated) => {
            if (activated !== undefined && !this.stopped)
              this.emit(
                "diagnostic",
                `Player window activation: ${this.player.name} (${activated ? "accepted" : "refused"})`,
              );
          });
      }
    } catch {
      /* IPC disconnect handles termination; transient status errors can recover. */
    } finally {
      this.polling = false;
    }
  }
  async stop(): Promise<void> {
    if (this.stopped) return;
    await this.poll();
    try {
      if (this.player.kind === "vlc") await this.vlcRequest("status", { command: "pl_stop" });
      else await this.ipc?.command(["stop"]);
    } catch {
      /* Already closed. */
    }
    this.finish();
  }
  private finish(): void {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    this.ipc?.close();
    // These processes belong to this session. IINA's launcher hands off to the user's app.
    if (this.player.kind !== "iina") this.child?.kill();
    this.emit("stopped", this.snapshot);
  }
  private async startVlc(media: PreparedMedia[], fullscreen: boolean): Promise<void> {
    this.vlcPort = await freePort();
    this.vlcPassword = randomBytes(24).toString("hex");
    const first = media[0];
    this.launch([
      "--extraintf=http",
      "--http-host=127.0.0.1",
      `--http-port=${this.vlcPort}`,
      `--http-password=${this.vlcPassword}`,
      "--no-one-instance",
      ...(fullscreen ? ["--fullscreen"] : []),
      first.url,
      `:start-time=${first.startSeconds}`,
      ...vlcOptions(first),
    ]);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await this.vlcRequest("status");
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    if (!ready) throw new UserFacingError("vlcConnection");
    if (this.stopped) return;
    for (const next of media.slice(1)) await this.enqueue(next);
    await this.refreshVlcPlaylist();
    await this.poll();
    this.timer = setInterval(() => void this.poll(), 1_000);
  }
  private async refreshVlcPlaylist(): Promise<void> {
    const playlist = await this.vlcRequest("playlist");
    const flatten = (node: {
      id?: number | string;
      type?: string;
      children?: unknown[];
    }): number[] =>
      node.type === "leaf"
        ? [Number(node.id)]
        : (node.children ?? []).flatMap((child) => flatten(child as typeof node));
    this.vlcIds = flatten(playlist);
  }
  private async vlcRequest(
    endpoint: string,
    params: Record<string, string | string[]> = {},
  ): Promise<any> {
    const url = new URL(`http://127.0.0.1:${this.vlcPort}/requests/${endpoint}.json`);
    for (const [key, value] of Object.entries(params))
      for (const part of Array.isArray(value) ? value : [value]) url.searchParams.append(key, part);
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`:${this.vlcPassword}`).toString("base64")}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new UserFacingError("vlcNotReady");
    return response.json();
  }
}
export function title(media: PreparedMedia): string {
  return media.item.seriesTitle
    ? `${media.item.seriesTitle} · ${media.item.title}`
    : media.item.title;
}
export function mediaOptions(media: PreparedMedia): Record<string, string> {
  return {
    start: String(media.startSeconds),
    "force-media-title": title(media),
    ...Object.fromEntries(
      trackArgs(media).map((arg) => {
        const index = arg.indexOf("=");
        return [arg.slice(2, index), arg.slice(index + 1)];
      }),
    ),
  };
}
export function trackArgs(media: PreparedMedia): string[] {
  return [
    ...(media.audioId ? [`--aid=${media.audioId}`] : []),
    ...(media.subtitleId !== undefined ? [`--sid=${media.subtitleId}`] : []),
    ...(media.subtitleUrl ? [`--sub-files=${media.subtitleUrl}`] : []),
    ...(Object.keys(media.headers).length
      ? [
          `--http-header-fields=${Object.entries(media.headers)
            .map(([key, value]) => `${key}: ${value.replace(/,/g, "\\,")}`)
            .join(",")}`,
        ]
      : []),
  ];
}
function vlcOptions(media: PreparedMedia): string[] {
  return [
    ...(media.audioId ? [`:audio-track=${media.audioId - 1}`] : []),
    ...(media.subtitleId !== undefined
      ? [`:sub-track=${media.subtitleId === "no" ? -1 : media.subtitleId - 1}`]
      : []),
    ...(media.subtitleUrl ? [`:sub-file=${media.subtitleUrl}`] : []),
    ...(media.headers["User-Agent"] ? [`:http-user-agent=${media.headers["User-Agent"]}`] : []),
  ];
}
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}
