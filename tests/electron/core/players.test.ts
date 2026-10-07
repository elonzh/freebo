import { describe, it, expect } from "vitest";
import { candidatePlayers, manualPlayer } from "../../../electron/core/players";

describe("player discovery", () => {
  it("looks for platform-specific installed applications and converts macOS app bundles", () => {
    expect(
      candidatePlayers("darwin", { PATH: "" }, "/home/me").some(
        (p) => p.executable === "/Applications/IINA.app/Contents/MacOS/iina-cli",
      ),
    ).toBe(true);
    expect(
      candidatePlayers("win32", { ProgramFiles: "C:/Program Files", PATH: "" }, "C:/Users/me").some(
        (p) => p.kind === "mpvnet",
      ),
    ).toBe(true);
    expect(
      candidatePlayers("linux", { PATH: "/custom/bin" }, "/home/me").some(
        (p) => p.executable === "/custom/bin/mpv",
      ),
    ).toBe(true);
    expect(
      candidatePlayers("win32", { PATH: "C:\\Portable;D:\\Media" }, "C:\\Users\\me").some(
        (p) => p.executable === "D:\\Media\\mpv.exe",
      ),
    ).toBe(true);
    expect(
      candidatePlayers("linux", { PATH: "/first:/second" }, "/home/me").some(
        (p) => p.executable === "/second/mpv",
      ),
    ).toBe(true);
    expect(manualPlayer("iina", "/Applications/IINA.app").executable).toBe(
      "/Applications/IINA.app/Contents/MacOS/iina-cli",
    );
    const windows = candidatePlayers(
      "win32",
      {
        ProgramFiles: "C:\\Program Files",
        "ProgramFiles(x86)": "C:\\Program Files (x86)",
        PATH: "D:\\Portable",
      },
      "C:\\Users\\me",
    );
    expect(windows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "potplayer",
          executable: "C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe",
        }),
        expect.objectContaining({
          kind: "mpc-hc",
          executable: "C:\\Program Files (x86)\\MPC-HC\\mpc-hc.exe",
        }),
        expect.objectContaining({ kind: "mpc-be", executable: "D:\\Portable\\mpc-be64.exe" }),
      ]),
    );
  });
});
