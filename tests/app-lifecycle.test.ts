import { describe, expect, it, vi } from "vitest";
import { AppLifecycle } from "../electron/core/app-lifecycle";

describe("background and shutdown lifecycle", () => {
  it("keeps playback alive on window close, but permits closing without a tray", () => {
    const cleanup = vi.fn(async () => {});
    const lifecycle = new AppLifecycle(cleanup);
    const event = { preventDefault: vi.fn() };
    const hide = vi.fn();
    expect(lifecycle.close(event, true, hide)).toBe(false);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(hide).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
    expect(lifecycle.close(event, false, hide)).toBe(true);
    expect(lifecycle.isQuitting).toBe(false);
  });

  it("flushes once and keeps windows alive until cleanup finishes, including repeated quit requests", async () => {
    let finish!: () => void;
    const cleanup = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const lifecycle = new AppLifecycle(cleanup);
    const quit = vi.fn();
    const event = { preventDefault: vi.fn() };
    lifecycle.beforeQuit(event, quit);
    lifecycle.beforeQuit(event, quit);
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(lifecycle.close(event, true, vi.fn())).toBe(false);
    expect(quit).not.toHaveBeenCalled();
    finish();
    await lifecycle.prepareToQuit();
    await Promise.resolve();
    expect(quit).toHaveBeenCalledOnce();
    expect(lifecycle.close(event, true, vi.fn())).toBe(true);
    lifecycle.beforeQuit(event, quit);
    expect(event.preventDefault).toHaveBeenCalledTimes(3);
  });

  it("lets updater window closure bypass the tray after preparing shutdown", async () => {
    const cleanup = vi.fn(async () => {});
    const lifecycle = new AppLifecycle(cleanup);
    await lifecycle.prepareToQuit();
    const event = { preventDefault: vi.fn() };
    expect(lifecycle.close(event, true, vi.fn())).toBe(true);
    lifecycle.beforeQuit(event, vi.fn());
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("restores background closing and fresh shutdown after a failed update", async () => {
    const cleanup = vi.fn(async () => {});
    const lifecycle = new AppLifecycle(cleanup);
    await lifecycle.prepareToQuit();
    lifecycle.resumeAfterFailedUpdate();
    expect(lifecycle.isQuitting).toBe(false);
    const event = { preventDefault: vi.fn() };
    expect(lifecycle.close(event, true, vi.fn())).toBe(false);
    await lifecycle.prepareToQuit();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
});
