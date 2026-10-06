import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import type { AppUpdater } from "electron-updater";
import type { Platform, UpdateState } from "../../src/shared/types";

export type UpdateBackend = Pick<
  AppUpdater,
  | "on"
  | "autoDownload"
  | "autoInstallOnAppQuit"
  | "allowPrerelease"
  | "allowDowngrade"
  | "disableWebInstaller"
  | "logger"
  | "checkForUpdates"
  | "quitAndInstall"
>;

export function updateDisabledReason(options: {
  packaged: boolean;
  platform: Platform;
  portable: boolean;
  appImage: boolean;
  deb: boolean;
  macSigned: boolean;
}): UpdateState["reason"] {
  if (!options.packaged) return "development";
  if (options.platform === "darwin" && !options.macSigned) return "unsigned-mac";
  if (options.platform === "win32" && options.portable) return "unsupported-package";
  if (options.platform === "linux" && !options.appImage && !options.deb)
    return "unsupported-package";
}

export function hasMacUpdateSignature(executable: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      "/usr/bin/codesign",
      ["--display", "--verbose=2", executable],
      { timeout: 5000 },
      (error, _stdout, stderr) =>
        resolve(!error && /^Authority=Developer ID Application:/m.test(stderr)),
    );
  });
}

export class UpdateManager extends EventEmitter {
  state: UpdateState;
  private checking?: Promise<void>;
  private installing?: Promise<void>;

  constructor(
    private readonly updater: UpdateBackend | undefined,
    reason: UpdateState["reason"],
    private readonly log: (message: string) => void,
  ) {
    super();
    this.state = reason ? { status: "disabled", reason } : { status: "idle" };
    if (!updater || reason) return;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.disableWebInstaller = true;
    updater.logger = {
      info: (message) => log(`Update: ${String(message)}`),
      warn: (message) => log(`Update warning: ${String(message)}`),
      error: (message) => log(`Update error: ${String(message)}`),
    };
    updater.on("checking-for-update", () => this.set({ status: "checking" }));
    updater.on("update-not-available", () => this.set({ status: "up-to-date" }));
    updater.on("update-available", (info) =>
      this.set({ status: "downloading", version: info.version, percent: 0 }),
    );
    updater.on("download-progress", (progress) =>
      this.set({
        ...this.state,
        status: "downloading",
        percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
      }),
    );
    updater.on("update-downloaded", (info) =>
      this.set({ status: "downloaded", version: info.version, percent: 100 }),
    );
    updater.on("error", (error) => this.fail(error));
  }

  private set(state: UpdateState) {
    if (
      state.status === this.state.status &&
      state.version === this.state.version &&
      state.percent === this.state.percent &&
      state.reason === this.state.reason
    )
      return;
    this.state = state;
    this.emit("change", state);
  }

  private fail(error: unknown) {
    const installing = this.state.status === "installing";
    this.log(`Update failed: ${String(error)}`);
    this.set({ status: "error" });
    if (installing) this.emit("install-failed");
  }

  check(): Promise<void> {
    if (this.checking) return this.checking;
    if (
      !this.updater ||
      ["disabled", "downloading", "downloaded", "installing"].includes(this.state.status)
    )
      return Promise.resolve();
    this.set({ status: "checking" });
    this.checking = Promise.resolve()
      .then(async () => {
        const result = await this.updater!.checkForUpdates();
        if (result?.downloadPromise) await result.downloadPromise;
      })
      .catch((error) => this.fail(error))
      .finally(() => {
        this.checking = undefined;
      });
    return this.checking;
  }

  install(prepareToQuit: () => Promise<void>): Promise<void> {
    if (this.installing) return this.installing;
    if (!this.updater || this.state.status !== "downloaded") return Promise.resolve();
    this.set({ ...this.state, status: "installing" });
    this.installing = Promise.resolve()
      .then(async () => {
        // quitAndInstall closes windows before before-quit on some platforms.
        await prepareToQuit();
        this.updater!.quitAndInstall(false, true);
      })
      .catch((error) => this.fail(error))
      .finally(() => {
        this.installing = undefined;
      });
    return this.installing;
  }
}
