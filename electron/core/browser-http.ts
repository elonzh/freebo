import type { Fetcher } from "../providers/types";
import { ServerAccessError } from "../providers/types";

export function guardServerAccess(fetcher: Fetcher): Fetcher {
  const rejectedOrigins = new Map<string, ServerAccessError>();
  return async (input, init) => {
    const origin = new URL(input).origin;
    const rejected = rejectedOrigins.get(origin);
    if (rejected) throw rejected;
    const response = await fetcher(input, init);
    if ([401, 403, 429].includes(response.status))
      rejectedOrigins.set(
        origin,
        new ServerAccessError(
          response.status === 401
            ? "authExpired"
            : response.status === 403
              ? "connectionForbidden"
              : "serverRateLimited",
          response.status,
        ),
      );
    return response;
  };
}

export function browserUserAgent(userAgent: string): string {
  return userAgent.replace(/\b(?:Freebo|Electron)\/[\w.-]+\s*/gi, "");
}

export function browserDeviceName(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/Chrome\//.test(userAgent)) return "Chrome";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  return "Safari";
}

export function browserFetcher(
  browser: { getUserAgent(): string; fetch: Fetcher },
  pageUrl: string,
): Fetcher {
  const page = new URL(pageUrl);
  page.hash = "";
  return (input, init) => {
    const target = new URL(input);
    const headers = new Headers(init?.headers);
    headers.set("User-Agent", browserUserAgent(browser.getUserAgent()));
    const crossOrigin = target.origin !== page.origin;
    const method = init?.method?.toUpperCase() ?? "GET";
    if (crossOrigin || !["GET", "HEAD"].includes(method)) headers.set("Origin", page.origin);
    else headers.delete("Origin");
    if (page.protocol === "https:" && target.protocol === "http:") headers.delete("Referer");
    else headers.set("Referer", crossOrigin ? `${page.origin}/` : page.href);
    return browser.fetch(input, { ...init, credentials: "include", headers });
  };
}
