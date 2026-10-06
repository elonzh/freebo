import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { MpvIPC } from "../electron/core/mpv-ipc";
import { MediaProxy } from "../electron/core/media-proxy";

describe("player transport", () => {
  it("handles split JSON packets and correlates asynchronous IPC replies", async () => {
    const path =
      process.platform === "win32"
        ? `\\\\.\\pipe\\efp-test-${randomUUID()}`
        : join(tmpdir(), `efp-test-${randomUUID()}.sock`);
    const server = createServer((socket) => {
      socket.on("data", (data) => {
        for (const line of data.toString().trim().split("\n")) {
          const request = JSON.parse(line);
          const reply = JSON.stringify({
            request_id: request.request_id,
            error: "success",
            data: request.command[1],
          });
          socket.write(reply.slice(0, 7));
          socket.write(`${reply.slice(7)}\n`);
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(path, resolve));
    const ipc = new MpvIPC();
    try {
      await ipc.open(path);
      expect(
        await Promise.all([
          ipc.command(["get_property", "time-pos"]),
          ipc.command(["get_property", "pause"]),
        ]),
      ).toEqual(["time-pos", "pause"]);
    } finally {
      ipc.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
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
