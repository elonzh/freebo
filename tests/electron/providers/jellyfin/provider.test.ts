import { describe, expect, it, vi } from "vitest";
import { jellyfinProvider } from "../../../../electron/providers/jellyfin";
import { embyProvider } from "../../../../electron/providers/emby";
import { ProviderRegistry } from "../../../../electron/providers/registry";
import { plexProvider } from "../../../../electron/providers/plex";

const server = { id: "j", name: "", url: "https://media.test/jellyfin", providerId: "jellyfin" };
const auth = {
  baseUrl: server.url,
  userId: "user",
  token: "fixture-jellyfin-token",
  deviceId: "device",
  serverId: "remote",
  clientName: "Jellyfin Web",
  clientVersion: "10.11.0",
  deviceName: "Chrome",
};
const item = {
  Id: "movie",
  Name: "Film",
  Type: "Movie",
  RunTimeTicks: 900_000_000,
  UserData: { PlaybackPositionTicks: 120_000_000 },
  MediaSources: [],
};
const source = {
  Id: "source",
  DefaultAudioStreamIndex: 4,
  DefaultSubtitleStreamIndex: 7,
  MediaStreams: [
    { Index: 0, Type: "Video" },
    { Index: 4, Type: "Audio" },
    {
      Index: 7,
      Type: "Subtitle",
      IsExternal: true,
      DeliveryUrl: "/jellyfin/Videos/movie/source/Subtitles/7/Stream.srt?api_key=legacy",
    },
  ],
};

describe("Jellyfin provider", () => {
  it("registers separate server sessions and normalizes proxy/Web addresses", () => {
    const registry = new ProviderRegistry([embyProvider, jellyfinProvider, plexProvider]);
    expect(registry.list().map((p) => p.id)).toEqual(["emby", "jellyfin", "plex"]);
    expect(registry.partition(server)).toBe("persist:jellyfin-j");
    expect(
      jellyfinProvider.normalizeUrl("https://media.test/jellyfin/web/index.html#/home.html"),
    ).toBe(server.url);
    expect(jellyfinProvider.entryUrl(server)).toBe(`${server.url}/web/index.html#/home.html`);
  });
  it("rejects credentials-bearing, foreign and neighboring proxy paths", () => {
    for (const baseUrl of [
      "https://media.test/jellyfin-other",
      "https://other.test/jellyfin",
      "https://user:pass@media.test/jellyfin",
    ]) {
      expect(() =>
        jellyfinProvider.parsePlayback(
          { auth: { ...auth, baseUrl }, intent: { itemIds: ["movie"] } },
          server,
        ),
      ).toThrow("playbackOrigin");
    }
  });
  it("uses root APIs, current authorization headers, direct streams and authenticated subtitles", async () => {
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      Response.json(
        url.includes("PlaybackInfo") ? { MediaSources: [source], PlaySessionId: "play" } : item,
      ),
    );
    const request = jellyfinProvider.parsePlayback(
      { auth, intent: { itemIds: ["movie"] } },
      server,
    );
    const client = request.createClient(fetcher);
    const queue = await client.resolveQueue(request.intent);
    const media = await client.prepare(queue[0], request.intent);
    expect(client.identity).toBe(`jellyfin:${server.url}:user`);
    expect(await client.itemUrl!("movie")).toBe(
      `${server.url}/web/index.html#/details?id=movie&serverId=remote`,
    );
    expect(media.startSeconds).toBe(12);
    expect(media.audioId).toBe(1);
    expect(media.subtitleUrl).toBe(
      "https://media.test/jellyfin/Videos/movie/source/Subtitles/7/Stream.srt",
    );
    expect(media.headers.Authorization).toContain('Token="fixture-jellyfin-token"');
    expect(media.url).not.toContain(auth.token);
    const [url, init] = fetcher.mock.calls[1];
    expect(new URL(url).pathname).toBe("/jellyfin/Items/movie/PlaybackInfo");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      EnableTranscoding: false,
      StartTimeTicks: 120_000_000,
      IsPlayback: true,
    });
    expect(new Headers(init?.headers).get("authorization")).toContain('Client="Jellyfin Web"');
    expect(new URL(url).searchParams.has("X-Emby-Token")).toBe(false);
  });
  it("reports progress/stopped and reads the retained resume record", async () => {
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("Sessions/")
        ? new Response(null, { status: 204 })
        : Response.json({
            ...item,
            UserData: { PlaybackPositionTicks: 300_000_000, Played: false },
          }),
    );
    const client = jellyfinProvider
      .parsePlayback({ auth, intent: { itemIds: ["movie"] } }, server)
      .createClient(fetcher);
    const media = {
      item: { id: "movie", title: "Film" },
      source: { id: "source" },
      playSessionId: "session",
      url: "",
      startSeconds: 0,
      headers: {},
    };
    await client.report(media, "start", 12);
    await client.report(media, "progress", 30, true);
    expect(await client.report(media, "stop", 30)).toMatchObject({
      status: "verified",
      position: 30,
    });
    const body = JSON.parse(fetcher.mock.calls[1][1]!.body as string);
    expect(body).toMatchObject({ IsPaused: true, EventName: "Pause", PositionTicks: 300_000_000 });
  });
  it("tests login and revokes the test session without leaking tokens into URLs", async () => {
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      url.endsWith("Public")
        ? Response.json({
            Id: "remote",
            ServerName: "Jellyfin",
            Version: "10.11.0",
            ProductName: "Jellyfin Server",
          })
        : url.endsWith("Logout")
          ? new Response(null, { status: 204 })
          : Response.json({ AccessToken: "test-session", User: { Id: "user" } }),
    );
    expect(
      await jellyfinProvider.testConnection!(
        server.url,
        { username: "account", password: "fixture-password" },
        fetcher,
        { deviceId: "test", deviceName: "Chrome" },
      ),
    ).toEqual({ serverName: "Jellyfin", authenticated: true });
    expect(fetcher.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      "/jellyfin/System/Info/Public",
      "/jellyfin/Users/AuthenticateByName",
      "/jellyfin/Sessions/Logout",
    ]);
    expect(new Headers(fetcher.mock.calls[2][1]?.headers).get("Authorization")).toContain(
      'Token="test-session"',
    );
    expect(fetcher.mock.calls.every(([url]) => !url.includes("test-session"))).toBe(true);
  });
  it("rejects cross-origin subtitle URLs before exposing authorization", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        MediaSources: [
          {
            ...source,
            MediaStreams: [
              {
                Index: 7,
                Type: "Subtitle",
                IsExternal: true,
                DeliveryUrl: "https://foreign.test/subtitle.srt",
              },
            ],
          },
        ],
      }),
    );
    const client = jellyfinProvider
      .parsePlayback({ auth, intent: { itemIds: ["movie"] } }, server)
      .createClient(fetcher);
    await expect(
      client.prepare({ id: "movie", title: "Film", providerData: item }, { itemIds: ["movie"] }),
    ).rejects.toThrow("playbackOrigin");
  });
});
