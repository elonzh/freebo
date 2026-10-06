import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { windowsNativeSource } from "./windows-native-source";

export interface NativeStatus {
  loaded: boolean;
  position: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  stopped?: boolean;
}
export interface NativeBridge {
  open: () => Promise<string>;
  request: <T = unknown>(action: string, data?: Record<string, unknown>) => Promise<T>;
  close: () => void;
}

export class WindowsNativeBridge implements NativeBridge {
  private child?: ChildProcessWithoutNullStreams;
  private sequence = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  async open(): Promise<string> {
    const source = Buffer.from(windowsNativeSource).toString("base64");
    const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${source}'))) -ReferencedAssemblies System.dll,System.Core.dll,System.Windows.Forms.dll,System.Web.Extensions.dll; [FreeboNative]::Run()`;
    const child = (this.child = spawn(
      join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe",
      ),
      [
        "-NoProfile",
        "-STA",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ],
      { shell: false, windowsHide: true, stdio: "pipe" },
    ));
    const lines = createInterface({ input: child.stdout });
    child.stdin.on("error", () => {});
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2_000);
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.close();
        reject(new Error("Windows player bridge timed out"));
      }, 15_000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        const error = new Error(`Windows player bridge closed${stderr ? `: ${stderr}` : ""}`);
        reject(error);
        for (const request of this.pending.values()) request.reject(error);
        this.pending.clear();
      });
      lines.on("line", (line) => {
        let message: { ready?: string; id?: number; result?: unknown; error?: string };
        try {
          message = JSON.parse(line);
        } catch {
          return;
        }
        if (message.ready) {
          clearTimeout(timer);
          resolve(message.ready);
        }
        if (message.id !== undefined) {
          const request = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) request?.reject(new Error(message.error));
          else request?.resolve(message.result);
        }
      });
    });
  }
  request<T = unknown>(action: string, data: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Windows player command timed out"));
      }, 3_000);
      this.pending.set(id, {
        resolve: (value) => {
          this.pending.delete(id);
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(error);
        },
      });
      if (!this.child?.stdin.writable)
        this.pending.get(id)?.reject(new Error("Windows player bridge unavailable"));
      else this.child.stdin.write(`${JSON.stringify({ ...data, id, action })}\n`);
    });
  }
  close(): void {
    for (const request of this.pending.values())
      request.reject(new Error("Windows player bridge closed"));
    this.pending.clear();
    this.child?.stdin.end();
    this.child?.kill();
  }
}
