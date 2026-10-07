import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { MpvIPC } from "../../../electron/core/mpv-ipc";

describe("mpv IPC transport", () => {
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
});
