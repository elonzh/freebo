import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  defaultSettings,
  normalizeServerUrl,
  SettingsStore,
  settingsSchema,
} from "../../../electron/core/settings";
import type { Settings } from "../../../src/shared/types";
import { embyProvider } from "../../../electron/providers/emby";
import { serverLabel } from "../../../src/shared/servers";

const settingsDirectories: string[] = [];
async function settingsFile() {
  const directory = await mkdtemp(join(tmpdir(), "freebo-settings-test-"));
  settingsDirectories.push(directory);
  return join(directory, "settings.json");
}
afterEach(async () => {
  await Promise.all(
    settingsDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function configuredSettings(): Settings {
  const serverId = "01234567-89ab-4cde-8fab-0123456789ab";
  return {
    ...structuredClone(defaultSettings),
    servers: [{ id: serverId, name: "Home", url: "https://example.test", providerId: "jellyfin" }],
    activeServerId: serverId,
    players: [
      { id: "mpv", kind: "mpv", name: "mpv", executable: "/test/mpv", prefixArgs: ["--no-config"] },
    ],
    defaultPlayerId: "mpv",
    autoNext: false,
    fullscreen: true,
    theme: "dark",
    language: "en",
    setupCompleted: true,
    playerScanCompleted: true,
    runInBackground: false,
    remindOnClose: false,
  };
}

describe("server settings", () => {
  it("persists an empty optional name and uses the normalized address as its display label", async () => {
    const file = await settingsFile();
    const store = new SettingsStore(file);
    const server = await store.upsertServer({
      name: "   ",
      url: "https://home.test/",
      providerId: "emby",
    });
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
    const file = await settingsFile();
    const store = new SettingsStore(file);
    await store.load();
    const server = await store.upsertServer({
      name: "Home",
      url: "https://home.test",
      providerId: "emby",
    });
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
        providerId: "emby",
      }),
    ).rejects.toThrow("serverDuplicate");
  });
});

describe("settings defaults and unknown fields", () => {
  it("persists background and reminder preferences", async () => {
    const file = await settingsFile();
    const store = new SettingsStore(file);
    expect(await store.load()).toMatchObject({ runInBackground: true, remindOnClose: true });
    await store.save({ ...store.value, runInBackground: false, remindOnClose: false });
    expect(await new SettingsStore(file).load()).toMatchObject({
      runInBackground: false,
      remindOnClose: false,
    });
  });
  it.each(Object.keys(defaultSettings) as (keyof Settings)[])(
    "fills a missing %s without resetting other settings or rewriting the file",
    async (field) => {
      const file = await settingsFile();
      const settings: Partial<Settings> = configuredSettings();
      delete settings[field];
      const serialized = JSON.stringify(settings);
      await writeFile(file, serialized);
      const report = vi.fn();
      const store = new SettingsStore(file, report);
      expect(await store.load()).toEqual({
        ...configuredSettings(),
        [field]: defaultSettings[field],
      });
      expect(report).not.toHaveBeenCalled();
      expect(await readFile(file, "utf8")).toBe(serialized);
    },
  );

  it("ignores additional fields at the root and within server and player records", async () => {
    const file = await settingsFile();
    const settings = configuredSettings();
    const serialized = JSON.stringify({
      ...settings,
      futurePreferences: { enabled: true },
      servers: settings.servers.map((server) => ({ ...server, futureServerField: "extra" })),
      players: settings.players.map((player) => ({ ...player, futurePlayerField: "extra" })),
    });
    await writeFile(file, serialized);
    const report = vi.fn();
    expect(await new SettingsStore(file, report).load()).toEqual(settings);
    expect(report).not.toHaveBeenCalled();
    expect(await readFile(file, "utf8")).toBe(serialized);
  });

  it("uses simple defaults for absent server type, name and player arguments", async () => {
    const file = await settingsFile();
    const settings = configuredSettings();
    const server = settings.servers[0];
    await writeFile(
      file,
      JSON.stringify({
        ...settings,
        servers: [{ id: server.id, url: server.url }],
        players: [{ id: "mpv", kind: "mpv", name: "mpv", executable: "/test/mpv" }],
      }),
    );
    const report = vi.fn();
    expect(await new SettingsStore(file, report).load()).toEqual({
      ...settings,
      servers: [{ ...server, providerId: "emby", name: "" }],
      players: [{ ...settings.players[0], prefixArgs: [] }],
    });
    expect(report).not.toHaveBeenCalled();
  });

  it("keeps default collections independent across parses and from the default settings", () => {
    const first = settingsSchema.parse({});
    const second = settingsSchema.parse({});
    first.servers.push(configuredSettings().servers[0]);
    first.players.push(configuredSettings().players[0]);
    expect(second).toEqual(defaultSettings);
    expect(defaultSettings.servers).toEqual([]);
    expect(defaultSettings.players).toEqual([]);
  });
});

describe("settings recovery", () => {
  it.each([
    ["language", "unsupported"],
    ["runInBackground", "false"],
    ["remindOnClose", null],
  ])("resets an invalid %s rather than hiding it behind a default", async (field, value) => {
    const file = await settingsFile();
    await writeFile(file, JSON.stringify({ ...configuredSettings(), [field as string]: value }));
    const report = vi.fn();
    expect(await new SettingsStore(file, report).load()).toEqual(defaultSettings);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(defaultSettings);
    expect(report.mock.calls).toEqual([
      [{ type: "read-failed", reason: expect.stringContaining(field) }],
      [{ type: "reset" }],
    ]);
  });

  it.each([
    ["servers", "id"],
    ["servers", "url"],
    ["players", "executable"],
  ] as const)("resets a missing core %s.%s field", async (group, field) => {
    const file = await settingsFile();
    const settings = configuredSettings();
    await writeFile(
      file,
      JSON.stringify({
        ...settings,
        [group]: [{ ...settings[group][0], [field]: undefined }],
      }),
    );
    const report = vi.fn();
    expect(await new SettingsStore(file, report).load()).toEqual(defaultSettings);
    expect(report.mock.calls).toEqual([
      [{ type: "read-failed", reason: expect.stringContaining(field) }],
      [{ type: "reset" }],
    ]);
  });

  it("resets malformed JSON without including configuration fragments in diagnostics", async () => {
    const file = await settingsFile();
    await writeFile(file, '{"servers":[{"name":"PRIVATE_SERVER"}],"secret":"PRIVATE_TOKEN",}');
    const report = vi.fn();
    const store = new SettingsStore(file, report);
    expect(await store.load()).toEqual(defaultSettings);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(defaultSettings);
    expect(report.mock.calls[0]).toEqual([
      { type: "read-failed", reason: expect.stringContaining("Invalid JSON") },
    ]);
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/PRIVATE_SERVER|PRIVATE_TOKEN/);
  });

  it("keeps defaults usable and records both failures when the file cannot be read or replaced", async () => {
    const file = await settingsFile();
    await mkdir(file);
    const report = vi.fn();
    const store = new SettingsStore(file, report);
    expect(await store.load()).toEqual(defaultSettings);
    expect(store.value).toEqual(defaultSettings);
    expect(report.mock.calls).toEqual([
      [{ type: "read-failed", reason: "EISDIR" }],
      [{ type: "reset-failed", reason: expect.any(String) }],
    ]);
  });

  it("loads a fresh profile without reporting an ordinary missing file as an error", async () => {
    const file = await settingsFile();
    const report = vi.fn();
    expect(await new SettingsStore(file, report).load()).toEqual(defaultSettings);
    expect(report).not.toHaveBeenCalled();
  });
});
