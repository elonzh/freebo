import { UserFacingError, errorToken } from "../../../src/shared/i18n";
import { randomUUID } from "node:crypto";
import type { AuthContext, MediaItem, MediaSource, MediaStream, PlaybackInfo } from "./types";
import type {
  PlayIntent,
  PreparedMedia,
  PlaybackItem,
  PlaybackSource,
  PlaybackRecord,
} from "../../../src/shared/types";
import type { Fetcher, PlaybackClient } from "../types";
export type { Fetcher } from "../types";

export class EmbyClient implements PlaybackClient {
  private pausedSessions = new Map<string, boolean>();
  get identity(): string {
    return `emby:${this.auth.baseUrl}:${this.auth.userId}`;
  }
  constructor(
    readonly auth: AuthContext,
    private readonly fetcher: Fetcher,
    readonly playbackHeaders: Record<string, string> = {},
    private readonly webBaseUrl = auth.baseUrl.replace(/\/emby\/?$/, ""),
  ) {}
  async itemUrl(itemId: string): Promise<string> {
    // Emby's item route requires the remote server ID, not Freebo's local server UUID.
    const serverId =
      this.auth.serverId ?? (await this.request<{ Id: string }>("System/Info/Public")).Id;
    if (!serverId) throw new UserFacingError("serverMissing");
    const params = new URLSearchParams({ id: itemId, serverId });
    return `${this.webBaseUrl.replace(/\/$/, "")}/web/index.html#!/item?${params}`;
  }
  url(path: string, params: Record<string, string | number | boolean | undefined> = {}): string {
    const url = new URL(`${this.auth.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params))
      if (value !== undefined) url.searchParams.set(key, String(value));
    return url.toString();
  }
  async request<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetcher(
      this.url(path, {
        ...params,
        "X-Emby-Client": this.auth.clientName ?? "Freebo",
        "X-Emby-Device-Name": this.auth.deviceName ?? "Desktop",
        "X-Emby-Device-Id": this.auth.deviceId,
        "X-Emby-Client-Version": this.auth.clientVersion ?? "0.1.0",
        "X-Emby-Token": this.auth.token,
      }),
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          "X-Emby-Token": this.auth.token,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? errorToken("authExpired")
          : errorToken("serverRequest", { code: response.status }),
      );
    if (response.status === 204 || response.headers.get("content-length") === "0")
      return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  item(id: string): Promise<MediaItem> {
    return this.request(
      `Users/${encodeURIComponent(this.auth.userId)}/Items/${encodeURIComponent(id)}`,
      { Fields: "MediaSources,MediaStreams,Path" },
    );
  }
  async list(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
  ): Promise<MediaItem[]> {
    const items: MediaItem[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = await this.request<{ Items: MediaItem[]; TotalRecordCount?: number }>(path, {
        ...params,
        StartIndex: offset,
        Limit: 200,
      });
      items.push(...page.Items);
      if (
        page.Items.length < 200 ||
        (page.TotalRecordCount !== undefined && items.length >= page.TotalRecordCount)
      )
        break;
      if (items.length >= 10_000) throw new UserFacingError("queueTooLarge");
    }
    return items;
  }
  async resolveQueue(intent: PlayIntent): Promise<PlaybackItem[]> {
    const result: MediaItem[] = [];
    for (const id of intent.itemIds) {
      const item = await this.item(id);
      if (item.Type === "Playlist")
        result.push(
          ...(await this.list(`Playlists/${encodeURIComponent(id)}/Items`, {
            UserId: this.auth.userId,
            Fields: "MediaSources,MediaStreams",
          })),
        );
      else if (item.Type === "Series" || item.Type === "Season")
        result.push(
          ...(await this.list(`Shows/${encodeURIComponent(item.SeriesId ?? item.Id)}/Episodes`, {
            UserId: this.auth.userId,
            SeasonId: item.Type === "Season" ? id : undefined,
            Fields: "MediaSources,MediaStreams",
            IsVirtual: false,
          })),
        );
      else if (item.Type === "BoxSet" || item.Type === "Folder")
        result.push(
          ...(await this.list(`Users/${encodeURIComponent(this.auth.userId)}/Items`, {
            ParentId: id,
            Recursive: true,
            IncludeItemTypes: "Movie,Episode,Video",
            SortBy: "SortName",
            Fields: "MediaSources,MediaStreams",
          })),
        );
      else if (
        intent.itemIds.length === 1 &&
        intent.expand !== false &&
        item.Type === "Episode" &&
        item.SeriesId
      ) {
        const episodes = await this.list(`Shows/${encodeURIComponent(item.SeriesId)}/Episodes`, {
          UserId: this.auth.userId,
          Fields: "MediaSources,MediaStreams",
          IsVirtual: false,
        });
        const index = episodes.findIndex((ep) => ep.Id === id);
        result.push(...(index >= 0 ? episodes.slice(index) : [item]));
      } else result.push(item);
    }
    const videos = result.filter(isVideo);
    if (intent.shuffle)
      for (let i = videos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [videos[i], videos[j]] = [videos[j], videos[i]];
      }
    else if (intent.startIndex) videos.splice(0, intent.startIndex);
    if (!videos.length) throw new UserFacingError("noVideo");
    return videos.map(normalizeEmbyItem);
  }
  async prepare(
    input: PlaybackItem,
    intent: PlayIntent,
    preferred?: PlaybackSource,
    preferredTracks?: Pick<PreparedMedia, "audioStreamIndex" | "subtitleStreamIndex">,
  ): Promise<PreparedMedia> {
    const item = input.providerData as MediaItem;
    const preferredSource = preferred?.providerData as MediaSource | undefined;
    const info = await this.request<PlaybackInfo>(
      `Items/${encodeURIComponent(item.Id)}/PlaybackInfo`,
      {
        UserId: this.auth.userId,
        IsPlayback: true,
        AutoOpenLiveStream: false,
        MediaSourceId: intent.mediaSourceId,
        AudioStreamIndex: intent.audioIndex,
        SubtitleStreamIndex: intent.subtitleIndex,
        StartTimeTicks: intent.startTicks ?? item.UserData?.PlaybackPositionTicks ?? 0,
      },
      {
        UserId: this.auth.userId,
        DeviceProfile: {
          Name: "Freebo",
          MaxStreamingBitrate: 1_000_000_000,
          DirectPlayProfiles: [{ Type: "Video" }],
          TranscodingProfiles: [],
        },
      },
    );
    const source = chooseSource(info.MediaSources, intent.mediaSourceId, preferredSource);
    if (!source) throw new UserFacingError("noSource");
    const playSessionId = info.PlaySessionId ?? randomUUID();
    const url = this.url(`Videos/${encodeURIComponent(item.Id)}/stream`, {
      Static: true,
      MediaSourceId: source.Id,
      PlaySessionId: playSessionId,
      DeviceId: this.auth.deviceId,
      api_key: this.auth.token,
    });
    const audioIndex =
      intent.audioIndex ??
      matchingTrack(source, preferredSource, "Audio", preferredTracks?.audioStreamIndex) ??
      source.DefaultAudioStreamIndex;
    const subtitleIndex =
      intent.subtitleIndex ??
      (preferredTracks?.subtitleStreamIndex === -1
        ? -1
        : matchingTrack(
            source,
            preferredSource,
            "Subtitle",
            preferredTracks?.subtitleStreamIndex,
          )) ??
      source.DefaultSubtitleStreamIndex;
    const audio = source.MediaStreams?.filter((stream) => stream.Type === "Audio") ?? [];
    const subtitle = source.MediaStreams?.find(
      (stream) => stream.Type === "Subtitle" && stream.Index === subtitleIndex,
    );
    const internalSubs =
      source.MediaStreams?.filter((stream) => stream.Type === "Subtitle" && !stream.IsExternal) ??
      [];
    let subtitleUrl: string | undefined;
    if (subtitle?.IsExternal) {
      subtitleUrl = subtitle.DeliveryUrl
        ? new URL(subtitle.DeliveryUrl, `${this.auth.baseUrl}/`).toString()
        : this.url(
            `Videos/${encodeURIComponent(item.Id)}/${encodeURIComponent(source.Id)}/Subtitles/${subtitle.Index}/Stream.${subtitle.Codec === "ass" ? "ass" : "srt"}`,
          );
      const authenticated = new URL(subtitleUrl);
      authenticated.searchParams.set("api_key", this.auth.token);
      subtitleUrl = authenticated.toString();
    }
    return {
      item: input,
      source: { id: source.Id, name: source.Name, providerData: source },
      playSessionId,
      url,
      startSeconds: Math.max(
        0,
        (intent.startTicks ?? item.UserData?.PlaybackPositionTicks ?? 0) / 10_000_000,
      ),
      runTimeTicks: source.RunTimeTicks ?? item.RunTimeTicks,
      audioId: audioIndex === undefined ? undefined : ordinalTrack(audio, audioIndex),
      audioStreamIndex: audioIndex,
      subtitleStreamIndex: subtitleIndex,
      subtitleId:
        subtitleIndex === -1
          ? "no"
          : subtitle && !subtitle.IsExternal
            ? ordinalTrack(internalSubs, subtitle.Index)
            : undefined,
      subtitleUrl,
      headers: this.playbackHeaders,
    };
  }
  async report(
    media: PreparedMedia,
    event: "start" | "progress" | "stop",
    position: number,
    paused = false,
  ): Promise<PlaybackRecord | void> {
    const path = {
      start: "Sessions/Playing",
      progress: "Sessions/Playing/Progress",
      stop: "Sessions/Playing/Stopped",
    }[event];
    const wasPaused = this.pausedSessions.get(media.playSessionId);
    await this.request(
      path,
      { DeviceId: this.auth.deviceId },
      {
        ItemId: media.item.id,
        MediaSourceId: media.source.id,
        PlaySessionId: media.playSessionId,
        PositionTicks: Math.round(Math.max(0, position) * 10_000_000),
        RunTimeTicks: media.runTimeTicks,
        IsPaused: paused,
        CanSeek: true,
        PlayMethod: "DirectPlay",
        RepeatMode: "RepeatNone",
        EventName:
          event === "progress"
            ? wasPaused !== undefined && wasPaused !== paused
              ? paused
                ? "Pause"
                : "Unpause"
              : "TimeUpdate"
            : undefined,
        AudioStreamIndex: media.audioStreamIndex,
        SubtitleStreamIndex: media.subtitleStreamIndex,
      },
    );
    if (event === "stop") this.pausedSessions.delete(media.playSessionId);
    else this.pausedSessions.set(media.playSessionId, paused);
    if (event !== "stop") return;
    // A successful report is not proof that Emby retained a resume point.
    // Read the persisted user data after stopping; library rules may clear short playback.
    try {
      const { UserData: data, RunTimeTicks: runTimeTicks } = await this.item(media.item.id);
      if (!data) return { status: "unavailable" };
      const savedPosition = (data.PlaybackPositionTicks ?? 0) / 10_000_000;
      const record: PlaybackRecord = {
        status: "verified",
        position: savedPosition,
        reportedPosition: position,
        played: data.Played ?? false,
        playCount: data.PlayCount,
        lastPlayedAt: data.LastPlayedDate,
      };
      if (position > 0 && savedPosition === 0 && !record.played) {
        record.minimumResumeSeconds = await this.minimumResumeSeconds(
          media.item.id,
          runTimeTicks ?? media.runTimeTicks,
        );
      }
      return record;
    } catch {
      return { status: "unavailable" };
    }
  }
  private async minimumResumeSeconds(itemId: string, runTimeTicks?: number) {
    if (!runTimeTicks) return;
    try {
      const ancestors = await this.request<{ Id: string }[]>(
        `Items/${encodeURIComponent(itemId)}/Ancestors`,
        { UserId: this.auth.userId },
      );
      const folders =
        await this.request<{ ItemId: string; LibraryOptions?: { MinResumePct?: number } }[]>(
          "Library/VirtualFolders",
        );
      const library = folders.find((folder) => ancestors.some((item) => item.Id === folder.ItemId));
      const percent = library?.LibraryOptions?.MinResumePct;
      if (percent !== undefined) return (runTimeTicks / 10_000_000) * (percent / 100);
    } catch {
      // Some accounts cannot inspect library configuration; saved user data is still valid.
    }
  }
}
function matchingTrack(
  source: MediaSource,
  previous: MediaSource | undefined,
  type: MediaStream["Type"],
  index: number | undefined,
): number | undefined {
  if (index === undefined) return;
  const selected = previous?.MediaStreams?.find(
    (stream) => stream.Type === type && stream.Index === index,
  );
  if (!selected) return;
  const candidates = source.MediaStreams?.filter((stream) => stream.Type === type) ?? [];
  const exact = selected.DisplayTitle
    ? candidates.find(
        (stream) =>
          stream.DisplayTitle === selected.DisplayTitle && stream.Language === selected.Language,
      )
    : undefined;
  return (
    exact ||
    (selected.Language
      ? candidates.find((stream) => stream.Language === selected.Language)
      : undefined)
  )?.Index;
}
export function isVideo(item: MediaItem): boolean {
  return (
    item.MediaType !== "Audio" &&
    ["Movie", "Episode", "Video", "Trailer", "MusicVideo"].includes(item.Type)
  );
}
export function ordinalTrack(streams: { Index: number }[], index: number): number | undefined {
  const ordinal = streams.findIndex((s) => s.Index === index);
  return ordinal < 0 ? undefined : ordinal + 1;
}
export function chooseSource(
  sources: MediaSource[] = [],
  id?: string,
  preferred?: MediaSource,
): MediaSource | undefined {
  if (id) {
    const exact = sources.find((source) => source.Id === id);
    if (!exact) throw new UserFacingError("sourceMissing");
    return exact;
  }
  return (
    (preferred?.Name && sources.find((source) => source.Name === preferred.Name)) || sources[0]
  );
}

export function normalizeEmbyItem(item: MediaItem): PlaybackItem {
  return { id: item.Id, title: item.Name, seriesTitle: item.SeriesName, providerData: item };
}
