import { useLayoutEffect } from "react";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  lazyRouteComponent,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { AppPage, AppState, SettingsPage } from "./shared/types";
import { UserFacingError } from "./shared/i18n";
import type { DesktopRuntime } from "./runtime/desktop";
import { App } from "./App";
import { BrowserShell } from "./components/BrowserShell";
import { HomePage } from "./pages/HomePage";
const settingsModule = () => import("./pages/SettingsPages");
const SettingsLayout = lazyRouteComponent(settingsModule, "SettingsLayout");
const ServersPage = lazyRouteComponent(settingsModule, "ServersPage");
const ServerEditorPage = lazyRouteComponent(settingsModule, "ServerEditorPage");
const PlayersPage = lazyRouteComponent(settingsModule, "PlayersPage");
const GeneralPage = lazyRouteComponent(settingsModule, "GeneralPage");
const DiagnosticsPage = lazyRouteComponent(settingsModule, "DiagnosticsPage");
const AboutPage = lazyRouteComponent(settingsModule, "AboutPage");
const LibraryPage = lazyRouteComponent(settingsModule, "LibraryPage");
const SetupGuide = lazyRouteComponent(() => import("./components/SetupGuide"), "SetupGuide");
import { PlaybackPanel } from "./components/PlaybackPanel";
import { ServerMenu } from "./components/ServerMenu";
import { Button } from "./components/ui/button";
import { useApp } from "./runtime/context";
import { useAppTranslation } from "./i18n";
import { preservesRoute, setupSearchSchema, snapshotPath } from "./routing";

type RouterContext = {
  runtime: DesktopRuntime;
  nativeTransition: { count: number; queue: Promise<void> };
};
async function preparePage(
  context: RouterContext,
  page: AppPage,
  section?: SettingsPage,
  serverId?: string,
) {
  const { runtime, nativeTransition } = context;
  const state = await runtime.queryClient.ensureQueryData(runtime.stateOptions);
  if (serverId && !state.settings.servers.some((server) => server.id === serverId))
    throw new UserFacingError("serverMissing");
  const matches = (snapshot: AppState) =>
    snapshot.page === page &&
    (!section || snapshot.settingsPage === section) &&
    (!serverId || snapshot.browser.serverId === serverId);
  if (matches(state) && nativeTransition.count === 0) return;
  nativeTransition.count++;
  // Native IPC cannot be aborted. Order transitions so a quick Home click wins
  // over an earlier server-open request that is still saving its active server.
  const operation = nativeTransition.queue.then(async () => {
    const current = await runtime.queryClient.ensureQueryData(runtime.stateOptions);
    if (matches(current)) return;
    if (serverId) runtime.applyState(await runtime.api.openServer(serverId));
    else await runtime.api.showPage(page, section);
  });
  nativeTransition.queue = operation.catch(() => {});
  try {
    await operation;
  } finally {
    nativeTransition.count--;
  }
}
function RouteError({ error }: ErrorComponentProps) {
  const { t, errorText } = useAppTranslation();
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-3 p-7" role="alert">
      <p className="text-destructive">{errorText(error)}</p>
      <Button variant="outline" onClick={() => void router.navigate({ to: "/" })}>
        {t("appHome")}
      </Button>
    </div>
  );
}
function usePopupReady(surface: "playback" | "servers") {
  const { runtime } = useApp();
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      void runtime.api.surfaceReady(surface).catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [runtime, surface]);
}
function PlaybackSurface() {
  usePopupReady("playback");
  const { state, run, error } = useApp();
  const { errorText } = useAppTranslation();
  return <PlaybackPanel state={state} run={run} error={error ? errorText(error) : ""} />;
}
function ServerSurface() {
  usePopupReady("servers");
  const { state, run, error } = useApp();
  const { errorText } = useAppTranslation();
  return <ServerMenu state={state} run={run} error={error ? errorText(error) : ""} />;
}
const root = createRootRouteWithContext<RouterContext>()({
  component: App,
  errorComponent: RouteError,
  notFoundComponent: () => (
    <RouteError error={new UserFacingError("invalidInput")} reset={() => {}} />
  ),
});
const shell = createRoute({ getParentRoute: () => root, id: "shell", component: BrowserShell });
const home = createRoute({
  getParentRoute: () => shell,
  path: "/",
  component: HomePage,
  beforeLoad: ({ context }) => preparePage(context, "home"),
});
const library = createRoute({
  getParentRoute: () => shell,
  path: "/library/$serverId",
  component: LibraryPage,
  beforeLoad: ({ context, params }) => preparePage(context, "library", undefined, params.serverId),
});
const setup = createRoute({
  getParentRoute: () => shell,
  path: "/setup",
  component: SetupGuide,
  validateSearch: (search) => setupSearchSchema.parse(search),
  beforeLoad: ({ context }) => preparePage(context, "setup"),
});
const settings = createRoute({
  getParentRoute: () => shell,
  path: "/settings",
  component: SettingsLayout,
});
const settingsIndex = createRoute({
  getParentRoute: () => settings,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/settings/servers" });
  },
});
const servers = createRoute({
  getParentRoute: () => settings,
  path: "servers",
  component: ServersPage,
  beforeLoad: ({ context }) => preparePage(context, "settings", "servers"),
});
const add = createRoute({
  getParentRoute: () => settings,
  path: "servers/new",
  component: ServerEditorPage,
  beforeLoad: ({ context }) => preparePage(context, "settings", "servers"),
});
const edit = createRoute({
  getParentRoute: () => settings,
  path: "servers/$serverId/edit",
  component: ServerEditorPage,
  beforeLoad: async ({ context, params }) => {
    const state = await context.runtime.queryClient.ensureQueryData(context.runtime.stateOptions);
    if (!state.settings.servers.some((server) => server.id === params.serverId))
      throw new UserFacingError("serverMissing");
    await preparePage(context, "settings", "servers");
  },
});
const players = createRoute({
  getParentRoute: () => settings,
  path: "players",
  component: PlayersPage,
  beforeLoad: ({ context }) => preparePage(context, "settings", "players"),
});
const general = createRoute({
  getParentRoute: () => settings,
  path: "general",
  component: GeneralPage,
  beforeLoad: ({ context }) => preparePage(context, "settings", "general"),
});
const diagnostics = createRoute({
  getParentRoute: () => settings,
  path: "diagnostics",
  component: DiagnosticsPage,
  beforeLoad: ({ context }) => preparePage(context, "settings", "diagnostics"),
});
const about = createRoute({
  getParentRoute: () => settings,
  path: "about",
  component: AboutPage,
  beforeLoad: ({ context }) => preparePage(context, "settings", "about"),
});
const playbackSurface = createRoute({
  getParentRoute: () => root,
  path: "/popups/playback",
  component: PlaybackSurface,
});
const serverSurface = createRoute({
  getParentRoute: () => root,
  path: "/popups/servers",
  component: ServerSurface,
});
const routeTree = root.addChildren([
  shell.addChildren([
    home,
    library,
    setup,
    settings.addChildren([settingsIndex, servers, add, edit, players, general, diagnostics, about]),
  ]),
  playbackSurface,
  serverSurface,
]);

export function createAppRouter(
  runtime: DesktopRuntime,
  initial: AppState,
  surface?: string | null,
) {
  const nativeTransition = { count: 0, queue: Promise.resolve() };
  const initialPath =
    surface === "servers" || surface === "playback" ? `/popups/${surface}` : snapshotPath(initial);
  return createRouter({
    routeTree,
    context: { runtime, nativeTransition },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    defaultPreload: false,
    defaultPendingMs: 0,
  });
}
export type AppRouter = ReturnType<typeof createAppRouter>;
declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

export function connectNativeNavigation(
  router: AppRouter,
  runtime: DesktopRuntime,
  popup: boolean,
) {
  if (popup) return () => {};
  const unsubscribe = runtime.subscribe((state) => {
    if (
      router.options.context?.nativeTransition.count ||
      preservesRoute(router.state.location.pathname, state)
    )
      return;
    // Snapshots can change the native guest independently (menus and popup actions).
    void router.navigate({ to: snapshotPath(state), replace: true });
  });
  const unsubscribeAdd = runtime.api.onAddServer(
    () => void router.navigate({ to: "/settings/servers/new" }),
  );
  return () => {
    unsubscribe();
    unsubscribeAdd();
  };
}
