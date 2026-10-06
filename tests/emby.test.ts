import { describe, expect, it, vi } from "vitest";
import {
  EmbyClient,
  normalizeEmbyItem,
  chooseSource,
  ordinalTrack,
  type Fetcher,
} from "../electron/providers/emby/client";
import type { AuthContext, MediaItem } from "../electron/providers/emby/types";

const auth: AuthContext = {
  baseUrl: "https://media.example.test/library/emby",
  token: "test-token",
  userId: "user1",
  deviceId: "desktop1",
};
const episode = (id: string): MediaItem => ({
  Id: id,
  Name: `Episode ${id}`,
  Type: "Episode",
  SeriesId: "series",
  UserData: { PlaybackPositionTicks: 420_000_000 },
});
const response = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

describe("Emby video playback", () => {
  it("retains a reverse-proxy prefix, chosen source, resume, audio ordinals and external subtitle auth", async () => {
    const fetcher = vi.fn(async () =>
      response({
        PlaySessionId: "session",
        MediaSources: [
          {
            Id: "source",
            Container: "mkv",
            DefaultAudioStreamIndex: 3,
            DefaultSubtitleStreamIndex: 5,
            MediaStreams: [
              { Type: "Video", Index: 0 },
              { Type: "Audio", Index: 1 },
              { Type: "Audio", Index: 3 },
              { Type: "Subtitle", Index: 5, IsExternal: true, Codec: "ass" },
            ],
          },
        ],
      }),
    );
    const client = new EmbyClient(auth, fetcher);
    const media = await client.prepare(normalizeEmbyItem(episode("ep1")), {
      itemIds: ["ep1"],
      mediaSourceId: "source",
    });
    const url = new URL(media.url);
    expect(url.pathname).toBe("/library/emby/Videos/ep1/stream");
    expect(url.searchParams.get("MediaSourceId")).toBe("source");
    expect(url.searchParams.get("Static")).toBe("true");
    expect(media.startSeconds).toBe(42);
    expect(media.audioId).toBe(2);
    expect(new URL(media.subtitleUrl!).pathname).toBe(
      "/library/emby/Videos/ep1/source/Subtitles/5/Stream.ass",
    );
    expect(new URL(media.subtitleUrl!).searchParams.get("api_key")).toBe("test-token");
  });
  it("maps internal subtitles independently of video and audio indices, and supports explicit off", async () => {
    const fetcher = async () =>
      response({
        MediaSources: [
          {
            Id: "s",
            MediaStreams: [
              { Type: "Audio", Index: 1 },
              { Type: "Subtitle", Index: 2 },
              { Type: "Subtitle", Index: 4, IsExternal: true },
              { Type: "Subtitle", Index: 7 },
            ],
          },
        ],
      });
    const client = new EmbyClient(auth, fetcher);
    expect(
      (await client.prepare(normalizeEmbyItem(episode("e")), { itemIds: ["e"], subtitleIndex: 7 }))
        .subtitleId,
    ).toBe(2);
    expect(
      (await client.prepare(normalizeEmbyItem(episode("e")), { itemIds: ["e"], subtitleIndex: -1 }))
        .subtitleId,
    ).toBe("no");
    expect(ordinalTrack([{ Index: 2 }], 9)).toBeUndefined();
  });
  it("keeps selected languages across episodes with different stream indices and reports the resolved track", async () => {
    const sources = [
      {
        Id: "first",
        MediaStreams: [
          { Type: "Audio", Index: 2, Language: "jpn" },
          { Type: "Subtitle", Index: 3, Language: "zho" },
        ],
      },
      {
        Id: "next",
        DefaultAudioStreamIndex: 1,
        MediaStreams: [
          { Type: "Audio", Index: 1, Language: "eng" },
          { Type: "Audio", Index: 7, Language: "jpn" },
          { Type: "Subtitle", Index: 8, Language: "zho" },
        ],
      },
    ];
    const fetcher = vi.fn<Fetcher>(async (url) =>
      url.includes("PlaybackInfo")
        ? response({ MediaSources: [sources.shift()] })
        : new Response(null, { status: 204 }),
    );
    const client = new EmbyClient(auth, fetcher);
    const first = await client.prepare(normalizeEmbyItem(episode("a")), {
      itemIds: ["a"],
      audioIndex: 2,
      subtitleIndex: 3,
    });
    const next = await client.prepare(
      normalizeEmbyItem(episode("b")),
      { itemIds: ["b"] },
      first.source,
      first,
    );
    expect(next).toMatchObject({
      audioId: 2,
      subtitleId: 1,
      audioStreamIndex: 7,
      subtitleStreamIndex: 8,
    });
    await client.report(next, "start", 0);
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string)).toMatchObject({
      AudioStreamIndex: 7,
      SubtitleStreamIndex: 8,
    });
  });
  it("keeps subtitles disabled across a playlist even when the next item has a default subtitle", async () => {
    const client = new EmbyClient(auth, async () =>
      response({
        MediaSources: [
          {
            Id: "next",
            DefaultSubtitleStreamIndex: 5,
            MediaStreams: [{ Type: "Subtitle", Index: 5 }],
          },
        ],
      }),
    );
    const media = await client.prepare(
      normalizeEmbyItem(episode("b")),
      { itemIds: ["b"] },
      { id: "first", providerData: { Id: "first" } },
      { subtitleStreamIndex: -1 },
    );
    expect(media).toMatchObject({ subtitleId: "no", subtitleStreamIndex: -1 });
  });
  it("preserves explicit playlists including repeated videos and filters music", async () => {
    const client = new EmbyClient(auth, async (url) =>
      url.includes("/Playlists/")
        ? response({
            Items: [
              episode("a"),
              { Id: "audio", Type: "Audio", Name: "Music" },
              episode("a"),
              episode("b"),
            ],
          })
        : response({ Id: "p", Name: "Playlist", Type: "Playlist" }),
    );
    expect((await client.resolveQueue({ itemIds: ["p"] })).map((item) => item.id)).toEqual([
      "a",
      "a",
      "b",
    ]);
  });
  it("continues episodes from the selected item and paginates without truncating a season", async () => {
    const all = Array.from({ length: 205 }, (_, index) => episode(String(index)));
    const client = new EmbyClient(auth, async (url) => {
      const request = new URL(url);
      if (request.pathname.includes("/Episodes")) {
        const offset = Number(request.searchParams.get("StartIndex"));
        return response({ Items: all.slice(offset, offset + 200), TotalRecordCount: all.length });
      }
      return response(episode("198"));
    });
    const queue = await client.resolveQueue({ itemIds: ["198"] });
    expect(queue.map((item) => item.id)).toEqual(["198", "199", "200", "201", "202", "203", "204"]);
  });
  it("reports the exact item, source, session and tick position for start, progress and stop", async () => {
    const fetcher = vi.fn<Fetcher>(async () => new Response(null, { status: 204 }));
    const client = new EmbyClient(auth, fetcher);
    const media = {
      item: normalizeEmbyItem(episode("e")),
      source: { id: "s" },
      playSessionId: "play",
      url: "https://example.test",
      startSeconds: 0,
      headers: {},
    };
    for (const event of ["start", "progress", "stop"] as const)
      await client.report(media, event, 123.5, true);
    expect(fetcher.mock.calls.map((call) => new URL(call[0]).pathname)).toEqual([
      "/library/emby/Sessions/Playing",
      "/library/emby/Sessions/Playing/Progress",
      "/library/emby/Sessions/Playing/Stopped",
    ]);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toMatchObject({
      ItemId: "e",
      MediaSourceId: "s",
      PlaySessionId: "play",
      PositionTicks: 1_235_000_000,
      IsPaused: true,
    });
  });
  it("rejects an unavailable selected version and keeps the matching version across episodes", () => {
    expect(() => chooseSource([{ Id: "s" }], "missing")).toThrow("sourceMissing");
    expect(
      chooseSource(
        [
          { Id: "1", Name: "1080p" },
          { Id: "2", Name: "4K" },
        ],
        undefined,
        { Id: "previous", Name: "4K" },
      )?.Id,
    ).toBe("2");
  });
  it("explains expired authentication and disallows empty video playlists", async () => {
    const client = new EmbyClient(auth, async () => new Response("", { status: 401 }));
    await expect(client.item("a")).rejects.toThrow("authExpired");
    const audioClient = new EmbyClient(auth, async () =>
      response({ Id: "a", Name: "Music", Type: "Audio" }),
    );
    await expect(audioClient.resolveQueue({ itemIds: ["a"] })).rejects.toThrow("noVideo");
  });
});
