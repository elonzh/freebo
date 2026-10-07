import {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  dialog,
  shell,
  nativeTheme,
  Menu,
  screen,
  safeStorage,
  clipboard,
  Tray,
  nativeImage,
  Notification,
  type IpcMainInvokeEvent,
} from "electron";
import { join } from "node:path";
import { release } from "node:os";
import { writeFile, access, mkdir } from "node:fs/promises";
import { constants, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  browserUserAgent,
  browserDeviceName,
  browserFetcher,
  guardServerAccess,
} from "./core/browser-http";
import { isLiveWindow, sendWindowState } from "./core/window-lifecycle";
import { SingleInstance } from "./core/single-instance";
import { z } from "zod";
import { SettingsStore } from "./core/settings";
import {
  WindowStateStore,
  defaultWindowSize,
  minimumWindowSize,
  fitWindowBounds,
} from "./core/window-state";
import { discoverPlayers, manualPlayer, playerGuides } from "./core/players";
import { PlaybackManager } from "./core/playback-manager";
import { ProviderRegistry } from "./providers/registry";
import { embyProvider } from "./providers/emby";
import { jellyfinProvider } from "./providers/jellyfin";
import { plexProvider } from "./providers/plex";
import type { PlaybackClient } from "./providers/types";
import {
  translate,
  localizeError,
  resolveLocale,
  UserFacingError,
  errorToken,
  type MessageKey,
} from "../src/shared/i18n";
import { MediaProxy } from "./core/media-proxy";
import type { AppState, AppPage, SettingsPage, Platform, Server } from "../src/shared/types";
import { redact } from "./core/redact";
import { CredentialStore, credentialsSchema, credentialOriginMatches } from "./core/credentials";
import { loadFavicon } from "./core/favicon";
import { diagnosticSnapshot, productLink } from "./core/diagnostics";
import { AppLifecycle } from "./core/app-lifecycle";
import { UpdateManager, hasMacUpdateSignature, updateDisabledReason } from "./core/updates";
import { autoUpdater } from "electron-updater";

app.setName("Freebo");
const userDataPath =
  !app.isPackaged && process.env.FREEBO_USER_DATA_DIR
    ? process.env.FREEBO_USER_DATA_DIR
    : join(app.getPath("appData"), "Freebo");
mkdirSync(userDataPath, { recursive: true });
app.setPath("userData", userDataPath);
const instance = new SingleInstance(app, showMainWindow);
if (!instance.primary) app.quit();
const store = new SettingsStore(join(userDataPath, "settings.json"), (event) => {
  if (event.type === "reset") log(t("settingsReset"));
  else
    log(
      t(event.type === "read-failed" ? "settingsReadFailed" : "settingsResetFailed", {
        reason: event.reason,
      }),
    );
});
const windowStateStore = new WindowStateStore(join(userDataPath, "window-state.json"));
const credentials = new CredentialStore(join(userDataPath, "credentials.json"), {
  available: async () => {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
    // Linux's basic fallback uses a hardcoded key rather than a system secret store.
    return (
      process.platform !== "linux" ||
      (safeStorage.isEncryptionAvailable() &&
        safeStorage.getSelectedStorageBackend() !== "basic_text")
    );
  },
  encrypt: (value) => safeStorage.encryptStringAsync(value),
  decrypt: async (value) => (await safeStorage.decryptStringAsync(value)).result,
});
let credentialsAvailable = false;
const windowIcon = join(
  __dirname,
  process.env.FREEBO_DEV_URL ? "../public/icon.png" : "../dist/icon.png",
);
const providers = new ProviderRegistry([embyProvider, jellyfinProvider, plexProvider]);
const playback = new PlaybackManager();
function locale() {
  return resolveLocale(store.value.language, app.getLocale());
}
function t(key: MessageKey, params?: Record<string, string | number>) {
  return translate(locale(), key, params);
}
const proxy = new MediaProxy();
let window: BrowserWindow;
let guest: WebContentsView | undefined;
let shown = false;
let page: AppPage = "home";
let settingsPage: SettingsPage = "servers";
let playbackPopup: BrowserWindow | undefined;
let serverPopup: BrowserWindow | undefined;
type PopupAnchor = { x: number; y: number; width: number; height: number };
let serverPopupAnchor: PopupAnchor | undefined;
let serverPopupLoading: Promise<void> | undefined;
let playbackPopupLoading: Promise<void> | undefined;
let mainWindowClosing = false;
let tray: Tray | undefined;
let updates: UpdateManager | undefined;
let updateTimer: ReturnType<typeof setInterval> | undefined;
const lifecycle = new AppLifecycle(async () => {
  clearInterval(updateTimer);
  try {
    await playback.flush();
  } catch (error) {
    log(`Playback shutdown failed: ${String(error)}`);
  }
  try {
    await proxy.close();
  } catch (error) {
    log(`Media proxy shutdown failed: ${String(error)}`);
  }
});
const popupReadiness = new Map<number, { promise: Promise<void>; resolve(): void }>();
function waitForPopupRenderer(panel: BrowserWindow): Promise<void> {
  const id = panel.webContents.id;
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  popupReadiness.set(id, { promise, resolve });
  panel.once("closed", () => {
    popupReadiness.get(id)?.resolve();
    popupReadiness.delete(id);
  });
  return promise;
}
let serverPopupBlurTimer: ReturnType<typeof setTimeout> | undefined;
let playbackServer: Server | undefined;
let playbackClient: PlaybackClient | undefined;
let popupAnchor: { x: number; y: number; width: number; height: number } | undefined;
let popupBlurTimer: ReturnType<typeof setTimeout> | undefined;
let errorVisible = false;
let activeServer: Server | undefined;
let webStatus: AppState["webStatus"] = "closed";
let webError: string | undefined;
let adapterStatus: AppState["adapterStatus"];
let bootstrapRetries = 0;
const serverFavicons = new Map<string, { url: string; icon: string }>();
const diagnostics: { time: string; message: string }[] = [];
function log(message: string) {
  diagnostics.push({ time: new Date().toISOString(), message: redact(message) });
  if (diagnostics.length > 200) diagnostics.shift();
}
function getDiagnostics() {
  return diagnosticSnapshot(
    state(),
    {
      arch: process.arch,
      osRelease: release(),
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      node: process.versions.node,
    },
    diagnostics,
  );
}
let stateRevision = 0;
function state(): AppState {
  const contents = guest && !guest.webContents.isDestroyed() ? guest.webContents : undefined;
  return {
    revision: ++stateRevision,
    settings: store.value,
    playback: playback.state,
    platform: process.platform as Platform,
    version: app.getVersion(),
    updates: updates?.state ?? { status: "disabled", reason: "development" },
    webStatus,
    webError,
    credentialsAvailable,
    serverFavicons: Object.fromEntries(
      store.value.servers.flatMap((server) => {
        const saved = serverFavicons.get(server.id);
        return saved?.url === server.url ? [[server.id, saved.icon]] : [];
      }),
    ),
    adapterStatus,
    locale: locale(),
    providers: providers.list(),
    page,
    settingsPage,
    playbackPopupOpen: isLiveWindow(playbackPopup) && playbackPopup.isVisible(),
    serverPopupOpen: isLiveWindow(serverPopup) && serverPopup.isVisible(),
    playbackSource:
      playbackServer && playback.state.queue[playback.state.index]
        ? { serverId: playbackServer.id, itemId: playback.state.queue[playback.state.index].id }
        : undefined,
    browser: {
      url: contents?.getURL() ?? "",
      serverId: activeServer?.id,
      canGoBack: contents?.navigationHistory.canGoBack() ?? false,
      canGoForward: contents?.navigationHistory.canGoForward() ?? false,
    },
    fullscreen: window && !window.isDestroyed() ? window.isFullScreen() : false,
  };
}
function publish() {
  if (mainWindowClosing || !isLiveWindow(window)) return;
  const snapshot = state();
  for (const target of [window, playbackPopup, serverPopup]) sendWindowState(target, snapshot);
}
function layout() {
  if (!guest || !window || window.isDestroyed()) return;
  const [width, height] = window.getContentSize();
  const top = 88 + (webError || errorVisible ? 64 : 0);
  guest.setBounds({
    x: 0,
    y: shown ? top : height,
    width,
    height: Math.max(0, height - top),
  });
}
function own(event: IpcMainInvokeEvent) {
  const contents = [window, playbackPopup, serverPopup].find(
    (target) => isLiveWindow(target) && event.sender === target.webContents,
  )?.webContents;
  if (!contents || event.senderFrame !== contents.mainFrame)
    throw new UserFacingError("invalidOrigin");
}
const idSchema = z.string().min(1).max(200);
const kindSchema = z.enum(["iina", "mpv", "mpvnet", "vlc", "potplayer", "mpc-hc", "mpc-be"]);
const controlSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["pause", "next", "previous", "stop"]) }),
  z.object({ action: z.literal("seek"), seconds: z.number().finite().min(0) }),
  z.object({ action: z.literal("jump"), index: z.number().int().min(0) }),
]);
let scanning: Promise<void> | undefined;
async function scan() {
  if (scanning) return scanning;
  scanning = performScan().finally(() => {
    scanning = undefined;
  });
  return scanning;
}
async function performScan() {
  const players = await discoverPlayers(process.platform as Platform, store.value.players);
  const defaultPlayerId = players.some((p) => p.id === store.value.defaultPlayerId)
    ? store.value.defaultPlayerId
    : players[0]?.id;
  await store.save({ ...store.value, players, defaultPlayerId, playerScanCompleted: true });
  publish();
}
function closeGuest() {
  if (!guest) return;
  const view = guest;
  guest = undefined;
  if (window && !window.isDestroyed()) window.contentView.removeChildView(view);
  if (!view.webContents.isDestroyed()) view.webContents.close();
  activeServer = undefined;
  adapterStatus = undefined;
  bootstrapRetries = 0;
  webStatus = "closed";
}
async function openServer(id: string, destination?: string) {
  hideServerPopup();
  const server = store.value.servers.find((s) => s.id === id);
  if (!server) throw new UserFacingError("serverMissing");
  if (
    activeServer?.id === id &&
    activeServer.url === server.url &&
    activeServer.providerId === server.providerId &&
    guest
  ) {
    shown = true;
    page = "library";
    layout();
    if (destination)
      void guest.webContents.loadURL(destination).catch((error) => log(String(error)));
    publish();
    return;
  }
  const provider = providers.get(server.providerId);
  closeGuest();
  activeServer = server;
  shown = true;
  page = "library";
  webError = undefined;
  webStatus = "loading";
  const ses = session.fromPartition(providers.partition(server));
  // Emby treats Electron as its own desktop client and requests a missing native plugin.
  ses.setUserAgent(browserUserAgent(ses.getUserAgent()));
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  guest = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, provider.preload),
      partition: providers.partition(server),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  const view = guest;
  const faviconFetcher = guardServerAccess(browserFetcher(ses, provider.entryUrl(server)));
  let faviconRevision = 0;
  let faviconKey: string | undefined;
  view.webContents.on("page-favicon-updated", (_event, favicons) => {
    if (guest !== view) return;
    const key = favicons.join("\n");
    if (key === faviconKey) return;
    faviconKey = key;
    const revision = ++faviconRevision;
    void loadFavicon(favicons, faviconFetcher).then((icon) => {
      if (guest !== view || revision !== faviconRevision || view.webContents.isDestroyed()) return;
      if (icon) serverFavicons.set(server.id, { url: server.url, icon });
      else if (!favicons.length) serverFavicons.delete(server.id);
      publish();
    });
  });
  view.webContents.on("console-message", (event) => {
    if (event.level === "error") {
      log(`Emby: ${event.message}`);
      if (process.env.FREEBO_DEV_URL) console.warn(redact(`Emby: ${event.message}`));
    }
  });
  const origin = new URL(server.url).origin;
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") && new URL(url).origin !== origin) void shell.openExternal(url);
    return { action: "deny" };
  });
  const guardNavigation = (event: { preventDefault(): void }, url: string) => {
    if (new URL(url).origin !== origin) {
      event.preventDefault();
      webError = errorToken("externalNavigation");
      layout();
      publish();
    }
  };
  view.webContents.on("will-navigate", guardNavigation);
  view.webContents.on("will-redirect", guardNavigation);
  view.webContents.on("dom-ready", () => {
    if (guest !== view) return;
    if (webStatus !== "error" && !view.webContents.getURL().startsWith("chrome-error:")) {
      layout();
      publish();
    }
    if (provider.adapterScript)
      void view.webContents
        .executeJavaScript(provider.adapterScript)
        .catch((error) => log(String(error)));
  });
  view.webContents.on("did-start-loading", () => {
    if (guest !== view) return;
    webStatus = "loading";
    publish();
  });
  view.webContents.on("did-stop-loading", () => {
    if (guest !== view || webStatus === "error") return;
    webStatus = "ready";
    publish();
  });
  view.webContents.on("did-start-navigation", (event) => {
    if (guest !== view || !event.isMainFrame || event.isSameDocument) return;
    faviconRevision++;
    faviconKey = undefined;
    webStatus = "loading";
    webError = undefined;
    adapterStatus = undefined;
    layout();
    publish();
  });
  view.webContents.on("did-finish-load", () => {
    if (
      guest !== view ||
      webStatus === "error" ||
      view.webContents.getURL().startsWith("chrome-error:")
    )
      return;
    webError = undefined;
    layout();
    publish();
  });
  view.webContents.on("did-fail-load", (_event, code, _description, _url, mainFrame) => {
    if (!mainFrame || code === -3 || guest !== view) return;
    webStatus = "error";
    webError = errorToken("webFailed", { code });
    layout();
    publish();
  });
  view.webContents.on("did-navigate-in-page", publish);
  view.webContents.on("did-navigate", publish);
  view.webContents.on("render-process-gone", () => {
    if (guest !== view) return;
    webStatus = "error";
    webError = errorToken("webFailed", { code: "renderer" });
    layout();
    publish();
  });
  window.contentView.addChildView(view);
  layout();
  await store.save({ ...store.value, activeServerId: id });
  publish();
  void view.webContents
    .loadURL(destination ?? provider.entryUrl(server))
    .catch((error) => log(String(error)));
}

function hidePlaybackPopup() {
  clearTimeout(popupBlurTimer);
  if (isLiveWindow(playbackPopup)) playbackPopup.hide();
  publish();
}
function positionPlaybackPopup() {
  if (!isLiveWindow(playbackPopup) || !popupAnchor || !isLiveWindow(window)) return;
  const bounds = window.getContentBounds();
  const area = screen.getDisplayMatching(window.getBounds()).workArea;
  const width = Math.min(420, area.width - 24);
  const height = Math.min(640, Math.max(320, bounds.height - 104), area.height - 24);
  playbackPopup.setBounds({
    width,
    height,
    x: Math.max(
      area.x + 12,
      Math.min(
        bounds.x + popupAnchor.x + popupAnchor.width - width,
        area.x + area.width - width - 12,
      ),
    ),
    y: Math.max(
      area.y + 12,
      Math.min(
        bounds.y + popupAnchor.y + popupAnchor.height + 8,
        area.y + area.height - height - 12,
      ),
    ),
  });
}
async function togglePlaybackPopup(anchor: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  if (mainWindowClosing || !isLiveWindow(window)) return;
  hideServerPopup();
  clearTimeout(popupBlurTimer);
  if (playbackPopup?.isVisible()) {
    hidePlaybackPopup();
    return;
  }
  popupAnchor = anchor;
  if (!playbackPopup || playbackPopup.isDestroyed()) {
    const panel = (playbackPopup = new BrowserWindow({
      parent: window,
      width: 420,
      height: 640,
      frame: false,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? "#17231f" : "#fbfcf9",
      webPreferences: {
        preload: join(__dirname, "preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    }));
    panel.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    panel.webContents.on("will-navigate", (event) => event.preventDefault());
    panel.on("blur", () => {
      popupBlurTimer = setTimeout(hidePlaybackPopup, 150);
    });
    panel.on("closed", () => {
      playbackPopup = undefined;
      publish();
    });
    const ready = waitForPopupRenderer(panel);
    if (process.env.FREEBO_DEV_URL) {
      const url = new URL(process.env.FREEBO_DEV_URL);
      url.searchParams.set("surface", "playback");
      playbackPopupLoading = Promise.all([panel.loadURL(url.toString()), ready]).then(() => {});
    } else
      playbackPopupLoading = Promise.all([
        panel.loadFile(join(__dirname, "../dist/index.html"), {
          query: { surface: "playback" },
        }),
        ready,
      ]).then(() => {});
  }
  await playbackPopupLoading;
  if (mainWindowClosing || !isLiveWindow(window) || !isLiveWindow(playbackPopup)) return;
  positionPlaybackPopup();
  playbackPopup.show();
  publish();
}

function hideServerPopup() {
  clearTimeout(serverPopupBlurTimer);
  serverPopupAnchor = undefined;
  if (isLiveWindow(serverPopup)) serverPopup.hide();
  publish();
}
function positionServerPopup() {
  if (!isLiveWindow(serverPopup) || !serverPopupAnchor || !isLiveWindow(window)) return;
  const bounds = window.getContentBounds();
  const area = screen.getDisplayMatching(window.getBounds()).workArea;
  const width = Math.min(360, area.width - 24);
  const height = Math.min(
    496,
    Math.max(160, 101 + store.value.servers.length * 64),
    bounds.height - 64,
    area.height - 24,
  );
  serverPopup.setBounds({
    width,
    height,
    x: Math.max(
      area.x + 12,
      Math.min(bounds.x + serverPopupAnchor.x, area.x + area.width - width - 12),
    ),
    y: Math.max(
      area.y + 12,
      Math.min(
        bounds.y + serverPopupAnchor.y + serverPopupAnchor.height + 6,
        area.y + area.height - height - 12,
      ),
    ),
  });
}
async function toggleServerPopup(anchor: PopupAnchor) {
  if (mainWindowClosing || !isLiveWindow(window)) return;
  clearTimeout(serverPopupBlurTimer);
  if (serverPopupAnchor) {
    hideServerPopup();
    return;
  }
  hidePlaybackPopup();
  serverPopupAnchor = anchor;
  if (!serverPopup || serverPopup.isDestroyed()) {
    const panel = (serverPopup = new BrowserWindow({
      parent: window,
      width: 360,
      height: 240,
      frame: false,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? "#1d2c25" : "#ffffff",
      webPreferences: {
        preload: join(__dirname, "preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    }));
    panel.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    panel.webContents.on("will-navigate", (event) => event.preventDefault());
    panel.on("blur", () => {
      serverPopupBlurTimer = setTimeout(hideServerPopup, 150);
    });
    panel.on("closed", () => {
      serverPopup = undefined;
      serverPopupAnchor = undefined;
      publish();
    });
    const ready = waitForPopupRenderer(panel);
    if (process.env.FREEBO_DEV_URL) {
      const url = new URL(process.env.FREEBO_DEV_URL);
      url.searchParams.set("surface", "servers");
      serverPopupLoading = Promise.all([panel.loadURL(url.toString()), ready]).then(() => {});
    } else
      serverPopupLoading = Promise.all([
        panel.loadFile(join(__dirname, "../dist/index.html"), {
          query: { surface: "servers" },
        }),
        ready,
      ]).then(() => {});
  }
  await serverPopupLoading;
  if (
    mainWindowClosing ||
    !isLiveWindow(window) ||
    !isLiveWindow(serverPopup) ||
    !serverPopupAnchor
  )
    return;
  positionServerPopup();
  serverPopup.show();
  publish();
}

function setupIPC() {
  const handle = (channel: string, callback: (input: any) => unknown) =>
    ipcMain.handle(channel, async (event, input) => {
      own(event);
      try {
        return await callback(input);
      } catch (error) {
        log(String(error));
        if (error instanceof UserFacingError) throw error;
        throw new UserFacingError(error instanceof z.ZodError ? "invalidInput" : "actionFailed");
      }
    });
  handle("app:state", () => state());
  ipcMain.handle("app:surface-ready", (event, input) => {
    own(event);
    const surface = z.enum(["servers", "playback"]).parse(input);
    const panel = surface === "servers" ? serverPopup : playbackPopup;
    if (!isLiveWindow(panel) || panel.webContents !== event.sender)
      throw new UserFacingError("invalidOrigin");
    popupReadiness.get(event.sender.id)?.resolve();
  });
  handle("app:error-visible", (input) => {
    errorVisible = z.boolean().parse(input);
    layout();
  });
  handle("app:save-server", async (input) => {
    const server = z
      .object({
        id: z.uuid().optional(),
        name: z.string(),
        url: z.string(),
        providerId: z.string(),
        credentials: credentialsSchema.optional(),
      })
      .parse(input);
    const provider = providers.get(server.providerId);
    if (server.credentials && provider.supportsCredentials === false)
      throw new UserFacingError("plexWebSignIn");
    const savedServer = await store.upsertServer(
      { ...server, url: provider.normalizeUrl(server.url) },
      async (saved) => {
        const previous = store.value.servers.find((entry) => entry.id === saved.id);
        if (server.credentials !== undefined) await credentials.set(saved, server.credentials);
        else if (
          previous &&
          (previous.url !== saved.url || previous.providerId !== saved.providerId)
        )
          await credentials.set(saved, null);
      },
    );
    if (
      activeServer?.id === savedServer.id &&
      (server.credentials !== undefined || activeServer.url !== savedServer.url)
    )
      closeGuest();
    publish();
    return state();
  });
  handle("app:server-credentials", async (input) => {
    const server = store.value.servers.find((server) => server.id === idSchema.parse(input));
    if (!server) throw new UserFacingError("serverMissing");
    return credentials.get(server);
  });
  handle("app:test-server-connection", async (input) => {
    const request = z
      .object({
        id: z.uuid().optional(),
        url: z.string(),
        providerId: z.string(),
        credentials: credentialsSchema.optional(),
      })
      .parse(input);
    const provider = providers.get(request.providerId);
    if (!provider.testConnection) throw new UserFacingError("providerMissing");
    const url = provider.normalizeUrl(request.url);
    const registered = store.value.servers.find(
      (server) =>
        server.id === request.id && server.url === url && server.providerId === provider.id,
    );
    const ses = session.fromPartition(
      registered ? providers.partition(registered) : "freebo-connection-test",
    );
    ses.setUserAgent(browserUserAgent(ses.getUserAgent()));
    return provider.testConnection(
      url,
      request.credentials,
      browserFetcher(
        ses,
        provider.entryUrl({ id: "connection-test", name: "", url, providerId: provider.id }),
      ),
      {
        deviceId: createHash("sha256")
          .update(`${app.getPath("userData")}\0${url}`)
          .digest("hex"),
        deviceName: browserDeviceName(ses.getUserAgent()),
      },
    );
  });
  handle("app:remove-server", async (input) => {
    const id = idSchema.parse(input);
    const server = store.value.servers.find((entry) => entry.id === id);
    if (!server) throw new UserFacingError("serverMissing");
    await credentials.set(server, null);
    serverFavicons.delete(id);
    if (activeServer?.id === id) closeGuest();
    if (page === "library" && !guest) page = "home";
    const servers = store.value.servers.filter((s) => s.id !== id);
    await store.save({
      ...store.value,
      servers,
      activeServerId:
        store.value.activeServerId === id ? servers[0]?.id : store.value.activeServerId,
    });
    publish();
    return state();
  });
  handle("app:open-server", async (input) => {
    await openServer(idSchema.parse(input));
    return state();
  });
  handle("app:page", (input) => {
    const request = z
      .object({
        page: z.enum(["home", "library", "settings", "setup"]),
        section: z.enum(["players", "general", "servers", "diagnostics", "about"]).optional(),
      })
      .parse(input);
    page = request.page;
    if (request.section) settingsPage = request.section;
    shown = page === "library";
    hidePlaybackPopup();
    hideServerPopup();
    layout();
    publish();
  });
  handle("app:playback-popup", async (input) => {
    if (input === null) {
      hidePlaybackPopup();
      return;
    }
    const coordinate = z.number().finite().min(0).max(100_000);
    const anchor = z
      .object({ x: coordinate, y: coordinate, width: coordinate, height: coordinate })
      .parse(input);
    await togglePlaybackPopup(anchor);
  });
  handle("app:server-popup", async (input) => {
    if (input === null) {
      hideServerPopup();
      return;
    }
    const coordinate = z.number().finite().min(0).max(100_000);
    const anchor = z
      .object({ x: coordinate, y: coordinate, width: coordinate, height: coordinate })
      .parse(input);
    await toggleServerPopup(anchor);
  });
  handle("app:add-server", () => {
    hideServerPopup();
    hidePlaybackPopup();
    page = "settings";
    settingsPage = "servers";
    shown = false;
    layout();
    publish();
    window.webContents.send("app:add-server");
    window.show();
    window.focus();
  });
  handle("app:playback-item", async () => {
    const server = store.value.servers.find((server) => server.id === playbackServer?.id);
    const item = playback.state.queue[playback.state.index];
    if (!server || !item) throw new UserFacingError("itemMissing");
    const destination = await playbackClient?.itemUrl?.(item.id);
    if (!destination) throw new UserFacingError("providerMissing");
    hidePlaybackPopup();
    await openServer(server.id, destination);
    window.show();
    window.focus();
  });
  handle("app:discover-players", async () => {
    await scan();
    return state();
  });
  handle("app:choose-player", async (input) => {
    const kind = kindSchema.parse(input);
    const result = await dialog.showOpenDialog(window, {
      title: t("selectPlayerTitle", { name: playerGuides[kind].name }),
      properties: ["openFile"],
      ...(process.platform === "darwin"
        ? { filters: [{ name: t("playerApp"), extensions: ["app", "*"] }] }
        : {}),
    });
    if (!result.canceled && result.filePaths[0]) {
      const player = manualPlayer(kind, result.filePaths[0]);
      await access(
        player.executable,
        process.platform === "win32" ? constants.F_OK : constants.X_OK,
      );
      await store.save({
        ...store.value,
        players: store.value.players.filter((p) => p.id !== player.id).concat(player),
        defaultPlayerId: player.id,
        playerScanCompleted: true,
      });
    }
    publish();
    return state();
  });
  handle("app:settings", async (input) => {
    const settings = z
      .object({
        defaultPlayerId: z.string().optional(),
        autoNext: z.boolean().optional(),
        fullscreen: z.boolean().optional(),
        theme: z.enum(["system", "dark", "light"]).optional(),
        language: z.enum(["system", "zh", "en"]).optional(),
        setupCompleted: z.boolean().optional(),
        runInBackground: z.boolean().optional(),
        remindOnClose: z.boolean().optional(),
      })
      .strict()
      .parse(input);
    if (
      settings.defaultPlayerId &&
      !store.value.players.some((p) => p.id === settings.defaultPlayerId)
    )
      throw new UserFacingError("playerMissing");
    await store.save({ ...store.value, ...settings });
    if (settings.setupCompleted && page === "setup") page = "home";
    nativeTheme.themeSource = store.value.theme;
    updateChrome();
    buildMenu();
    syncTray();
    publish();
    return state();
  });
  handle("app:control", async (input) => {
    await playback.control(controlSchema.parse(input));
  });
  handle("app:navigate", (input) => {
    const action = z.enum(["back", "forward", "reload", "stop", "home"]).parse(input);
    if (!guest || !activeServer) return;
    if (action === "home")
      void guest.webContents.loadURL(
        providers.get(activeServer.providerId).entryUrl(activeServer, true),
      );
    else if (action === "reload") {
      webError = undefined;
      webStatus = "loading";
      bootstrapRetries = 0;
      layout();
      publish();
      guest.webContents.reload();
    } else if (action === "stop") {
      guest.webContents.stop();
      if (webStatus !== "error") webStatus = "ready";
      publish();
    } else if (action === "back" && guest.webContents.navigationHistory.canGoBack())
      guest.webContents.navigationHistory.goBack();
    else if (action === "forward" && guest.webContents.navigationHistory.canGoForward())
      guest.webContents.navigationHistory.goForward();
  });
  handle("app:reset-session", async (input) => {
    const id = idSchema.parse(input);
    const server = store.value.servers.find((s) => s.id === id);
    if (!server) throw new UserFacingError("serverMissing");
    if (activeServer?.id === id) closeGuest();
    await session.fromPartition(providers.partition(server)).clearStorageData();
    publish();
    return state();
  });
  handle("app:guide", async (input) => {
    await shell.openExternal(playerGuides[kindSchema.parse(input)].url);
  });
  handle("app:diagnostics", async () => {
    const result = await dialog.showSaveDialog(window, {
      defaultPath: "freebo-diagnostics.json",
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, JSON.stringify(getDiagnostics(), null, 2));
    return result.filePath;
  });
  handle("app:get-diagnostics", () => getDiagnostics());
  handle("app:copy-diagnostics", async () => {
    await clipboard.writeText(JSON.stringify(getDiagnostics(), null, 2));
  });
  handle("app:open-link", async (input) => {
    await shell.openExternal(
      productLink(z.enum(["product", "github", "issue"]).parse(input), getDiagnostics()),
    );
  });
  ipcMain.on("server:ready", (event, status) => {
    if (
      guest &&
      event.sender === guest.webContents &&
      event.senderFrame === guest.webContents.mainFrame
    ) {
      const result = z.enum(["waiting", "sign-in", "ready", "error", "stalled"]).safeParse(status);
      if (result.success) {
        if (result.data === "stalled") {
          if (bootstrapRetries++ === 0) {
            log("Initial server bootstrap stalled; retrying once");
            guest.webContents.reload();
          } else adapterStatus = "error";
          publish();
          return;
        }
        adapterStatus = result.data;
        publish();
      }
    }
  });
  ipcMain.handle("server:credentials", async (event) => {
    const view = guest;
    const server = activeServer;
    const frame = event.senderFrame;
    if (
      !view ||
      !server ||
      event.sender !== view.webContents ||
      frame !== view.webContents.mainFrame ||
      !frame ||
      !credentialOriginMatches(server, frame.url)
    )
      throw new UserFacingError("invalidOrigin");
    const frameUrl = frame.url;
    const saved = await credentials.get(server);
    // A pending keychain read must not deliver secrets to a newly navigated page.
    if (guest !== view || frame.isDestroyed() || frame.url !== frameUrl) return null;
    return saved;
  });
  ipcMain.handle("server:play", async (event, input) => {
    if (
      !guest ||
      !activeServer ||
      event.sender !== guest.webContents ||
      event.senderFrame !== guest.webContents.mainFrame
    )
      throw new UserFacingError("invalidOrigin");
    const provider = providers.get(activeServer.providerId);
    const request = provider.parsePlayback(input, activeServer);
    const { intent } = request;
    const player = store.value.players.find((p) => p.id === store.value.defaultPlayerId);
    if (!player) {
      shown = false;
      page = "settings";
      settingsPage = "players";
      layout();
      playback.state = {
        ...playback.state,
        status: "error",
        error: errorToken("noPlayer"),
      };
      publish();
      return;
    }
    const server = activeServer;
    playbackServer = server;
    const browserSession = guest.webContents.session;
    const fetch = guardServerAccess(browserFetcher(browserSession, guest.webContents.getURL()));
    const fetcher = async (url: string, init?: RequestInit) => {
      const response = await fetch(url, init);
      if (!response.ok) {
        const message = `${provider.name} API ${init?.method ?? "GET"} ${new URL(url).pathname}: ${response.status}, ${response.headers.get("content-type")}, ${response.headers.get("cf-mitigated") ?? ""}`;
        log(message);
        if (process.env.FREEBO_DEV_URL) console.warn(message);
      }
      return response;
    };
    const client = request.createClient(fetcher);
    playbackClient = client;
    const originalPrepare = client.prepare.bind(client);
    client.prepare = async (...args) => {
      const media = await originalPrepare(...args);
      if (player.kind === "potplayer") {
        // PotPlayer's documented control messages do not select embedded tracks.
        // Do not report Emby's chosen indices as though the player applied them.
        media.audioStreamIndex = undefined;
        if (!media.subtitleUrl) media.subtitleStreamIndex = undefined;
      }
      media.url = proxy.register(media.url, fetcher, media.headers);
      if (media.subtitleUrl)
        media.subtitleUrl = proxy.register(media.subtitleUrl, fetcher, media.headers);
      media.headers = {};
      return media;
    };
    // Keep old proxy routes while queued stop reports are draining; playback replaces the queue.
    void playback.play(client, intent, player, store.value);
  });
}

function updateChrome() {
  if (!window || window.isDestroyed()) return;
  window.setTitle(t("brand"));
  if (process.platform !== "darwin")
    window.setTitleBarOverlay({
      height: 40,
      color: nativeTheme.shouldUseDarkColors ? "#111b17" : "#e0e8db",
      symbolColor: nativeTheme.shouldUseDarkColors ? "#f1f6e9" : "#193c35",
    });
}
function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: t("brand"),
        submenu: [
          { role: "about", label: t("about") },
          { type: "separator" },
          { role: "quit", label: t("quit") },
        ],
      },
      {
        label: t("editMenu"),
        submenu: [
          { role: "undo", label: t("undo") },
          { role: "redo", label: t("redo") },
          { type: "separator" },
          { role: "cut", label: t("cut") },
          { role: "copy", label: t("copy") },
          { role: "paste", label: t("paste") },
          { role: "selectAll", label: t("selectAll") },
        ],
      },
      {
        label: t("viewMenu"),
        submenu: [
          { role: "resetZoom", label: t("resetZoom") },
          { role: "zoomIn", label: t("zoomIn") },
          { role: "zoomOut", label: t("zoomOut") },
          { role: "togglefullscreen", label: t("toggleFullscreen") },
        ],
      },
      {
        label: t("windowMenu"),
        submenu: [
          { role: "minimize", label: t("minimize") },
          { role: "close", label: t("closeWindow") },
        ],
      },
      ...(process.env.FREEBO_DEV_URL && process.env.FREEBO_CAPTURE_DIR
        ? [
            {
              label: t("development"),
              submenu: [
                {
                  label: "Minimum window (820 × 600)",
                  accelerator: "CmdOrCtrl+Shift+1",
                  click: () => window.setSize(820, 600),
                },
                {
                  label: "Standard window (1280 × 850)",
                  accelerator: "CmdOrCtrl+Shift+2",
                  click: () => window.setSize(1280, 850),
                },
                {
                  label: t("capture"),
                  accelerator: "CmdOrCtrl+Shift+S",
                  click: async () => {
                    const directory = process.env.FREEBO_CAPTURE_DIR!;
                    await mkdir(directory, { recursive: true });
                    const filename = `app-${Date.now()}`;
                    await writeFile(
                      join(directory, `${filename}.png`),
                      (await window.capturePage()).toPNG(),
                    );
                    await writeFile(
                      join(directory, `${filename}.json`),
                      JSON.stringify(
                        {
                          bounds: window.getBounds(),
                          locale: locale(),
                          theme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
                        },
                        null,
                        2,
                      ),
                    );
                  },
                },
              ],
            },
          ]
        : []),
    ]),
  );
}

function showMainWindow() {
  if (lifecycle.isQuitting || !isLiveWindow(window)) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  publish();
}
function showUpdates() {
  showMainWindow();
  if (lifecycle.isQuitting) return;
  hidePlaybackPopup();
  hideServerPopup();
  shown = false;
  page = "settings";
  settingsPage = "about";
  layout();
  publish();
}
function buildTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setToolTip(t("brand"));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t("showFreebo"), click: showMainWindow },
      {
        label: t(updates?.state.status === "downloaded" ? "updateReadyMenu" : "softwareUpdates"),
        click: showUpdates,
      },
      { type: "separator" },
      { label: t("quit"), click: () => app.quit() },
    ]),
  );
}
function createTray() {
  try {
    const directory = join(
      app.isPackaged ? process.resourcesPath : join(__dirname, "../resources"),
      "tray",
    );
    const image = nativeImage.createFromPath(
      join(directory, process.platform === "darwin" ? "trayTemplate.png" : "trayColor.png"),
    );
    if (image.isEmpty()) throw new Error("Tray icon is missing");
    if (process.platform === "darwin") image.setTemplateImage(true);
    tray = new Tray(image);
    tray.on("click", showMainWindow);
    tray.on("double-click", showMainWindow);
    buildTrayMenu();
  } catch (error) {
    // A machine without a usable tray must retain a way to exit the app.
    tray?.destroy();
    tray = undefined;
    log(`Could not create tray: ${String(error)}`);
  }
}
function syncTray() {
  if (store.value.runInBackground) {
    if (!tray || tray.isDestroyed()) createTray();
    else buildTrayMenu();
  } else {
    if (!lifecycle.isQuitting && isLiveWindow(window) && !window.isVisible()) showMainWindow();
    tray?.destroy();
    tray = undefined;
  }
}
let backgroundClosePending = false;
async function closeToBackground() {
  if (backgroundClosePending || lifecycle.isQuitting) return;
  const hide = () => {
    hidePlaybackPopup();
    hideServerPopup();
    window.hide();
  };
  if (!store.value.remindOnClose) {
    hide();
    return;
  }
  backgroundClosePending = true;
  try {
    const result = await dialog.showMessageBox(window, {
      type: "info",
      message: t("backgroundCloseTitle"),
      detail: t("backgroundDescription"),
      buttons: [t("continueInBackground"), t("quit"), t("cancel")],
      defaultId: 0,
      cancelId: 2,
      checkboxLabel: t("doNotRemindAgain"),
    });
    if (lifecycle.isQuitting || !isLiveWindow(window) || result.response === 2) return;
    if (result.checkboxChecked) {
      await store.save({ ...store.value, remindOnClose: false });
      publish();
    }
    if (lifecycle.isQuitting) return;
    if (result.response === 1 || !store.value.runInBackground || !tray || tray.isDestroyed())
      app.quit();
    else hide();
  } catch (error) {
    log(`Could not close to background: ${String(error)}`);
    if (!lifecycle.isQuitting && isLiveWindow(window))
      await dialog.showMessageBox(window, {
        type: "error",
        message: localizeError(locale(), error),
      });
  } finally {
    backgroundClosePending = false;
  }
}
async function setupUpdates() {
  const packageType = join(process.resourcesPath, "package-type");
  const reason = updateDisabledReason({
    packaged: app.isPackaged,
    platform: process.platform as Platform,
    portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE),
    appImage: Boolean(process.env.APPIMAGE),
    deb: existsSync(packageType) && readFileSync(packageType, "utf8").trim() === "deb",
    macSigned:
      process.platform !== "darwin" ||
      (app.isPackaged && (await hasMacUpdateSignature(process.execPath))),
  });
  updates = new UpdateManager(reason ? undefined : autoUpdater, reason, log);
  updates.on("install-failed", () => {
    void lifecycle
      .prepareToQuit()
      .then(async () => {
        if (!isLiveWindow(window)) {
          app.quit();
          return;
        }
        await proxy.open();
        lifecycle.resumeAfterFailedUpdate();
      })
      .catch((error) => {
        log(`Could not recover after update installation failed: ${String(error)}`);
        app.quit();
      });
  });
  let previousStatus = updates.state.status;
  updates.on("change", () => {
    publish();
    buildTrayMenu();
    if (
      updates?.state.status === "downloaded" &&
      previousStatus !== "downloaded" &&
      Notification.isSupported()
    ) {
      const notification = new Notification({
        title: t("brand"),
        body: t("updateDownloaded", { version: updates.state.version ?? "" }),
        icon: windowIcon,
      });
      notification.on("click", showUpdates);
      notification.show();
    }
    previousStatus = updates!.state.status;
  });
  ipcMain.handle("app:check-updates", (event) => {
    own(event);
    if (!lifecycle.isQuitting) return updates?.check();
  });
  ipcMain.handle("app:install-update", (event) => {
    own(event);
    if (!lifecycle.isQuitting) return updates?.install(() => lifecycle.prepareToQuit());
  });
  ipcMain.handle("app:open-releases", (event) => {
    own(event);
    return shell.openExternal("https://github.com/elonzh/freebo/releases/latest");
  });
  buildTrayMenu();
  publish();
  if (!reason) {
    void updates.check();
    updateTimer = setInterval(
      () => {
        if (!lifecycle.isQuitting) void updates?.check();
      },
      6 * 60 * 60 * 1000,
    );
    updateTimer.unref();
  }
}

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});
void app.whenReady().then(async () => {
  if (!instance.primary) return;
  await store.load();
  try {
    await credentials.load();
    credentialsAvailable = await credentials.available();
  } catch {
    log("System credential storage is unavailable");
  }
  await proxy.open();
  nativeTheme.themeSource = store.value.theme;
  page = store.value.setupCompleted ? "home" : "setup";
  const savedWindow = windowStateStore.load();
  const bounds = savedWindow
    ? fitWindowBounds(savedWindow.bounds, screen.getDisplayMatching(savedWindow.bounds).workArea)
    : defaultWindowSize;
  window = new BrowserWindow({
    ...bounds,
    minWidth: minimumWindowSize.width,
    minHeight: minimumWindowSize.height,
    title: t("brand"),
    icon: windowIcon,
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 12, y: 13 } }
      : {
          titleBarOverlay: {
            height: 40,
            color: nativeTheme.shouldUseDarkColors ? "#111b17" : "#e0e8db",
            symbolColor: nativeTheme.shouldUseDarkColors ? "#f1f6e9" : "#193c35",
          },
        }),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#17231f" : "#fbfcf9",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (savedWindow?.maximized) window.maximize();
  let windowStateTimer: ReturnType<typeof setTimeout> | undefined;
  const saveWindowState = () => {
    clearTimeout(windowStateTimer);
    if (window.isDestroyed()) return;
    try {
      windowStateStore.save({ bounds: window.getNormalBounds(), maximized: window.isMaximized() });
    } catch {
      log("Could not save window geometry");
    }
  };
  const scheduleWindowState = () => {
    clearTimeout(windowStateTimer);
    windowStateTimer = setTimeout(saveWindowState, 400);
  };
  window.on("resize", scheduleWindowState);
  window.on("move", scheduleWindowState);
  window.on("maximize", scheduleWindowState);
  window.on("unmaximize", scheduleWindowState);
  window.on("close", saveWindowState);
  if (process.platform === "darwin") app.dock?.setIcon(windowIcon);
  buildMenu();
  syncTray();
  setupIPC();
  playback.on("state", () => {
    if (playback.state.status === "idle") proxy.clear();
    publish();
  });
  playback.on("report", (result: { event: string; status: string; error?: string }) => {
    log(
      `Playback sync ${result.event}: ${result.status}${result.error ? ` (${result.error})` : ""}`,
    );
  });
  playback.on("diagnostic", (message: string) => log(message));
  window.on("resize", () => {
    layout();
    if (playbackPopup?.isVisible()) positionPlaybackPopup();
    if (serverPopup?.isVisible()) positionServerPopup();
  });
  window.on("move", () => {
    if (playbackPopup?.isVisible()) positionPlaybackPopup();
    if (serverPopup?.isVisible()) positionServerPopup();
  });
  window.on("minimize", hidePlaybackPopup);
  window.on("minimize", hideServerPopup);
  window.on("close", (event) => {
    if (
      !lifecycle.close(
        event,
        Boolean(store.value.runInBackground && tray && !tray.isDestroyed()),
        () => {
          void closeToBackground();
        },
        () => app.quit(),
      )
    )
      return;
    mainWindowClosing = true;
    clearTimeout(popupBlurTimer);
    clearTimeout(serverPopupBlurTimer);
    popupAnchor = undefined;
    serverPopupAnchor = undefined;
    closeGuest();
    if (isLiveWindow(playbackPopup)) playbackPopup.destroy();
    if (isLiveWindow(serverPopup)) serverPopup.destroy();
  });
  window.on("enter-full-screen", () => {
    layout();
    publish();
  });
  window.on("leave-full-screen", () => {
    layout();
    publish();
  });
  nativeTheme.on("updated", updateChrome);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  if (process.env.FREEBO_DEV_URL) await window.loadURL(process.env.FREEBO_DEV_URL);
  else await window.loadFile(join(__dirname, "../dist/index.html"));
  instance.windowReady();
  await setupUpdates();
});
app.on("before-quit", (event) => {
  if (instance.primary) lifecycle.beforeQuit(event, () => app.quit());
});
app.on("will-quit", () => {
  tray?.destroy();
});
app.on("window-all-closed", () => {
  if (lifecycle.isQuitting || !tray || tray.isDestroyed()) app.quit();
});
