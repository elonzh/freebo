import { describe, expect, it } from "vitest";
import { embyProvider } from "../../../../electron/providers/emby";

describe("Emby playback requests", () => {
  it("validates server ownership at the provider boundary including exact reverse-proxy prefixes", () => {
    const server = {
      id: "test",
      name: "Emby",
      url: "https://example.test/media",
      providerId: "emby",
    };
    const request = {
      auth: {
        baseUrl: "https://example.test/media/emby",
        userId: "u",
        token: "t",
        deviceId: "d",
        clientName: "Emby Web",
        clientVersion: "4.9.5.0",
        deviceName: "Chrome",
      },
      intent: { itemIds: ["a"] },
    };
    expect(embyProvider.parsePlayback(request, server).intent.itemIds).toEqual(["a"]);
    expect(() =>
      embyProvider.parsePlayback(
        { ...request, auth: { ...request.auth, baseUrl: "https://example.test/media-other/emby" } },
        server,
      ),
    ).toThrow("playbackOrigin");
    expect(() =>
      embyProvider.parsePlayback(
        { ...request, auth: { ...request.auth, baseUrl: "https://other.test/media" } },
        server,
      ),
    ).toThrow("playbackOrigin");
  });
  it("treats blank video-version choices as unspecified while retaining ID validation", () => {
    const server = { id: "test", name: "Emby", url: "https://example.test", providerId: "emby" };
    const auth = {
      baseUrl: "https://example.test/emby",
      userId: "u",
      token: "t",
      deviceId: "d",
      clientName: "Emby Web",
      clientVersion: "4.9.5.0",
      deviceName: "Chrome",
    };
    for (const mediaSourceId of [undefined, null, ""]) {
      const result = embyProvider.parsePlayback(
        { auth, intent: { itemIds: ["video"], mediaSourceId } },
        server,
      );
      expect(result.intent.mediaSourceId).toBeUndefined();
    }
    const chosen = embyProvider.parsePlayback(
      { auth, intent: { itemIds: ["video"], mediaSourceId: "version-1" } },
      server,
    );
    expect(chosen.intent.mediaSourceId).toBe("version-1");
    for (const mediaSourceId of [42, "x".repeat(201)]) {
      expect(() =>
        embyProvider.parsePlayback({ auth, intent: { itemIds: ["video"], mediaSourceId } }, server),
      ).toThrow();
    }
    expect(() =>
      embyProvider.parsePlayback({ auth, intent: { itemIds: [""], mediaSourceId: "" } }, server),
    ).toThrow();
  });
});
