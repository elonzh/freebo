import { describe, it, expect, vi } from "vitest";
import { MediaProxy } from "../../../electron/core/media-proxy";

describe("media proxy", () => {
  it("does not forward compressed Content-Length for a decoded subtitle body", async () => {
    const proxy = new MediaProxy();
    await proxy.open();
    const url = proxy.register(
      "https://server.test/subtitle",
      async () =>
        new Response("decoded subtitle text", {
          headers: {
            "Content-Encoding": "gzip",
            "Content-Length": "5",
            "Content-Type": "text/plain",
          },
        }),
    );
    try {
      const response = await fetch(url);
      expect(response.headers.get("content-length")).toBeNull();
      expect(await response.text()).toBe("decoded subtitle text");
    } finally {
      await proxy.close();
    }
  });
  it("keeps header credentials at the proxy and ignores player-supplied authentication", async () => {
    const proxy = new MediaProxy();
    await proxy.open();
    const upstream = vi.fn(async (_url: string, _init?: RequestInit) => new Response("media"));
    const url = proxy.register("https://server.test/video", upstream, {
      Authorization: "MediaBrowser Token=fixture",
      "X-Plex-Token": "fixture-token",
    });
    try {
      expect(url).not.toContain("fixture");
      await fetch(url, {
        headers: { Authorization: "spoofed", "X-Plex-Token": "spoofed", Range: "bytes=0-5" },
      });
      const headers = new Headers(upstream.mock.calls[0][1]?.headers);
      expect(headers.get("Authorization")).toBe("MediaBrowser Token=fixture");
      expect(headers.get("X-Plex-Token")).toBe("fixture-token");
      expect(headers.get("Range")).toBe("bytes=0-5");
    } finally {
      await proxy.close();
    }
  });
  it("keeps authenticated URLs private, streams range responses, and rejects unknown routes and methods", async () => {
    const proxy = new MediaProxy();
    await proxy.open();
    let upstreamRange: string | undefined;
    const playerUrl = proxy.register(
      "https://private.test/stream?api_key=secret",
      async (_url, init) => {
        upstreamRange = (init?.headers as Record<string, string> | undefined)?.range;
        return new Response("partial", {
          status: 206,
          headers: { "Content-Range": "bytes 0-6/100", "Accept-Ranges": "bytes" },
        });
      },
    );
    try {
      expect(playerUrl).not.toContain("secret");
      const result = await fetch(playerUrl, { headers: { Range: "bytes=0-6" } });
      expect(result.status).toBe(206);
      expect(upstreamRange).toBe("bytes=0-6");
      expect(result.headers.get("content-range")).toBe("bytes 0-6/100");
      expect(await result.text()).toBe("partial");
      expect((await fetch(`${new URL(playerUrl).origin}/unknown`)).status).toBe(404);
      expect((await fetch(playerUrl, { method: "POST" })).status).toBe(404);
    } finally {
      await proxy.close();
    }
  });
});
