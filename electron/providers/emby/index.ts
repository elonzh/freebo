import { EmbyClient } from "./client";
import { normalizeServerUrl } from "../../core/settings";
import { assertServerUrl, mediaBrowserRequestSchema } from "../playback-request";
import type { MediaServerProvider } from "../types";
import { testEmbyConnection } from "./connection-test";
export const embyProvider: MediaServerProvider = {
  id: "emby",
  name: "Emby Server",
  preload: "emby-preload.cjs",
  // The sandboxed preload installs the adapter without waiting for every page resource.
  adapterScript: "",
  testConnection: testEmbyConnection,
  normalizeUrl(input) {
    const url = new URL(normalizeServerUrl(input));
    url.pathname = url.pathname.replace(/\/web(?:\/.*)?$/i, "").replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  },
  entryUrl: (server) => `${server.url}/web/index.html#!/home`,
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
        ),
    };
  },
};
