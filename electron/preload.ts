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
  openPlaybackItem: () => ipcRenderer.invoke("app:playback-item"),
  showError: (visible) => ipcRenderer.invoke("app:error-visible", visible),
  discoverPlayers: () => ipcRenderer.invoke("app:discover-players"),
  choosePlayer: (kind) => ipcRenderer.invoke("app:choose-player", kind),
  updateSettings: (settings) => ipcRenderer.invoke("app:settings", settings),
  control: (control) => ipcRenderer.invoke("app:control", control),
  confirm: (action, id) => ipcRenderer.invoke("app:confirm", { action, id }),
  navigate: (action) => ipcRenderer.invoke("app:navigate", action),
  resetSession: (id) => ipcRenderer.invoke("app:reset-session", id),
  openGuide: (kind) => ipcRenderer.invoke("app:guide", kind),
  exportDiagnostics: () => ipcRenderer.invoke("app:diagnostics"),
  onState: (callback) => {
    const listener = (_event: unknown, state: AppState) => callback(state);
    ipcRenderer.on("app:state", listener);
    return () => ipcRenderer.removeListener("app:state", listener);
  },
};
contextBridge.exposeInMainWorld("desktop", api);
