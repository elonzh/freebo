import { EmbyClient } from "../emby/client";
import { embyProvider } from "../emby";
import { testEmbyConnection } from "../emby/connection-test";
import { normalizeServerUrl } from "../../core/settings";
import { assertServerUrl, mediaBrowserRequestSchema } from "../playback-request";
import type { MediaServerProvider } from "../types";

export const jellyfinProvider: MediaServerProvider = {
  id: "jellyfin",
  name: "Jellyfin",
  preload: "jellyfin-preload.cjs",
  adapterScript: "",
  normalizeUrl: (input) => embyProvider.normalizeUrl(input),
  entryUrl: (server) => `${server.url}/web/index.html#/home.html`,
  testConnection: (url, credentials, fetcher, identity) =>
    testEmbyConnection(url, credentials, fetcher, identity, "jellyfin"),
  parsePlayback(input, server) {
    const { auth, intent } = mediaBrowserRequestSchema.parse(input);
    assertServerUrl(auth.baseUrl, server);
    return {
      intent,
      createClient: (fetcher) =>
        new EmbyClient(
          { ...auth, baseUrl: normalizeServerUrl(auth.baseUrl) },
          fetcher,
          {},
          server.url,
          "jellyfin",
        ),
    };
  },
};
