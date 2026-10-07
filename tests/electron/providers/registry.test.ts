import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "../../../electron/providers/registry";
import { embyProvider } from "../../../electron/providers/emby";
import type { MediaServerProvider } from "../../../electron/providers/types";

describe("provider registry", () => {
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
});
