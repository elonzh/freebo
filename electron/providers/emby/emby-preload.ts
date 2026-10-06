import { contextBridge, ipcRenderer } from "electron";
import { installEmbyAdapter } from "./emby-adapter";

contextBridge.exposeInMainWorld("freeboPlayback", {
  request: (payload: unknown) => ipcRenderer.invoke("server:play", payload),
  ready: (status: string) => ipcRenderer.send("server:ready", status),
});
window.addEventListener(
  "DOMContentLoaded",
  () => {
    try {
      contextBridge.executeInMainWorld({ func: installEmbyAdapter });
    } catch {
      ipcRenderer.send("server:ready", "error");
    }
  },
  { once: true },
);
