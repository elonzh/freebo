// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installJellyfinAdapter } from "../../../../electron/providers/jellyfin/jellyfin-adapter";

const page = window as any;
afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  delete page.__freeboAdapterInstalled;
  delete page.webpackChunkjellyfin_web;
  delete page.webpackChunk;
  delete page.ApiClient;
  delete page.freeboPlayback;
  vi.useRealTimers();
});

describe("Jellyfin Web module boundary", () => {
  it.each(["webpackChunkjellyfin_web", "webpackChunk"])(
    "observes executed %s exports and preserves music/casting",
    async (chunkName) => {
      const request = vi.fn(async () => {});
      page.freeboPlayback = { request, ready: vi.fn() };
      page.ApiClient = {
        serverAddress: () => "http://localhost:3000/jellyfin",
        getCurrentUserId: () => "u",
        accessToken: () => "token",
        deviceId: () => "d",
        serverId: () => "server",
        appName: () => "Jellyfin Web",
        appVersion: () => "10.11",
        deviceName: () => "Chrome",
      };
      // Re-evaluate serialization so the test catches accidental references to module scope.
      // oxlint-disable-next-line typescript/no-implied-eval -- Verify contextBridge serialization.
      new Function(`return (${installJellyfinAdapter.toString()})`)()();
      const chunks = page[chunkName];
      const original = vi.fn();
      const manager = {
        play: original,
        getPlayers: () => [],
        _currentPlayer: { isLocalPlayer: true },
      };
      const unused = vi.fn();
      const data = [
        ["main"],
        {
          player: (module: any) => {
            module.exports.b = manager;
          },
          unrelated: unused,
        },
      ];
      // Model Webpack installing its own push callback and calling its captured parent.
      const parentPush = chunks.push.bind(chunks);
      chunks.push = (value: any) => {
        parentPush(value);
      };
      chunks.push(data);
      const module = { exports: {} };
      (data[1] as any).player(module);
      expect(unused).not.toHaveBeenCalled();
      expect(page.freeboPlayback.ready).toHaveBeenCalledWith("ready");
      await manager.play({
        items: [{ Id: "video", Type: "Movie" }],
        subtitleStreamIndex: "-1",
        startPositionTicks: "200000000",
      });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: expect.objectContaining({
            itemIds: ["video"],
            subtitleIndex: -1,
            startTicks: 200_000_000,
          }),
        }),
      );
      await manager.play({ items: [{ Id: "song", Type: "Audio" }] });
      manager._currentPlayer.isLocalPlayer = false;
      await manager.play({ items: [{ Id: "video", Type: "Movie" }] });
      expect(original).toHaveBeenCalledTimes(2);
    },
  );
});
