import { Outlet, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import {
  Bug,
  ExternalLink,
  Globe2,
  Info,
  Settings2,
  MonitorPlay,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { OptionSelect } from "../components/shared/OptionSelect";
import { SettingRow } from "../components/settings/SettingRow";
import { PlayerSetup } from "../components/players/PlayerSetup";
import { ServerForm } from "../components/servers/ServerForm";
import { ServerManagementRow } from "../components/servers/ServerManagementRow";
import { BrandLogo, BrandName } from "../components/shared/Brand";
import { DiagnosticsPanel } from "../components/settings/DiagnosticsPanel";
import { UpdateSettings } from "../components/settings/UpdateSettings";
import { useApp } from "../runtime/context";
import { useAppTranslation } from "../i18n";
import { settingsPaths } from "../routing";

const settingPages = [
  { id: "servers", icon: Globe2 },
  { id: "players", icon: MonitorPlay },
  { id: "general", icon: Settings2 },
  { id: "diagnostics", icon: Bug },
  { id: "about", icon: Info },
] as const;
function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-5 [&_p]:mt-[7px] [&>span]:text-xs [&>span]:text-muted-foreground">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function SettingsLayout() {
  const { state, clearError } = useApp();
  const { t } = useAppTranslation();
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  return (
    <div className="grid min-h-full grid-cols-[216px_minmax(0,1fr)] max-[1000px]:grid-cols-[190px_minmax(0,1fr)] max-[650px]:grid-cols-[150px_minmax(0,1fr)]">
      <aside className="sticky top-0 flex h-[calc(100vh-88px)] flex-col px-3 py-6 max-[650px]:px-2 max-[650px]:py-5 [&>h1]:mx-4 [&>h1]:mb-6 [&>h1]:text-xl [&>nav]:flex [&>nav]:flex-col [&>nav]:gap-[3px]">
        <h1>{t("settings")}</h1>
        <nav className="-ml-3 max-[650px]:-ml-2" aria-label={t("settings")}>
          {settingPages.map(({ id, icon: Icon }) => (
            <Button
              variant="ghost"
              key={id}
              className={cn(
                "h-auto justify-start gap-3 rounded-l-none rounded-r-[22px] py-3 text-[13px] text-muted-foreground has-[>svg]:pl-6 max-[650px]:has-[>svg]:pl-5",
                pathname.startsWith(settingsPaths[id]) && "bg-accent text-primary",
              )}
              aria-current={pathname.startsWith(settingsPaths[id]) ? "page" : undefined}
              onClick={() => {
                clearError();
                void navigate({ to: settingsPaths[id] });
              }}
            >
              <Icon size={17} />
              <span className="min-w-0 text-left leading-normal whitespace-normal">{t(id)}</span>
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
          <Outlet />
        </section>
      </div>
    </div>
  );
}
export function ServersPage() {
  const { state, run, isPending } = useApp();
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  return (
    <>
      <Heading title={t("serverManagement")}>
        <Button onClick={() => void navigate({ to: "/settings/servers/new" })}>
          <Plus size={16} />
          {t("addServer")}
        </Button>
      </Heading>
      <ul>
        {state.settings.servers.map((server) => (
          <ServerManagementRow
            key={server.id}
            server={server}
            disabled={isPending("remove") || isPending("reset")}
            onEdit={() =>
              void navigate({
                to: "/settings/servers/$serverId/edit",
                params: { serverId: server.id },
              })
            }
            onOpen={() =>
              void navigate({ to: "/library/$serverId", params: { serverId: server.id } })
            }
            onSignOut={() => void run("reset", (api) => api.resetSession(server.id))}
            onRemove={() => void run("remove", (api) => api.removeServer(server.id))}
          />
        ))}
      </ul>
      {!state.settings.servers.length && <p className="mt-2.5">{t("noServers")}</p>}
    </>
  );
}
export function ServerEditorPage() {
  const { state, runtime, run, isPending } = useApp();
  const { t } = useAppTranslation();
  const { serverId } = useParams({ strict: false });
  const server = serverId ? state.settings.servers.find((server) => server.id === serverId) : {};
  const navigate = useNavigate();
  if (!server) return <p role="alert">{t("serverMissing")}</p>;
  return (
    <>
      <Heading title={t(serverId ? "editServer" : "addServer")} />
      <ServerForm
        key={serverId ?? "new"}
        server={server}
        providers={state.providers}
        credentialsAvailable={state.credentialsAvailable}
        loadCredentials={runtime.api.getServerCredentials}
        testConnection={runtime.api.testServerConnection}
        saving={isPending("save")}
        onCancel={() => void navigate({ to: "/settings/servers" })}
        onSave={(input) =>
          void run("save", async (api) => {
            const updated = await api.saveServer(input);
            runtime.applyState(updated);
            await navigate({ to: "/settings/servers" });
            return updated;
          })
        }
      />
    </>
  );
}
export function PlayersPage() {
  const { state, run, update, isPending } = useApp();
  const { t } = useAppTranslation();
  return (
    <>
      <Heading title={t("players")}>
        <Button
          variant="outline"
          disabled={isPending("scan")}
          onClick={() => void run("scan", (api) => api.discoverPlayers())}
        >
          <RefreshCw size={15} className={isPending("scan") ? "animate-spin" : ""} />
          {t("scan")}
        </Button>
      </Heading>
      <PlayerSetup state={state} run={run} update={update}>
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
    </>
  );
}
export function GeneralPage() {
  const { state, update, isPending } = useApp();
  const { t } = useAppTranslation();
  return (
    <>
      <Heading title={t("general")} />
      <SettingRow title={t("theme")}>
        <OptionSelect
          label={t("theme")}
          value={state.settings.theme}
          onValueChange={(theme) => update({ theme })}
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
          onValueChange={(language) => update({ language })}
          options={[
            { value: "system", label: t("system") },
            { value: "zh", label: "中文" },
            { value: "en", label: "English" },
          ]}
        />
      </SettingRow>
      <SettingRow title={t("runInBackground")} description={t("runInBackgroundDescription")}>
        <Switch
          aria-label={t("runInBackground")}
          checked={state.settings.runInBackground}
          disabled={isPending("settings")}
          onCheckedChange={(checked) => update({ runInBackground: checked })}
        />
      </SettingRow>
      <SettingRow title={t("remindOnClose")} description={t("remindOnCloseDescription")}>
        <Switch
          aria-label={t("remindOnClose")}
          checked={state.settings.remindOnClose}
          disabled={!state.settings.runInBackground || isPending("settings")}
          onCheckedChange={(checked) => update({ remindOnClose: checked })}
        />
      </SettingRow>
    </>
  );
}
export function DiagnosticsPage() {
  const { state, run } = useApp();
  const { t } = useAppTranslation();
  return (
    <>
      <Heading title={t("diagnostics")} />
      <DiagnosticsPanel state={state} run={run} />
    </>
  );
}
export function AboutPage() {
  const { state, run } = useApp();
  const { t } = useAppTranslation();
  return (
    <>
      <Heading title={t("about")} />
      <div className="mt-6 flex flex-col items-start gap-5 [&_p]:mt-1.5">
        <BrandLogo width={230} />
        <p>v{state.version} · Apache-2.0</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void run("product", (api) => api.openLink("product"))}
          >
            {t("productPage")}
            <ExternalLink size={14} />
          </Button>
          <Button
            variant="outline"
            onClick={() => void run("github", (api) => api.openLink("github"))}
          >
            {t("githubRepository")}
            <ExternalLink size={14} />
          </Button>
        </div>
      </div>
      <UpdateSettings state={state} run={run} />
    </>
  );
}
export function LibraryPage() {
  const { state } = useApp();
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-background">
      {state.webStatus === "closed" && (
        <Button onClick={() => void navigate({ to: "/" })}>{t("chooseServer")}</Button>
      )}
    </div>
  );
}
