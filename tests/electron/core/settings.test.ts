import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  defaultSettings,
  normalizeServerUrl,
  SettingsStore,
} from "../../../electron/core/settings";
import { embyProvider } from "../../../electron/providers/emby";
import { serverLabel } from "../../../src/shared/servers";

describe("server settings", () => {
  it("persists an empty optional name and uses the normalized address as its display label", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "freebo-settings-")), "settings.json");
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
    const file = join(await mkdtemp(join(tmpdir(), "efp-settings-")), "settings.json");
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

describe("current settings format", () => {
  it.each(["providerId", "language", "setupCompleted", "playerScanCompleted"])(
    "rejects a missing %s without rewriting the stored file",
    async (field) => {
      const directory = await mkdtemp(join(tmpdir(), "freebo-settings-"));
      const file = join(directory, "settings.json");
      const id = "01234567-89ab-4cde-8fab-0123456789ab";
      const settings: Record<string, unknown> = {
        ...structuredClone(defaultSettings),
        servers: [{ id, name: "Home", url: "https://example.test", providerId: "emby" }],
      };
      if (field === "providerId")
        settings.servers = [{ id, name: "Home", url: "https://example.test" }];
      else delete settings[field];
      const serialized = JSON.stringify(settings);
      await writeFile(file, serialized);
      await expect(new SettingsStore(file).load()).rejects.toThrow("settingsUnreadable");
      expect(await readFile(file, "utf8")).toBe(serialized);
    },
  );
});
