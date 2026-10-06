import { UserFacingError } from "../../src/shared/i18n";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { Settings, Server } from "../../src/shared/types";

export function normalizeServerUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`,
    );
  } catch {
    throw new UserFacingError("invalidUrl");
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw new UserFacingError("invalidUrl");
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

const serverSchema = z.object({
  id: z.uuid(),
  providerId: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .default("emby"),
  name: z.string().trim().min(1).max(100),
  url: z.string().transform(normalizeServerUrl),
});
const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["iina", "mpv", "mpvnet", "vlc"]),
  executable: z.string().min(1),
  prefixArgs: z.array(z.string()),
  manual: z.boolean().optional(),
});
export const settingsSchema = z
  .object({
    servers: z.array(serverSchema),
    activeServerId: z.string().optional(),
    players: z.array(playerSchema),
    defaultPlayerId: z.string().optional(),
    autoNext: z.boolean(),
    fullscreen: z.boolean(),
    theme: z.enum(["system", "dark", "light"]),
    language: z.enum(["system", "zh", "en"]).default("system"),
    setupCompleted: z.boolean().default(false),
    playerScanCompleted: z.boolean().optional(),
  })
  .transform((settings) => ({
    ...settings,
    playerScanCompleted: settings.playerScanCompleted ?? settings.players.length > 0,
  }));
export const defaultSettings: Settings = {
  servers: [],
  players: [],
  autoNext: true,
  fullscreen: false,
  theme: "system",
  language: "system",
  setupCompleted: false,
  playerScanCompleted: false,
};

export class SettingsStore {
  value: Settings = structuredClone(defaultSettings);
  private writing: Promise<void> = Promise.resolve();
  constructor(private readonly path: string) {}
  async load(): Promise<Settings> {
    try {
      this.value = settingsSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new UserFacingError("settingsUnreadable");
    }
    return this.value;
  }
  async save(value: Settings): Promise<void> {
    this.value = settingsSchema.parse(value);
    const data = JSON.stringify(this.value, null, 2);
    this.writing = this.writing
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = `${this.path}.tmp`;
        await writeFile(temporary, data, { mode: 0o600 });
        await rename(temporary, this.path);
      });
    await this.writing;
  }
  async upsertServer(input: {
    id?: string;
    name: string;
    url: string;
    providerId?: string;
  }): Promise<Server> {
    const server = serverSchema.parse({ ...input, id: input.id ?? randomUUID() });
    if (
      this.value.servers.some(
        (s) => s.id !== server.id && s.url === server.url && s.providerId === server.providerId,
      )
    )
      throw new UserFacingError("serverDuplicate");
    const servers = this.value.servers.filter((s) => s.id !== server.id).concat(server);
    await this.save({ ...this.value, servers });
    return server;
  }
}
