import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { normalizeServerUrl, SettingsStore } from "../electron/core/settings";
import { candidatePlayers, manualPlayer } from "../electron/core/players";
import { embyProvider } from "../electron/providers/emby";
import { redact } from "../electron/core/redact";
import { serverLabel } from "../src/shared/servers";

describe("server and player setup", () => {
  it("persists an empty optional name and uses the normalized address as its display label", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "freebo-settings-")), "settings.json");
    const store = new SettingsStore(file);
    const server = await store.upsertServer({ name: "   ", url: "https://home.test/" });
    expect(server.name).toBe("");
    expect(serverLabel(server)).toBe("https://home.test");
    const reloaded = await new SettingsStore(file).load();
    expect(reloaded.servers[0].name).toBe("");
    expect(serverLabel({ ...server, name: "Home" })).toBe("Home");
  });
  it("normalizes web links and reverse-proxy roots without credentials", () => {
    expect(
      embyProvider.normalizeUrl(" https://example.test:443/media/web/index.html#!/home "),
    ).toBe("https://example.test/media");
    expect(normalizeServerUrl("https://other.test/custom/web/index.html")).toBe(
      "https://other.test/custom/web/index.html",
    );
    expect(normalizeServerUrl("example.test:8096")).toBe("https://example.test:8096");
    expect(() => normalizeServerUrl("https://user:password@example.test")).toThrow("invalidUrl");
    expect(() => normalizeServerUrl("file:///Applications")).toThrow("invalidUrl");
    expect(() => normalizeServerUrl("http://")).toThrow("invalidUrl");
  });
  it("serializes concurrent saves and persists server UUIDs without an account password", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "efp-settings-")), "settings.json");
    const store = new SettingsStore(file);
    await store.load();
    const server = await store.upsertServer({ name: "Home", url: "https://home.test" });
    await Promise.all([
      store.save({ ...store.value, fullscreen: true }),
      store.save({ ...store.value, theme: "dark" }),
    ]);
    const saved = JSON.parse(await readFile(file, "utf8"));
    expect(saved.theme).toBe("dark");
    expect(saved.servers[0].id).toBe(server.id);
    expect(saved).not.toHaveProperty("password");
    await expect(
      store.upsertServer({
        name: "Duplicate",
        url: embyProvider.normalizeUrl("https://home.test/web/"),
      }),
    ).rejects.toThrow("serverDuplicate");
  });
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
  it("redacts query credentials and authentication headers from errors", () => {
    const text = redact(
      "https://server.test/video?api_key=secret&X-Emby-Token=token Cookie: cookie\nPassword: pass",
    );
    expect(text).not.toContain("secret");
    expect(text).not.toContain("=token");
    expect(text).not.toContain("cookie\n");
    expect(text).not.toContain(": pass");
  });
});
