import { describe, expect, it } from "vitest";
import { sessionProcessId } from "../electron/core/player-focus";
describe("matching a player window to its playback session", () => {
  it("selects the exact IINA instance by executable and IPC marker, including paths with spaces", () => {
    const executable = "/Applications/Media Players/IINA.app/Contents/MacOS/IINA";
    const processes = ` 12 ${executable} --mpv-input-ipc-server=/tmp/old.sock video\n 13 ${executable} --mpv-input-ipc-server=/tmp/current.sock-long video\n 14 /bin/other --mpv-input-ipc-server=/tmp/current.sock\n 15 ${executable} --mpv-input-ipc-server=/tmp/current.sock video`;
    expect(
      sessionProcessId(processes, executable, "--mpv-input-ipc-server=/tmp/current.sock"),
    ).toBe(15);
    expect(
      sessionProcessId(processes, executable, "--mpv-input-ipc-server=/tmp/absent.sock"),
    ).toBeUndefined();
    expect(
      sessionProcessId(
        ` 16 ${executable} --mpv-input-ipc-server=/tmp/with space/session.sock video`,
        executable,
        "--mpv-input-ipc-server=/tmp/with space/session.sock",
      ),
    ).toBe(16);
  });
});
