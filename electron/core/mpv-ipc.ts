import { UserFacingError, errorToken } from "../../src/shared/i18n";
import { connect, type Socket } from "node:net";
import { EventEmitter } from "node:events";

export class MpvIPC extends EventEmitter {
  private socket?: Socket;
  private sequence = 0;
  private buffer = "";
  private pending = new Map<
    number,
    { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >();
  async open(path: string, timeout = 12_000): Promise<void> {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        this.socket = await new Promise<Socket>((resolve, reject) => {
          const socket = connect(path);
          socket.once("connect", () => {
            socket.removeListener("error", reject);
            resolve(socket);
          });
          socket.once("error", (error) => {
            socket.destroy();
            reject(error);
          });
        });
        this.socket.on("data", (data) => this.consume(data.toString()));
        this.socket.on("error", (error) => this.emit("disconnected", error));
        this.socket.on("close", () => {
          this.rejectPending();
          this.emit("disconnected");
        });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    throw new UserFacingError("ipcConnection");
  }
  command<T = unknown>(command: unknown[]): Promise<T> {
    if (!this.socket || this.socket.destroyed)
      return Promise.reject(new UserFacingError("ipcClosed"));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new UserFacingError("ipcTimeout"));
      }, 5_000);
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      this.socket!.write(`${JSON.stringify({ command, request_id: id })}\n`);
    });
  }
  private consume(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > 4_000_000) {
      this.socket?.destroy();
      return;
    }
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      try {
        const message = JSON.parse(line);
        if (message.request_id) {
          const pending = this.pending.get(message.request_id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(message.request_id);
            if (message.error === "success") pending.resolve(message.data);
            else pending.reject(new Error(errorToken("ipcCommand", { detail: message.error })));
          }
        }
        if (message.event) this.emit("event", message);
      } catch {
        /* Ignore malformed diagnostics from third-party scripts. */
      }
    }
  }
  close(): void {
    this.rejectPending();
    this.socket?.destroy();
  }
  private rejectPending(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new UserFacingError("ipcClosed"));
    }
    this.pending.clear();
  }
}
