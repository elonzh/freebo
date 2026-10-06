import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Player, PreparedMedia } from "../src/shared/types";
import type { NativeBridge, NativeStatus } from "../electron/core/windows-native";
import { WindowsPlayerSession, windowsPlayerArgs } from "../electron/core/windows-player-session";
import type { spawn } from "node:child_process";
const player: Player = {
  id: "hc",
  name: "MPC-HC",
  kind: "mpc-hc",
  executable: "C:\\Players\\mpc-hc64.exe",
  prefixArgs: [],
};
const media = (id: string): PreparedMedia => ({
  item: { id, title: id },
  source: { id },
  playSessionId: id,
  url: `http://127.0.0.1:1234/${id}`,
  headers: {},
  startSeconds: 42.5,
});
function setup(kind = player.kind) {
  let status: NativeStatus = {
    loaded: false,
    position: 0,
    duration: 0,
    paused: false,
    ended: false,
  };
  const bridge: NativeBridge = {
    open: vi.fn(async () => "123456"),
    request: vi.fn(async (action: string) =>
      action.endsWith("status") ? { ...status } : true,
    ) as NativeBridge["request"],
    close: vi.fn(),
  };
  const children: (EventEmitter & { pid: number; kill: ReturnType<typeof vi.fn> })[] = [];
  const launch = vi.fn(() => {
    const child = Object.assign(new EventEmitter(), { pid: 456 + children.length, kill: vi.fn() });
    children.push(child);
    return child;
  });
  const session = new WindowsPlayerSession(
    { ...player, kind },
    bridge,
    launch as unknown as typeof spawn,
  );
  return {
    session,
    bridge,
    launch,
    children,
    status: (next: Partial<NativeStatus>) => {
      status = { ...status, ...next };
    },
  };
}
describe("Windows native player lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  it("launches dedicated instances with resume times and Unicode-safe arguments", () => {
    const item = { ...media("中文 & $(test)"), subtitleUrl: "http://127.0.0.1/sub?x=1&y=2" };
    expect(windowsPlayerArgs(player, item, true, "123456")).toEqual([
      item.url,
      "/new",
      "/slave",
      "123456",
      "/play",
      "/start",
      "42500",
      "/sub",
      item.subtitleUrl,
      "/fullscreen",
    ]);
    expect(windowsPlayerArgs({ ...player, kind: "potplayer" }, item, false, "123")).toContain(
      "/seek=00:00:42",
    );
    expect(windowsPlayerArgs({ ...player, kind: "potplayer" }, item, false, "123")).toContain(
      `/title=${item.item.title}`,
    );
  });
  it.each(["mpc-hc", "mpc-be", "potplayer"] as const)(
    "waits for %s media and reads the final position before stop",
    async (kind) => {
      vi.useFakeTimers();
      const { session, bridge, launch, status } = setup(kind);
      const snapshots = vi.fn();
      session.on("snapshot", snapshots);
      await session.start([media("a")], false);
      expect(launch.mock.calls[0]).toBeDefined();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(snapshots).not.toHaveBeenCalled();
      status({ loaded: true, position: 43, duration: 100 });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(session.snapshot).toMatchObject({ index: 0, position: 43, duration: 100 });
      expect(bridge.request).toHaveBeenCalledWith("activate");
      await session.control({ action: "seek", seconds: 70 });
      expect(bridge.request).toHaveBeenCalledWith(kind === "potplayer" ? "pot-seek" : "mpc-seek", {
        value: kind === "potplayer" ? 70_000 : 70,
      });
      status({ position: 71 });
      await session.stop();
      expect(session.snapshot.position).toBe(71);
      expect(bridge.close).toHaveBeenCalled();
    },
  );
  it("waits for a late queue item after EOF and ignores the replaced process exit", async () => {
    vi.useFakeTimers();
    const { session, children, status, launch } = setup();
    await session.start([media("a")], false, true);
    status({ loaded: true, duration: 100, position: 99 });
    await vi.advanceTimersByTimeAsync(1_000);
    status({ ended: true, position: 100 });
    await vi.advanceTimersByTimeAsync(1_000);
    await session.enqueue(media("b"));
    expect(launch).toHaveBeenCalledTimes(2);
    children[0].emit("exit", 0);
    status({ ended: false, loaded: true, duration: 200, position: 43 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(session.snapshot).toMatchObject({ index: 1, position: 43, duration: 200 });
    session.completeQueue();
    await session.stop();
  });
  it.each(["mpc-hc", "mpc-be", "potplayer"] as const)(
    "preserves %s progress when its own stop button resets the clock",
    async (kind) => {
      vi.useFakeTimers();
      const { session, status, launch } = setup(kind);
      const stopped = vi.fn();
      session.on("stopped", stopped);
      await session.start([media("a"), media("b")], false);
      status({ loaded: true, duration: 100, position: 42 });
      await vi.advanceTimersByTimeAsync(1_000);
      status({ position: 0, stopped: true });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(stopped).toHaveBeenCalledWith(expect.objectContaining({ position: 42 }));
      expect(launch).toHaveBeenCalledTimes(1);
    },
  );
  it("cancels native startup before it can launch a player", async () => {
    const { session, bridge, launch } = setup();
    let ready!: (handle: string) => void;
    vi.mocked(bridge.open).mockImplementation(
      () =>
        new Promise((resolve) => {
          ready = resolve;
        }),
    );
    const starting = session.start([media("a")], false);
    await session.stop();
    ready("123");
    await starting;
    expect(launch).not.toHaveBeenCalled();
  });
  it("reports native startup failures with a recoverable player message", async () => {
    const { session, bridge, launch } = setup();
    vi.mocked(bridge.open).mockRejectedValue(new Error("PowerShell unavailable"));
    const diagnostic = vi.fn();
    session.on("diagnostic", diagnostic);
    await expect(session.start([media("a")], false)).rejects.toThrow("playerConnection");
    expect(diagnostic).toHaveBeenCalledWith("Windows player bridge: PowerShell unavailable");
    expect(launch).not.toHaveBeenCalled();
    expect(bridge.close).toHaveBeenCalled();
  });
  it("ignores an old status response after switching queue items", async () => {
    vi.useFakeTimers();
    const { session, bridge, status } = setup();
    await session.start([media("a"), media("b")], false);
    let reply!: (value: NativeStatus) => void;
    vi.mocked(bridge.request).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          reply = resolve;
        }),
    );
    const poll = vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(reply).toBeDefined());
    await session.control({ action: "jump", index: 1 });
    reply({ loaded: true, position: 99, duration: 100, paused: false, ended: false });
    await poll;
    expect(session.snapshot).toMatchObject({ index: 1, position: 42.5, duration: 0 });
    status({ loaded: true, position: 44, duration: 200 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(session.snapshot).toMatchObject({ index: 1, position: 44, duration: 200 });
    await session.stop();
  });
});
