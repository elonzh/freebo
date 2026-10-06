import { expect, it, vi } from "vitest";
import { sendWindowState } from "../electron/core/window-lifecycle";

it("skips a destroyed WebContents even while its parent window still reports alive", () => {
  const send = vi.fn(() => {
    throw new TypeError("Object has been destroyed");
  });
  expect(() =>
    sendWindowState(
      { isDestroyed: () => false, webContents: { isDestroyed: () => true, send } },
      {},
    ),
  ).not.toThrow();
  expect(send).not.toHaveBeenCalled();
});
it("skips closed windows and still publishes to surviving windows", () => {
  const send = vi.fn();
  const contents = { isDestroyed: () => false, send };
  sendWindowState(undefined, {});
  sendWindowState({ isDestroyed: () => true, webContents: contents }, {});
  expect(send).not.toHaveBeenCalled();
  sendWindowState({ isDestroyed: () => false, webContents: contents }, { page: "home" });
  expect(send).toHaveBeenCalledWith("app:state", { page: "home" });
});
