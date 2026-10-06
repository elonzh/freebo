import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProviderRegistry } from "../electron/providers/registry";
import { embyProvider } from "../electron/providers/emby";
import type { MediaServerProvider } from "../electron/providers/types";
import { SettingsStore } from "../electron/core/settings";
import { migrateLegacyProfile } from "../electron/core/profile-migration";
import {
  localizeError,
  messageKeys,
  resolveLocale,
  translate,
  UserFacingError,
} from "../src/shared/i18n";

describe("provider boundary and localization", () => {
  it("registers an independent provider and keeps its sessions apart from Emby", () => {
    const testProvider: MediaServerProvider = {
      id: "test",
      name: "Test",
      preload: "test.cjs",
      adapterScript: "",
      normalizeUrl: (input) => input,
      entryUrl: (server) => server.url,
      parsePlayback: () => {
        throw new Error("Not used");
      },
    };
    const registry = new ProviderRegistry([embyProvider, testProvider]);
    expect(registry.list()).toEqual([
      { id: "emby", name: "Emby Server" },
      { id: "test", name: "Test" },
    ]);
    expect(
      registry
        .get("test")
        .entryUrl({ id: "same", name: "Test", url: "https://test.example", providerId: "test" }),
    ).toBe("https://test.example");
    expect(registry.partition({ id: "same", providerId: "test" })).not.toBe(
      registry.partition({ id: "same", providerId: "emby" }),
    );
    expect(() => registry.get("missing")).toThrow("providerMissing");
    expect(() => new ProviderRegistry([testProvider, testProvider])).toThrow("Duplicate provider");
  });
  it("validates server ownership at the provider boundary including exact reverse-proxy prefixes", () => {
    const server = {
      id: "test",
      name: "Emby",
      url: "https://example.test/media",
      providerId: "emby",
    };
    const request = {
      auth: { baseUrl: "https://example.test/media/emby", userId: "u", token: "t", deviceId: "d" },
      intent: { itemIds: ["a"] },
    };
    expect(embyProvider.parsePlayback(request, server).intent.itemIds).toEqual(["a"]);
    expect(() =>
      embyProvider.parsePlayback(
        { ...request, auth: { ...request.auth, baseUrl: "https://example.test/media-other/emby" } },
        server,
      ),
    ).toThrow("playbackOrigin");
    expect(() =>
      embyProvider.parsePlayback(
        { ...request, auth: { ...request.auth, baseUrl: "https://other.test/media" } },
        server,
      ),
    ).toThrow("playbackOrigin");
  });
  it("treats blank video-version choices as unspecified while retaining ID validation", () => {
    const server = { id: "test", name: "Emby", url: "https://example.test", providerId: "emby" };
    const auth = { baseUrl: "https://example.test/emby", userId: "u", token: "t", deviceId: "d" };
    for (const mediaSourceId of [undefined, null, ""]) {
      const result = embyProvider.parsePlayback(
        { auth, intent: { itemIds: ["video"], mediaSourceId } },
        server,
      );
      expect(result.intent.mediaSourceId).toBeUndefined();
    }
    const chosen = embyProvider.parsePlayback(
      { auth, intent: { itemIds: ["video"], mediaSourceId: "version-1" } },
      server,
    );
    expect(chosen.intent.mediaSourceId).toBe("version-1");
    for (const mediaSourceId of [42, "x".repeat(201)]) {
      expect(() =>
        embyProvider.parsePlayback({ auth, intent: { itemIds: ["video"], mediaSourceId } }, server),
      ).toThrow();
    }
    expect(() =>
      embyProvider.parsePlayback({ auth, intent: { itemIds: [""], mediaSourceId: "" } }, server),
    ).toThrow();
  });
  it("translates every message and re-localizes an existing serialized error", () => {
    for (const key of messageKeys) {
      expect(translate("zh", key)).not.toBe("");
      expect(translate("en", key)).not.toBe("");
      if (key !== "brand") expect(translate("en", key)).not.toMatch(/[\u4e00-\u9fff]/);
    }
    expect(resolveLocale("system", "zh-CN")).toBe("zh");
    expect(resolveLocale("system", "de-DE")).toBe("en");
    expect(resolveLocale("en", "zh-TW")).toBe("en");
    const error = new UserFacingError("webFailed", { code: -105 });
    expect(localizeError("en", error)).toContain("Cannot open");
    expect(localizeError("zh", error)).toContain("无法打开（-105）");
    expect(
      localizeError(
        "en",
        `Error invoking remote method 'app:save-server': Error: ${new UserFacingError("serverDuplicate").message}`,
      ),
    ).toBe(
      "This server has already been added. Open it from Home or edit the existing server in Settings.",
    );
  });
});
describe("existing-user migration", () => {
  it("adds provider and language defaults to old settings and persists a new language", async () => {
    const directory = await mkdtemp(join(tmpdir(), "freebo-settings-"));
    const file = join(directory, "settings.json");
    const id = "01234567-89ab-4cde-8fab-0123456789ab";
    await writeFile(
      file,
      JSON.stringify({
        servers: [{ id, name: "Home", url: "https://example.test" }],
        activeServerId: id,
        players: [],
        autoNext: true,
        fullscreen: false,
        theme: "system",
      }),
    );
    const store = new SettingsStore(file);
    await store.load();
    expect(store.value.language).toBe("system");
    expect(store.value.servers[0].providerId).toBe("emby");
    expect(new ProviderRegistry([embyProvider]).partition(store.value.servers[0])).toBe(
      `persist:emby-${id}`,
    );
    await store.save({ ...store.value, language: "en" });
    const reopened = new SettingsStore(file);
    expect((await reopened.load()).language).toBe("en");
  });
  it("copies settings and browser sessions without overwriting an existing profile", async () => {
    const directory = await mkdtemp(join(tmpdir(), "freebo-profile-"));
    const legacy = join(directory, "legacy");
    const current = join(directory, "Freebo");
    await mkdir(join(legacy, "Partitions", "emby-test"), { recursive: true });
    await writeFile(join(legacy, "settings.json"), "old settings");
    await writeFile(join(legacy, "Partitions", "emby-test", "Cookies"), "fake session");
    expect(await migrateLegacyProfile(current, [legacy])).toBe(true);
    expect(await readFile(join(current, "Partitions", "emby-test", "Cookies"), "utf8")).toBe(
      "fake session",
    );
    await writeFile(join(current, "settings.json"), "new settings");
    expect(await migrateLegacyProfile(current, [legacy])).toBe(false);
    expect(await readFile(join(current, "settings.json"), "utf8")).toBe("new settings");
    expect(await readFile(join(legacy, "settings.json"), "utf8")).toBe("old settings");
  });
});
