import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { launchExternalPlayer } from "../../../electron/core/player-session";
import { PlaybackManager } from "../../../electron/core/playback-manager";
import { defaultSettings } from "../../../electron/core/settings";
import type { Player, PreparedMedia } from "../../../src/shared/types";
import type { PlaybackClient } from "../../../electron/providers/types";

vi.mock("node:child_process", () => ({ spawn: vi.fn(), execFile: vi.fn() }));

const cine: Player = {
  id: "cine",
  kind: "cine",
  name: "Cine",
  executable: "/home/nix/.local/bin/cine",
  prefixArgs: [],
};
const media: PreparedMedia = {
  item: { id: "movie", title: "Movie" },
  source: { id: "source" },
  playSessionId: "session",
  url: "http://127.0.0.1:1234/media/opaque-id",
  headers: {},
  startSeconds: 150,
};
let child: EventEmitter & { unref: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> };

beforeEach(() => {
  child = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() });
  vi.mocked(spawn)
    .mockReset()
    .mockImplementation(() => {
      queueMicrotask(() => child.emit("spawn"));
      return child as unknown as ReturnType<typeof spawn>;
    });
});

it("opens Cine with its new-window option and a single proxy URL, without mpv arguments or a shell", async () => {
  await launchExternalPlayer(cine, media);
  expect(spawn).toHaveBeenCalledExactlyOnceWith(cine.executable, ["--new-window", media.url], {
    shell: false,
    stdio: "ignore",
    detached: true,
  });
  expect(child.unref).toHaveBeenCalledOnce();
  expect(child.kill).not.toHaveBeenCalled();
});

it.each(["cine", "custom"] as const)(
  "hands off only the current video to %s without a controlled session or invented progress",
  async (kind) => {
    const createSession = vi.fn();
    const manager = new PlaybackManager(createSession);
    const prepare = vi.fn(async () => media);
    const report = vi.fn();
    const client: PlaybackClient = {
      identity: "cine-test",
      resolveQueue: vi.fn(async () => [media.item, { id: "next", title: "Next" }]),
      prepare,
      report,
    };
    await manager.play(client, { itemIds: ["movie"] }, { ...cine, kind }, defaultSettings);
    expect(createSession).not.toHaveBeenCalled();
    expect(prepare).toHaveBeenCalledOnce();
    expect(manager.state).toMatchObject({
      status: "external",
      title: "Movie",
      position: 0,
      duration: 0,
      queue: [{ id: "movie", title: "Movie" }],
    });
    expect(manager.state.sync).toBeUndefined();
    await manager.flush();
    expect(report).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  },
);

it("surfaces a missing executable as a launch failure", async () => {
  vi.mocked(spawn).mockImplementation(() => {
    queueMicrotask(() => child.emit("error", new Error("ENOENT")));
    return child as unknown as ReturnType<typeof spawn>;
  });
  await expect(launchExternalPlayer(cine, media)).rejects.toThrow("playerStartFailed");
  expect(child.unref).not.toHaveBeenCalled();
});

it("substitutes custom arguments once and preserves spaces and shell characters as literal arguments", async () => {
  const player: Player = {
    ...cine,
    kind: "custom",
    executable: "/Player Folder/custom",
    arguments: ["--title={title}", "{url}", "--start={start}"],
  };
  const prepared = { ...media, item: { ...media.item, title: "A title; $(touch bad) {url}" } };
  await launchExternalPlayer(player, prepared);
  expect(spawn).toHaveBeenCalledExactlyOnceWith(
    player.executable,
    ["--title=A title; $(touch bad) {url}", media.url, "--start=150"],
    { shell: false, stdio: "ignore", detached: true },
  );
});

it("rejects a template that cannot pass the media URL before launching a process", async () => {
  await expect(
    launchExternalPlayer({ ...cine, kind: "custom", arguments: ["--fullscreen"] }, media),
  ).rejects.toThrow("playerUrlRequired");
  expect(spawn).not.toHaveBeenCalled();
});
