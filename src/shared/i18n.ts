import { createInstance, type InitOptions } from "i18next";
import { zh } from "./locales/zh";
import { en } from "./locales/en";

export type Locale = "zh" | "en";
export type Language = "system" | Locale;
export type MessageKey = keyof typeof zh;
export const resources = { zh: { translation: zh }, en: { translation: en } } as const;
export function i18nOptions(locale: Locale): InitOptions {
  return {
    resources,
    lng: locale,
    fallbackLng: "en",
    supportedLngs: ["zh", "en"],
    initAsync: false,
    returnNull: false,
    interpolation: { escapeValue: false },
  };
}
const sharedI18n = createInstance();
void sharedI18n.init(i18nOptions("en"));
export function resolveLocale(language: Language, systemLocale: string): Locale {
  return language === "system" ? (/^zh(?:[-_]|$)/i.test(systemLocale) ? "zh" : "en") : language;
}
export function translate(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  return sharedI18n.t(key, { ...params, lng: locale });
}
const prefix = "FREEBO_ERROR:";
export function errorToken(key: MessageKey, params: Record<string, string | number> = {}): string {
  return prefix + JSON.stringify({ key, params });
}
export class UserFacingError extends Error {
  constructor(key: MessageKey, params?: Record<string, string | number>) {
    super(errorToken(key, params));
  }
}
export function localizeError(locale: Locale, error: unknown): string {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error == null
          ? ""
          : translate(locale, "actionFailed");
  const marker = text.indexOf(prefix);
  if (marker >= 0) {
    try {
      const { key, params } = JSON.parse(text.slice(marker + prefix.length)) as {
        key: MessageKey;
        params: Record<string, string | number>;
      };
      if (Object.hasOwn(zh, key)) return translate(locale, key, params);
    } catch {
      /* Unexpected system errors retain their diagnostic detail. */
    }
  }
  return text.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
}
export const messageKeys = Object.keys(zh) as MessageKey[];
