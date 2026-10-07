import type { DesktopAPI, Settings } from "./shared/types";
import type { MessageKey } from "./shared/i18n";
export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;
export type RunAction = (
  key: string,
  action: (desktop: DesktopAPI) => Promise<unknown>,
) => Promise<void>;
export type SettingsPatch = Partial<
  Pick<
    Settings,
    | "defaultPlayerId"
    | "autoNext"
    | "fullscreen"
    | "theme"
    | "language"
    | "setupCompleted"
    | "runInBackground"
    | "remindOnClose"
  >
>;
export function formatTime(value: number) {
  const seconds = Math.floor(Math.max(0, value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
