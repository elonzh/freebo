import type { ServerCredentials } from "../../../src/shared/types";

// Runs in the isolated preload world. The webpage receives only the filled inputs, no secret API.
export function installCredentialAutofill(
  load: () => Promise<ServerCredentials | null>,
): () => void {
  let disposed = false;
  let scheduled = false;
  let saved: Promise<ServerCredentials | null> | undefined;
  const filled = new WeakSet<HTMLInputElement>();
  const loginRoute = () =>
    /^#!?\/?(?:startup\/)?(?:login|manuallogin)(?:\.html)?(?:[/?]|$)/i.test(location.hash);
  const visible = (input: HTMLInputElement) =>
    !input.disabled &&
    !input.readOnly &&
    input.type !== "hidden" &&
    input.getClientRects().length > 0 &&
    !input.closest('[hidden], [aria-hidden="true"]');
  const fields = () => {
    if (!loginRoute()) return;
    for (const password of document.querySelectorAll<HTMLInputElement>(
      'input[type="password"]:not([autocomplete="new-password"])',
    )) {
      if (!visible(password)) continue;
      const scope = password.closest("form") ?? password.closest(".loginPage, .manualLoginPage");
      if (!scope) continue;
      const username = [
        ...scope.querySelectorAll<HTMLInputElement>(
          'input[autocomplete="username"], input[name="username"], input[name="Username"], #txtManualName, #txtUsername, input[type="text"], input[type="email"]',
        ),
      ].find(visible);
      if (username) return { username, password };
    }
  };
  const setValue = (input: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const fill = async () => {
    const pair = fields();
    if (!pair || filled.has(pair.password)) return;
    const url = location.href;
    const request = (saved ??= load().catch(() => null));
    const credentials = await request;
    // A navigation race or temporary keychain failure must not poison the SPA's cache.
    if (!credentials && saved === request) saved = undefined;
    if (disposed || location.href !== url || !credentials || fields()?.password !== pair.password)
      return;
    // Preserve account choices and edits made while the keychain request was pending.
    if (
      pair.password.value ||
      (pair.username.value && pair.username.value !== credentials.username)
    )
      return;
    filled.add(pair.password);
    if (!pair.username.value) setValue(pair.username, credentials.username);
    setValue(pair.password, credentials.password);
  };
  const schedule = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!disposed) void fill();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "aria-hidden", "type"],
  });
  window.addEventListener("hashchange", schedule);
  schedule();
  const dispose = () => {
    disposed = true;
    observer.disconnect();
    window.removeEventListener("hashchange", schedule);
    window.removeEventListener("pagehide", dispose);
  };
  window.addEventListener("pagehide", dispose, { once: true });
  return dispose;
}
