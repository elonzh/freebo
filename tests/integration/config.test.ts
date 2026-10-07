import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  endpointsFromCompose,
  fixtureSettings,
  integrationPaths,
  integrationProject,
  integrationDebugArguments,
} from "../../scripts/integration/config";
import { defaultSettings } from "../../electron/core/settings";

const compose = {
  services: {
    emby: { ports: [{ host_ip: "127.0.0.1", target: 8096, published: "18097" }] },
    jellyfin: { ports: [{ host_ip: "127.0.0.1", target: 8096, published: "18096" }] },
    plex: { ports: [{ host_ip: "127.0.0.1", target: 32400, published: "13240" }] },
  },
};
describe("integration environment isolation", () => {
  it("enables optional Electron debugging only on a valid loopback port", () => {
    expect(integrationDebugArguments()).toEqual([]);
    expect(integrationDebugArguments("9228")).toEqual([
      "--remote-debugging-port=9228",
      "--remote-debugging-address=127.0.0.1",
    ]);
    for (const input of ["0", "80", "65536", "9228 --other-flag"])
      expect(() => integrationDebugArguments(input)).toThrow();
  });
  it("uses resolved Compose ports, including custom overrides", () => {
    const custom = structuredClone(compose);
    custom.services.emby.ports[0].published = "28097";
    expect(endpointsFromCompose(custom)).toEqual({
      emby: "http://127.0.0.1:28097",
      jellyfin: "http://127.0.0.1:18096",
      plex: "http://127.0.0.1:13240",
    });
  });
  it("rejects non-loopback ports and missing provider services", () => {
    const publicPorts = structuredClone(compose);
    publicPorts.services.plex.ports[0].host_ip = "0.0.0.0";
    expect(() => endpointsFromCompose(publicPorts)).toThrow("127.0.0.1");
    expect(() => endpointsFromCompose({ services: {} })).toThrow("integration service");
  });
  it("limits reset paths and project names to the Freebo integration namespace", () => {
    expect(integrationProject("freebo-integration-branch-1")).toBe("freebo-integration-branch-1");
    for (const input of [
      "production",
      "../freebo",
      "freebo-integration/../../app",
      "freebo-integration-",
    ])
      expect(() => integrationProject(input)).toThrow();
    expect(integrationPaths("/workspace", "freebo-integration").app).toBe(
      join("/workspace", ".integration/freebo-integration/app"),
    );
  });
  it("preserves test player preferences and server IDs while refreshing fixture addresses", () => {
    const endpoints = endpointsFromCompose(compose);
    const initial = fixtureSettings(endpoints);
    const previous = {
      ...initial,
      setupCompleted: true,
      theme: "dark" as const,
      defaultPlayerId: "player",
      players: [
        { id: "player", kind: "mpv" as const, name: "mpv", executable: "/mpv", prefixArgs: [] },
      ],
    };
    const updated = fixtureSettings({ ...endpoints, plex: "http://127.0.0.1:23240" }, previous);
    expect(updated.players).toEqual(previous.players);
    expect(updated.setupCompleted).toBe(true);
    expect(updated.theme).toBe("dark");
    expect(updated.servers.map((s) => s.id)).toEqual(initial.servers.map((s) => s.id));
    expect(updated.servers[2].url).toBe("http://127.0.0.1:23240");
    expect(defaultSettings.servers).toEqual([]);
  });
});
