import { spawn, execFile } from "node:child_process";
import type { Player } from "../../src/shared/types";
import { WindowsNativeBridge } from "./windows-native";

export function sessionProcessId(
  processes: string,
  executable: string,
  marker: string,
): number | undefined {
  for (const line of processes.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (
      match &&
      match[2].startsWith(`${executable} `) &&
      (match[2].includes(` ${marker} `) || match[2].endsWith(` ${marker}`))
    )
      return Number(match[1]);
  }
}
export async function iinaProcessId(player: Player, socket: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    execFile(
      "/bin/ps",
      ["-axo", "pid=,args="],
      { timeout: 2_000, maxBuffer: 2_000_000 },
      (error, stdout) => {
        resolve(
          error
            ? undefined
            : sessionProcessId(
                stdout,
                player.executable.replace(/iina-cli$/, "IINA"),
                `--mpv-input-ipc-server=${socket}`,
              ),
        );
      },
    );
  });
}
export async function activatePlayer(player: Player, pid?: number): Promise<boolean | undefined> {
  if (process.platform === "darwin") {
    const bundle = player.executable.match(/^(.+\.app)\//)?.[1];
    if (!bundle && !pid) return;
    return new Promise<boolean>((resolve) => {
      // Cocoa activation by PID avoids choosing an older instance of IINA.
      // Calling AppKit directly needs no System Events / Accessibility permission.
      const script =
        'function run(argv) { ObjC.import("AppKit"); var app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(Number(argv[0])); return app.activateWithOptions(2); }';
      const child = pid
        ? spawn("/usr/bin/osascript", ["-l", "JavaScript", "-e", script, String(pid)], {
            stdio: ["ignore", "pipe", "ignore"],
            shell: false,
            timeout: 3_000,
          })
        : spawn("/usr/bin/open", ["-a", bundle!], { stdio: "ignore", shell: false });
      let result = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        result = (result + chunk.toString()).slice(-32);
      });
      child.once("error", () => resolve(false));
      child.once("close", (code) => resolve(code === 0 && (!pid || result.trim() === "true")));
    });
  } else if (process.platform === "win32" && pid) {
    const bridge = new WindowsNativeBridge();
    try {
      await bridge.open();
      await bridge.request("target", { pid });
      return Boolean(await bridge.request("activate"));
    } catch {
      return false;
    } finally {
      bridge.close();
    }
  }
}
