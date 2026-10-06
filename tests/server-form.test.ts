// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ServerForm } from "../src/components/ServerForm";
import { translate } from "../src/shared/i18n";
import type { Server, ServerCredentials, DesktopAPI } from "../src/shared/types";

const server: Server = {
  id: "test",
  name: "Test",
  url: "https://example.test",
  providerId: "emby",
};
const credentials = { username: "test-account", password: "test-password" };
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  vi.unstubAllGlobals();
});
async function render(
  loadCredentials = async (): Promise<ServerCredentials | null> => credentials,
  testConnection: DesktopAPI["testServerConnection"] = vi.fn(async () => ({
    serverName: "Test",
    authenticated: true,
  })),
) {
  const onSave = vi.fn();
  await act(async () =>
    root.render(
      createElement(ServerForm, {
        server,
        saving: false,
        onSave,
        onCancel: vi.fn(),
        providers: [{ id: "emby", name: "Emby" }],
        credentialsAvailable: true,
        loadCredentials,
        testConnection,
        locale: "zh",
        t: (key, params) => translate("zh", key, params),
      }),
    ),
  );
  return onSave;
}
async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
it("restores the saved account and masked password and preserves them on a normal server edit", async () => {
  const onSave = await render();
  expect(container.querySelector<HTMLInputElement>('input[autocomplete="username"]')?.value).toBe(
    credentials.username,
  );
  expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(
    credentials.password,
  );
  await submit();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ credentials }));
});
it("always shows both fields without a switch and forgets credentials only when requested", async () => {
  const onSave = await render();
  expect(container.querySelector('[role="switch"]')).toBeNull();
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === translate("zh", "forgetCredentials"))!
      .click();
  });
  expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe("");
  expect(container.querySelector<HTMLInputElement>('input[autocomplete="username"]')?.value).toBe(
    "",
  );
  await submit();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ credentials: null }));
});
it("tests the current account without saving it and displays the result", async () => {
  const testConnection = vi.fn(async () => ({ serverName: "Test", authenticated: true }));
  const onSave = await render(undefined, testConnection);
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[name="test-connection"]')!.click(),
  );
  expect(testConnection).toHaveBeenCalledWith({
    id: server.id,
    url: server.url,
    providerId: server.providerId,
    credentials,
  });
  expect(onSave).not.toHaveBeenCalled();
  expect(container.querySelector('[role="status"]')?.textContent).toContain("账号密码验证成功");
});
it("can test server reachability with empty credential fields and shows a localized error", async () => {
  const testConnection = vi.fn(async () => {
    throw new Error(translate("zh", "credentialsRejected"));
  });
  await render(async () => null, testConnection);
  expect(container.querySelector('input[type="password"]')).not.toBeNull();
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[name="test-connection"]')!.click(),
  );
  expect(testConnection).toHaveBeenCalledWith(expect.objectContaining({ credentials: undefined }));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("账号或密码不正确");
});
it("does not erase saved credentials after a keychain read fails unless the user requests it", async () => {
  const onSave = await render(async () => {
    throw new Error("Keychain unavailable");
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Keychain unavailable");
  await submit();
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ credentials: undefined }));
  const forget = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === translate("zh", "forgetCredentials"),
  )!;
  await act(async () => {
    forget.click();
  });
  await submit();
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ credentials: null }));
});
