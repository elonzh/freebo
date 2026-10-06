import type { Fetcher } from "../providers/types";

const maxBytes = 512 * 1024;
function imageUrl(bytes: Buffer): string | undefined {
  if (!bytes.length || bytes.length > maxBytes) return;
  const hex = bytes.subarray(0, 12).toString("hex");
  const prefix = bytes.subarray(0, 256).toString("utf8");
  const mime = hex.startsWith("89504e470d0a1a0a")
    ? "image/png"
    : hex.startsWith("ffd8ff")
      ? "image/jpeg"
      : hex.startsWith("00000100")
        ? "image/x-icon"
        : /^GIF8[79]a/.test(prefix)
          ? "image/gif"
          : prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP"
            ? "image/webp"
            : /^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(prefix)
              ? "image/svg+xml"
              : undefined;
  return mime ? `data:${mime};base64,${bytes.toString("base64")}` : undefined;
}

/** Keep remote image requests in the server session and the owned renderer's CSP unchanged. */
export async function loadFavicon(
  candidates: string[],
  fetcher: Fetcher,
): Promise<string | undefined> {
  const signal = AbortSignal.timeout(8_000);
  for (const candidate of [...new Set(candidates)].slice(0, 4)) {
    try {
      if (candidate.length > maxBytes * 3) continue;
      const url = new URL(candidate);
      if (url.protocol === "data:") {
        const comma = candidate.indexOf(",");
        const metadata = candidate.slice(0, comma);
        if (!/^data:image\//i.test(metadata)) continue;
        const value = candidate.slice(comma + 1);
        const icon = imageUrl(
          /;base64$/i.test(metadata)
            ? Buffer.from(value, "base64")
            : Buffer.from(decodeURIComponent(value)),
        );
        if (icon) return icon;
        continue;
      }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) continue;
      const response = await fetcher(url.href, { signal });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        continue;
      }
      if (Number(response.headers.get("content-length")) > maxBytes) {
        await response.body.cancel();
        continue;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(chunk.value);
      }
      if (size <= maxBytes) {
        const icon = imageUrl(Buffer.concat(chunks));
        if (icon) return icon;
      }
    } catch {
      // Missing, blocked or invalid favicons leave the tab's generic icon intact.
    }
    if (signal.aborted) break;
  }
}
