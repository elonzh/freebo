import { expect, it, vi } from "vitest";
import { loadFavicon } from "../../../electron/core/favicon";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jc1kAAAAASUVORK5CYII=",
  "base64",
);
const imageResponse = () =>
  new Response(png, { headers: { "content-type": "application/octet-stream" } });
it("loads the advertised favicon into a local data URL even when an ICO-style server uses an opaque MIME type", async () => {
  const fetcher = vi.fn(async () => imageResponse());
  const icon = await loadFavicon(["https://example.test/media/icon.png"], fetcher);
  expect(icon).toBe(`data:image/png;base64,${png.toString("base64")}`);
  expect(fetcher).toHaveBeenCalledWith(
    "https://example.test/media/icon.png",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
it("skips unsafe URLs and falls back from an error or HTML response to a working favicon", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(
      new Response("<html>Login</html>", { headers: { "content-type": "image/png" } }),
    )
    .mockResolvedValueOnce(imageResponse());
  await expect(
    loadFavicon(
      [
        "https://example.test/missing.ico",
        "https://example.test/blocked.ico",
        "https://example.test/icon.png",
      ],
      fetcher,
    ),
  ).resolves.toContain("data:image/png;base64,");
  const unsafe = vi.fn();
  await expect(
    loadFavicon(
      ["file:///etc/passwd", "javascript:alert(1)", "https://user:password@example.test/icon.png"],
      unsafe,
    ),
  ).resolves.toBeUndefined();
  expect(unsafe).not.toHaveBeenCalled();
});
it("supports inline SVG favicons without passing a website's remote URL to the owned renderer", async () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle r="7" cx="8" cy="8"/></svg>';
  const fetcher = vi.fn();
  await expect(
    loadFavicon([`data:image/svg+xml,${encodeURIComponent(svg)}`], fetcher),
  ).resolves.toBe(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects oversized images based on both the declared length and streamed bytes", async () => {
  const cancel = vi.fn();
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(png);
        controller.enqueue(new Uint8Array(512 * 1024));
      },
      cancel,
    }),
  );
  await expect(
    loadFavicon(["https://example.test/large.png"], async () => response),
  ).resolves.toBeUndefined();
  expect(cancel).toHaveBeenCalledOnce();
  const declared = new Response(png, { headers: { "content-length": String(512 * 1024 + 1) } });
  await expect(
    loadFavicon(["https://example.test/large.png"], async () => declared),
  ).resolves.toBeUndefined();
});
it("limits repeated and failing favicon candidates", async () => {
  const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
  await expect(
    loadFavicon(
      Array.from({ length: 12 }, (_, index) => `https://example.test/${Math.floor(index / 2)}.ico`),
      fetcher,
    ),
  ).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(4);
});
