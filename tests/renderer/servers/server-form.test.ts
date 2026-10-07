import { createRendererI18n } from "../../../src/i18n";
import type { i18n } from "i18next";
import { withTestProviders } from "../../helpers/render-providers";
// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ServerForm } from "../../../src/components/servers/ServerForm";
import { translate, UserFacingError } from "../../../src/shared/i18n";
import type { Server, ServerCredentials, DesktopAPI } from "../../../src/shared/types";

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
  language?: i18n,
) {
  const onSave = vi.fn();
  await act(async () =>
    root.render(
      withTestProviders(
        createElement(ServerForm, {
          server,
          saving: false,
          onSave,
          onCancel: vi.fn(),
          providers: [{ id: "emby", name: "Emby" }],
          credentialsAvailable: true,
          loadCredentials,
          testConnection,
        }),
        language ?? "zh",
      ),
    ),
  );
  await act(async () => {
    await vi.waitFor(() =>
      expect(container.querySelector<HTMLButtonElement>('[name="test-connection"]')!.disabled).toBe(
        false,
      ),
    );
  });
  return onSave;
}
async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
it("uses Plex Web sign-in without loading or submitting saved account credentials", async () => {
  const loadCredentials = vi.fn(async () => credentials);
  const onSave = vi.fn();
  const testConnection = vi.fn(async () => ({ serverName: "Plex", authenticated: false }));
  await act(async () =>
    root.render(
      withTestProviders(
        createElement(ServerForm, {
          server: { ...server, providerId: "plex" },
          saving: false,
          onSave,
          onCancel: vi.fn(),
          providers: [{ id: "plex", name: "Plex", supportsCredentials: false }],
          credentialsAvailable: true,
          loadCredentials,
          testConnection,
        }),
        "zh",
      ),
    ),
  );
  expect(loadCredentials).not.toHaveBeenCalled();
  expect(container.querySelector('input[type="password"]')).toBeNull();
  expect(container.textContent).toContain("在 Plex 网页中登录");
  await submit();
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ providerId: "plex", credentials: undefined }),
  );
});
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
it("preserves saved credentials when both fields are emptied and has no clear-account action", async () => {
  const onSave = await render();
  expect(container.querySelector('[role="switch"]')).toBeNull();
  expect(container.textContent).not.toContain("清除已保存的账号密码");
  await act(async () => {
    for (const input of container.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="username"], input[autocomplete="current-password"]',
    )) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe("");
  expect(container.querySelector<HTMLInputElement>('input[autocomplete="username"]')?.value).toBe(
    "",
  );
  await submit();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ credentials: undefined }));
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
  expect(container.querySelector('[role="status"]')?.textContent).toBe("连接成功");
});
it("submits a blank optional server name without inserting a default", async () => {
  const onSave = await render();
  const name = container.querySelector<HTMLInputElement>('input[maxlength="100"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "   ");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await submit();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "", credentials }));
});
it("shows successful authentication as success even when test logout is rejected", async () => {
  await render(
    undefined,
    vi.fn(async () => ({ serverName: "Test", authenticated: true, logoutFailed: true })),
  );
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[name="test-connection"]')!.click(),
  );
  const status = container.querySelector('[role="status"]')!;
  expect(status.textContent).toBe("连接成功");
  expect(status.classList.contains("text-destructive")).toBe(false);
  expect(status.classList.contains("text-primary")).toBe(true);
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain("测试会话未注销。");
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
  expect(container.querySelector('[role="alert"]')?.classList.contains("text-destructive")).toBe(
    true,
  );
});
it("does not erase saved credentials after a keychain read fails", async () => {
  const onSave = await render(async () => {
    throw new Error("Keychain unavailable");
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Keychain unavailable");
  await submit();
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ credentials: undefined }));
  expect(container.textContent).not.toContain("清除已保存的账号密码");
});

it("re-localizes an existing connection error when the renderer language changes", async () => {
  const language = createRendererI18n("zh");
  await render(
    async () => null,
    vi.fn(async () => {
      throw new UserFacingError("credentialsRejected");
    }),
    language,
  );
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[name="test-connection"]')!.click(),
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("账号或密码不正确");
  await act(async () => {
    await language.changeLanguage("en");
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "The account or password is incorrect",
  );
  expect(container.querySelector('[name="test-connection"]')?.textContent).toBe("Test connection");
});
