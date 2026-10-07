import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { SingleInstance } from "../../../electron/core/single-instance";

function fixture(primary = true) {
  return Object.assign(new EventEmitter(), {
    requestSingleInstanceLock: vi.fn(() => primary),
  });
}

describe("application instance ownership", () => {
  it("acquires the Electron instance lock before listening for activation", () => {
    const app = fixture();
    app.requestSingleInstanceLock.mockImplementation(() => {
      expect(app.listenerCount("activate")).toBe(0);
      expect(app.listenerCount("second-instance")).toBe(0);
      return true;
    });
    const instance = new SingleInstance(app, vi.fn());
    expect(instance.primary).toBe(true);
    expect(app.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(app.listenerCount("activate")).toBe(1);
    expect(app.listenerCount("second-instance")).toBe(1);
  });

  it("does not restore windows when another instance owns the lock", () => {
    const app = fixture(false);
    const restore = vi.fn();
    const instance = new SingleInstance(app, restore);
    expect(instance.primary).toBe(false);
    expect(app.listenerCount("activate")).toBe(0);
    expect(app.listenerCount("second-instance")).toBe(0);
    app.emit("activate");
    app.emit("second-instance");
    instance.windowReady();
    expect(restore).not.toHaveBeenCalled();
  });

  it.each(["activate", "second-instance"])(
    "defers %s during startup and restores once after the renderer is ready",
    (event) => {
      const app = fixture();
      const restore = vi.fn();
      const instance = new SingleInstance(app, restore);
      app.emit(event);
      app.emit(event);
      expect(restore).not.toHaveBeenCalled();
      instance.windowReady();
      expect(restore).toHaveBeenCalledOnce();
      instance.windowReady();
      expect(restore).toHaveBeenCalledOnce();
      app.emit(event);
      expect(restore).toHaveBeenCalledTimes(2);
    },
  );

  it("does not request a restore during an ordinary first launch", () => {
    const restore = vi.fn();
    const instance = new SingleInstance(fixture(), restore);
    instance.windowReady();
    expect(restore).not.toHaveBeenCalled();
  });
});
