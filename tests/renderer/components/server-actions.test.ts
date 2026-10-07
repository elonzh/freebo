import { withTestProviders } from "../../helpers/render-providers";
// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ServerManagementRow } from "../../../src/components/ServerManagementRow";

let container: HTMLDivElement;
let root: Root;
const onRemove = vi.fn();
const onSignOut = vi.fn();
const onEdit = vi.fn();
const onOpen = vi.fn();
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  onRemove.mockReset();
  onSignOut.mockReset();
  onEdit.mockReset();
  onOpen.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      withTestProviders(
        createElement(
          "ul",
          null,
          createElement(ServerManagementRow, {
            server: { id: "s", name: "", url: "https://media.test", providerId: "emby" },

            onRemove,
            onSignOut,
            onEdit,
            onOpen,
            disabled: false,
          }),
        ),
      ),
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});
it("uses an app dialog and does not remove a server when cancelled", async () => {
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-label^="移除"]')!;
  await act(async () => trigger.click());
  const dialog = document.querySelector('[role="alertdialog"]')!;
  expect(dialog.textContent).not.toContain("https://media.test");
  expect(dialog.textContent).toContain("移除服务器？");
  expect(dialog.textContent).toContain("不会删除服务器中的媒体");
  const cancel = [...dialog.querySelectorAll("button")].find(
    (button) => button.textContent === "取消",
  )!;
  expect(document.activeElement).toBe(cancel);
  expect(onRemove).not.toHaveBeenCalled();
  await act(async () => cancel.click());
  expect(onRemove).not.toHaveBeenCalled();
  expect(onSignOut).not.toHaveBeenCalled();
  expect(onEdit).not.toHaveBeenCalled();
  expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
});
it("performs exactly the selected action after confirmation", async () => {
  const signOut = container.querySelector<HTMLButtonElement>('button[aria-label="退出登录"]')!;
  expect(signOut.textContent).toBe("");
  await act(async () => signOut.click());
  const dialog = document.querySelector('[role="alertdialog"]')!;
  expect(dialog.textContent).toContain("保留已保存的账号密码");
  expect(onSignOut).not.toHaveBeenCalled();
  await act(async () =>
    [...dialog.querySelectorAll("button")]
      .find((button) => button.textContent === "退出登录")!
      .click(),
  );
  expect(onSignOut).toHaveBeenCalledOnce();
  expect(onRemove).not.toHaveBeenCalled();
  expect(onEdit).not.toHaveBeenCalled();
});
it("edits from row content and the provider icon while Open remains a separate action", async () => {
  const edit = container.querySelector<HTMLButtonElement>('button[aria-label^="编辑服务器"]')!;
  await act(async () => edit.querySelector("span")!.click());
  expect(onEdit).toHaveBeenCalledOnce();
  expect(onOpen).not.toHaveBeenCalled();
  expect(edit.querySelector("button")).toBeNull();
  await act(async () => edit.querySelector("img")!.click());
  expect(onEdit).toHaveBeenCalledTimes(2);
  const open = container.querySelector<HTMLButtonElement>('button[aria-label="打开"]')!;
  expect(open.textContent).toBe("");
  await act(async () => open.click());
  expect(onOpen).toHaveBeenCalledOnce();
  expect(onEdit).toHaveBeenCalledTimes(2);
  expect(onRemove).not.toHaveBeenCalled();
  expect(onSignOut).not.toHaveBeenCalled();
});
