import { z } from "zod";
import { UserFacingError } from "../../../src/shared/i18n";
import type { ServerCredentials, ServerConnectionResult } from "../../../src/shared/types";
import type { BrowserClientIdentity, Fetcher } from "../types";

const publicInfo = z.object({
  Id: z.string().min(1),
  ServerName: z.string().min(1),
  Version: z.string().min(1),
});
const authentication = z.object({
  AccessToken: z.string().min(1),
  User: z.object({ Id: z.string().min(1) }),
});

export async function testEmbyConnection(
  baseUrl: string,
  credentials: ServerCredentials | undefined,
  fetcher: Fetcher,
  identity: BrowserClientIdentity,
): Promise<ServerConnectionResult> {
  const signal = AbortSignal.timeout(15_000);
  const request = (url: string, init?: RequestInit) => {
    const requestHeaders = new Headers({ Accept: "application/json" });
    new Headers(init?.headers).forEach((value, key) => requestHeaders.set(key, value));
    return fetcher(url, { ...init, headers: requestHeaders, redirect: "error", signal });
  };
  const parse = async (response: Response) => {
    try {
      return await response.json();
    } catch {
      if (signal.aborted) throw new UserFacingError("connectionTimeout");
      throw new UserFacingError("unexpectedServer");
    }
  };
  try {
    // Emby's web client uses /emby; older reverse proxies may expose the root API instead.
    let api = `${baseUrl}/emby`;
    let response = await request(`${api}/System/Info/Public`);
    if (response.status === 404) {
      api = baseUrl;
      response = await request(`${api}/System/Info/Public`);
    }
    let serverName = new URL(baseUrl).host;
    let version: string | undefined;
    if (response.ok) {
      const info = publicInfo.safeParse(await parse(response));
      if (!info.success) throw new UserFacingError("unexpectedServer");
      serverName = info.data.ServerName;
      version = info.data.Version;
    } else if (!credentials || ![401, 403].includes(response.status)) {
      throw new UserFacingError("serverRequest", { code: response.status });
    }
    if (!credentials) return { serverName, authenticated: false };
    // Never guess a web version or retry with another client identity.
    if (!version) throw new UserFacingError("connectionForbidden");
    const quote = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const authorization = `Emby Client="Emby Web", Device="${quote(identity.deviceName)}", DeviceId="${quote(identity.deviceId)}", Version="${quote(version)}"`;
    const headers = { "X-Emby-Authorization": authorization, Accept: "application/json" };
    const authenticatedUrl = (path: string, token: string) => {
      const url = new URL(`${api}/${path}`);
      const params = {
        "X-Emby-Client": "Emby Web",
        "X-Emby-Device-Name": identity.deviceName,
        "X-Emby-Device-Id": identity.deviceId,
        "X-Emby-Client-Version": version,
        "X-Emby-Token": token,
      };
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      return url.href;
    };
    const login = await request(`${api}/Users/AuthenticateByName`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ Username: credentials.username, Pw: credentials.password }),
    });
    if (!login.ok)
      throw new UserFacingError(
        login.status === 429
          ? "serverRateLimited"
          : login.status === 403
            ? "connectionForbidden"
            : [400, 401].includes(login.status)
              ? "credentialsRejected"
              : "serverRequest",
        { code: login.status },
      );
    const result = authentication.safeParse(await parse(login));
    if (!result.success) throw new UserFacingError("unexpectedServer");
    // A test must not keep a second login session or hand a token to the renderer.
    let logoutFailed = false;
    try {
      const logout = await fetcher(authenticatedUrl("Sessions/Logout", result.data.AccessToken), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Emby-Authorization": `${authorization}, Token="${quote(result.data.AccessToken)}"`,
          "X-Emby-Token": result.data.AccessToken,
        },
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      logoutFailed = !logout.ok;
    } catch {
      logoutFailed = true;
    }
    return { serverName, authenticated: true, ...(logoutFailed ? { logoutFailed: true } : {}) };
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError(signal.aborted ? "connectionTimeout" : "connectionTestFailed");
  }
}
