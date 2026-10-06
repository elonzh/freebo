import { ExternalLink } from "lucide-react";
import type { Server } from "../shared/types";
import { serverLabel } from "../shared/servers";
import type { Translator } from "../ui";
import { ServerRow } from "./ServerRow";
import { ServerActions } from "./ServerActions";
import { Button } from "./ui/button";

export function ServerManagementRow({
  server,
  t,
  disabled,
  onEdit,
  onOpen,
  onRemove,
  onSignOut,
}: {
  server: Server;
  t: Translator;
  disabled: boolean;
  onEdit: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onSignOut: () => void;
}) {
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
        <ServerActions t={t} disabled={disabled} onRemove={onRemove} onSignOut={onSignOut} />
      </ServerRow>
    </li>
  );
}
