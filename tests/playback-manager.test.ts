import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
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
      ["a", "progress", 42],
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
});
