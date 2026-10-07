import { desktopStateKey } from "../../runtime/desktop";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Globe2,
  Home,
  ListVideo,
  LoaderCircle,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { BrandName } from "../shared/Brand";
import { SiteIcon } from "../shared/SiteIcon";
import type { AppState, Server } from "../../shared/types";
import { localizeError } from "../../shared/i18n";
import { serverLabel } from "../../shared/servers";
import { useAppTranslation } from "../../i18n";
import { useApp } from "../../runtime/context";
import { settingsPaths, pageFromPath } from "../../routing";

export function BrowserShell() {
  const { state, runtime, run, error: actionError, clearError } = useApp();
  const { t, locale, errorText } = useAppTranslation();
  const error = actionError ? errorText(actionError) : "";
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const page = pageFromPath(pathname);
  const [settingsOpened, setSettingsOpened] = useState(page === "settings");
  const [tabs, setTabs] = useState<string[]>(
    state.page === "library" && state.browser.serverId ? [state.browser.serverId] : [],
  );
  const router = useRouter();
  useEffect(
    () =>
      router.subscribe("onResolved", ({ toLocation }) => {
        const resolvedPage = pageFromPath(toLocation.pathname);
        if (resolvedPage === "settings") setSettingsOpened(true);
        if (resolvedPage === "library") {
          const id = runtime.queryClient.getQueryData<AppState>(desktopStateKey)?.browser.serverId;
          if (id) setTabs((current) => (current.includes(id) ? current : [...current, id]));
        }
      }),
    [router, runtime],
  );
  const go = (next: "home" | "setup" | "settings", section = state.settingsPage) => {
    clearError();
    if (next === "settings") void navigate({ to: settingsPaths[section] });
    else if (next === "setup") void navigate({ to: "/setup", search: { step: "welcome" } });
    else void navigate({ to: "/" });
  };
  const open = (server: Server) => {
    clearError();
    void navigate({ to: "/library/$serverId", params: { serverId: server.id } });
  };
  const closeTab = (id: string) => {
    const remaining = tabs.filter((tab) => tab !== id);
    setTabs(remaining);
    if (page === "library" && state.browser.serverId === id) {
      const next = state.settings.servers.find((server) => server.id === remaining.at(-1));
      if (next) open(next);
      else go("home");
    }
  };
  const active = state.settings.servers.find((server) => server.id === state.browser.serverId);
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
            <span>{error || errorText(state.webError)}</span>
            <Button
              variant="link"
              onClick={() => {
                if (error) clearError();
                else void run("reload", (api) => api.navigate("reload"));
              }}
            >
              {error ? t("close") : t("reload")}
            </Button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
