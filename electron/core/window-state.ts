import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

const boundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const windowStateSchema = z.object({
  bounds: boundsSchema,
  maximized: z.boolean().default(false),
});
export type WindowBounds = z.infer<typeof boundsSchema>;
export type WindowState = z.infer<typeof windowStateSchema>;
export const defaultWindowSize = { width: 1280, height: 850 };
export const minimumWindowSize = { width: 820, height: 600 };

// Fit saved bounds to the current display, including when a monitor was disconnected.
export function fitWindowBounds(bounds: WindowBounds, workArea: WindowBounds): WindowBounds {
  const width = Math.min(workArea.width, Math.max(minimumWindowSize.width, bounds.width));
  const height = Math.min(workArea.height, Math.max(minimumWindowSize.height, bounds.height));
  return {
    x: Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - height)),
    width,
    height,
  };
}

export class WindowStateStore {
  constructor(private readonly path: string) {}

  load(): WindowState | undefined {
    try {
      return windowStateSchema.parse(JSON.parse(readFileSync(this.path, "utf8")));
    } catch {
      // Missing or corrupt geometry must never prevent the app from starting.
      return undefined;
    }
  }

  save(state: WindowState): void {
    const data = JSON.stringify(windowStateSchema.parse(state));
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, data, { mode: 0o600 });
    renameSync(temporary, this.path);
  }
}
