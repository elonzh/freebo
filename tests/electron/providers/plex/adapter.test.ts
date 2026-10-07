// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installPlexAdapter } from "../../../../electron/providers/plex/plex-adapter";

const page = window as any;
const originalXHR = window.XMLHttpRequest;
const originalFetch = window.fetch;
const originalRequest = window.Request;
const originalResponse = window.Response;
afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  delete page.__freeboAdapterInstalled;
  delete page.freeboPlayback;
  window.XMLHttpRequest = originalXHR;
  window.fetch = originalFetch;
  window.Request = originalRequest;
  window.Response = originalResponse;
  vi.useRealTimers();
});

describe("Plex Web queue interception", () => {
  const queue = {
    MediaContainer: {
      playQueueID: 7,
      playQueueSelectedItemID: 10,
      Metadata: [{ ratingKey: "12", type: "movie", playQueueItemID: 10 }],
      size: 1,
      playQueueTotalCount: 1,
    },
  };
  const url =
    "http://localhost:3000/plex/playQueues?type=video&X-Plex-Token=fixture&X-Plex-Client-Identifier=client";
  function setup(data = queue) {
    const request = vi.fn(async () => {});
    page.freeboPlayback = { request, ready: vi.fn() };
    window.fetch = vi.fn(async () => Response.json(data));
    class FakeXHR extends EventTarget {
      readyState = 0;
      status = 200;
      responseType = "";
      response = JSON.stringify(data);
      responseText = JSON.stringify(data);
      open() {
        this.readyState = 1;
      }
      setRequestHeader() {}
      send() {
        this.readyState = 4;
        this.dispatchEvent(new Event("readystatechange"));
      }
    }
    window.XMLHttpRequest = FakeXHR as any;
    // oxlint-disable-next-line typescript/no-implied-eval -- Verify contextBridge serialization.
    new Function(`return (${installPlexAdapter.toString()})`)()();
    return request;
  }
  it("takes over fetch queues and empties only the native video queue", async () => {
    const request = setup();
    const response = await window.fetch(url, { method: "POST" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          baseUrl: "http://localhost:3000/plex",
          token: "fixture",
          playQueueId: "7",
          selectedQueueItemId: "10",
        }),
        intent: expect.objectContaining({ itemIds: ["12"], expand: false }),
      }),
    );
    expect((await response.json()).MediaContainer.Metadata).toEqual([]);
  });
  it("intercepts XMLHttpRequest before existing response callbacks run", () => {
    const request = setup();
    const xhr = new window.XMLHttpRequest();
    xhr.open("POST", url);
    let nativeQueue: unknown;
    xhr.addEventListener("readystatechange", () => {
      nativeQueue = JSON.parse(xhr.responseText).MediaContainer.Metadata;
    });
    xhr.send();
    expect(request).toHaveBeenCalledTimes(1);
    expect(nativeQueue).toEqual([]);
  });
  it("supports servers that explicitly allow local access without a token", async () => {
    const request = setup();
    await window.fetch(
      "http://localhost:3000/plex/playQueues?type=video&X-Plex-Client-Identifier=local",
      { method: "POST" },
    );
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ auth: expect.objectContaining({ token: "", clientId: "local" }) }),
    );
  });
  it("closes only the new empty-queue error through Plex's own close action after handoff", async () => {
    setup();
    await window.fetch(url, { method: "POST" });
    const dialog = document.createElement("div");
    dialog.className = "ModalContent-modalContent";
    dialog.innerHTML =
      '<button class="ModalContent-closeButton">Close</button><div class="PlayerErrorModal-modalHeader">Localized playback error</div>';
    const close = vi.fn(() => dialog.remove());
    const events: string[] = [];
    for (const type of ["mousedown", "mouseup", "click"])
      dialog.querySelector("button")!.addEventListener(type, () => events.push(type));
    dialog.querySelector("button")!.addEventListener("click", close);
    document.body.append(dialog);
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(events).toEqual(["mousedown", "mouseup", "click"]);
  });
  it("preserves errors that were already visible before handoff", async () => {
    const dialog = document.createElement("div");
    dialog.className = "ModalContent-modalContent";
    dialog.innerHTML =
      '<button class="ModalContent-closeButton">Close</button><div class="PlayerErrorModal-modalHeader">Previous error</div>';
    const close = vi.fn();
    dialog.querySelector("button")!.addEventListener("click", close);
    document.body.append(dialog);
    setup();
    await window.fetch(url, { method: "POST" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(close).not.toHaveBeenCalled();
    dialog.remove();
  });
  it("keeps music, queue reads, remote targets and missing client identity on the Web path", async () => {
    const request = setup();
    await window.fetch(url, { method: "GET" });
    await window.fetch(url.replace("type=video", "type=audio"), { method: "POST" });
    await window.fetch(`${url}&X-Plex-Target-Client-Identifier=remote`, { method: "POST" });
    await window.fetch("http://localhost:3000/plex/playQueues?type=video", { method: "POST" });
    expect(request).not.toHaveBeenCalled();
  });
});
