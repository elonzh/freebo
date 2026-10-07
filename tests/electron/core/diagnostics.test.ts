import { describe, expect, it } from "vitest";
import { diagnosticSnapshot, productLink } from "../../../electron/core/diagnostics";
import type { AppState } from "../../../src/shared/types";
const runtime = {
  arch: "arm64",
  osRelease: "25.0",
  electron: "44.5.1",
  chromium: "152",
  node: "22",
};
const state = {
  version: "0.1.0",
  platform: "darwin",
  locale: "zh-CN",
  credentialsAvailable: true,
  webStatus: "ready",
  adapterStatus: "ready",
  settings: {
    servers: [{ id: "a", name: "Home", url: "https://private.example.test" }],
    players: [
      { id: "p", kind: "iina", name: "IINA", executable: "/private/path/IINA", prefixArgs: [] },
    ],
    defaultPlayerId: "p",
    theme: "light",
  },
  playback: {
    status: "idle",
    position: 42,
    duration: 100,
    title: "Private movie",
    queue: [{ id: "a", title: "Private movie" }],
    index: 0,
    sync: {
      status: "error",
      event: "stop",
      time: "2026-10-06T00:00:00Z",
      error: "https://private.example.test?api_key=secret",
    },
  },
} as unknown as AppState;
describe("diagnostic information and feedback links", () => {
  it("includes useful runtime and sync details while omitting credentials, addresses, executables and media titles", () => {
    const result = diagnosticSnapshot(state, runtime, [
      {
        time: "now",
        message:
          "Playback Private movie https://private.example.test/movie?api_key=secret Authorization: token",
      },
    ]);
    const json = JSON.stringify(result);
    for (const privateValue of [
      "private.example.test",
      "secret",
      "Private movie",
      "/private/path",
      ": token",
    ])
      expect(json).not.toContain(privateValue);
    expect(result).toMatchObject({
      ...runtime,
      serverCount: 1,
      players: [{ kind: "iina", name: "IINA", default: true }],
      playback: { position: 42, sync: { status: "error", event: "stop" } },
    });
  });
  it("opens fixed HTTPS destinations and only prefills environment information in an issue", () => {
    const diagnostic = diagnosticSnapshot(state, runtime, []);
    expect(productLink("product", diagnostic)).toBe("https://elonzh.cn/toys/freebo");
    expect(productLink("github", diagnostic)).toBe("https://github.com/elonzh/freebo");
    const issue = new URL(productLink("issue", diagnostic));
    expect(issue.origin + issue.pathname).toBe("https://github.com/elonzh/freebo/issues/new");
    expect(issue.searchParams.get("body")).toContain("Freebo 0.1.0");
    expect(issue.toString()).not.toContain("private.example.test");
  });
});
