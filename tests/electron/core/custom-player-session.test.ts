import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlayerSession } from "../../../electron/core/player-session";
import { MpvIPC } from "../../../electron/core/mpv-ipc";
import type { Player, PreparedMedia } from "../../../src/shared/types";

vi.mock("node:child_process", () => ({ spawn: vi.fn(), execFile: vi.fn() }));
vi.mock("../../../electron/core/player-focus", () => ({
  activatePlayer: vi.fn(),
  iinaProcessId: vi.fn(),
}));
vi.mock("../../../electron/core/mpv-ipc", () => ({
  MpvIPC: class extends EventEmitter {
    open = vi.fn(async () => {});
    close = vi.fn();
    command = vi.fn(async (command: unknown[]) => {
      if (command[0] !== "get_property") return;
      return (
        {
          "mpv-version": "mpv 0.40.0",
          "playlist-pos": 0,
          "time-pos": 150,
          duration: 600,
          pause: false,
          "idle-active": false,
        } as Record<string, unknown>
      )[String(command[1])];
    });
  },
}));
const player: Player = {
  id: "custom",
  name: "mpv profile",
  kind: "custom",
  executable: "/custom/launcher",
  prefixArgs: [],
  arguments: ["--profile=high-quality", "{url}"],
  mpvIpc: true,
};
const media: PreparedMedia = {
  item: { id: "movie", title: "Movie" },
  source: { id: "source" },
  url: "http://localhost/media/movie",
  playSessionId: "session",
  headers: {},
  startSeconds: 150,
  audioId: 2,
  subtitleId: "no",
};
let child: EventEmitter & { kill: ReturnType<typeof vi.fn> };
let session: PlayerSession;
beforeEach(() => {
  child = Object.assign(new EventEmitter(), { kill: vi.fn() });
  vi.mocked(spawn)
    .mockReset()
    .mockReturnValue(child as unknown as ReturnType<typeof spawn>);
  session = new PlayerSession(player);
});
afterEach(async () => session.stop());
it("launches with managed options and the custom template, then follows IPC after the launcher exits", async () => {
  const stopped = vi.fn();
  const snapshot = vi.fn();
  session.on("stopped", stopped).on("snapshot", snapshot);
  await session.start([media], false);
  const args = vi.mocked(spawn).mock.calls[0][1] as string[];
  expect(args).toContainEqual(expect.stringMatching(/^--input-ipc-server=.+/));
  expect(args).toEqual(
    expect.arrayContaining([
      "--start=150",
      "--aid=2",
      "--sid=no",
      "--profile=high-quality",
      media.url,
    ]),
  );
  expect(args.at(-1)).toBe(media.url);
  expect(spawn).toHaveBeenCalledWith(player.executable, args, {
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  child.emit("exit", 0);
  expect(stopped).not.toHaveBeenCalled();
  expect(snapshot).toHaveBeenCalledWith({ index: 0, position: 150, duration: 600, paused: false });
  await session.enqueue({ ...media, url: "http://localhost/next", startSeconds: 0 });
  await session.control({ action: "seek", seconds: 200 });
  // The actual IPC transport is already covered separately; assert queue and
  // control commands reach the same connection used at startup.
  const ipc = (session as unknown as { ipc: MpvIPC }).ipc;
  const command = vi.spyOn(ipc, "command");
  expect(command).toHaveBeenCalledWith([
    "loadfile",
    "http://localhost/next",
    "append-play",
    -1,
    expect.objectContaining({ start: "0", aid: "2", sid: "no" }),
  ]);
  expect(command).toHaveBeenCalledWith(["seek", 200, "absolute"]);
  ipc.emit("disconnected");
  expect(stopped).toHaveBeenCalledOnce();
});
it("rejects a conflicting IPC endpoint before starting the process", async () => {
  session = new PlayerSession({ ...player, arguments: ["--input-ipc-server=/tmp/other", "{url}"] });
  await expect(session.start([media], false)).rejects.toThrow("playerMpvArgumentsConflict");
  expect(spawn).not.toHaveBeenCalled();
});
