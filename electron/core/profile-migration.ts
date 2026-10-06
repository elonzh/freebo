import { access, cp, mkdir, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
/** Copy a legacy profile only when the new profile is absent; never overwrite either profile. */
export async function migrateLegacyProfile(
  destination: string,
  candidates: string[],
): Promise<boolean> {
  try {
    await access(destination);
    return false;
  } catch {
    /* First launch. */
  }
  for (const source of candidates) {
    try {
      await access(source);
    } catch {
      continue;
    }
    const staging = `${destination}.migration`;
    try {
      await mkdir(dirname(destination), { recursive: true });
      await cp(source, staging, {
        recursive: true,
        force: false,
        errorOnExist: true,
        filter: (path) =>
          !/(?:^|[\\/])(?:SingletonLock|SingletonSocket|SingletonCookie)$/.test(path),
      });
      await rename(staging, destination);
      return true;
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      throw error;
    }
  }
  return false;
}
