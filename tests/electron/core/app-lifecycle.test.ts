import { describe, expect, it, vi } from "vitest";
import { AppLifecycle } from "../../../electron/core/app-lifecycle";

describe("background and shutdown lifecycle", () => {
  it("keeps playback alive on window close when background running is available", () => {
    const cleanup = vi.fn(async () => {});
    const lifecycle = new AppLifecycle(cleanup);
    const event = { preventDefault: vi.fn() };
    const hide = vi.fn();
    const quit = vi.fn();
    expect(lifecycle.close(event, true, hide, quit)).toBe(false);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(hide).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
    expect(quit).not.toHaveBeenCalled();
    expect(lifecycle.isQuitting).toBe(false);
  });

  it("requests a clean quit when background running is disabled or the tray is unavailable", async () => {
    let finish!: () => void;
    const cleanup = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const lifecycle = new AppLifecycle(cleanup);
    const event = { preventDefault: vi.fn() };
    const hide = vi.fn();
    const resumeQuit = vi.fn();
    const quit = vi.fn(() => lifecycle.beforeQuit(event, resumeQuit));
    expect(lifecycle.close(event, false, hide, quit)).toBe(false);
    expect(lifecycle.isQuitting).toBe(true);
    expect(quit).toHaveBeenCalledOnce();
    expect(hide).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(lifecycle.close(event, false, hide, quit)).toBe(false);
    expect(quit).toHaveBeenCalledOnce();
    expect(resumeQuit).not.toHaveBeenCalled();
    finish();
    await lifecycle.prepareToQuit();
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(resumeQuit).toHaveBeenCalledOnce();
    expect(lifecycle.close(event, false, hide, quit)).toBe(true);
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
    expect(lifecycle.close(event, true, vi.fn(), quit)).toBe(false);
    expect(quit).not.toHaveBeenCalled();
    finish();
    await lifecycle.prepareToQuit();
    await Promise.resolve();
    expect(quit).toHaveBeenCalledOnce();
    expect(lifecycle.close(event, true, vi.fn(), quit)).toBe(true);
    lifecycle.beforeQuit(event, quit);
    expect(event.preventDefault).toHaveBeenCalledTimes(3);
  });

  it("lets updater window closure bypass the tray after preparing shutdown", async () => {
    const cleanup = vi.fn(async () => {});
    const lifecycle = new AppLifecycle(cleanup);
    await lifecycle.prepareToQuit();
    const event = { preventDefault: vi.fn() };
    expect(lifecycle.close(event, true, vi.fn(), vi.fn())).toBe(true);
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
    expect(lifecycle.close(event, true, vi.fn(), vi.fn())).toBe(false);
    await lifecycle.prepareToQuit();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
});
