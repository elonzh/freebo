import { createHash, randomUUID } from "node:crypto";
import type {
  PlaybackItem,
  PlaybackSource,
  PlayIntent,
  PreparedMedia,
  PlaybackRecord,
} from "../../../src/shared/types";
import { UserFacingError } from "../../../src/shared/i18n";
import type { Fetcher, PlaybackClient } from "../types";
import { ServerAccessError } from "../types";
import { assertServerUrl } from "../playback-request";
import type {
  PlexAuth,
  PlexContainer,
  PlexItem,
  PlexMedia,
  PlexPlaybackData,
  PlexStream,
} from "./types";

export class PlexClient implements PlaybackClient {
  private accessError?: ServerAccessError;
  constructor(
    readonly auth: PlexAuth,
    private readonly fetcher: Fetcher,
  ) {}
  get identity(): string {
    return `plex:${this.auth.baseUrl}:${createHash("sha256").update(this.auth.token).digest("hex")}`;
  }
  private get headers(): Record<string, string> {
    return {
      Accept: "application/json",
      ...(this.auth.token ? { "X-Plex-Token": this.auth.token } : {}),
      "X-Plex-Client-Identifier": this.auth.clientId,
      "X-Plex-Product": "Freebo",
      "X-Plex-Version": "1.0.0",
    };
  }
  private url(path: string, params: Record<string, string | number | undefined> = {}): string {
    // PMS keys start with / even when the server lives behind a proxy subpath.
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
      throw new UserFacingError("playbackOrigin");
    const url = assertServerUrl(`${this.auth.baseUrl.replace(/\/$/, "")}${path}`, {
      url: this.auth.baseUrl,
    });
    for (const [key, value] of Object.entries(params))
      if (value !== undefined) url.searchParams.set(key, String(value));
    return url.href;
  }
  private async request<T = PlexContainer>(
    path: string,
    params: Record<string, string | number | undefined> = {},
    method = "GET",
    sessionId?: string,
    json = true,
  ): Promise<T> {
    if (this.accessError) throw this.accessError;
    const response = await this.fetcher(this.url(path, params), {
      method,
      headers: {
        ...this.headers,
        ...(sessionId ? { "X-Plex-Session-Identifier": sessionId } : {}),
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if ([401, 403, 429].includes(response.status)) {
      this.accessError = new ServerAccessError(
        response.status === 401
          ? "authExpired"
          : response.status === 403
            ? "connectionForbidden"
            : "serverRateLimited",
        response.status,
      );
      throw this.accessError;
    }
    if (!response.ok) throw new UserFacingError("serverRequest", { code: response.status });
    if (!json || response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new UserFacingError("unexpectedServer");
    }
  }
  private async item(id: string): Promise<PlexItem> {
    const data = await this.request(`/library/metadata/${encodeURIComponent(id)}`);
    const item = data.MediaContainer?.Metadata?.[0];
    if (!item || String(item.ratingKey) !== id) throw new UserFacingError("itemMissing");
    return item;
  }
  async itemUrl(itemId: string): Promise<string> {
    const serverId =
      this.auth.serverId ?? (await this.request("/identity")).MediaContainer.machineIdentifier;
    if (!serverId) throw new UserFacingError("serverMissing");
    const query = new URLSearchParams({ key: `/library/metadata/${itemId}` });
    return `${this.auth.baseUrl}/web/index.html#!/server/${encodeURIComponent(serverId)}/details?${query}`;
  }
  private async list(path: string): Promise<PlexItem[]> {
    const items: PlexItem[] = [];
    for (let offset = 0; ; offset += 200) {
      const { MediaContainer: page } = await this.request(path, {
        "X-Plex-Container-Start": offset,
        "X-Plex-Container-Size": 200,
      });
      const batch = page?.Metadata ?? [];
      if (offset && batch.length && batch[0].ratingKey === items[0]?.ratingKey)
        throw new UserFacingError("queueTooLarge");
      items.push(...batch);
      if (items.length > 10_000) throw new UserFacingError("queueTooLarge");
      if (batch.length < 200 || (page.totalSize !== undefined && items.length >= page.totalSize))
        return items;
    }
  }
  async resolveQueue(intent: PlayIntent): Promise<PlaybackItem[]> {
    let items: PlexItem[] = [];
    if (this.auth.playQueueId) {
      const { MediaContainer: queue } = await this.request(
        `/playQueues/${encodeURIComponent(this.auth.playQueueId)}`,
        { window: 10_000, includeBefore: 1, includeAfter: 1 },
      );
      items = queue?.Metadata ?? [];
      if (
        (queue.playQueueTotalCount ?? items.length) > 10_000 ||
        (queue.playQueueTotalCount ?? 0) > items.length
      )
        throw new UserFacingError("queueTooLarge");
      const index = items.findIndex((item) =>
        this.auth.selectedQueueItemId
          ? String(item.playQueueItemID) === this.auth.selectedQueueItemId
          : String(item.ratingKey) === intent.itemIds[0],
      );
      if (index < 0) throw new UserFacingError("itemMissing");
      items = items.slice(index);
    } else {
      for (const id of intent.itemIds) {
        const item = await this.item(id);
        if (item.type === "playlist")
          items.push(...(await this.list(`/playlists/${encodeURIComponent(id)}/items`)));
        else if (["show", "season", "collection"].includes(item.type))
          items.push(...(await this.list(`/library/metadata/${encodeURIComponent(id)}/allLeaves`)));
        else if (
          intent.itemIds.length === 1 &&
          intent.expand !== false &&
          item.type === "episode" &&
          item.grandparentRatingKey
        ) {
          const episodes = await this.list(
            `/library/metadata/${encodeURIComponent(item.grandparentRatingKey)}/allLeaves`,
          );
          const index = episodes.findIndex((episode) => String(episode.ratingKey) === id);
          items.push(...(index >= 0 ? episodes.slice(index) : [item]));
        } else items.push(item);
        if (items.length > 10_000) throw new UserFacingError("queueTooLarge");
      }
      if (intent.shuffle)
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }
      else if (intent.startIndex) items = items.slice(intent.startIndex);
    }
    const videos = items.filter((item) => ["movie", "episode", "clip"].includes(item.type));
    if (!videos.length) throw new UserFacingError("noVideo");
    const result: PlaybackItem[] = [];
    for (const [index, queued] of videos.entries()) {
      const metadata = queued.Media?.some((media) => media.Part?.length)
        ? queued
        : {
            ...(await this.item(String(queued.ratingKey))),
            playQueueItemID: queued.playQueueItemID,
          };
      const media = chooseMedia(metadata, index === 0 ? intent.mediaSourceId : undefined);
      let offset = 0;
      const start =
        index === 0
          ? intent.startTicks === undefined
            ? (metadata.viewOffset ?? 0)
            : intent.startTicks / 10_000
          : 0;
      for (const [partIndex, part] of (media.Part ?? []).entries()) {
        const duration = part.duration ?? media.duration ?? metadata.duration ?? 0;
        if (start < offset + duration || partIndex === (media.Part?.length ?? 1) - 1)
          result.push({
            id: String(metadata.ratingKey),
            title: metadata.title,
            seriesTitle: metadata.grandparentTitle,
            continuation: partIndex > 0,
            providerData: {
              metadata,
              mediaId: media.id,
              partIndex,
              offset,
            } satisfies PlexPlaybackData,
          });
        offset += duration;
      }
    }
    if (!result.length) throw new UserFacingError("noSource");
    if (result.length > 10_000) throw new UserFacingError("queueTooLarge");
    return result;
  }
  async prepare(
    input: PlaybackItem,
    intent: PlayIntent,
    preferred?: PlaybackSource,
    tracks?: Pick<PreparedMedia, "audioStreamIndex" | "subtitleStreamIndex">,
  ): Promise<PreparedMedia> {
    const data = input.providerData as PlexPlaybackData;
    // Resolve full stream data lazily so a large play queue can start its first item promptly.
    data.metadata = {
      ...(await this.item(input.id)),
      playQueueItemID: data.metadata.playQueueItemID,
    };
    const previous = preferred?.providerData as PlexMedia | undefined;
    const media = chooseMedia(
      data.metadata,
      intent.mediaSourceId ?? String(data.mediaId),
      previous,
    );
    const part = media.Part?.[data.partIndex];
    if (!part) throw new UserFacingError("noSource");
    const streams = part.Stream ?? [];
    const audio = streams.filter((stream) => stream.streamType === 2);
    const subs = streams.filter((stream) => stream.streamType === 3);
    const matching = (type: number, id: number | undefined) => {
      const old = previous?.Part?.flatMap((p) => p.Stream ?? []).find(
        (s) => s.streamType === type && s.id === id,
      );
      return (
        old &&
        streams.find(
          (s) =>
            s.streamType === type &&
            s.languageCode === old.languageCode &&
            (s.displayTitle === old.displayTitle || !old.displayTitle),
        )?.id
      );
    };
    const audioIndex =
      intent.audioIndex ??
      matching(2, tracks?.audioStreamIndex) ??
      audio.find((s) => s.selected)?.id;
    const subtitleIndex =
      intent.subtitleIndex ??
      (tracks?.subtitleStreamIndex === -1 ? -1 : matching(3, tracks?.subtitleStreamIndex)) ??
      subs.find((s) => s.selected)?.id ??
      -1;
    const subtitle = subs.find((s) => s.id === subtitleIndex);
    const internal = subs.filter((s) => !s.key);
    const start =
      intent.startTicks === undefined
        ? (data.metadata.viewOffset ?? 0)
        : intent.startTicks / 10_000;
    const playSessionId = randomUUID();
    return {
      item: input,
      source: {
        id: String(media.id),
        name: `${media.videoResolution ?? ""} ${media.container ?? ""}`.trim(),
        providerData: media,
      },
      playSessionId,
      url: this.url(part.key, { "X-Plex-Session-Identifier": playSessionId }),
      startSeconds: Math.max(0, start - data.offset) / 1000,
      runTimeTicks: (part.duration ?? media.duration ?? data.metadata.duration ?? 0) * 10_000,
      audioId: ordinal(audio, audioIndex),
      audioStreamIndex: audioIndex,
      subtitleStreamIndex: subtitleIndex,
      subtitleId:
        subtitleIndex === -1
          ? "no"
          : subtitle && !subtitle.key
            ? ordinal(internal, subtitle.id)
            : undefined,
      subtitleUrl: subtitle?.key ? this.url(subtitle.key) : undefined,
      headers: { ...this.headers, "X-Plex-Session-Identifier": playSessionId },
    };
  }
  async report(
    media: PreparedMedia,
    event: "start" | "progress" | "stop",
    position: number,
    paused = false,
  ): Promise<PlaybackRecord | void> {
    const data = media.item.providerData as PlexPlaybackData;
    const time = Math.round(Math.max(0, position) * 1000 + data.offset);
    await this.request(
      "/:/timeline",
      {
        key: `/library/metadata/${media.item.id}`,
        ratingKey: media.item.id,
        state: event === "stop" ? "stopped" : paused ? "paused" : "playing",
        time,
        duration: data.metadata.duration,
        playQueueItemID: data.metadata.playQueueItemID,
        identifier: "com.plexapp.plugins.library",
      },
      "POST",
      media.playSessionId,
      false,
    );
    if (event !== "stop") return;
    try {
      const item = await this.item(media.item.id);
      return {
        status: "verified",
        position: (item.viewOffset ?? 0) / 1000,
        reportedPosition: time / 1000,
        played: (item.viewCount ?? 0) > 0,
        playCount: item.viewCount,
        lastPlayedAt: item.lastViewedAt
          ? new Date(item.lastViewedAt * 1000).toISOString()
          : undefined,
      };
    } catch {
      return { status: "unavailable" };
    }
  }
}
function chooseMedia(item: PlexItem, id?: string, previous?: PlexMedia): PlexMedia {
  const media = item.Media ?? [];
  const selected = id
    ? media.find((source) => String(source.id) === id)
    : (media.find((source) => source.selected) ??
      (previous &&
        media.find(
          (source) =>
            source.videoResolution === previous.videoResolution &&
            source.container === previous.container,
        )) ??
      media[0]);
  if (!selected) throw new UserFacingError(id ? "sourceMissing" : "noSource");
  return selected;
}
function ordinal(streams: PlexStream[], id?: number): number | undefined {
  const index = streams.findIndex((s) => s.id === id);
  return index >= 0 ? index + 1 : undefined;
}
