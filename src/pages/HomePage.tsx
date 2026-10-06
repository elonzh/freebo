import { useNavigate } from "@tanstack/react-router";
import { MonitorPlay, Pencil, Plus, Settings2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { BrandLogo } from "../components/Brand";
import { PlayerIcon } from "../components/IntegrationIcon";
import { ServerRow } from "../components/ServerRow";
import { serverLabel } from "../shared/servers";
import type { Server } from "../shared/types";
import { useApp } from "../runtime/context";
import { useAppTranslation } from "../i18n";

export function HomePage() {
  const { state } = useApp();
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const currentPlayer = state.settings.players.find(
    (player) => player.id === state.settings.defaultPlayerId,
  );
  const manageServers = (add = false) =>
    void navigate({ to: add ? "/settings/servers/new" : "/settings/servers" });
  const editServer = (server: Server) =>
    void navigate({ to: "/settings/servers/$serverId/edit", params: { serverId: server.id } });
  const open = (server: Server) =>
    void navigate({ to: "/library/$serverId", params: { serverId: server.id } });
  const go = (page: "settings" | "setup") => {
    if (page === "setup") void navigate({ to: "/setup", search: { step: "welcome" } });
    else void navigate({ to: "/settings/players" });
  };
  return (
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
        <Button variant="link" onClick={() => go("settings")}>
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
  );
}
