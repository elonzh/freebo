import assert from "node:assert/strict";
import { embyProvider } from "../../electron/providers/emby";
import { jellyfinProvider } from "../../electron/providers/jellyfin";
import { plexProvider } from "../../electron/providers/plex";
import { MediaProxy } from "../../electron/core/media-proxy";
import { providerIds, type FixtureServer, type FixtureState, type ProviderId } from "./config";
import { serverApi } from "./servers";
import type { PreparedMedia, Server } from "../../src/shared/types";
import type { MediaItem } from "../../electron/providers/emby/types";
import type { PlexItem } from "../../electron/providers/plex/types";

const providers = { emby: embyProvider, jellyfin: jellyfinProvider, plex: plexProvider };
const fetcher = (input: string, init?: RequestInit) => fetch(input, init);
const deviceId = "freebo-integration-playback";

async function tracks(
  id: ProviderId,
  state: FixtureServer,
): Promise<{ audioIndex: number; subtitleIndex: number }> {
  if (id === "plex") {
    const api = serverApi(state.baseUrl);
    const item = (
      await api<{ MediaContainer: { Metadata: PlexItem[] } }>(`library/metadata/${state.movieId}`)
    ).MediaContainer.Metadata[0];
    const streams = item.Media?.[0]?.Part?.[0]?.Stream ?? [];
    const audio = streams.filter((stream) => stream.streamType === 2);
    const subtitle = streams.find((stream) => stream.streamType === 3 && stream.key);
    assert(audio.length >= 2, "Plex did not discover the two audio tracks");
    assert(subtitle, "Plex did not discover the external subtitle");
    return { audioIndex: audio[1].id, subtitleIndex: subtitle.id };
  }
  const api = serverApi(`${state.baseUrl}${id === "emby" ? "/emby" : ""}`, {
    Authorization: `MediaBrowser Token="${state.token}"`,
    "X-Emby-Token": state.token,
  });
  const item = await api<MediaItem>(`Users/${state.userId}/Items/${state.movieId}`);
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];
  const audio = streams.filter((stream) => stream.Type === "Audio");
  const subtitle = streams.find((stream) => stream.Type === "Subtitle" && stream.IsExternal);
  assert(audio.length >= 2, `${id} did not discover the two audio tracks`);
  assert(subtitle, `${id} did not discover the external subtitle`);
  return { audioIndex: audio[1].Index, subtitleIndex: subtitle.Index };
}

async function readMedia(proxy: MediaProxy, media: PreparedMedia) {
  const url = proxy.register(media.url, fetcher, media.headers);
  const response = await fetch(url, {
    headers: { Range: "bytes=0-1023" },
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 206, "Media proxy did not preserve Range requests");
  assert.match(response.headers.get("content-range") ?? "", /^bytes 0-1023\//);
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal(data.length, 1024);
  assert(data.subarray(0, 32).includes(Buffer.from("ftyp")), "Fixture is not an MP4 stream");
  assert(media.subtitleUrl, "Selected subtitle did not produce a URL");
  const subtitle = await fetch(proxy.register(media.subtitleUrl, fetcher, media.headers), {
    signal: AbortSignal.timeout(15_000),
  });
  assert(subtitle.ok, `Subtitle HTTP ${subtitle.status}`);
  assert.match(await subtitle.text(), /Freebo integration subtitle/);
}

export async function verifyServers(state: FixtureState) {
  const proxy = new MediaProxy();
  await proxy.open();
  const results = [];
  try {
    for (const id of providerIds) {
      const saved = state.servers[id];
      const server: Server = { id: `fixture-${id}`, name: id, providerId: id, url: saved.baseUrl };
      const selectedTracks = await tracks(id, saved);
      const auth =
        id === "plex"
          ? {
              baseUrl: saved.baseUrl,
              token: saved.token,
              clientId: deviceId,
              serverId: saved.serverId,
            }
          : {
              baseUrl: `${saved.baseUrl}${id === "emby" ? "/emby" : ""}`,
              token: saved.token,
              userId: saved.userId,
              serverId: saved.serverId,
              deviceId,
              clientName: id === "emby" ? "Emby Web" : "Jellyfin Web",
              clientVersion: saved.version,
              deviceName: "Chrome",
            };
      const intent = { itemIds: [saved.movieId], expand: false, ...selectedTracks };
      const client = providers[id].parsePlayback({ auth, intent }, server).createClient(fetcher);
      const queue = await client.resolveQueue(intent);
      assert.equal(queue.length, 1);
      const media = await client.prepare(queue[0], intent);
      assert.equal(media.audioId, 2, `${id} audio index did not map to the second local track`);
      assert(
        (media.runTimeTicks ?? 0) >= 590 * 10_000_000,
        `${id} fixture duration is too short for resume validation`,
      );
      await readMedia(proxy, media);
      await client.report(media, "start", 120);
      await client.report(media, "progress", 140, true);
      await client.report(media, "progress", 150, false);
      const record = await client.report(media, "stop", 150);
      assert(record && record.status === "verified", `${id} saved watch record is unavailable`);
      assert(
        Math.abs(record.position - 150) < 2,
        `${id} saved resume position is ${record.position}`,
      );
      const resumed = await client.prepare((await client.resolveQueue(intent))[0], intent);
      assert(
        Math.abs(resumed.startSeconds - 150) < 2,
        `${id} resume preparation did not use the saved position`,
      );
      const episodes = await client.resolveQueue({ itemIds: [saved.episodeId], expand: true });
      assert.equal(episodes.length, 2, `${id} episode expansion did not produce both episodes`);
      const next = await client.prepare(
        episodes[1],
        { itemIds: [episodes[1].id], startTicks: 0 },
        media.source,
        media,
      );
      assert.equal(next.startSeconds, 0);
      assert.equal(next.audioId, 2);
      results.push({
        provider: id,
        version: saved.version,
        range: "verified",
        externalSubtitle: "verified",
        audioTracks: 2,
        resumeSeconds: record.position,
        episodes: episodes.length,
      });
      console.log(
        `${id}: media Range, two audio tracks, external subtitle, saved resume and episode queue passed`,
      );
      proxy.clear();
    }
  } finally {
    await proxy.close();
  }
  return {
    checkedAt: new Date().toISOString(),
    scope: "real server API and media proxy; player events are simulated",
    servers: results,
  };
}
