import type { i18n } from "i18next";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { createRendererI18n } from "../src/i18n";
import type { Locale } from "../src/shared/i18n";

export function withTestProviders(children: ReactNode, locale: Locale | i18n = "zh") {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, networkMode: "always" },
      mutations: { retry: false, gcTime: 0, networkMode: "always" },
    },
  });
  return createElement(
    QueryClientProvider,
    { client },
    createElement(
      I18nextProvider,
      { i18n: typeof locale === "string" ? createRendererI18n(locale) : locale },
      children,
    ),
  );
}
