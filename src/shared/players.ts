import type { MessageKey } from "./i18n";

// Session options belong to Freebo so launch templates cannot silently disable
// IPC or replace the server's selected resume position and tracks.
const sessionOptions = new Set([
  "input-ipc-server",
  "input-ipc-client",
  "idle",
  "keep-open",
  "force-window",
  "save-position-on-quit",
  "resume-playback",
  "start",
  "force-media-title",
  "fullscreen",
  "aid",
  "sid",
  "sub-files",
  "http-header-fields",
]);

export function customPlayerArgumentsError(args: string[], mpvIpc = false): MessageKey | undefined {
  if (!args.some((argument) => argument.includes("{url}"))) return "playerUrlRequired";
  if (
    mpvIpc &&
    args.some((argument) => {
      const option = argument.match(/^--(?:no-)?([^=]+)/)?.[1];
      return (
        argument === "--" ||
        argument === "--{" ||
        argument === "--}" ||
        Boolean(option && sessionOptions.has(option))
      );
    })
  )
    return "playerMpvArgumentsConflict";
}
