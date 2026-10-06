import type { Server } from "./types";

export function serverLabel(server: Pick<Server, "name" | "url">): string {
  return server.name.trim() || server.url;
}
