import { dirname } from "node:path";
import { z } from "zod";
import { UserFacingError } from "../../src/shared/i18n";
import type { AppDirectories } from "../../src/shared/types";

interface DirectoryApp {
  isPackaged: boolean;
  getAppPath(): string;
  getPath(name: "exe" | "userData"): string;
}

export function applicationDirectories(app: DirectoryApp): AppDirectories {
  return {
    program: app.isPackaged ? dirname(app.getPath("exe")) : app.getAppPath(),
    data: app.getPath("userData"),
  };
}

export async function openApplicationDirectory(
  app: DirectoryApp,
  input: unknown,
  openPath: (path: string) => Promise<string>,
): Promise<void> {
  const target = z.enum(["program", "data"]).parse(input);
  let error: string;
  try {
    error = await openPath(applicationDirectories(app)[target]);
  } catch {
    throw new UserFacingError("directoryOpenFailed");
  }
  if (error) throw new UserFacingError("directoryOpenFailed");
}
