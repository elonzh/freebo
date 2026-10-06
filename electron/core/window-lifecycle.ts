export interface WindowTarget {
  isDestroyed(): boolean;
  webContents: { isDestroyed(): boolean; send(channel: string, value: unknown): void };
}

export function isLiveWindow<T extends WindowTarget>(target: T | undefined): target is T {
  return Boolean(target && !target.isDestroyed() && !target.webContents.isDestroyed());
}

export function sendWindowState(target: WindowTarget | undefined, state: unknown): void {
  if (isLiveWindow(target)) target.webContents.send("app:state", state);
}
