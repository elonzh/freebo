import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Fetcher } from "../providers/types";

// Keep browser cookies and server tokens in the app, while preserving Range requests.
export class MediaProxy {
  private server?: Server;
  private port = 0;
  private routes = new Map<
    string,
    { url: string; fetcher: Fetcher; headers: Record<string, string> }
  >();
  async open(): Promise<void> {
    this.server = createServer(async (request, response) => {
      const route = this.routes.get((request.url ?? "").split("?")[0]);
      if (
        !route ||
        !["GET", "HEAD"].includes(request.method ?? "") ||
        !["127.0.0.1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "")
      ) {
        response.writeHead(404).end();
        return;
      }
      const controller = new AbortController();
      response.on("close", () => controller.abort());
      try {
        const headers: Record<string, string> = { ...route.headers };
        for (const key of ["range", "if-range", "if-none-match", "if-modified-since"])
          if (typeof request.headers[key] === "string") headers[key] = request.headers[key];
        const upstream = await route.fetcher(route.url, {
          method: request.method,
          headers,
          ...(Object.keys(route.headers).length ? { redirect: "error" as const } : {}),
          signal: controller.signal,
        });
        const forwarded: Record<string, string> = {};
        // Fetch decodes compressed bodies; the upstream length describes encoded bytes.
        const encoding = upstream.headers.get("content-encoding");
        for (const key of [
          "content-type",
          "content-range",
          "content-length",
          "accept-ranges",
          "etag",
          "last-modified",
        ]) {
          if (key === "content-length" && encoding && encoding !== "identity") continue;
          const value = upstream.headers.get(key);
          if (value) forwarded[key] = value;
        }
        response.writeHead(upstream.status, forwarded);
        if (request.method === "HEAD" || !upstream.body) response.end();
        else
          await pipeline(
            Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream),
            response,
          );
      } catch {
        if (!response.headersSent) response.writeHead(502).end("Media connection failed");
        else response.destroy();
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", () => {
        const address = this.server!.address();
        this.port = typeof address === "object" && address ? address.port : 0;
        resolve();
      });
    });
  }
  register(url: string, fetcher: Fetcher, headers: Record<string, string> = {}): string {
    const key = `/media/${randomBytes(24).toString("hex")}`;
    this.routes.set(key, { url, fetcher, headers });
    return `http://127.0.0.1:${this.port}${key}`;
  }
  clear(): void {
    this.routes.clear();
  }
  async close(): Promise<void> {
    this.clear();
    this.server?.closeAllConnections();
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
  }
}
