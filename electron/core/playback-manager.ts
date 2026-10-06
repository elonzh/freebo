import { EventEmitter } from "node:events";
import type {
  PlayIntent,
  Player,
  PlaybackControl,
  PlaybackState,
  Settings,
  PreparedMedia,
} from "../../src/shared/types";
import type { PlaybackClient } from "../providers/types";
import { UserFacingError, errorToken } from "../../src/shared/i18n";
import { PlayerSession, title, type PlayerSnapshot, type PlaybackSession } from "./player-session";
import { WindowsPlayerSession } from "./windows-player-session";
import { redact } from "./redact";

export const idlePlayback: PlaybackState = {
  status: "idle",
  position: 0,
  duration: 0,
  queue: [],
  index: 0,
};
export class PlaybackManager extends EventEmitter {
  state: PlaybackState = structuredClone(idlePlayback);
  private player?: PlaybackSession;
  private client?: PlaybackClient;
  private media: PreparedMedia[] = [];
  private current = -1;
  private generation = 0;
  private lastSync = 0;
  private reports = Promise.resolve();
  private lastIntent = "";
  private lastIntentAt = 0;
  private positions = new Map<number, number>();
  constructor(
    private readonly createSession: (player: Player) => PlaybackSession = (player) =>
      ["potplayer", "mpc-hc", "mpc-be"].includes(player.kind)
        ? new WindowsPlayerSession(player)
        : new PlayerSession(player),
  ) {
    super();
  }
  async play(
    client: PlaybackClient,
    intent: PlayIntent,
    player: Player,
    settings: Settings,
  ): Promise<void> {
    const key = JSON.stringify({ base: client.identity, ...intent });
    if (key === this.lastIntent && Date.now() - this.lastIntentAt < 1_500) return;
    this.lastIntent = key;
    this.lastIntentAt = Date.now();
    const stopping = this.stop(false);
    const generation = this.generation;
    this.state = { ...idlePlayback, status: "preparing", playerName: player.name };
    this.publish();
    try {
      await stopping;
      if (generation !== this.generation) return;
      this.client = client;
      let items = await client.resolveQueue(intent);
      if (!settings.autoNext) items = items.slice(0, 1);
      const prepared = [await client.prepare(items[0], intent)];
      if (generation !== this.generation) return;
      this.media = prepared;
      this.state.queue = prepared.map((media) => ({ id: media.item.id, title: title(media) }));
      this.lastSync = 0;
      this.current = -1;
      this.positions.clear();
      const session = (this.player = this.createSession(player));
      session.on("diagnostic", (message: string) => this.emit("diagnostic", redact(message)));
      session.on("snapshot", (snapshot: PlayerSnapshot) => {
        if (generation === this.generation) this.onSnapshot(snapshot);
      });
      session.on("stopped", () => {
        if (generation === this.generation) {
          this.reportStop();
          if (this.state.status !== "error") this.state.status = "idle";
          this.publish();
        }
      });
      session.on("loading", () => {
        if (generation === this.generation) {
          this.reportStop();
          this.state.status = "preparing";
          this.publish();
        }
      });
      session.on("media-error", (message: string) => {
        if (generation === this.generation) {
          this.state.error = message;
          this.state.status = "error";
          this.publish();
        }
      });
      await session.start([...prepared], settings.fullscreen, items.length > 1);
      for (const item of items.slice(1)) {
        if (generation !== this.generation) return;
        try {
          const next = await client.prepare(
            item,
            { itemIds: [item.id], startTicks: 0 },
            prepared[0].source,
            prepared[0],
          );
          if (generation !== this.generation) return;
          prepared.push(next);
          try {
            await session.enqueue(next);
          } catch (error) {
            prepared.pop();
            throw error;
          }
          this.state.queue = prepared.map((media) => ({ id: media.item.id, title: title(media) }));
          this.publish();
        } catch {
          if (generation !== this.generation) return;
          this.state.error = errorToken("skipItem", { name: item.title });
          this.publish();
        }
      }
      session.completeQueue();
    } catch (error) {
      if (generation === this.generation) {
        await this.player?.stop();
        this.state.status = "error";
        this.state.error = error instanceof Error ? error.message : errorToken("playbackFailed");
        this.publish();
      }
    }
  }
  private onSnapshot(snapshot: PlayerSnapshot): void {
    if (
      !this.media[snapshot.index] ||
      !Number.isFinite(snapshot.position) ||
      !(snapshot.duration > 0)
    )
      return;
    const changed = snapshot.index !== this.current;
    const pausedChanged = (this.state.status === "paused") !== snapshot.paused;
    const sought = !changed && Math.abs(snapshot.position - this.state.position) > 3;
    if (changed) {
      this.reportStop();
      this.current = snapshot.index;
      this.report(this.media[this.current], "start", snapshot.position, snapshot.paused);
      this.lastSync = Date.now();
    }
    this.positions.set(snapshot.index, snapshot.position);
    this.state = {
      ...this.state,
      status: snapshot.paused ? "paused" : "playing",
      title: title(this.media[snapshot.index]),
      position: snapshot.position,
      duration: snapshot.duration,
      index: snapshot.index,
    };
    if (!changed && (pausedChanged || sought || Date.now() - this.lastSync >= 10_000)) {
      this.lastSync = Date.now();
      this.report(this.media[this.current], "progress", snapshot.position, snapshot.paused);
    }
    this.publish();
  }
  private report(
    media: PreparedMedia,
    event: "start" | "progress" | "stop",
    position: number,
    paused = false,
    client = this.client,
    generation = this.generation,
  ): void {
    if (!client) return;
    this.reports = this.reports
      .catch(() => {})
      .then(async () => {
        if (generation === this.generation) {
          this.state.sync = { status: "pending", event };
          this.publish();
        }
        let failure = "";
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const record = await client.report(media, event, position, paused);
            if (generation === this.generation) {
              this.state.syncError = undefined;
              this.state.sync = {
                status: "success",
                event,
                time: new Date().toISOString(),
                record: record || undefined,
              };
              this.publish();
            }
            this.emit("report", { event, status: "success" });
            return;
          } catch (error) {
            failure = redact(error instanceof Error ? error.message : error);
            if (attempt < 2)
              await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
          }
        }
        if (generation === this.generation) {
          this.state.syncError = errorToken("syncFailed");
          this.state.sync = {
            status: "error",
            event,
            time: new Date().toISOString(),
            error: failure,
          };
          this.publish();
        }
        this.emit("report", { event, status: "error", error: failure });
      });
  }
  private reportStop(): void {
    if (this.current < 0 || !this.media[this.current]) return;
    this.report(
      this.media[this.current],
      "stop",
      this.positions.get(this.current) ?? this.state.position,
    );
    this.current = -1;
  }
  async control(control: PlaybackControl): Promise<void> {
    if (
      control.action === "jump" &&
      (!Number.isInteger(control.index) || control.index < 0 || control.index >= this.media.length)
    )
      throw new UserFacingError("itemMissing");
    if (control.action === "seek" && (!Number.isFinite(control.seconds) || control.seconds < 0))
      throw new UserFacingError("positionInvalid");
    if (control.action === "stop") await this.stop();
    else await this.player?.control(control);
  }
  async stop(publishIdle = true): Promise<void> {
    const generation = ++this.generation;
    const player = this.player;
    const client = this.client;
    const media = this.media[this.current];
    const index = this.current;
    const position = this.positions.get(index) ?? this.state.position;
    this.current = -1;
    this.player = undefined;
    await player?.stop();
    if (media)
      this.report(
        media,
        "stop",
        player?.snapshot?.index === index ? player.snapshot.position : position,
        false,
        client,
        publishIdle ? generation : generation - 1,
      );
    if (publishIdle && generation === this.generation) {
      this.state.status = "idle";
      this.publish();
    }
  }
  async flush(): Promise<void> {
    await this.stop();
    await this.reports;
  }
  private publish(): void {
    this.emit("state", this.state);
  }
}
