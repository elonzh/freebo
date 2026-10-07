import {
  fixtureCredentials,
  providerIds,
  type Endpoints,
  type FixtureServer,
  type FixtureState,
} from "./config";

interface PublicInfo {
  Id: string;
  Version: string;
  StartupWizardCompleted?: boolean;
}
interface Authentication {
  AccessToken: string;
  User: { Id: string };
}
interface Item {
  Id: string;
  Type: string;
  Path?: string;
  MediaSources?: { Path?: string }[];
}
interface PlexMetadata {
  ratingKey: string;
  type: string;
  Media?: { Part?: { file?: string }[] }[];
}
export type Api = <T>(
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
) => Promise<T>;
const identity =
  'MediaBrowser Client="Freebo integration", Device="Fixture", DeviceId="freebo-integration-bootstrap", Version="1.0.0"';

export function serverApi(baseUrl: string, headers: Record<string, string> = {}): Api {
  return async <T>(
    path: string,
    options?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<T> => {
    const response = await fetch(`${baseUrl}/${path.replace(/^\//, "")}`, {
      method: options?.method ?? (options?.body === undefined ? "GET" : "POST"),
      headers: {
        Accept: "application/json",
        ...headers,
        ...options?.headers,
        ...(options?.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(options?.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(
        `Fixture API ${new URL(baseUrl).host}/${path.split("?")[0]}: HTTP ${response.status}`,
      );
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Fixture API did not return JSON: ${path.split("?")[0]}`);
    }
  };
}

export async function waitFor<T>(
  description: string,
  operation: () => Promise<T | undefined>,
  timeout = 120_000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await operation();
      if (result !== undefined) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Timed out waiting for ${description}.${lastError instanceof Error ? ` ${lastError.message}` : ""}`,
  );
}

async function setupMediaBrowser(id: "emby" | "jellyfin", baseUrl: string): Promise<FixtureServer> {
  const apiRoot = id === "emby" ? `${baseUrl}/emby` : baseUrl;
  const publicApi = serverApi(apiRoot, {
    Authorization: identity,
    "X-Emby-Authorization": identity,
  });
  const info = await waitFor(`${id} HTTP readiness`, async () => {
    const value = await publicApi<PublicInfo>("System/Info/Public");
    return value.Id && value.Version ? value : undefined;
  });
  const authenticate = () =>
    publicApi<Authentication>("Users/AuthenticateByName", {
      body: { Username: fixtureCredentials.username, Pw: fixtureCredentials.password },
    });
  let auth: Authentication | undefined;
  if (info.StartupWizardCompleted !== false) {
    try {
      auth = await authenticate();
    } catch (error) {
      if (info.StartupWizardCompleted === true) throw error;
    }
  }
  if (!auth) {
    await publicApi("Startup/Configuration", {
      body: {
        ServerName: `Freebo ${id} integration`,
        UICulture: "en-US",
        MetadataCountryCode: "US",
        PreferredMetadataLanguage: "en",
      },
    });
    await waitFor(`${id} initial administrator`, async () => {
      try {
        return await publicApi<{ Name: string }>("Startup/User");
      } catch (error) {
        if (id !== "jellyfin") throw error;
        return publicApi<{ Name: string }>("Startup/FirstUser");
      }
    });
    await publicApi("Startup/User", {
      body: { Name: fixtureCredentials.username, Password: fixtureCredentials.password },
    });
    await publicApi("Startup/RemoteAccess", {
      body: { EnableRemoteAccess: true, EnableAutomaticPortMapping: false },
    });
    await publicApi("Startup/Complete", { method: "POST" });
  }
  auth ??= await authenticate();
  if (!auth.AccessToken || !auth.User?.Id) throw new Error(`Invalid ${id} fixture authentication.`);
  const api = serverApi(apiRoot, {
    Authorization: `${identity}, Token="${auth.AccessToken}"`,
    "X-Emby-Token": auth.AccessToken,
  });
  const folders = await api<{ Name: string }[]>("Library/VirtualFolders");
  for (const [name, collectionType, path] of [
    ["Freebo Movies", "movies", "/media/Movies"],
    ["Freebo Shows", "tvshows", "/media/Shows"],
  ]) {
    if (folders.some((folder) => folder.Name === name)) continue;
    const query = new URLSearchParams({ name, collectionType, refreshLibrary: "true" });
    await api(`Library/VirtualFolders?${query}`, {
      body: {
        LibraryOptions: {
          PathInfos: [{ Path: path }],
          EnableRealtimeMonitor: false,
          EnableInternetProviders: false,
          TypeOptions: ["Movie", "Series", "Season", "Episode"].map((Type) => ({
            Type,
            MetadataFetchers: [],
            ImageFetchers: [],
          })),
        },
      },
    });
  }
  // A second library can be added while the first scan is already running.
  await waitFor(`${id} first scan completion`, async () => {
    const tasks = await api<{ Key: string; State: string }[]>("ScheduledTasks");
    return tasks.some((task) => task.Key === "RefreshLibrary" && task.State === "Running")
      ? undefined
      : true;
  });
  await api("Library/Refresh", { method: "POST" });
  const query = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: "Movie,Episode",
    Fields: "Path,MediaSources,MediaStreams",
    SortBy: "SortName",
  });
  const selected = await waitFor(`${id} movie and two episodes`, async () => {
    const result = await api<{ Items: Item[] }>(`Users/${auth.User.Id}/Items?${query}`);
    const path = (item: Item) => item.Path ?? item.MediaSources?.[0]?.Path ?? "";
    const movie = result.Items.find(
      (item) => item.Type === "Movie" && path(item).includes("Freebo Test (2026)"),
    );
    const episodes = result.Items.filter((item) => item.Type === "Episode");
    const episode = episodes.find((item) => path(item).includes("S01E01"));
    return movie && episode && episodes.length >= 2
      ? { movieId: movie.Id, episodeId: episode.Id }
      : undefined;
  });
  console.log(`${id}: ${info.Version}, movie and episodes ready`);
  return {
    baseUrl,
    version: info.Version,
    serverId: info.Id,
    userId: auth.User.Id,
    token: auth.AccessToken,
    ...selected,
  };
}

async function setupPlex(baseUrl: string): Promise<FixtureServer> {
  const api = serverApi(baseUrl, { "X-Plex-Client-Identifier": "freebo-integration-bootstrap" });
  const info = await waitFor("Plex HTTP readiness", async () => {
    const result = await api<{ MediaContainer: { machineIdentifier: string; version: string } }>(
      "identity",
    );
    return result.MediaContainer?.machineIdentifier ? result.MediaContainer : undefined;
  });
  // /identity becomes available before the legacy Personal Media agents finish loading.
  for (const mediaType of [1, 2])
    await waitFor(`Plex Personal Media agent (${mediaType})`, async () => {
      const result = await api<{
        MediaContainer: { Agent?: { identifier: string; Language?: { code: string } }[] };
      }>(`system/agents?mediaType=${mediaType}`);
      return result.MediaContainer.Agent?.some(
        (agent) => agent.identifier === "com.plexapp.agents.none" && agent.Language?.code === "xn",
      )
        ? true
        : undefined;
    });
  const folders = await api<{
    MediaContainer: { Directory?: { title: string; key: string; type: string }[] };
  }>("library/sections");
  for (const [name, type, location, scanner, agent] of [
    ["Freebo Movies", "movie", "/media/Movies", "Plex Movie Scanner", "com.plexapp.agents.none"],
    ["Freebo Shows", "show", "/media/Shows", "Plex Series Scanner", "com.plexapp.agents.none"],
  ]) {
    if (folders.MediaContainer.Directory?.some((folder) => folder.title === name)) continue;
    await waitFor(
      `Plex ${name} creation`,
      async () => {
        await api(
          `library/sections?${new URLSearchParams({ name, type, location, scanner, agent, language: "xn" })}`,
          { method: "POST" },
        );
        return true;
      },
      60_000,
    );
  }
  const sections = (
    await api<{ MediaContainer: { Directory: { key: string; type: string }[] } }>(
      "library/sections",
    )
  ).MediaContainer.Directory;
  const movieSection = sections.find((section) => section.type === "movie")!;
  const showSection = sections.find((section) => section.type === "show")!;
  for (const section of [movieSection, showSection])
    await api(`library/sections/${section.key}/refresh`);
  const selected = await waitFor("Plex movie and two episodes", async () => {
    const movies =
      (
        await api<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(
          `library/sections/${movieSection.key}/all`,
        )
      ).MediaContainer.Metadata ?? [];
    const episodes =
      (
        await api<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(
          `library/sections/${showSection.key}/all?type=4`,
        )
      ).MediaContainer.Metadata ?? [];
    const path = (item: PlexMetadata) => item.Media?.[0]?.Part?.[0]?.file ?? "";
    const movie = movies.find((item) => path(item).includes("Freebo Test (2026)"));
    const episode = episodes.find((item) => path(item).includes("S01E01"));
    return movie && episode && episodes.length >= 2
      ? { movieId: movie.ratingKey, episodeId: episode.ratingKey }
      : undefined;
  });
  console.log(`plex: ${info.version}, movie and episodes ready`);
  return {
    baseUrl,
    version: info.version,
    serverId: info.machineIdentifier,
    token: "",
    ...selected,
  };
}

export async function setupServers(project: string, endpoints: Endpoints): Promise<FixtureState> {
  const results = await Promise.allSettled(
    providerIds.map((id) =>
      id === "plex" ? setupPlex(endpoints[id]) : setupMediaBrowser(id, endpoints[id]),
    ),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Fixture initialization failed. Check integration:status; integration:reset recreates only this test environment.",
    );
  return {
    project,
    createdAt: new Date().toISOString(),
    servers: Object.fromEntries(
      results.map((result, index) => [
        providerIds[index],
        (result as PromiseFulfilledResult<FixtureServer>).value,
      ]),
    ) as FixtureState["servers"],
  };
}
