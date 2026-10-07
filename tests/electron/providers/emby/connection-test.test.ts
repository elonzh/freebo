import { describe, expect, it, vi } from "vitest";
import { testEmbyConnection } from "../../../../electron/providers/emby/connection-test";
import { errorToken } from "../../../../src/shared/i18n";

const credentials = { username: "test-account", password: "test-password" };
const identity = { deviceId: "stable-browser-device", deviceName: "Chrome" };
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
      identity,
    );
    expect(result).toEqual({ serverName: info.ServerName, authenticated: true });
    expect(
      fetcher.mock.calls.map((call) => new URL(call[0]).origin + new URL(call[0]).pathname),
    ).toEqual([
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
    expect(options.headers.get("X-Emby-Authorization")).toContain('Client="Emby Web"');
    expect(options.headers.get("X-Emby-Authorization")).toContain('Device="Chrome"');
    expect(options.headers.get("X-Emby-Authorization")).toContain(`Version="${info.Version}"`);
    expect(options.headers.get("X-Emby-Authorization")).toContain(
      `DeviceId="${identity.deviceId}"`,
    );
    expect(fetcher.mock.calls[0][1].headers.has("X-Emby-Authorization")).toBe(false);
    expect(fetcher.mock.calls[2][1].headers["X-Emby-Token"]).toBe("test-token");
    const logout = new URL(fetcher.mock.calls[2][0]);
    expect(logout.searchParams.get("X-Emby-Client")).toBe("Emby Web");
    expect(logout.searchParams.get("X-Emby-Token")).toBe("test-token");
    expect(logout.searchParams.get("X-Emby-Client-Version")).toBe(info.Version);
    expect(new Headers(fetcher.mock.calls[2][1].headers).get("X-Emby-Authorization")).toContain(
      'Token="test-token"',
    );
    expect(JSON.stringify(result)).not.toContain("test-token");
  });
  it("falls back to a root API only for a missing /emby endpoint and skips authentication for empty fields", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json(info));
    await expect(
      testEmbyConnection("https://example.test", undefined, fetcher, identity),
    ).resolves.toEqual({ serverName: info.ServerName, authenticated: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe("https://example.test/System/Info/Public");
  });
  it.each([400, 401])(
    "reports rejected credentials for HTTP %s without echoing passwords",
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(json(info))
        .mockResolvedValueOnce(new Response("test-password", { status }));
      await expect(
        testEmbyConnection("https://example.test", credentials, fetcher, identity),
      ).rejects.toThrow(errorToken("credentialsRejected", { code: status }));
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
  it("authenticates with the embedded web client's identity on servers with a client allowlist", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("System/Info/Public")) return json(info);
      if (new URL(url).pathname.endsWith("Sessions/Logout"))
        return new Response(null, { status: 204 });
      const client = new Headers(init?.headers).get("X-Emby-Authorization");
      return client?.includes('Client="Emby Web"')
        ? json({ AccessToken: "test-token", User: { Id: "user-id" } })
        : new Response("Client not allowed", { status: 403 });
    });
    await expect(
      testEmbyConnection("https://example.test", credentials, fetcher, identity),
    ).resolves.toEqual({ serverName: info.ServerName, authenticated: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("distinguishes forbidden clients or accounts from an incorrect password", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(info))
      .mockResolvedValueOnce(new Response("Client not allowed", { status: 403 }));
    await expect(
      testEmbyConnection("https://example.test", credentials, fetcher, identity),
    ).rejects.toThrow(errorToken("connectionForbidden", { code: 403 }));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects a non-Emby page before transmitting credentials", async () => {
    const fetcher = vi.fn(async () => new Response("<html>Sign in</html>"));
    await expect(
      testEmbyConnection("https://example.test", credentials, fetcher, identity),
    ).rejects.toThrow(errorToken("unexpectedServer"));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("does not guess a web version or transmit credentials when public metadata is forbidden", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(
      testEmbyConnection("https://example.test", credentials, fetcher, identity),
    ).rejects.toThrow(errorToken("connectionForbidden"));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("redacts transport failures and stops at the first failed request", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("sensitive upstream details");
    });
    await expect(
      testEmbyConnection("https://example.test", credentials, fetcher, identity),
    ).rejects.toThrow(errorToken("connectionTestFailed"));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("reports a refused test-session logout without retrying or exposing its token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(info))
      .mockResolvedValueOnce(json({ AccessToken: "test-token", User: { Id: "user-id" } }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    const result = await testEmbyConnection("https://example.test", credentials, fetcher, identity);
    expect(result).toEqual({
      serverName: info.ServerName,
      authenticated: true,
      logoutFailed: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain("test-token");
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
      testEmbyConnection("https://example.test", undefined, fetcher, identity),
    ).rejects.toThrow(errorToken("connectionTimeout"));
    await vi.advanceTimersByTimeAsync(15_000);
    await check;
    timeout.mockRestore();
    vi.useRealTimers();
  });
});
