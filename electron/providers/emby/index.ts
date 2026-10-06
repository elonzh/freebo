import { z } from "zod";
import { EmbyClient } from "./client";
import { normalizeServerUrl } from "../../core/settings";
import { UserFacingError } from "../../../src/shared/i18n";
import type { MediaServerProvider } from "../types";
const id = z.string().min(1).max(200);
const requestSchema = z.object({
  auth: z.object({
    baseUrl: z.url(),
    userId: id,
    token: z.string().min(1).max(4096),
    deviceId: id,
    clientName: z.string().max(200).optional(),
    clientVersion: z.string().max(200).optional(),
    deviceName: z.string().max(200).optional(),
  }),
  intent: z.object({
    itemIds: z.array(id).min(1).max(10_000),
    startIndex: z.number().int().min(0).optional(),
    startTicks: z.number().min(0).optional(),
    mediaSourceId: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      id.optional(),
    ),
    audioIndex: z.number().int().min(0).optional(),
    subtitleIndex: z.number().int().min(-1).optional(),
    shuffle: z.boolean().optional(),
    expand: z.boolean().optional(),
  }),
});
export const embyProvider: MediaServerProvider = {
  id: "emby",
  name: "Emby Server",
  preload: "emby-preload.cjs",
  // The sandboxed preload installs the adapter without waiting for every page resource.
  adapterScript: "",
  normalizeUrl(input) {
    const url = new URL(normalizeServerUrl(input));
    url.pathname = url.pathname.replace(/\/web(?:\/.*)?$/i, "").replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  },
  entryUrl: (server) => `${server.url}/web/index.html#!/home`,
  itemUrl: (server, itemId) =>
    `${server.url}/web/index.html#!/item?id=${encodeURIComponent(itemId)}`,
  parsePlayback(input, server) {
    const { auth, intent } = requestSchema.parse(input);
    const registered = new URL(server.url);
    const base = new URL(auth.baseUrl);
    const prefix = registered.pathname.replace(/\/$/, "");
    if (
      base.origin !== registered.origin ||
      !(base.pathname === prefix || base.pathname.startsWith(`${prefix}/`))
    )
      throw new UserFacingError("playbackOrigin");
    return {
      intent,
      createClient: (fetcher) =>
        new EmbyClient({ ...auth, baseUrl: normalizeServerUrl(auth.baseUrl) }, fetcher),
    };
  },
};
