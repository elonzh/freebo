import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { PlayerIcon } from "./IntegrationIcon";
import { localizeError, type MessageKey } from "../shared/i18n";
import type { AppState, Diagnostics } from "../shared/types";
import { formatTime, type Translator, type RunAction } from "../ui";

function Details({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mt-3 divide-y">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[minmax(120px,1fr)_minmax(0,2fr)] gap-5 py-3 text-sm max-[650px]:grid-cols-1 max-[650px]:gap-1"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function DiagnosticsPanel({
  state,
  t,
  run,
}: {
  state: AppState;
  t: Translator;
  run: RunAction;
}) {
  const [data, setData] = useState<Diagnostics>();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let active = true;
    void window.desktop
      ?.getDiagnostics()
      .then((value) => {
        if (active) {
          setData(value);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(localizeError(state.locale, reason));
      });
    return () => {
      active = false;
    };
  }, [
    state.locale,
    state.webStatus,
    state.adapterStatus,
    state.playback.sync?.status,
    state.playback.sync?.time,
  ]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3_000);
    return () => clearTimeout(timer);
  }, [copied]);
  const sync = state.playback.sync;
  const record = sync?.record;
  const syncStatus: Record<NonNullable<Diagnostics["playback"]["sync"]>["status"], MessageKey> = {
    pending: "syncPending",
    success: "syncSuccess",
    error: "syncFailure",
  };
  const syncEvent: Record<NonNullable<Diagnostics["playback"]["sync"]>["event"], MessageKey> = {
    start: "syncStart",
    progress: "syncProgress",
    stop: "syncStop",
  };
  return (
    <div className="mt-4 space-y-7">
      <div>
        <p className="max-w-prose text-sm leading-relaxed">{t("diagnosticsDescription")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              void run("copy-diagnostics", async (desktop) => {
                await desktop.copyDiagnostics();
                setCopied(true);
              })
            }
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t("copiedDiagnostics") : t("copyDiagnostics")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void run("report-issue", (desktop) => desktop.openLink("issue"))}
          >
            {t("reportIssue")}
            <ExternalLink size={14} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => void run("diagnostics", (desktop) => desktop.exportDiagnostics())}
          >
            <Download size={15} />
            {t("exportLog")}
          </Button>
          <Button
            variant="ghost"
            disabled={refreshing}
            onClick={() =>
              void run("refresh-diagnostics", async (desktop) => {
                setRefreshing(true);
                try {
                  setData(await desktop.getDiagnostics());
                  setError("");
                } finally {
                  setRefreshing(false);
                }
              })
            }
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin motion-reduce:animate-none" : ""}
            />
            {t("refreshDiagnostics")}
          </Button>
        </div>
        <span className="sr-only" role="status">
          {copied ? t("copiedDiagnostics") : ""}
        </span>
        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <section aria-label={t("connectionInfo")}>
        <h3>{t("connectionInfo")}</h3>
        <Details
          rows={[
            [t("serverCount"), state.settings.servers.length],
            [
              t("webState"),
              t(
                (
                  {
                    closed: "notOpen",
                    loading: "connecting",
                    ready: "pageReady",
                    error: "connectionFailed",
                  } as const
                )[state.webStatus],
              ),
            ],
            [
              t("adapterState"),
              t(
                (
                  {
                    waiting: "waiting",
                    "sign-in": "signInRequired",
                    ready: "ready",
                    error: "adapterFailed",
                  } as const
                )[state.adapterStatus ?? "waiting"],
              ),
            ],
            [
              t("playbackState"),
              t(
                (
                  {
                    idle: state.playback.queue.length ? "ended" : "noPlayback",
                    preparing: "preparing",
                    playing: "playing",
                    paused: "paused",
                    error: "playbackFailed",
                  } as const
                )[state.playback.status],
              ),
            ],
            [
              t("playbackPosition"),
              <span key="position" className="tabular-nums">
                {formatTime(state.playback.position)} / {formatTime(state.playback.duration)}
              </span>,
            ],
            [
              t("syncState"),
              <div key="sync">
                <span className={sync?.status === "error" ? "text-destructive" : undefined}>
                  {sync
                    ? `${t(syncStatus[sync.status])} · ${t(syncEvent[sync.event])}`
                    : t("syncNone")}
                </span>
                {sync?.time && (
                  <time className="mt-1 block text-xs text-muted-foreground" dateTime={sync.time}>
                    {new Date(sync.time).toLocaleString(state.locale)}
                  </time>
                )}
                {sync?.error && (
                  <p className="mt-1 text-sm text-destructive">
                    {localizeError(state.locale, sync.error)}
                  </p>
                )}
              </div>,
            ],
            [
              t("serverPlaybackRecord"),
              record?.status === "verified" ? (
                <div key="record">
                  {record.playCount !== undefined && (
                    <p>{t("recordPlayCount", { count: record.playCount })}</p>
                  )}
                  {record.lastPlayedAt && (
                    <time
                      className="mt-1 block text-xs text-muted-foreground"
                      dateTime={record.lastPlayedAt}
                    >
                      {new Date(record.lastPlayedAt).toLocaleString(state.locale)}
                    </time>
                  )}
                  <p className="mt-1 tabular-nums">
                    {t("savedResumePosition", { position: formatTime(record.position) })}
                  </p>
                  {record.reportedPosition > 0 && record.position === 0 && !record.played && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {record.minimumResumeSeconds !== undefined &&
                      record.reportedPosition < record.minimumResumeSeconds
                        ? t("belowResumeThreshold", {
                            position: formatTime(Math.ceil(record.minimumResumeSeconds)),
                          })
                        : t("resumePositionCleared")}
                    </p>
                  )}
                </div>
              ) : (
                t(record ? "recordUnavailable" : "recordPending")
              ),
            ],
            [t("passwordStorage"), t(state.credentialsAvailable ? "available" : "unavailable")],
          ]}
        />
      </section>
      <section aria-label={t("players")}>
        <h3>{t("players")}</h3>
        {state.settings.players.length ? (
          <ul className="mt-3 divide-y">
            {state.settings.players.map((player) => (
              <li key={player.id} className="flex items-center gap-3 py-3">
                <PlayerIcon kind={player.kind} className="size-6" />
                <span className="min-w-0 flex-1 text-sm wrap-anywhere">{player.name}</span>
                {player.id === state.settings.defaultPlayerId && (
                  <span className="text-xs text-primary">{t("default")}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm">{t("noPlayers")}</p>
        )}
      </section>
      <section aria-label={t("runtimeInfo")}>
        <h3>{t("runtimeInfo")}</h3>
        {data && (
          <Details
            rows={[
              ["Freebo", `v${data.version}`],
              [t("systemInfo"), `${data.platform} ${data.arch} · ${data.osRelease}`],
              ["Electron / Chromium", `${data.electron} / ${data.chromium}`],
              ["Node.js", data.node],
              [t("language"), state.locale],
            ]}
          />
        )}
      </section>
      <section aria-label={t("recentEvents")}>
        <h3>{t("recentEvents")}</h3>
        {data?.logs.length ? (
          <ol className="mt-3 divide-y">
            {data.logs
              .slice(-8)
              .reverse()
              .map((entry, index) => (
                <li key={`${entry.time}-${index}`} className="py-3 text-sm wrap-anywhere">
                  <time
                    dateTime={entry.time}
                    className="mb-1 block text-xs text-muted-foreground tabular-nums"
                  >
                    {new Date(entry.time).toLocaleString(state.locale)}
                  </time>
                  {localizeError(state.locale, entry.message)}
                </li>
              ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm">{t("noEvents")}</p>
        )}
      </section>
    </div>
  );
}
