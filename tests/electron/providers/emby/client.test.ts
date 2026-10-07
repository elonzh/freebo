import { describe, expect, it, vi } from "vitest";
import {
  EmbyClient,
  normalizeEmbyItem,
  chooseSource,
  ordinalTrack,
  type Fetcher,
} from "../../../../electron/providers/emby/client";
import type { AuthContext, MediaItem } from "../../../../electron/providers/emby/types";

const auth: AuthContext = {
  baseUrl: "https://media.example.test/library/emby",
  token: "test-token",
  userId: "user1",
  deviceId: "desktop1",
  clientName: "Emby Web",
  clientVersion: "4.9.5.0",
  deviceName: "Chrome",
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
  it("preserves the web client's identity and stops requests after a permission rejection", async () => {
    const fetcher = vi.fn<Fetcher>(async () => new Response(null, { status: 403 }));
    const client = new EmbyClient(auth, fetcher);
    await expect(client.item("a")).rejects.toThrow("connectionForbidden");
    const request = new URL(fetcher.mock.calls[0][0]);
    expect(request.searchParams.get("X-Emby-Client")).toBe(auth.clientName);
    expect(request.searchParams.get("X-Emby-Client-Version")).toBe(auth.clientVersion);
    expect(request.searchParams.get("X-Emby-Device-Name")).toBe(auth.deviceName);
    await expect(client.item("a")).rejects.toThrow("connectionForbidden");
    expect(fetcher).toHaveBeenCalledOnce();
  });
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
      runTimeTicks: 2_000_000_000,
    };
    for (const event of ["start", "progress", "stop"] as const)
      await client.report(media, event, 123.5, true);
    expect(fetcher.mock.calls.map((call) => new URL(call[0]).pathname)).toEqual([
      "/library/emby/Sessions/Playing",
      "/library/emby/Sessions/Playing/Progress",
      "/library/emby/Sessions/Playing/Stopped",
      "/library/emby/Users/user1/Items/e",
    ]);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toMatchObject({
      ItemId: "e",
      MediaSourceId: "s",
      PlaySessionId: "play",
      PositionTicks: 1_235_000_000,
      IsPaused: true,
      RunTimeTicks: 2_000_000_000,
      EventName: "TimeUpdate",
    });
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get("X-Emby-Token")).toBe("test-token");
    await client.report(media, "progress", 124, false);
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string).EventName).toBe("TimeUpdate");
    await client.report(media, "progress", 124, true);
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string).EventName).toBe("Pause");
    await client.report(media, "progress", 125, false);
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string).EventName).toBe("Unpause");
  });
  it("opens the Emby detail route with the remote server ID and the registered web prefix", async () => {
    const fetcher = vi.fn<Fetcher>(async () => response({ Id: "remote-server" }));
    const client = new EmbyClient(auth, fetcher, {}, "https://media.example.test/library");
    const url = new URL(await client.itemUrl("episode & 1"));
    expect(url.pathname).toBe("/library/web/index.html");
    const params = new URLSearchParams(url.hash.split("?")[1]);
    expect(params.get("id")).toBe("episode & 1");
    expect(params.get("serverId")).toBe("remote-server");
    expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe("/library/emby/System/Info/Public");
    expect(url.toString()).not.toContain("test-token");
    const known = new EmbyClient({ ...auth, serverId: "known-server" }, fetcher);
    expect(await known.itemUrl("e")).toContain("serverId=known-server");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("reads the persisted watch record and identifies a library threshold that cleared the resume point", async () => {
    const fetcher = vi.fn<Fetcher>(async (input, init) => {
      const path = new URL(input).pathname;
      if (init?.method === "POST") return new Response(null, { status: 204 });
      if (path.endsWith("/Ancestors")) return response([{ Id: "library" }]);
      if (path.endsWith("/VirtualFolders"))
        return response([
          { ItemId: "other", LibraryOptions: { MinResumePct: 5 } },
          { ItemId: "library", LibraryOptions: { MinResumePct: 3 } },
        ]);
      return response({
        RunTimeTicks: 87_006_500_000,
        UserData: {
          PlaybackPositionTicks: 0,
          PlayCount: 2,
          LastPlayedDate: "2026-10-06T10:19:30Z",
          Played: false,
        },
      });
    });
    const client = new EmbyClient(auth, fetcher);
    const media = {
      item: normalizeEmbyItem(episode("e")),
      source: { id: "s" },
      playSessionId: "p",
      url: "",
      startSeconds: 0,
      headers: {},
    };
    expect(await client.report(media, "stop", 174)).toEqual({
      status: "verified",
      position: 0,
      reportedPosition: 174,
      playCount: 2,
      lastPlayedAt: "2026-10-06T10:19:30Z",
      played: false,
      minimumResumeSeconds: 261.0195,
    });
    expect(fetcher.mock.calls.every((call) => call[1]?.cache === "no-store")).toBe(true);
  });
  it("distinguishes a saved resume point from an unreadable record without retrying an accepted stop", async () => {
    const fetcher = vi.fn<Fetcher>(async (_input, init) =>
      init?.method === "POST"
        ? new Response(null, { status: 204 })
        : response({
            UserData: { PlaybackPositionTicks: 5_400_000_000, Played: false, PlayCount: 3 },
          }),
    );
    const client = new EmbyClient(auth, fetcher);
    const media = {
      item: normalizeEmbyItem(episode("e")),
      source: { id: "s" },
      playSessionId: "p",
      url: "",
      startSeconds: 0,
      headers: {},
    };
    expect(await client.report(media, "stop", 540)).toMatchObject({
      status: "verified",
      position: 540,
      playCount: 3,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockImplementation(
      async (_input, init) => new Response(null, { status: init?.method === "POST" ? 204 : 403 }),
    );
    expect(await client.report(media, "stop", 540)).toEqual({ status: "unavailable" });
    expect(fetcher.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(2);
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
