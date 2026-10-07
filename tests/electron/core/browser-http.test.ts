import type { Fetcher } from "../../../electron/providers/types";
import { describe, expect, it, vi } from "vitest";
import {
  browserFetcher,
  browserUserAgent,
  guardServerAccess,
} from "../../../electron/core/browser-http";

const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Freebo/0.1.0 Chrome/152.0.7977.130 Electron/44.5.1 Safari/537.36";
describe("browser server requests", () => {
  it("preserves real browser and OS versions while removing desktop app markers", () => {
    const value = browserUserAgent(userAgent);
    expect(value).not.toMatch(/Freebo|Electron/);
    expect(value).toContain("Chrome/152.0.7977.130");
    expect(value).toContain("Mac OS X 10_15_7");
    expect(browserUserAgent(value)).toBe(value);
  });
  it("uses the browser session, removes fragments from the referrer and preserves authentication and Range", async () => {
    const fetch = vi.fn<Fetcher>(async () => new Response(null, { status: 204 }));
    const request = browserFetcher(
      { getUserAgent: () => userAgent, fetch },
      "https://media.test/web/index.html#!/home",
    );
    await request("https://media.test/emby/Items", {
      method: "POST",
      headers: { "X-Emby-Token": "token", Range: "bytes=0-9" },
      body: "{}",
    });
    const init = fetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("User-Agent")).toBe(browserUserAgent(userAgent));
    expect(headers.get("Referer")).toBe("https://media.test/web/index.html");
    expect(headers.get("Origin")).toBe("https://media.test");
    expect(headers.get("X-Emby-Token")).toBe("token");
    expect(headers.get("Range")).toBe("bytes=0-9");
    expect(init.credentials).toBe("include");
    await request("https://media.test/emby/Items");
    expect(new Headers((fetch.mock.calls[1][1] as RequestInit).headers).has("Origin")).toBe(false);
    await request("https://cdn.test/video");
    expect(new Headers((fetch.mock.calls[2][1] as RequestInit).headers).get("Referer")).toBe(
      "https://media.test/",
    );
  });
  it.each([401, 403, 429])(
    "does not repeat API or stream requests after HTTP %s",
    async (status) => {
      const fetch = vi.fn<Fetcher>(async () => new Response(null, { status }));
      const request = guardServerAccess(fetch);
      expect((await request("https://media.test/stream")).status).toBe(status);
      await expect(
        request("https://media.test/stream", { headers: { Range: "bytes=100-" } }),
      ).rejects.toThrow();
      await expect(
        request("https://media.test/Sessions/Playing", { method: "POST" }),
      ).rejects.toThrow();
      expect(fetch).toHaveBeenCalledOnce();
    },
  );
  it("keeps a denied external subtitle host from blocking permitted server progress requests", async () => {
    const fetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const request = guardServerAccess(fetch);
    await request("https://subtitles.test/track.srt");
    expect((await request("https://media.test/Sessions/Playing", { method: "POST" })).status).toBe(
      204,
    );
    await expect(request("https://subtitles.test/track.srt")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
