import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { UserFacingError, errorToken } from "../../src/shared/i18n";
import type { Player, PreparedMedia, PlaybackControl } from "../../src/shared/types";
import { title, type PlayerSnapshot } from "./player-session";
import { WindowsNativeBridge, type NativeBridge, type NativeStatus } from "./windows-native";

export function windowsPlayerArgs(
  player: Player,
  media: PreparedMedia,
  fullscreen: boolean,
  handle: string,
): string[] {
  if (player.kind === "potplayer") {
    const seconds = Math.max(0, Math.floor(media.startSeconds));
    const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
    return [
      media.url,
      "/new",
      `/seek=${time}`,
      `/title=${title(media)}`,
      ...(media.subtitleUrl ? [`/sub=${media.subtitleUrl}`] : []),
      ...(fullscreen ? ["/fullscreen"] : []),
    ];
  }
  return [
    media.url,
    "/new",
    "/slave",
    handle,
    "/play",
    "/start",
    String(Math.round(media.startSeconds * 1000)),
    ...(media.subtitleUrl ? ["/sub", media.subtitleUrl] : []),
    ...(fullscreen ? ["/fullscreen"] : []),
  ];
}

// Each process plays one queue item. This keeps per-item resume times, stream selections
// and stop reports independent of a player's own playlist persistence/preferences.
export class WindowsPlayerSession extends EventEmitter {
  snapshot: PlayerSnapshot = { index: 0, position: 0, duration: 0, paused: false };
  private queue: PreparedMedia[] = [];
  private child?: ChildProcess;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private queuePending = false;
  private waitingNext = false;
  private changing = false;
  private polling = false;
  private handle = "";
  private fullscreen = false;
  private loaded = false;
  private launchedAt = 0;
  private loadGeneration = 0;
  private statusFailures = 0;
  constructor(
    readonly player: Player,
    private readonly bridge: NativeBridge = new WindowsNativeBridge(),
    private readonly launchProcess = spawn,
  ) {
    super();
  }
  async start(media: PreparedMedia[], fullscreen: boolean, queuePending = false): Promise<void> {
    this.queue = [...media];
    this.fullscreen = fullscreen;
    this.queuePending = queuePending;
    try {
      this.handle = await this.bridge.open();
    } catch (error) {
      if (!this.stopped)
        this.emit(
          "diagnostic",
          `Windows player bridge: ${error instanceof Error ? error.message : String(error)}`,
        );
      this.bridge.close();
      throw new UserFacingError("playerConnection");
    }
    if (this.stopped) {
      this.bridge.close();
      return;
    }
    await this.load(0);
    if (!this.stopped) this.timer = setInterval(() => void this.poll(), 1_000);
  }
  private async load(index: number): Promise<void> {
    if (this.stopped || !this.queue[index]) return;
    this.changing = true;
    this.loadGeneration++;
    this.statusFailures = 0;
    const old = this.child;
    this.child = undefined;
    old?.kill();
    const media = this.queue[index];
    this.snapshot = { index, position: media.startSeconds, duration: 0, paused: false };
    this.loaded = false;
    this.waitingNext = false;
    this.launchedAt = Date.now();
    this.emit("loading", index);
    const child = (this.child = this.launchProcess(
      this.player.executable,
      [
        ...this.player.prefixArgs,
        ...windowsPlayerArgs(this.player, media, this.fullscreen, this.handle),
      ],
      { shell: false, stdio: "ignore", windowsHide: true },
    ));
    child.on("error", () => {
      if (this.child === child && !this.stopped) {
        this.emit("media-error", errorToken("playerStartFailed"));
        this.finish();
      }
    });
    child.on("exit", () => {
      if (this.child !== child || this.stopped) return;
      // EOF notification normally arrives before process exit; closing a window mid-video stops.
      if (this.loaded && this.snapshot.duration - this.snapshot.position <= 2)
        void this.advance().catch(() => {
          this.emit("media-error", errorToken("playerStartFailed"));
          this.finish();
        });
      else this.finish();
    });
    try {
      if (child.pid) {
        await this.bridge.request("target", { pid: child.pid });
        await this.bridge.request("activate").catch(() => {});
      }
    } finally {
      this.changing = false;
    }
  }
  async enqueue(media: PreparedMedia): Promise<void> {
    if (this.stopped) throw new UserFacingError("playerClosed");
    this.queue.push(media);
    if (this.waitingNext) await this.load(this.snapshot.index + 1);
  }
  completeQueue(): void {
    this.queuePending = false;
    if (this.waitingNext && !this.queue[this.snapshot.index + 1]) this.finish();
  }
  private async advance(): Promise<void> {
    if (this.changing || this.waitingNext || this.stopped) return;
    if (this.queue[this.snapshot.index + 1]) await this.load(this.snapshot.index + 1);
    else if (this.queuePending) this.waitingNext = true;
    else this.finish();
  }
  private async poll(): Promise<void> {
    if (this.stopped || this.polling || this.changing || this.waitingNext) return;
    this.polling = true;
    const generation = this.loadGeneration;
    try {
      const status = await this.bridge.request<NativeStatus>(
        this.player.kind === "potplayer" ? "pot-status" : "mpc-status",
      );
      if (this.stopped || this.changing || generation !== this.loadGeneration) return;
      this.statusFailures = 0;
      if (this.loaded && (status.stopped || status.ended)) {
        // Native Stop can reset the clock to zero. Preserve the last known
        // position and distinguish manual stop from a natural EOF notification.
        const nearEnd = this.snapshot.duration - this.snapshot.position <= 2;
        if (status.ended || (this.player.kind === "potplayer" && nearEnd)) await this.advance();
        else this.finish();
        return;
      }
      if (status.loaded && Number.isFinite(status.position) && status.duration > 0) {
        if (!this.loaded) {
          this.loaded = true;
          await this.bridge.request("activate");
          if (this.stopped || generation !== this.loadGeneration) return;
          const media = this.queue[this.snapshot.index];
          if (this.player.kind !== "potplayer") {
            if (media.audioId !== undefined)
              await this.bridge.request("mpc-audio", { value: media.audioId - 1 });
            if (media.subtitleId !== undefined)
              await this.bridge.request("mpc-subtitle", {
                value: media.subtitleId === "no" ? -1 : media.subtitleId - 1,
              });
          }
        }
        if (this.stopped || generation !== this.loadGeneration) return;
        this.snapshot = {
          index: this.snapshot.index,
          position: Math.max(0, status.position),
          duration: status.duration,
          paused: status.paused,
        };
        this.emit("snapshot", this.snapshot);
      }
      if (status.ended && this.loaded) {
        await this.advance();
      } else if (!this.loaded && Date.now() - this.launchedAt > 30_000)
        throw new UserFacingError("playerConnection");
    } catch (error) {
      if (generation !== this.loadGeneration) return;
      this.statusFailures++;
      if (
        !this.stopped &&
        ((this.loaded && this.statusFailures >= 3) ||
          (!this.loaded && Date.now() - this.launchedAt > 30_000))
      ) {
        this.emit(
          "diagnostic",
          `Windows player status: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.emit("media-error", errorToken("playerConnection"));
        this.finish();
      }
    } finally {
      this.polling = false;
    }
  }
  async control(control: PlaybackControl): Promise<void> {
    if (control.action === "stop") return this.stop();
    if (control.action === "next" || control.action === "previous" || control.action === "jump") {
      const index =
        control.action === "jump"
          ? control.index
          : this.snapshot.index + (control.action === "next" ? 1 : -1);
      if (this.queue[index]) await this.load(index);
      return;
    }
    const prefix = this.player.kind === "potplayer" ? "pot" : "mpc";
    await this.bridge.request(
      `${prefix}-${control.action}`,
      control.action === "seek" ? { value: control.seconds * (prefix === "pot" ? 1000 : 1) } : {},
    );
    await this.poll();
  }
  async stop(): Promise<void> {
    if (this.stopped) return;
    // Capture the final position before stop resets the native player's clock.
    await this.poll();
    try {
      await this.bridge.request(this.player.kind === "potplayer" ? "pot-stop" : "mpc-stop");
    } catch {
      /* Already closed. */
    }
    this.finish();
  }
  private finish(): void {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    this.bridge.close();
    this.child?.kill();
    this.emit("stopped", this.snapshot);
  }
}
