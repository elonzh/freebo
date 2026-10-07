import { describe, expect, it, vi } from "vitest";
import { plexProvider } from "../../../../electron/providers/plex";
import { PlexClient } from "../../../../electron/providers/plex/client";
import type { PlexItem } from "../../../../electron/providers/plex/types";
import { redact } from "../../../../electron/core/redact";

const auth = {
  baseUrl: "https://media.test/plex",
  token: "fixture-plex-token",
  clientId: "client",
  serverId: "machine",
};
const item: PlexItem = {
  ratingKey: "12",
  key: "/library/metadata/12",
  title: "Film",
  type: "movie",
  duration: 100_000,
  viewOffset: 20_000,
  Media: [
    {
      id: 40,
      container: "mkv",
      videoResolution: "1080",
      Part: [
        {
          id: 41,
          key: "/library/parts/41/file.mkv",
          duration: 100_000,
          Stream: [
            { id: 5, streamType: 1 },
            { id: 9, streamType: 2, languageCode: "eng", selected: true },
            { id: 11, streamType: 3 },
            { id: 13, streamType: 3, selected: true, key: "/library/streams/13" },
          ],
        },
      ],
    },
  ],
};
const response = (metadata: PlexItem[] = [item]) =>
  Response.json({ MediaContainer: { Metadata: metadata, size: metadata.length } });

describe("Plex provider", () => {
  it("normalizes hosted server Web URLs and rejects cloud addresses and forged origins", () => {
    expect(plexProvider.normalizeUrl("http://192.168.1.2:32400/web/index.html#!/")).toBe(
      "http://192.168.1.2:32400",
    );
    expect(() => plexProvider.normalizeUrl("https://app.plex.tv/desktop")).toThrow(
      "plexServerAddress",
    );
    const server = { id: "p", name: "", url: auth.baseUrl, providerId: "plex" };
    for (const baseUrl of [
      "https://media.test/plex-other",
      "https://other.test/plex",
      "https://media.test/plex/sub",
    ]) {
      expect(() =>
        plexProvider.parsePlayback(
          { auth: { ...auth, baseUrl }, intent: { itemIds: ["12"] } },
          server,
        ),
      ).toThrow("playbackOrigin");
    }
  });
  it("checks public identity without transmitting account/password", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        MediaContainer: { machineIdentifier: "server", version: "1.42", friendlyName: "Plex" },
      }),
    );
    expect(
      await plexProvider.testConnection!(
        auth.baseUrl,
        { username: "account", password: "never-send" },
        fetcher,
        { deviceId: "d", deviceName: "Chrome" },
      ),
    ).toEqual({ serverName: "Plex", authenticated: false });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("never-send");
  });
  it("prepares direct playback with resume, local track ordinals and header-only tokens", async () => {
    const fetcher = vi.fn(async () => response());
    const client = new PlexClient(auth, fetcher);
    const intent = { itemIds: ["12"] };
    const queue = await client.resolveQueue(intent);
    const media = await client.prepare(queue[0], intent);
    expect(media).toMatchObject({
      startSeconds: 20,
      audioId: 1,
      audioStreamIndex: 9,
      subtitleStreamIndex: 13,
    });
    expect(media.url).toContain("/plex/library/parts/41/file.mkv");
    expect(media.url).not.toContain(auth.token);
    expect(media.subtitleUrl).toBe("https://media.test/plex/library/streams/13");
    expect(media.headers["X-Plex-Token"]).toBe(auth.token);
    expect(client.identity).not.toContain(auth.token);
    expect(await client.itemUrl("12")).toBe(
      "https://media.test/plex/web/index.html#!/server/machine/details?key=%2Flibrary%2Fmetadata%2F12",
    );
    expect(
      (await client.prepare(queue[0], { ...intent, startTicks: 0, subtitleIndex: -1 })).subtitleId,
    ).toBe("no");
  });
  it("keeps the server's shuffled queue and selected queue item, including repeated metadata", async () => {
    const items = [
      { ...item, playQueueItemID: 1 },
      { ...item, playQueueItemID: 2 },
      { ...item, ratingKey: "14", key: "/library/metadata/14", title: "Next", playQueueItemID: 3 },
    ];
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("playQueues")
        ? Response.json({ MediaContainer: { Metadata: items, playQueueTotalCount: 3 } })
        : response([url.includes("/14") ? items[2] : item]),
    );
    const client = new PlexClient({ ...auth, playQueueId: "7", selectedQueueItemId: "2" }, fetcher);
    expect(
      (await client.resolveQueue({ itemIds: ["12"], expand: false })).map((entry) => entry.title),
    ).toEqual(["Film", "Next"]);
  });
  it("splits multipart media, seeks into the correct part and reports the full item position", async () => {
    const multipart = structuredClone(item);
    multipart.Media![0].Part!.push({
      id: 42,
      key: "/library/parts/42/file.mkv",
      duration: 100_000,
    });
    multipart.duration = 200_000;
    multipart.viewOffset = 120_000;
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("timeline") ? new Response(null, { status: 200 }) : response([multipart]),
    );
    const client = new PlexClient(auth, fetcher);
    const queue = await client.resolveQueue({ itemIds: ["12"] });
    expect(queue).toHaveLength(1);
    const media = await client.prepare(queue[0], { itemIds: ["12"] });
    expect(media.startSeconds).toBe(20);
    expect(media.url).toContain("/parts/42/");
    const record = await client.report(media, "stop", 30);
    const call = fetcher.mock.calls.find(([url]) => url.includes("timeline"))!;
    expect(new URL(call[0]).searchParams.get("time")).toBe("130000");
    expect(record).toMatchObject({ status: "verified", position: 120, reportedPosition: 130 });
  });
  it("uses POST timeline events with stable playback identity and re-reads saved progress", async () => {
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("timeline") ? new Response(null, { status: 200 }) : response(),
    );
    const client = new PlexClient(auth, fetcher);
    const queue = await client.resolveQueue({ itemIds: ["12"] });
    const media = await client.prepare(queue[0], { itemIds: ["12"] });
    await client.report(media, "start", 20);
    await client.report(media, "progress", 25, true);
    expect(await client.report(media, "stop", 30)).toMatchObject({
      status: "verified",
      position: 20,
    });
    const calls = fetcher.mock.calls.filter(([url]) => url.includes("timeline"));
    expect(calls.map(([url]) => new URL(url).searchParams.get("state"))).toEqual([
      "playing",
      "paused",
      "stopped",
    ]);
    expect(
      calls.every(
        ([, init]) =>
          init?.method === "POST" &&
          new Headers(init.headers).get("X-Plex-Session-Identifier") === media.playSessionId,
      ),
    ).toBe(true);
  });
  it("stops retrying after access is refused and rejects escaping stream keys", async () => {
    const denied = vi.fn(async () => new Response(null, { status: 403 }));
    const client = new PlexClient(auth, denied);
    await expect(client.resolveQueue({ itemIds: ["12"] })).rejects.toThrow("connectionForbidden");
    await expect(client.resolveQueue({ itemIds: ["12"] })).rejects.toThrow("connectionForbidden");
    expect(denied).toHaveBeenCalledTimes(1);
    const malicious = structuredClone(item);
    malicious.Media![0].Part![0].key = "/../outside/file.mkv";
    const other = new PlexClient(auth, async () => response([malicious]));
    const queue = await other.resolveQueue({ itemIds: ["12"] });
    await expect(other.prepare(queue[0], { itemIds: ["12"] })).rejects.toThrow("playbackOrigin");
  });
  it("redacts Plex URL and header tokens", () => {
    expect(redact("https://plex.test/video?X-Plex-Token=private-token&offset=1")).not.toContain(
      "private-token",
    );
    expect(redact("X-Plex-Token: private-token")).not.toContain("private-token");
  });
});
