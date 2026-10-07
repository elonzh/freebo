import { Globe2, MonitorPlay } from "lucide-react";
import { cn } from "../lib/utils";
import type { PlayerKind } from "../shared/types";

const providerIcons = new Map([
  ["emby", "emby.svg"],
  ["jellyfin", "jellyfin.svg"],
  ["plex", "plex.svg"],
]);
const playerIcons: Record<PlayerKind, string> = {
  iina: "iina.png",
  mpv: "mpv.svg",
  mpvnet: "mpvnet.png",
  vlc: "vlc.svg",
  potplayer: "potplayer.png",
  "mpc-hc": "mpc-hc.png",
  "mpc-be": "mpc-be.png",
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
