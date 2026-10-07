import { z } from "zod";
import { normalizeServerUrl } from "../../core/settings";
import { UserFacingError } from "../../../src/shared/i18n";
import { assertServerUrl, playbackId, playIntentSchema } from "../playback-request";
import type { MediaServerProvider } from "../types";
import { PlexClient } from "./client";

const requestSchema = z.object({
  auth: z.object({
    baseUrl: z.url(),
    token: z.string().max(4096),
    clientId: playbackId,
    serverId: playbackId.optional(),
    playQueueId: z.string().regex(/^\d+$/).optional(),
    selectedQueueItemId: z.string().regex(/^\d+$/).optional(),
  }),
  intent: playIntentSchema.extend({
    itemIds: z.array(z.string().regex(/^\d+$/)).min(1).max(10_000),
  }),
});
export const plexProvider: MediaServerProvider = {
  id: "plex",
  name: "Plex",
  preload: "plex-preload.cjs",
  adapterScript: "",
  supportsCredentials: false,
  normalizeUrl(input) {
    const url = new URL(normalizeServerUrl(input));
    if (url.hostname === "app.plex.tv" || url.hostname === "plex.tv")
      throw new UserFacingError("plexServerAddress");
    url.pathname = url.pathname.replace(/\/web(?:\/.*)?$/i, "").replace(/\/+$/, "");
    return url.href.replace(/\/$/, "");
  },
  entryUrl: (server) => `${server.url}/web/index.html#!/`,
  async testConnection(url, _credentials, fetcher) {
    const signal = AbortSignal.timeout(15_000);
    try {
      const response = await fetcher(`${url}/identity`, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal,
      });
      if (!response.ok) throw new UserFacingError("serverRequest", { code: response.status });
      const result = z
        .object({
          MediaContainer: z.object({
            machineIdentifier: z.string().min(1),
            version: z.string().min(1),
            friendlyName: z.string().optional(),
          }),
        })
        .safeParse(await response.json());
      if (!result.success) throw new UserFacingError("unexpectedServer");
      return {
        serverName: result.data.MediaContainer.friendlyName ?? new URL(url).host,
        authenticated: false,
      };
    } catch (error) {
      if (error instanceof UserFacingError) throw error;
      throw new UserFacingError(signal.aborted ? "connectionTimeout" : "connectionTestFailed");
    }
  },
  parsePlayback(input, server) {
    const { auth, intent } = requestSchema.parse(input);
    const base = assertServerUrl(auth.baseUrl, server);
    if (base.pathname.replace(/\/$/, "") !== new URL(server.url).pathname.replace(/\/$/, ""))
      throw new UserFacingError("playbackOrigin");
    return {
      intent,
      createClient: (fetcher) =>
        new PlexClient({ ...auth, baseUrl: normalizeServerUrl(auth.baseUrl) }, fetcher),
    };
  },
};
