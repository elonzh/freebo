import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlaybackManager } from "../electron/core/playback-manager";
import type { PlaybackClient } from "../electron/providers/types";
import { PlayerSession } from "../electron/core/player-session";
import type { PreparedMedia, Settings, Player } from "../src/shared/types";
const player: Player = {
  id: "mpv",
  kind: "mpv",
  name: "mpv",
  executable: "/test/mpv",
  prefixArgs: [],
};
const settings: Settings = {
  servers: [],
  players: [player],
  autoNext: true,
  fullscreen: false,
  theme: "system",
  language: "system",
  setupCompleted: true,
  playerScanCompleted: true,
};
const media = (id: string): PreparedMedia => ({
  item: { id, title: id },
  source: { id },
  playSessionId: id,
  url: `https://example.test/${id}`,
  headers: {},
  startSeconds: 0,
});
class FakeSession extends EventEmitter {
  snapshot = { index: 0, position: 0, duration: 0, paused: false };
  constructor() {
    super();
    this.on("snapshot", (snapshot) => {
      this.snapshot = snapshot;
    });
  }
  start = vi.fn(async () => {});
  enqueue = vi.fn(async () => {});
  completeQueue = vi.fn();
  control = vi.fn(async () => {});
  stop = vi.fn(async () => {});
}
const setup = () => {
  const session = new FakeSession();
  const manager = new PlaybackManager(() => session as unknown as PlayerSession);
  const client: PlaybackClient = {
    identity: "test:account",
    resolveQueue: async () => [],
    prepare: async (item) => media(item.id),
    report: async () => {},
  };
  vi.spyOn(client, "resolveQueue").mockResolvedValue([media("a").item, media("b").item]);
  const prepare = vi.spyOn(client, "prepare").mockImplementation(async (item) => media(item.id));
  const report = vi.spyOn(client, "report").mockResolvedValue();
  return { session, manager, client, report, prepare };
};
describe("playback lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  it("publishes the server's saved watch record after the stop report", async () => {
    const { session, manager, client, report } = setup();
    const record = {
      status: "verified",
      position: 0,
      reportedPosition: 42,
      played: false,
      playCount: 1,
      minimumResumeSeconds: 60,
    } as const;
    report.mockImplementation(async (_media, event) => (event === "stop" ? record : undefined));
    await manager.play(client, { itemIds: ["a"] }, player, settings);
    session.emit("snapshot", { index: 0, position: 42, duration: 2000, paused: false });
    await manager.flush();
    expect(manager.state.sync).toMatchObject({ status: "success", event: "stop", record });
  });
  it("starts the first video before the next PlaybackInfo returns", async () => {
    const { session, manager, client, prepare } = setup();
    let release!: (value: PreparedMedia) => void;
    prepare.mockImplementation(async (item) =>
      item.id === "a"
        ? media("a")
        : new Promise((resolve) => {
            release = resolve;
          }),
    );
    const playing = manager.play(client, { itemIds: ["a", "b"] }, player, settings);
    await vi.waitFor(() => expect(session.start).toHaveBeenCalled());
    expect(session.enqueue).not.toHaveBeenCalled();
    release(media("b"));
    await playing;
    expect(session.enqueue).toHaveBeenCalledWith(media("b"));
    expect(session.completeQueue).toHaveBeenCalled();
  });
  it("reports the departing item before starting the next and preserves each position", async () => {
    const { session, manager, client, report } = setup();
    await manager.play(client, { itemIds: ["a", "b"] }, player, settings);
    session.emit("snapshot", { index: 0, position: 42, duration: 100, paused: false });
    session.emit("snapshot", { index: 1, position: 3, duration: 200, paused: false });
    await manager.flush();
    expect(report.mock.calls.map(([m, e, p]) => [m.item.id, e, p])).toEqual([
      ["a", "start", 42],
      ["a", "stop", 42],
      ["b", "start", 3],
      ["b", "stop", 3],
    ]);
  });
  it("cannot launch a cancelled preparation or send an invalid queue control", async () => {
    const { session, manager, client, prepare } = setup();
    let release!: (value: PreparedMedia) => void;
    prepare.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const playing = manager.play(client, { itemIds: ["a"] }, player, settings);
    await vi.waitFor(() => expect(prepare).toHaveBeenCalled());
    await manager.stop();
    release(media("a"));
    await playing;
    expect(session.start).not.toHaveBeenCalled();
    await expect(manager.control({ action: "jump", index: 99 })).rejects.toThrow("itemMissing");
  });
  it("publishes preparation before waiting for the previous player to stop", async () => {
    const { manager, session, client } = setup();
    await manager.play(client, { itemIds: ["a"] }, player, settings);
    let finish!: () => void;
    session.stop.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const next = manager.play(client, { itemIds: ["b"] }, player, settings);
    expect(manager.state.status).toBe("preparing");
    finish();
    await next;
  });
  it("does not report a start for an unloaded video and sends pause and seek changes immediately", async () => {
    const { manager, session, client, report } = setup();
    await manager.play(client, { itemIds: ["a"] }, player, settings);
    session.emit("snapshot", { index: 0, position: 0, duration: 0, paused: false });
    expect(manager.state.status).toBe("preparing");
    expect(report).not.toHaveBeenCalled();
    session.emit("snapshot", { index: 0, position: 42, duration: 200, paused: false });
    session.emit("snapshot", { index: 0, position: 43, duration: 200, paused: true });
    session.emit("snapshot", { index: 0, position: 100, duration: 200, paused: true });
    session.stop.mockImplementation(async () => {
      session.snapshot.position = 101;
    });
    await manager.flush();
    expect(
      report.mock.calls.map(([, event, position, paused]) => [event, position, paused]),
    ).toEqual([
      ["start", 42, false],
      ["progress", 43, true],
      ["progress", 100, true],
      ["stop", 101, false],
    ]);
    expect(manager.state.sync).toMatchObject({ status: "success", event: "stop" });
  });
  it("retains a redacted failure after retries for diagnostics", async () => {
    vi.useFakeTimers();
    const { manager, session, client, report } = setup();
    report.mockRejectedValue(new Error("Authorization: secret"));
    await manager.play(client, { itemIds: ["a"] }, player, settings);
    session.emit("snapshot", { index: 0, position: 1, duration: 100, paused: false });
    await vi.advanceTimersByTimeAsync(3_100);
    expect(report).toHaveBeenCalledTimes(3);
    expect(manager.state.sync).toMatchObject({
      status: "error",
      event: "start",
      error: "Authorization: [redacted]",
    });
    expect(manager.state.syncError).toContain("syncFailed");
  });
  it("keeps stale reports from overwriting a replacement session's diagnostics", async () => {
    vi.useFakeTimers();
    const { manager, session, client, report } = setup();
    report.mockRejectedValue(new Error("old server failure"));
    await manager.play(client, { itemIds: ["a"] }, player, settings);
    session.emit("snapshot", { index: 0, position: 1, duration: 100, paused: false });
    await Promise.resolve();
    await manager.play(
      { ...client, identity: "other", report: async () => {} },
      { itemIds: ["b"] },
      player,
      settings,
    );
    const failures: unknown[] = [];
    manager.on("state", () => {
      if (manager.state.syncError) failures.push(manager.state.syncError);
    });
    session.emit("snapshot", { index: 0, position: 2, duration: 100, paused: false });
    await vi.advanceTimersByTimeAsync(6_100);
    expect(failures).toEqual([]);
    expect(manager.state.sync).toMatchObject({ status: "success", event: "start" });
  });
});
