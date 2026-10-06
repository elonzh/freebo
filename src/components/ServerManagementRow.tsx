import { useAppTranslation } from "../i18n";
import { ExternalLink } from "lucide-react";
import type { Server } from "../shared/types";
import { serverLabel } from "../shared/servers";
import { ServerRow } from "./ServerRow";
import { ServerActions } from "./ServerActions";
import { Button } from "./ui/button";

export function ServerManagementRow({
  server,
  disabled,
  onEdit,
  onOpen,
  onRemove,
  onSignOut,
}: {
  server: Server;
  disabled: boolean;
  onEdit: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onSignOut: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <li>
      <ServerRow
        server={server}
        label={`${t("editServer")} · ${serverLabel(server)}`}
        disabled={disabled}
        onSelect={onEdit}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("open")}
          title={t("open")}
          disabled={disabled}
          onClick={onOpen}
        >
          <ExternalLink size={16} />
        </Button>
        <ServerActions disabled={disabled} onRemove={onRemove} onSignOut={onSignOut} />
      </ServerRow>
    </li>
  );
}
