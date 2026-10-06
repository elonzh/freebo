import { contextBridge, ipcRenderer } from "electron";
import { installEmbyAdapter } from "./emby-adapter";
import { installCredentialAutofill } from "./credential-autofill";

contextBridge.exposeInMainWorld("freeboPlayback", {
  request: (payload: unknown) => ipcRenderer.invoke("server:play", payload),
  ready: (status: string) => ipcRenderer.send("server:ready", status),
});
window.addEventListener(
  "DOMContentLoaded",
  () => {
    installCredentialAutofill(() => ipcRenderer.invoke("server:credentials"));
    try {
      contextBridge.executeInMainWorld({ func: installEmbyAdapter });
    } catch {
      ipcRenderer.send("server:ready", "error");
    }
  },
  { once: true },
);
