import { describe, expect, it, vi } from "vitest";
import { testEmbyConnection } from "../electron/providers/emby/connection-test";
import { errorToken } from "../src/shared/i18n";

const credentials = { username: "test-account", password: "test-password" };
const info = { Id: "server-id", ServerName: "Test Emby", Version: "4.9.5.0" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("Emby connection test", () => {
  it("checks a proxy subpath, authenticates in a JSON body and revokes the test token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(info))
      .mockResolvedValueOnce(json({ AccessToken: "test-token", User: { Id: "user-id" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await testEmbyConnection(
      "https://example.test/media",
      credentials,
      fetcher,
      "0.1.0",
    );
    expect(result).toEqual({ serverName: info.ServerName, authenticated: true });
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "https://example.test/media/emby/System/Info/Public",
      "https://example.test/media/emby/Users/AuthenticateByName",
      "https://example.test/media/emby/Sessions/Logout",
    ]);
    const options = fetcher.mock.calls[1][1];
    expect(JSON.parse(options.body)).toEqual({
      Username: credentials.username,
      Pw: credentials.password,
    });
    expect(options.redirect).toBe("error");
    expect(options.headers.get("X-Emby-Authorization")).toContain('Client="Freebo"');
    expect(fetcher.mock.calls[0][1].headers.has("X-Emby-Authorization")).toBe(false);
    expect(fetcher.mock.calls[2][1].headers["X-Emby-Token"]).toBe("test-token");
    expect(JSON.stringify(result)).not.toContain("test-token");
  });
  it("falls back to a root API only for a missing /emby endpoint and skips authentication for empty fields", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json(info));
    await expect(
      testEmbyConnection("https://example.test", undefined, fetcher, "0.1.0"),
    ).resolves.toEqual({ serverName: info.ServerName, authenticated: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe("https://example.test/System/Info/Public");
  });
  it.each([400, 401, 403])(
    "reports rejected credentials for HTTP %s without echoing passwords",
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(json(info))
        .mockResolvedValueOnce(new Response("test-password", { status }));
      await expect(
        testEmbyConnection("https://example.test", credentials, fetcher, "0.1.0"),
      ).rejects.toThrow(errorToken("credentialsRejected", { code: status }));
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
  it("rejects a non-Emby page before transmitting credentials", async () => {
    const fetcher = vi.fn(async () => new Response("<html>Sign in</html>"));
    await expect(
      testEmbyConnection("https://example.test", credentials, fetcher, "0.1.0"),
    ).rejects.toThrow(errorToken("unexpectedServer"));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("can authenticate when the public endpoint requires a login", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json({ AccessToken: "token", User: { Id: "user" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(
      testEmbyConnection("https://example.test", credentials, fetcher, "0.1.0"),
    ).resolves.toEqual({ serverName: "example.test", authenticated: true });
  });
  it("redacts transport failures and stops at the first failed request", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("sensitive upstream details");
    });
    await expect(
      testEmbyConnection("https://example.test", credentials, fetcher, "0.1.0"),
    ).rejects.toThrow(errorToken("connectionTestFailed"));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("times out without leaking transport details", async () => {
    vi.useFakeTimers();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((delay) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), delay);
      return controller.signal;
    });
    const fetcher = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)),
        ),
    );
    const check = expect(
      testEmbyConnection("https://example.test", undefined, fetcher, "0.1.0"),
    ).rejects.toThrow(errorToken("connectionTimeout"));
    await vi.advanceTimersByTimeAsync(15_000);
    await check;
    timeout.mockRestore();
    vi.useRealTimers();
  });
});
