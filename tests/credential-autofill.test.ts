// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installCredentialAutofill } from "../electron/providers/emby/credential-autofill";
import type { ServerCredentials } from "../src/shared/types";

const login = { username: "test-account", password: "test-password" };
let dispose: (() => void) | undefined;
const form = () => {
  document.body.innerHTML =
    '<form class="manualLoginPage"><input id="txtManualName" type="text"><input id="txtManualPassword" type="password"><button>Sign in</button></form>';
  return {
    username: document.querySelector<HTMLInputElement>("#txtManualName")!,
    password: document.querySelector<HTMLInputElement>("#txtManualPassword")!,
  };
};
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
beforeEach(() => {
  location.hash = "!/login";
  vi.spyOn(HTMLInputElement.prototype, "getClientRects").mockImplementation(function (
    this: HTMLInputElement,
  ) {
    return (this.closest("[hidden]") ? [] : [new DOMRect(0, 0, 200, 36)]) as unknown as DOMRectList;
  });
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
describe("Emby login autofill", () => {
  it.each([
    "!/startup/manuallogin.html?serverId=test",
    "!/startup/login.html",
    "/manuallogin.html",
  ])("fills the deployed Emby login route %s with generated input IDs", async (route) => {
    location.hash = route;
    document.body.innerHTML =
      '<form class="auto-center"><input id="embyinput0" type="text" autocomplete="off"><input id="embyinput1" type="password" autocomplete="off"></form>';
    dispose = installCredentialAutofill(async () => login);
    await settle();
    expect(document.querySelector<HTMLInputElement>("#embyinput0")!.value).toBe(login.username);
    expect(document.querySelector<HTMLInputElement>("#embyinput1")!.value).toBe(login.password);
  });
  it("retries a transient empty credential response on the next login form update", async () => {
    const { password } = form();
    const load = vi.fn().mockResolvedValue(null);
    dispose = installCredentialAutofill(load);
    await settle();
    expect(password.value).toBe("");
    load.mockResolvedValue(login);
    document.querySelector("form")!.classList.add("shown");
    await vi.waitFor(() => expect(password.value).toBe(login.password));
  });
  it("does not put the saved password into a password creation field", async () => {
    const { password } = form();
    password.autocomplete = "new-password";
    const load = vi.fn(async () => login);
    dispose = installCredentialAutofill(load);
    await settle();
    expect(load).not.toHaveBeenCalled();
    expect(password.value).toBe("");
  });
  it("fills a late SPA login form and dispatches field events without submitting", async () => {
    location.hash = "!/home";
    const load = vi.fn(async () => login);
    dispose = installCredentialAutofill(load);
    await settle();
    expect(load).not.toHaveBeenCalled();
    const { username, password } = form();
    const input = vi.fn();
    const change = vi.fn();
    const submit = vi.fn();
    password.addEventListener("input", input);
    username.addEventListener("change", change);
    document.querySelector("form")!.addEventListener("submit", submit);
    location.hash = "!/login?serverId=test";
    await vi.waitFor(() => expect(password.value).toBe(login.password));
    expect(username.value).toBe(login.username);
    expect(input).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledOnce();
  });
  it("preserves typing during a pending keychain read and never refills edited inputs", async () => {
    const { username, password } = form();
    let resolve!: (value: ServerCredentials) => void;
    dispose = installCredentialAutofill(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await settle();
    username.value = "another-account";
    password.value = "user-typed";
    resolve(login);
    await settle();
    expect(username.value).toBe("another-account");
    expect(password.value).toBe("user-typed");
  });
  it("does not fill a different selected account or a connect-login page", async () => {
    const { username, password } = form();
    username.value = "another-account";
    dispose = installCredentialAutofill(async () => login);
    await settle();
    expect(password.value).toBe("");
    username.value = "";
    location.hash = "!/connectlogin";
    document.body.append(document.createElement("div"));
    await settle();
    expect(password.value).toBe("");
  });
  it("waits until fields become visible and respects later manual clearing", async () => {
    const { username, password } = form();
    const element = document.querySelector("form")!;
    element.hidden = true;
    const load = vi.fn(async () => login);
    dispose = installCredentialAutofill(load);
    await settle();
    expect(load).not.toHaveBeenCalled();
    element.hidden = false;
    await vi.waitFor(() => expect(password.value).toBe(login.password));
    username.value = "";
    password.value = "";
    element.classList.add("updated");
    await settle();
    expect(password.value).toBe("");
  });
  it("discards a late response after navigating away or replacing the form", async () => {
    const { password } = form();
    let resolve!: (value: ServerCredentials) => void;
    dispose = installCredentialAutofill(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await settle();
    location.hash = "!/home";
    resolve(login);
    await settle();
    expect(password.value).toBe("");
  });
});
