import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import type { AppState } from "../../shared/types";
import type { RunAction } from "../../ui";
import { useAppTranslation } from "../../i18n";

export function UpdateSettings({ state, run }: { state: AppState; run: RunAction }) {
  const { t } = useAppTranslation();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const update = state.updates;
  const busy = ["checking", "downloading", "installing"].includes(update.status);
  const install = () => void run("install-update", (api) => api.installUpdate());
  const status = (() => {
    switch (update.status) {
      case "disabled":
        return t(update.reason === "development" ? "updateDevelopment" : "updateManual");
      case "checking":
        return t("updateChecking");
      case "up-to-date":
        return t("updateCurrent");
      case "downloading":
        return t("updateDownloading", {
          version: update.version ?? "",
          percent: update.percent ?? 0,
        });
      case "downloaded":
        return t("updateDownloaded", { version: update.version ?? "" });
      case "installing":
        return t("updateInstalling");
      case "error":
        return t("updateFailed");
      default:
        return t("updateAutomaticDescription");
    }
  })();
  return (
    <div className="mt-8 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h3>{t("softwareUpdates")}</h3>
          <p
            role="status"
            className={`mt-1.5 text-xs ${update.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {status}
          </p>
        </div>
        {update.status === "disabled" ? (
          <Button
            variant="outline"
            onClick={() => void run("releases", (api) => api.openReleases())}
          >
            {t("downloadLatest")}
          </Button>
        ) : (
          <Button
            variant={update.status === "downloaded" ? "default" : "outline"}
            disabled={busy}
            onClick={() => {
              if (update.status !== "downloaded")
                void run("check-updates", (api) => api.checkForUpdates());
              else if (state.playback.status === "idle") install();
              else setConfirmRestart(true);
            }}
          >
            {update.status === "downloaded" ? (
              <Download size={15} />
            ) : (
              <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
            )}
            {t(
              update.status === "downloaded" || update.status === "installing"
                ? "restartUpdate"
                : "checkUpdates",
            )}
          </Button>
        )}
      </div>
      <AlertDialog open={confirmRestart} onOpenChange={setConfirmRestart}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restartUpdate")}</AlertDialogTitle>
            <AlertDialogDescription>{t("updateStopsPlayback")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={install}>{t("restartUpdate")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
