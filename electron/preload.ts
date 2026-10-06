import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAPI, AppState } from "../src/shared/types";

const api: DesktopAPI = {
  getState: () => ipcRenderer.invoke("app:state"),
  saveServer: (server) => ipcRenderer.invoke("app:save-server", server),
  getServerCredentials: (id) => ipcRenderer.invoke("app:server-credentials", id),
  testServerConnection: (server) => ipcRenderer.invoke("app:test-server-connection", server),
  removeServer: (id) => ipcRenderer.invoke("app:remove-server", id),
  openServer: (id) => ipcRenderer.invoke("app:open-server", id),
  showPage: (page, section) => ipcRenderer.invoke("app:page", { page, section }),
  togglePlaybackPopup: (anchor) => ipcRenderer.invoke("app:playback-popup", anchor),
  hidePlaybackPopup: () => ipcRenderer.invoke("app:playback-popup", null),
  toggleServerPopup: (anchor) => ipcRenderer.invoke("app:server-popup", anchor),
  hideServerPopup: () => ipcRenderer.invoke("app:server-popup", null),
  addServer: () => ipcRenderer.invoke("app:add-server"),
  openPlaybackItem: () => ipcRenderer.invoke("app:playback-item"),
  showError: (visible) => ipcRenderer.invoke("app:error-visible", visible),
  discoverPlayers: () => ipcRenderer.invoke("app:discover-players"),
  choosePlayer: (kind) => ipcRenderer.invoke("app:choose-player", kind),
  updateSettings: (settings) => ipcRenderer.invoke("app:settings", settings),
  control: (control) => ipcRenderer.invoke("app:control", control),
  surfaceReady: (surface) => ipcRenderer.invoke("app:surface-ready", surface),
  navigate: (action) => ipcRenderer.invoke("app:navigate", action),
  resetSession: (id) => ipcRenderer.invoke("app:reset-session", id),
  openGuide: (kind) => ipcRenderer.invoke("app:guide", kind),
  exportDiagnostics: () => ipcRenderer.invoke("app:diagnostics"),
  getDiagnostics: () => ipcRenderer.invoke("app:get-diagnostics"),
  copyDiagnostics: () => ipcRenderer.invoke("app:copy-diagnostics"),
  openLink: (target) => ipcRenderer.invoke("app:open-link", target),
  checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),
  installUpdate: () => ipcRenderer.invoke("app:install-update"),
  openReleases: () => ipcRenderer.invoke("app:open-releases"),
  onState: (callback) => {
    const listener = (_event: unknown, state: AppState) => callback(state);
    ipcRenderer.on("app:state", listener);
    return () => ipcRenderer.removeListener("app:state", listener);
  },
  onAddServer: (callback) => {
    ipcRenderer.on("app:add-server", callback);
    return () => ipcRenderer.removeListener("app:add-server", callback);
  },
};
contextBridge.exposeInMainWorld("desktop", api);
