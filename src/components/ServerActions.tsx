import { useAppTranslation } from "../i18n";
import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function ServerActions({
  onRemove,
  onSignOut,
  disabled,
}: {
  onRemove: () => void;
  onSignOut: () => void;
  disabled: boolean;
}) {
  const { t } = useAppTranslation();
  const [action, setAction] = useState<"remove" | "sign-out" | null>(null);
  const removing = action === "remove";
  return (
    <AlertDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) setAction(null);
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("signOut")}
        title={t("signOut")}
        disabled={disabled}
        onClick={() => {
          setAction("sign-out");
        }}
      >
        <LogOut size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive"
        disabled={disabled}
        aria-label={t("removeServer")}
        title={t("removeServer")}
        onClick={() => {
          setAction("remove");
        }}
      >
        <Trash2 size={16} />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(removing ? "removeServerTitle" : "signOutTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(removing ? "removeConfirm" : "signOutConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: removing ? "destructive" : "default" })}
            onClick={() => {
              if (removing) onRemove();
              else onSignOut();
            }}
          >
            {t(removing ? "remove" : "signOut")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
