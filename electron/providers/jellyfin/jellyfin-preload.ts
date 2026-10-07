import { contextBridge, ipcRenderer } from "electron";
import { installJellyfinAdapter } from "./jellyfin-adapter";
import { installCredentialAutofill } from "../emby/credential-autofill";

contextBridge.exposeInMainWorld("freeboPlayback", {
  request: (payload: unknown) => ipcRenderer.invoke("server:play", payload),
  ready: (status: string) => ipcRenderer.send("server:ready", status),
});
try {
  contextBridge.executeInMainWorld({ func: installJellyfinAdapter });
} catch {
  ipcRenderer.send("server:ready", "error");
}
window.addEventListener(
  "DOMContentLoaded",
  () => {
    installCredentialAutofill(() => ipcRenderer.invoke("server:credentials"));
  },
  { once: true },
);
