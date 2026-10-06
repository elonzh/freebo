// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installEmbyAdapter } from "../electron/providers/emby/emby-adapter";

describe("real Emby playback option shapes", () => {
  afterEach(() => {
    delete (window as any).__freeboAdapterInstalled;
    delete (window as any).Emby;
    delete (window as any).freeboPlayback;
  });
  it("takes over video intentions and normalizes HTML select strings, preserving explicit subtitle off", async () => {
    const original = vi.fn();
    const request = vi.fn(async () => {});
    const ready = vi.fn();
    const manager = { play: original };
    const api = {
      serverAddress: () => "https://example.test",
      getCurrentUserId: () => "u",
      accessToken: () => "test",
      deviceId: () => "d",
      appName: () => "Emby Web",
      appVersion: () => "4.9.5.0",
      deviceName: () => "Chrome",
      serverId: () => "remote-server",
      ensureWebSocket: vi.fn(),
    };
    (window as any).Emby = {
      importModule: vi.fn(async (path: string) =>
        path.includes("playbackmanager") ? manager : { getApiClient: () => api },
      ),
    };
    (window as any).freeboPlayback = { request, ready };
    installEmbyAdapter();
    await vi.waitFor(() => expect(ready).toHaveBeenCalledWith("ready"));
    await manager.play({
      items: [{ Id: "v", Type: "Movie" }],
      mediaSourceId: "",
      audioStreamIndex: "3",
      subtitleStreamIndex: "-1",
      startPositionTicks: "420000000",
    });
    expect(original).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({ serverId: "remote-server" }),
        intent: expect.objectContaining({
          itemIds: ["v"],
          mediaSourceId: undefined,
          audioIndex: 3,
          subtitleIndex: -1,
          startTicks: 420000000,
        }),
      }),
    );
    expect(api.ensureWebSocket).toHaveBeenCalledTimes(1);
    api.appVersion = () => "";
    await manager.play({ items: [{ Id: "v", Type: "Movie" }] });
    expect(original).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    api.appVersion = () => "4.9.5.0";
    await manager.play({
      items: [{ Id: "v", Type: "Movie", MediaSourceId: "item-version" }],
      mediaSourceId: "",
    });
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        intent: expect.objectContaining({ mediaSourceId: "item-version" }),
      }),
    );
    await manager.play({ items: [{ Id: "music", Type: "Audio" }] });
    expect(original).toHaveBeenCalledTimes(2);
  });
});
