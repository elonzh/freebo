import { useCallback } from "react";
import { createInstance } from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { i18nOptions, localizeError, type Locale } from "./shared/i18n";
import type { Translator } from "./ui";

export function createRendererI18n(locale: Locale) {
  const i18n = createInstance();
  void i18n.use(initReactI18next).init({ ...i18nOptions(locale), react: { useSuspense: false } });
  return i18n;
}
export function useAppTranslation() {
  const { t: translate, i18n } = useTranslation();
  const locale: Locale = i18n.resolvedLanguage === "zh" ? "zh" : "en";
  const t: Translator = useCallback((key, params) => translate(key, params), [translate]);
  return { t, locale, errorText: (error: unknown) => localizeError(locale, error) };
}
