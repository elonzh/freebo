import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { UpdateManager, updateDisabledReason, type UpdateBackend } from "../electron/core/updates";

function fixture() {
  const backend = Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    allowPrerelease: true,
    allowDowngrade: true,
    disableWebInstaller: false,
    logger: undefined,
    checkForUpdates: vi.fn(async () => null),
    quitAndInstall: vi.fn(),
  });
  const log = vi.fn();
  const manager = new UpdateManager(backend as unknown as UpdateBackend, undefined, log);
  return { backend, manager, log };
}
describe("automatic updates", () => {
  it("downloads automatically without installing on quit, publishes progress and defers install until shutdown finishes", async () => {
    const { backend, manager } = fixture();
    expect(backend).toMatchObject({
      autoDownload: true,
      autoInstallOnAppQuit: false,
      allowPrerelease: false,
      allowDowngrade: false,
      disableWebInstaller: true,
    });
    backend.emit("update-available", { version: "1.1.0" });
    backend.emit("download-progress", { percent: 42.8 });
    expect(manager.state).toEqual({ status: "downloading", version: "1.1.0", percent: 43 });
    await manager.install(vi.fn());
    expect(backend.quitAndInstall).not.toHaveBeenCalled();
    backend.emit("update-downloaded", { version: "1.1.0" });
    const checkCount = backend.checkForUpdates.mock.calls.length;
    await manager.check();
    expect(backend.checkForUpdates).toHaveBeenCalledTimes(checkCount);
    let finish!: () => void;
    const cleanup = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = manager.install(cleanup);
    const second = manager.install(cleanup);
    expect(first).toBe(second);
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(backend.quitAndInstall).not.toHaveBeenCalled();
    finish();
    await first;
    expect(backend.quitAndInstall).toHaveBeenCalledExactlyOnceWith(false, true);
  });

  it("deduplicates checks and handles network failures without returning raw details to the UI", async () => {
    const { backend, manager } = fixture();
    let fail!: (error: Error) => void;
    backend.checkForUpdates.mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const first = manager.check();
    const second = manager.check();
    expect(first).toBe(second);
    await Promise.resolve();
    fail(new Error("https://example.test?token=secret"));
    await first;
    expect(manager.state).toEqual({ status: "error" });
    backend.checkForUpdates.mockResolvedValue(null);
    await manager.check();
    expect(backend.checkForUpdates).toHaveBeenCalledTimes(2);
    backend.emit("update-not-available", { version: "1.0.0" });
    expect(manager.state.status).toBe("up-to-date");
  });

  it("catches an auto-download rejection even when no error event is emitted", async () => {
    const { backend, manager } = fixture();
    backend.checkForUpdates.mockImplementation(async () => {
      backend.emit("update-available", { version: "1.1.0" });
      return { downloadPromise: Promise.reject(new Error("connection lost")) } as any;
    });
    await expect(manager.check()).resolves.toBeUndefined();
    expect(manager.state.status).toBe("error");
  });

  it("does not contact an update server from development or unsupported packages", async () => {
    const options = {
      packaged: true,
      platform: "darwin" as const,
      macSigned: true,
      portable: false,
      appImage: false,
      deb: false,
    };
    expect(updateDisabledReason({ ...options, packaged: false })).toBe("development");
    expect(updateDisabledReason({ ...options, macSigned: false })).toBe("unsigned-mac");
    expect(updateDisabledReason({ ...options, platform: "win32", portable: true })).toBe(
      "unsupported-package",
    );
    expect(updateDisabledReason({ ...options, platform: "linux" })).toBe("unsupported-package");
    expect(updateDisabledReason({ ...options, platform: "linux", appImage: true })).toBeUndefined();
    expect(updateDisabledReason({ ...options, platform: "linux", deb: true })).toBeUndefined();
    expect(updateDisabledReason(options)).toBeUndefined();
    const { backend } = fixture();
    const manager = new UpdateManager(backend as unknown as UpdateBackend, "development", vi.fn());
    await manager.check();
    await manager.install(vi.fn());
    expect(backend.checkForUpdates).not.toHaveBeenCalled();
    expect(backend.quitAndInstall).not.toHaveBeenCalled();
  });

  it.each(["event", "throw"])(
    "reports a failed installation through %s for application recovery",
    async (mode) => {
      const { backend, manager } = fixture();
      const recover = vi.fn();
      manager.on("install-failed", recover);
      backend.emit("update-downloaded", { version: "1.1.0" });
      backend.quitAndInstall.mockImplementation(() => {
        const error = new Error("installer could not start");
        if (mode === "event") backend.emit("error", error);
        else throw error;
      });
      await manager.install(async () => {});
      expect(manager.state.status).toBe("error");
      expect(recover).toHaveBeenCalledOnce();
    },
  );
});
