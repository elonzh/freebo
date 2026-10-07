import { Globe2, MonitorPlay } from "lucide-react";
import { cn } from "../../lib/utils";
import type { PlayerKind } from "../../shared/types";

const providerIcons = new Map([
  ["emby", "servers/emby.svg"],
  ["jellyfin", "servers/jellyfin.svg"],
  ["plex", "servers/plex.svg"],
]);
const playerIcons: Record<PlayerKind, string> = {
  iina: "players/iina.png",
  mpv: "players/mpv.svg",
  mpvnet: "players/mpvnet.png",
  vlc: "players/vlc.svg",
  potplayer: "players/potplayer.png",
  "mpc-hc": "players/mpc-hc.png",
  "mpc-be": "players/mpc-be.png",
};

function IntegrationIcon({
  src,
  fallback: Fallback,
  className,
}: {
  src?: string;
  fallback: typeof Globe2;
  className?: string;
}) {
  const classes = cn("size-8 shrink-0 object-contain", className);
  return src ? (
    <img src={`./integrations/${src}`} alt="" className={classes} draggable={false} />
  ) : (
    <Fallback aria-hidden="true" className={cn(classes, "text-muted-foreground")} />
  );
}

export function ServerIcon({ providerId, className }: { providerId: string; className?: string }) {
  return (
    <IntegrationIcon src={providerIcons.get(providerId)} fallback={Globe2} className={className} />
  );
}

export function PlayerIcon({ kind, className }: { kind: PlayerKind; className?: string }) {
  return <IntegrationIcon src={playerIcons[kind]} fallback={MonitorPlay} className={className} />;
}
