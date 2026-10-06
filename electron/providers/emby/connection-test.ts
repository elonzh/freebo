import { z } from "zod";
import { randomUUID } from "node:crypto";
import { UserFacingError } from "../../../src/shared/i18n";
import type { ServerCredentials, ServerConnectionResult } from "../../../src/shared/types";
import type { Fetcher } from "../types";

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
  version: string,
): Promise<ServerConnectionResult> {
  const signal = AbortSignal.timeout(15_000);
  const authorization = `Emby Client="Freebo", Device="Connection test", DeviceId="${randomUUID()}", Version="${version}"`;
  const headers = { "X-Emby-Authorization": authorization, Accept: "application/json" };
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
    if (response.ok) {
      const info = publicInfo.safeParse(await parse(response));
      if (!info.success) throw new UserFacingError("unexpectedServer");
      serverName = info.data.ServerName;
    } else if (!credentials || ![401, 403].includes(response.status)) {
      throw new UserFacingError("serverRequest", { code: response.status });
    }
    if (!credentials) return { serverName, authenticated: false };
    const login = await request(`${api}/Users/AuthenticateByName`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ Username: credentials.username, Pw: credentials.password }),
    });
    if (!login.ok)
      throw new UserFacingError(
        [400, 401, 403].includes(login.status) ? "credentialsRejected" : "serverRequest",
        { code: login.status },
      );
    const result = authentication.safeParse(await parse(login));
    if (!result.success) throw new UserFacingError("unexpectedServer");
    // A test must not keep a second login session or hand a token to the renderer.
    try {
      await fetcher(`${api}/Sessions/Logout`, {
        method: "POST",
        headers: { ...headers, "X-Emby-Token": result.data.AccessToken },
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // The account was verified even if the server became unreachable during cleanup.
    }
    return { serverName, authenticated: true };
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError(signal.aborted ? "connectionTimeout" : "connectionTestFailed");
  }
}
