import { contextBridge, ipcRenderer } from "electron";
import { installPlexAdapter } from "./plex-adapter";

contextBridge.exposeInMainWorld("freeboPlayback", {
  request: (payload: unknown) => ipcRenderer.invoke("server:play", payload),
  ready: (status: string) => ipcRenderer.send("server:ready", status),
});
try {
  contextBridge.executeInMainWorld({ func: installPlexAdapter });
} catch {
  ipcRenderer.send("server:ready", "error");
}
