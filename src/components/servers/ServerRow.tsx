import type { ReactNode } from "react";
import type { Server } from "../../shared/types";
import { serverLabel } from "../../shared/servers";
import { ServerIcon } from "../shared/IntegrationIcon";
import { Button } from "../ui/button";

export function ServerRow({
  server,
  label,
  disabled = false,
  onSelect,
  children,
}: {
  server: Server;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b py-1">
      <Button
        variant="ghost"
        className="h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-4 text-left whitespace-normal"
        aria-label={label}
        disabled={disabled}
        onClick={onSelect}
      >
        <ServerIcon providerId={server.providerId} className="size-6" />
        <span className="min-w-0 flex-1">
          <span className="block wrap-anywhere">{serverLabel(server)}</span>
          {server.name && (
            <span className="mt-1 block text-xs font-normal text-muted-foreground wrap-anywhere">
              {server.url}
            </span>
          )}
        </span>
      </Button>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}
