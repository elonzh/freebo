import { cn } from "./lib/utils";
import { Button } from "./components/ui/button";
import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bug,
  Globe2,
  Home,
  Info,
  Languages,
  ListVideo,
  LoaderCircle,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  X,
  ExternalLink,
} from "lucide-react";
import type { AppPage, AppState, Server } from "./shared/types";
import { translate, localizeError, resolveLocale } from "./shared/i18n";
import { serverLabel } from "./shared/servers";
import type { Translator, RunAction, SettingsPatch } from "./ui";
import { PlayerSetup } from "./components/PlayerSetup";
import { ServerForm } from "./components/ServerForm";
import { SetupGuide } from "./components/SetupGuide";
import { PlaybackPanel } from "./components/PlaybackPanel";
import { OptionSelect } from "./components/OptionSelect";
import { Input } from "./components/ui/input";
import { Switch } from "./components/ui/switch";
import { BrandLogo, BrandName } from "./components/Brand";
import { SiteIcon } from "./components/SiteIcon";
import { PlayerIcon } from "./components/IntegrationIcon";
import { ServerMenu } from "./components/ServerMenu";
import { ServerManagementRow } from "./components/ServerManagementRow";
import { ServerRow } from "./components/ServerRow";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";

const settingPages = [
  { id: "servers", icon: Globe2 },
  { id: "players", icon: MonitorPlay },
  { id: "appearance", icon: Languages },
  { id: "diagnostics", icon: Bug },
  { id: "about", icon: Info },
] as const;
const surface = new URLSearchParams(location.search).get("surface");
const popupSurface = surface === "playback" || surface === "servers";
export function App() {
  const [state, setState] = useState<AppState>();
  const [page, setPage] = useState<AppPage>("home");
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [tabs, setTabs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [editing, setEditing] = useState<Partial<Server> | null>(null);
  const api = window.desktop;
  const locale = state?.locale ?? resolveLocale("system", navigator.language);
  const theme = state?.settings.theme ?? "system";
  const initialized = Boolean(state);
  useLayoutEffect(() => {
    if (!initialized || !api || !popupSurface) return;
    const frame = requestAnimationFrame(() => {
      void api.surfaceReady(surface as "servers" | "playback").catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [initialized, api]);
  const applyState = useCallback((next: AppState) => {
    setState(next);
    if (popupSurface) return;
    setPage(next.page);
    if (next.page !== "settings") setEditing(null);
    if (next.page === "settings") setSettingsOpened(true);
    if (next.page === "library" && next.browser.serverId) {
      const id = next.browser.serverId;
      setTabs((current) => (current.includes(id) ? current : [...current, id]));
    }
  }, []);
  const t: Translator = (key, params) => translate(locale, key, params);
  useEffect(() => {
    if (!api) return;
    let current = true;
    void api
      .getState()
      .then((initial) => {
        if (current) applyState(initial);
      })
      .catch((err) => setError(String(err)));
    const unsubscribe = api.onState(applyState);
    const unsubscribeAddServer = api.onAddServer(() => {
      setEditing({});
      setError("");
    });
    return () => {
      current = false;
      unsubscribe();
      unsubscribeAddServer();
    };
  }, [api, applyState]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && systemTheme.matches),
      );
    syncTheme();
    systemTheme.addEventListener("change", syncTheme);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = translate(locale, surface === "servers" ? "chooseServer" : "brand");
    return () => systemTheme.removeEventListener("change", syncTheme);
  }, [theme, locale]);
  useEffect(() => {
    if (!popupSurface) void api?.showError(Boolean(error)).catch(() => {});
  }, [api, error]);
  const run: RunAction = useCallback(
    async (key, action) => {
      if (!api) return;
      setPending(key);
      setError("");
      try {
        const result = await action(api);
        if (result && typeof result === "object" && "settings" in result)
          applyState(result as AppState);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending("");
      }
    },
    [api, applyState],
  );
  const go = (next: AppPage, section?: AppState["settingsPage"]) => {
    setPage(next);
    setError("");
    if (next === "settings") setSettingsOpened(true);
    if (next !== "settings" || (section && section !== "servers")) setEditing(null);
    void run("page", (desktop) => desktop.showPage(next, section));
  };
  const open = (server: Server) => {
    setTabs((current) => (current.includes(server.id) ? current : [...current, server.id]));
    setPage("library");
    setEditing(null);
    void run("open", (desktop) => desktop.openServer(server.id));
  };
  const closeTab = (id: string) => {
    const remaining = tabs.filter((tab) => tab !== id);
    setTabs(remaining);
    if (page === "library" && state?.browser.serverId === id) {
      const next = state.settings.servers.find((server) => server.id === remaining.at(-1));
      if (next) open(next);
      else go("home");
    }
  };
  const manageServers = (add = false) => {
    go("settings", "servers");
    setEditing(add ? {} : null);
  };
  const editServer = (server: Server) => {
    go("settings", "servers");
    setEditing(server);
  };
  const update = (patch: SettingsPatch) =>
    void run("settings", (desktop) => desktop.updateSettings(patch));
  if (!api)
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground [&>h1]:text-foreground">
        <BrandLogo />
        <p>{t("preview")}</p>
      </main>
    );
  if (!state)
    return (
      <main className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" />
        {t("loading", { name: t("brand") })}
        {error && <p role="alert">{localizeError(locale, error)}</p>}
      </main>
    );
  if (surface === "playback") return <PlaybackPanel state={state} t={t} run={run} error={error} />;
  if (surface === "servers")
    return <ServerMenu state={state} t={t} run={run} error={localizeError(locale, error)} />;
  const active = state.settings.servers.find((server) => server.id === state.browser.serverId);
  const currentPlayer = state.settings.players.find(
    (player) => player.id === state.settings.defaultPlayerId,
  );
  const settingsPage = state.settingsPage;
  const mediaActive =
    state.playback.status === "playing" ||
    state.playback.status === "paused" ||
    state.playback.status === "preparing";
  const mediaError = Boolean(state.playback.error || state.playback.syncError);
  const connection =
    state.webStatus === "loading"
      ? t("connecting")
      : state.webStatus === "error"
        ? t("connectionFailed")
        : state.adapterStatus === "sign-in"
          ? t("signInRequired")
          : state.adapterStatus === "ready"
            ? t("ready")
            : state.adapterStatus === "error"
              ? t("adapterFailed")
              : t("pageReady");
  const locationText =
    page === "library" && active
      ? state.browser.url.startsWith("http")
        ? state.browser.url
        : active.url
      : `freebo://${page}`;
  const loadingPage = page === "library" && state.webStatus === "loading";
  return (
    <div
      className={`flex h-screen flex-col overflow-hidden platform-${state.platform} ${state.fullscreen ? "fullscreen" : ""}`}
    >
      <header className="browser-chrome">
        <div className="tab-strip">
          <nav className="tabs" aria-label={t("appHome")}>
            <Button
              variant="ghost"
              className={`browser-tab home-tab ${page === "home" || page === "setup" ? "active" : ""}`}
              aria-current={page === "home" || page === "setup" ? "page" : undefined}
              title={t("appHome")}
              onClick={() => go("home")}
            >
              <img src="./icon.svg" alt="" width={18} height={18} />
              <BrandName />
            </Button>
            {tabs
              .map((id) => state.settings.servers.find((server) => server.id === id))
              .filter((server): server is Server => Boolean(server))
              .map((server) => (
                <div
                  className={`browser-tab server-tab ${page === "library" && active?.id === server.id ? "active" : ""}`}
                  key={server.id}
                  title={serverLabel(server)}
                  onClick={() => open(server)}
                >
                  <Button
                    variant="ghost"
                    className="tab-select text-xs"
                    aria-current={
                      page === "library" && active?.id === server.id ? "page" : undefined
                    }
                    title={serverLabel(server)}
                    aria-busy={
                      state.browser.serverId === server.id && state.webStatus === "loading"
                    }
                  >
                    {state.browser.serverId === server.id && state.webStatus === "loading" ? (
                      <LoaderCircle
                        size={15}
                        className="animate-spin"
                        aria-label={t("loading", { name: serverLabel(server) })}
                      />
                    ) : (
                      <SiteIcon
                        src={state.serverFavicons[server.id]}
                        providerId={server.providerId}
                      />
                    )}
                    <span>{serverLabel(server)}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="tab-close"
                    aria-label={t("closeTab", { name: serverLabel(server) })}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(server.id);
                    }}
                  >
                    <X size={13} />
                  </Button>
                </div>
              ))}
            {settingsOpened && (
              <div
                className={`browser-tab settings-tab ${page === "settings" ? "active" : ""}`}
                onClick={() => go("settings")}
              >
                <Button
                  variant="ghost"
                  className="tab-select text-xs"
                  aria-current={page === "settings" ? "page" : undefined}
                >
                  <Settings2 size={15} />
                  <span>{t("settings")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="tab-close"
                  aria-label={t("closeTab", { name: t("settings") })}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSettingsOpened(false);
                    if (page === "settings") go("home");
                  }}
                >
                  <X size={13} />
                </Button>
              </div>
            )}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            className="new-tab"
            aria-label={t("newTab")}
            aria-haspopup="dialog"
            aria-expanded={state.serverPopupOpen}
            onClick={(event) => {
              const { x, y, width, height } = event.currentTarget.getBoundingClientRect();
              void run("server-menu", (desktop) =>
                desktop.toggleServerPopup({ x, y, width, height }),
              );
            }}
          >
            <Plus size={18} />
          </Button>
          <div className="drag-space" />
        </div>
        <div className="toolbar">
          <div className="navigation">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("back")}
              disabled={page !== "library" || !state.browser.canGoBack}
              onClick={() => void run("back", (desktop) => desktop.navigate("back"))}
            >
              <ArrowLeft size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("forward")}
              disabled={page !== "library" || !state.browser.canGoForward}
              onClick={() => void run("forward", (desktop) => desktop.navigate("forward"))}
            >
              <ArrowRight size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(loadingPage ? "stopLoading" : "reload")}
              disabled={page !== "library"}
              onClick={() =>
                void run("navigation", (desktop) =>
                  desktop.navigate(loadingPage ? "stop" : "reload"),
                )
              }
            >
              {loadingPage ? <X size={18} /> : <RefreshCw size={17} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("appHome")}
              disabled={page === "home"}
              onClick={() => go("home")}
            >
              <Home size={17} />
            </Button>
          </div>
          <div className="address-bar">
            {page === "library" ? (
              <Globe2 size={15} />
            ) : (
              <img src="./icon.svg" width={16} height={16} alt="" />
            )}
            <Input readOnly aria-label={t("address")} value={locationText} spellCheck={false} />
            {page === "library" && (
              <span
                className="flex shrink-0 items-center gap-1.5 overflow-hidden text-[11px] text-muted-foreground text-ellipsis whitespace-nowrap max-[1000px]:hidden"
                title={connection}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    state.adapterStatus === "ready" && state.webStatus === "ready"
                      ? "bg-[#2a8d64]"
                      : "bg-muted-foreground",
                  )}
                />
                {connection}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size={state.playback.status === "preparing" ? "default" : "icon"}
            className={cn(
              "relative",
              state.playback.status === "preparing" && "gap-2 px-3",
              (mediaActive || state.playbackPopupOpen) && "bg-accent text-primary",
            )}
            title={
              mediaError
                ? localizeError(locale, state.playback.error || state.playback.syncError)
                : t("playbackInfo")
            }
            aria-label={t("playbackInfo")}
            aria-expanded={state.playbackPopupOpen}
            aria-haspopup="dialog"
            onClick={(event) => {
              const { x, y, width, height } = event.currentTarget.getBoundingClientRect();
              void run("playback-popup", (desktop) =>
                desktop.togglePlaybackPopup({ x, y, width, height }),
              );
            }}
          >
            {state.playback.status === "preparing" ? (
              <>
                <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
                <span className="text-xs" role="status">
                  {t("preparing")}
                </span>
              </>
            ) : (
              <ListVideo size={20} />
            )}
            {state.playback.status !== "preparing" && (mediaActive || mediaError) && (
              <span
                className={cn(
                  "absolute right-1 bottom-1 size-1.5 rounded-full border border-(--toolbar)",
                  mediaError ? "bg-destructive" : "bg-primary",
                )}
              />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={page === "settings" ? "bg-accent text-primary" : undefined}
            aria-label={t("openSettings")}
            onClick={() => go("settings")}
          >
            <Settings2 size={19} />
          </Button>
        </div>
      </header>
      <main
        className={`relative flex-1 overflow-auto ${page === "library" ? "flex flex-col" : ""}`}
      >
        {(error || (state.webError && page === "library")) && (
          <div
            className="flex h-16 min-h-16 items-center gap-2.5 border-b bg-card px-5 py-3.5 text-destructive [&>span]:min-w-0 [&>span]:flex-1 [&>button]:ml-auto"
            role="alert"
          >
            <AlertCircle size={18} />
            <span>{localizeError(locale, error || state.webError)}</span>
            <Button
              variant="link"
              onClick={() => {
                if (error) setError("");
                else void run("reload", (desktop) => desktop.navigate("reload"));
              }}
            >
              {error ? t("close") : t("reload")}
            </Button>
          </div>
        )}
        {page === "library" ? (
          <div className="grid min-h-0 flex-1 place-items-center bg-background">
            {state.webStatus === "closed" && (
              <Button onClick={() => go("home")}>{t("chooseServer")}</Button>
            )}
          </div>
        ) : page === "setup" ? (
          <SetupGuide
            state={state}
            t={t}
            run={run}
            update={update}
            pending={pending}
            testConnection={api.testServerConnection}
            finish={(serverId) =>
              void run("finish-setup", async (desktop) => {
                const updated = await desktop.updateSettings({ setupCompleted: true });
                if (serverId) return desktop.openServer(serverId);
                await desktop.showPage("home");
                return updated;
              })
            }
          />
        ) : page === "home" ? (
          <div className="mx-auto flex min-h-full max-w-[960px] flex-col px-9 pt-8 pb-5 max-[650px]:px-5 max-[650px]:pt-6">
            <div className="flex items-center justify-between gap-5 [&_p]:mt-1.5">
              <div>
                <h1>{t("appHome")}</h1>
              </div>
              <Button variant="outline" onClick={() => manageServers()}>
                <Settings2 size={15} />
                {t("manageServers")}
              </Button>
            </div>
            {state.settings.servers.length ? (
              <section className="mt-8 [&>div]:mt-2">
                <h2>{t("servers")}</h2>
                <div className="my-[30px]">
                  {state.settings.servers.map((server) => (
                    <article key={server.id}>
                      <ServerRow
                        server={server}
                        label={`${t("open")} · ${serverLabel(server)}`}
                        onSelect={() => open(server)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t("editServer")} · ${serverLabel(server)}`}
                          title={t("editServer")}
                          onClick={() => editServer(server)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </ServerRow>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="flex flex-1 flex-col items-center justify-center pt-10 pb-15 text-center [&>h2]:text-[19px] [&>p]:mt-2 [&>p]:mb-[22px]">
                <BrandLogo width={260} className="mb-6" />
                <h2>{t("homeEmptyTitle")}</h2>
                <p>{t("homeEmptyDescription")}</p>
                <Button onClick={() => manageServers(true)}>
                  <Plus size={16} />
                  {t("addServer")}
                </Button>
              </section>
            )}
            <footer className="mt-auto flex items-center justify-between gap-3 border-t pt-3.5 text-xs text-muted-foreground max-[650px]:flex-wrap">
              <Button variant="link" onClick={() => go("setup")}>
                {t("setup")}
              </Button>
              <Button variant="link" onClick={() => go("settings", "players")}>
                {currentPlayer ? (
                  <>
                    <PlayerIcon kind={currentPlayer.kind} className="size-5" />
                    {currentPlayer.name}
                  </>
                ) : (
                  <>
                    <MonitorPlay size={14} />
                    {t("choosePlayer")}
                  </>
                )}
              </Button>
            </footer>
          </div>
        ) : (
          <div className="grid min-h-full grid-cols-[216px_minmax(0,1fr)] max-[1000px]:grid-cols-[190px_minmax(0,1fr)] max-[650px]:grid-cols-[150px_minmax(0,1fr)]">
            <aside className="sticky top-0 flex h-[calc(100vh-88px)] flex-col px-3 py-6 max-[650px]:px-2 max-[650px]:py-5 [&>h1]:mx-4 [&>h1]:mb-6 [&>h1]:text-xl [&>nav]:flex [&>nav]:flex-col [&>nav]:gap-[3px]">
              <h1>{t("settings")}</h1>
              <nav className="-ml-3 max-[650px]:-ml-2" aria-label={t("settings")}>
                {settingPages.map(({ id, icon: Icon }) => (
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-auto justify-start gap-3 rounded-l-none rounded-r-[22px] py-3 text-[13px] text-muted-foreground has-[>svg]:pl-6 max-[650px]:has-[>svg]:pl-5",
                      settingsPage === id && "bg-accent text-primary",
                    )}
                    key={id}
                    aria-current={settingsPage === id ? "page" : undefined}
                    onClick={() => go("settings", id)}
                  >
                    <Icon size={17} />
                    <span className="min-w-0 text-left leading-normal whitespace-normal">
                      {t(id)}
                    </span>
                  </Button>
                ))}
              </nav>
              <span className="mx-4 mt-auto pt-6 text-[11px] leading-[1.8] text-muted-foreground">
                <BrandName className="text-sm" />
                <br />v{state.version}
              </span>
            </aside>
            <div className="mx-auto w-full max-w-[880px] px-10 pt-7 pb-10 max-[1000px]:p-7 max-[650px]:p-5">
              <section className="mb-6 scroll-mt-[30px]">
                <div className="flex items-center justify-between gap-5 [&_p]:mt-[7px] [&>span]:text-xs [&>span]:text-muted-foreground">
                  <h2>
                    {t(
                      settingsPage === "servers"
                        ? editing
                          ? editing.id
                            ? "editServer"
                            : "addServer"
                          : "serverManagement"
                        : settingsPage,
                    )}
                  </h2>
                  {settingsPage === "players" && (
                    <Button
                      variant="outline"
                      disabled={pending === "scan"}
                      onClick={() => void run("scan", (desktop) => desktop.discoverPlayers())}
                    >
                      <RefreshCw size={15} className={pending === "scan" ? "animate-spin" : ""} />
                      {t("scan")}
                    </Button>
                  )}
                  {settingsPage === "servers" && !editing && (
                    <Button onClick={() => setEditing({})}>
                      <Plus size={16} />
                      {t("addServer")}
                    </Button>
                  )}
                </div>
                {settingsPage === "players" && (
                  <PlayerSetup state={state} t={t} run={run} update={update}>
                    <SettingRow title={t("autoNext")} description={t("autoNextDescription")}>
                      <Switch
                        aria-label={t("autoNext")}
                        checked={state.settings.autoNext}
                        onCheckedChange={(checked) => update({ autoNext: checked })}
                      />
                    </SettingRow>
                    <SettingRow title={t("fullscreen")}>
                      <Switch
                        aria-label={t("fullscreen")}
                        checked={state.settings.fullscreen}
                        onCheckedChange={(checked) => update({ fullscreen: checked })}
                      />
                    </SettingRow>
                  </PlayerSetup>
                )}
                {settingsPage === "appearance" && (
                  <>
                    <SettingRow title={t("theme")}>
                      <OptionSelect
                        label={t("theme")}
                        value={state.settings.theme}
                        onValueChange={(value) => update({ theme: value })}
                        options={[
                          { value: "system", label: t("system") },
                          { value: "light", label: t("light") },
                          { value: "dark", label: t("dark") },
                        ]}
                      />
                    </SettingRow>
                    <SettingRow title={t("language")}>
                      <OptionSelect
                        label={t("language")}
                        value={state.settings.language}
                        onValueChange={(value) => update({ language: value })}
                        options={[
                          { value: "system", label: t("system") },
                          { value: "zh", label: "中文" },
                          { value: "en", label: "English" },
                        ]}
                      />
                    </SettingRow>
                  </>
                )}
                {settingsPage === "servers" && (
                  <>
                    {editing ? (
                      <ServerForm
                        key={editing.id ?? "new"}
                        t={t}
                        providers={state.providers}
                        credentialsAvailable={state.credentialsAvailable}
                        loadCredentials={api.getServerCredentials}
                        testConnection={api.testServerConnection}
                        locale={state.locale}
                        server={editing}
                        saving={pending === "save"}
                        onCancel={() => setEditing(null)}
                        onSave={(input) =>
                          void run("save", async (desktop) => {
                            const updated = await desktop.saveServer(input);
                            setEditing(null);
                            return updated;
                          })
                        }
                      />
                    ) : (
                      <>
                        <ul>
                          {state.settings.servers.map((server) => (
                            <ServerManagementRow
                              key={server.id}
                              server={server}
                              t={t}
                              disabled={pending === "remove" || pending === "reset"}
                              onEdit={() => setEditing(server)}
                              onOpen={() => open(server)}
                              onSignOut={() =>
                                void run("reset", (desktop) => desktop.resetSession(server.id))
                              }
                              onRemove={() =>
                                void run("remove", async (desktop) => {
                                  const updated = await desktop.removeServer(server.id);
                                  setTabs((current) => current.filter((id) => id !== server.id));
                                  return updated;
                                })
                              }
                            />
                          ))}
                        </ul>
                        {!state.settings.servers.length && (
                          <p className="mt-2.5">{t("noServers")}</p>
                        )}
                      </>
                    )}
                  </>
                )}
                {settingsPage === "diagnostics" && (
                  <DiagnosticsPanel state={state} t={t} run={run} />
                )}
                {settingsPage === "about" && (
                  <div className="mt-6 flex flex-col items-start gap-5 [&_p]:mt-1.5">
                    <BrandLogo width={230} />
                    <p>v{state.version} · Apache-2.0</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          void run("product", (desktop) => desktop.openLink("product"))
                        }
                      >
                        {t("productPage")}
                        <ExternalLink size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void run("github", (desktop) => desktop.openLink("github"))}
                      >
                        {t("githubRepository")}
                        <ExternalLink size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
function SettingRow({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-[25px] border-b py-[18px] max-[650px]:flex-wrap [&>div:first-child]:min-w-0 [&>div:first-child]:flex-1 max-[650px]:[&>div:first-child]:basis-full [&_p]:mt-[5px] [&_p]:text-xs [&_p]:wrap-anywhere">
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <h3 className="wrap-anywhere">{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}
