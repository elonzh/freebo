// Plex's playback queue is a public API boundary; no private/minified Web module IDs.
// This function is serialized into the main world before Plex's scripts load.
export function installPlexAdapter(): void {
  const page = window as any;
  if (page.__freeboAdapterInstalled) return;
  page.__freeboAdapterInstalled = true;
  const status = () =>
    page.freeboPlayback?.ready(/(?:signin|login|auth)/i.test(location.hash) ? "sign-in" : "ready");
  window.addEventListener("hashchange", status);
  const requestUrl = (input: string | URL | Request) =>
    new URL(
      typeof input === "string" || input instanceof URL ? String(input) : input.url,
      location.href,
    );
  let disposeHandoff: (() => void) | undefined;
  const finishHandoff = (request: Promise<unknown>) => {
    disposeHandoff?.();
    const documentUrl = location.origin + location.pathname;
    const previous = document.querySelector('[class*="PlayerErrorModal-modalHeader"]');
    let accepted = false;
    const dispose = () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
    const closeEmptyQueueError = () => {
      if (!accepted || location.origin + location.pathname !== documentUrl) return;
      const header = document.querySelector('[class*="PlayerErrorModal-modalHeader"]');
      if (!header || header === previous) return;
      const close = header
        .closest('[class*="ModalContent-modalContent"]')
        ?.querySelector<HTMLButtonElement>('button[class*="ModalContent-closeButton"]');
      if (close) {
        dispose();
        // Plex Link activates on mousedown/mouseup; an unfocused .click() is ignored.
        for (const type of ["mousedown", "mouseup", "click"])
          close.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              button: 0,
              buttons: type === "mousedown" ? 1 : 0,
              detail: 1,
            }),
          );
      }
    };
    // PMS Web treats our deliberately empty queue as an error. Close only the modal
    // created by this accepted handoff, through its own action, before the next paint.
    const observer = new MutationObserver(closeEmptyQueueError);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timeout = setTimeout(dispose, 5_000);
    disposeHandoff = dispose;
    void request
      .then(() => {
        accepted = true;
        closeEmptyQueueError();
      })
      .catch(() => {
        dispose();
        page.freeboPlayback.ready("error");
      });
  };
  window.addEventListener("pagehide", () => disposeHandoff?.(), { once: true });
  const eligible = (url: URL, method: string, headers: Headers) =>
    method.toUpperCase() === "POST" &&
    /\/playQueues\/?$/.test(url.pathname) &&
    url.searchParams.get("type") === "video" &&
    !url.searchParams.get("X-Plex-Target-Client-Identifier") &&
    !headers.get("X-Plex-Target-Client-Identifier");
  const handoff = (url: URL, headers: Headers, response: any): any => {
    const queue = response?.MediaContainer;
    const token = url.searchParams.get("X-Plex-Token") ?? headers.get("X-Plex-Token") ?? "";
    const clientId =
      url.searchParams.get("X-Plex-Client-Identifier") ?? headers.get("X-Plex-Client-Identifier");
    const items = queue?.Metadata;
    if (
      !clientId ||
      !Array.isArray(items) ||
      !items.length ||
      !queue.playQueueID ||
      items.some((item: any) => !["movie", "episode", "clip"].includes(item.type))
    )
      return response;
    const selected =
      items.find(
        (item: any) => String(item.playQueueItemID) === String(queue.playQueueSelectedItemID),
      ) ??
      items.find(
        (item: any) => String(item.ratingKey) === String(queue.playQueueSelectedMetadataItemID),
      ) ??
      items[0];
    const base = new URL(url.href);
    base.pathname = base.pathname.replace(/\/playQueues\/?$/, "");
    base.search = "";
    base.hash = "";
    const serverId = /^#!\/server\/([^/?]+)/.exec(location.hash)?.[1];
    const numeric = (key: string) => {
      const value = url.searchParams.get(key);
      return value === null ? undefined : Number(value);
    };
    const mediaIndex = numeric("mediaIndex");
    const media =
      mediaIndex === undefined
        ? selected.Media?.find((source: any) => source.selected)
        : selected.Media?.[mediaIndex];
    finishHandoff(
      page.freeboPlayback.request({
        auth: {
          baseUrl: base.href.replace(/\/$/, ""),
          token,
          clientId,
          serverId: serverId ? decodeURIComponent(serverId) : undefined,
          playQueueId: String(queue.playQueueID),
          selectedQueueItemId:
            selected.playQueueItemID === undefined ? undefined : String(selected.playQueueItemID),
        },
        intent: {
          itemIds: [String(selected.ratingKey)],
          expand: false,
          mediaSourceId: media ? String(media.id) : undefined,
          startTicks: numeric("offset") === undefined ? undefined : numeric("offset")! * 10_000_000,
          audioIndex: numeric("audioStreamID"),
          subtitleIndex: numeric("subtitleStreamID") === 0 ? -1 : numeric("subtitleStreamID"),
        },
      }),
    );
    // Empty the Web player's queue after handing it off, so it cannot play/report in parallel.
    return {
      ...response,
      MediaContainer: { ...queue, Metadata: [], size: 0, playQueueTotalCount: 0 },
    };
  };
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = requestUrl(input);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const response = await originalFetch.call(window, input, init);
    if (!response.ok || !eligible(url, method, headers)) return response;
    let data: any;
    try {
      data = await response.clone().json();
    } catch {
      return response;
    }
    const replacement = handoff(url, headers, data);
    return replacement === data
      ? response
      : new Response(JSON.stringify(replacement), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
  };
  const requests = new WeakMap<XMLHttpRequest, { url: URL; method: string; headers: Headers }>();
  const rewritten = new WeakSet<XMLHttpRequest>();
  // oxlint-disable-next-line typescript/unbound-method -- Called with the intercepted XHR as this.
  const open = XMLHttpRequest.prototype.open;
  // oxlint-disable-next-line typescript/unbound-method -- Called with the intercepted XHR as this.
  const setHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    input: string | URL,
    ...rest: any[]
  ) {
    if (rewritten.has(this)) {
      delete (this as any).responseText;
      delete (this as any).response;
      rewritten.delete(this);
    }
    requests.set(this, { url: requestUrl(input), method, headers: new Headers() });
    return (open as any).call(this, method, input, ...rest);
  } as typeof open;
  XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
    requests.get(this)?.headers.set(key, value);
    return setHeader.call(this, key, value);
  };
  // oxlint-disable-next-line typescript/unbound-method -- Called with the intercepted XHR as this.
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    const capture = () => {
      if (this.readyState !== 4) return;
      this.removeEventListener("readystatechange", capture, true);
      const request = requests.get(this);
      if (
        !request ||
        this.status < 200 ||
        this.status >= 300 ||
        !eligible(request.url, request.method, request.headers)
      )
        return;
      if (!["", "text", "json"].includes(this.responseType)) return;
      try {
        const data = this.responseType === "json" ? this.response : JSON.parse(this.responseText);
        const replacement = handoff(request.url, request.headers, data);
        if (replacement !== data) {
          const text = JSON.stringify(replacement);
          Object.defineProperty(this, "responseText", { configurable: true, get: () => text });
          Object.defineProperty(this, "response", {
            configurable: true,
            get: () => (this.responseType === "json" ? replacement : text),
          });
          rewritten.add(this);
        }
      } catch {
        /* Non-JSON/error responses retain Plex's normal behavior. */
      }
    };
    this.addEventListener("readystatechange", capture, true);
    return send.call(this, body);
  };
  status();
}
