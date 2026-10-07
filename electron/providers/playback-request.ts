import { z } from "zod";
import type { Server } from "../../src/shared/types";
import { UserFacingError } from "../../src/shared/i18n";

export const playbackId = z.string().min(1).max(200);
export const playIntentSchema = z.object({
  itemIds: z.array(playbackId).min(1).max(10_000),
  startIndex: z.number().int().min(0).optional(),
  startTicks: z.number().min(0).optional(),
  mediaSourceId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    playbackId.optional(),
  ),
  audioIndex: z.number().int().min(0).optional(),
  subtitleIndex: z.number().int().min(-1).optional(),
  shuffle: z.boolean().optional(),
  expand: z.boolean().optional(),
});
export const mediaBrowserRequestSchema = z.object({
  auth: z.object({
    baseUrl: z.url(),
    userId: playbackId,
    token: z.string().min(1).max(4096),
    deviceId: playbackId,
    serverId: playbackId.optional(),
    clientName: playbackId,
    clientVersion: playbackId,
    deviceName: playbackId,
  }),
  intent: playIntentSchema,
});

export function assertServerUrl(input: string, server: Pick<Server, "url">): URL {
  const base = new URL(input);
  const registered = new URL(server.url);
  const prefix = registered.pathname.replace(/\/$/, "");
  if (
    base.username ||
    base.password ||
    base.origin !== registered.origin ||
    !(base.pathname === prefix || base.pathname.startsWith(`${prefix}/`))
  )
    throw new UserFacingError("playbackOrigin");
  return base;
}
