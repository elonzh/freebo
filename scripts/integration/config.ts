import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultSettings } from "../../electron/core/settings";
import type { Settings, Server } from "../../src/shared/types";

export const fixtureCredentials = { username: "freebo", password: "freebo-integration-only" };
export const providerIds = ["emby", "jellyfin", "plex"] as const;
export type ProviderId = (typeof providerIds)[number];
export type Endpoints = Record<ProviderId, string>;
export interface FixtureServer {
  baseUrl: string;
  version: string;
  serverId: string;
  userId?: string;
  token: string;
  movieId: string;
  episodeId: string;
}
export interface FixtureState {
  project: string;
  createdAt: string;
  servers: Record<ProviderId, FixtureServer>;
}

export function integrationProject(input = "freebo-integration"): string {
  if (!/^freebo-integration(?:-[a-z0-9][a-z0-9-]*)?$/.test(input))
    throw new Error(
      "FREEBO_INTEGRATION_PROJECT must be freebo-integration or freebo-integration-<suffix>.",
    );
  return input;
}
export function integrationDebugArguments(input?: string): string[] {
  if (!input) return [];
  if (!/^\d+$/.test(input) || Number(input) < 1024 || Number(input) > 65535)
    throw new Error("FREEBO_INTEGRATION_DEBUG_PORT must be between 1024 and 65535.");
  return [`--remote-debugging-port=${input}`, "--remote-debugging-address=127.0.0.1"];
}
export function integrationPaths(root: string, project: string) {
  const directory = join(root, ".integration", integrationProject(project));
  return {
    directory,
    state: join(directory, "state.json"),
    report: join(directory, "report.json"),
    app: join(directory, "app"),
  };
}
export function endpointsFromCompose(config: {
  services: Record<
    string,
    { ports?: { host_ip?: string; published?: string | number; target?: number }[] }
  >;
}): Endpoints {
  return Object.fromEntries(
    providerIds.map((id) => {
      const port = config.services[id]?.ports?.find(
        (entry) => entry.target === (id === "plex" ? 32400 : 8096),
      );
      if (!port || port.host_ip !== "127.0.0.1" || !/^\d+$/.test(String(port.published)))
        throw new Error(`The ${id} integration service must publish a single port on 127.0.0.1.`);
      const number = Number(port.published);
      if (number < 1 || number > 65535) throw new Error(`Invalid ${id} integration port.`);
      return [id, `http://127.0.0.1:${number}`];
    }),
  ) as Endpoints;
}
export function fixtureSettings(endpoints: Endpoints, previous?: Settings): Settings {
  const servers = providerIds.map((providerId): Server => ({
    id: previous?.servers.find((entry) => entry.providerId === providerId)?.id ?? randomUUID(),
    providerId,
    name: `${providerId === "emby" ? "Emby" : providerId === "jellyfin" ? "Jellyfin" : "Plex"} integration`,
    url: endpoints[providerId],
  }));
  return { ...structuredClone(defaultSettings), ...previous, servers };
}
