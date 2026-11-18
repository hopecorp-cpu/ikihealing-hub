"use client";
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { tr, fmtMoneyL, mlabel, type Locale, type TDich } from "@/lib/i18n";

const Ctx = createContext<Locale>("vi");

export function LangProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLang() {
  const locale = useContext(Ctx);
  const t = useCallback(((vi: string | null | undefined) => tr(locale, vi)) as TDich, [locale]);
  const money = useCallback((n: number) => fmtMoneyL(locale, n), [locale]);
  const ml = useCallback((label: string | null | undefined) => mlabel(locale, label ?? ""), [locale]);
  return { locale, t, money, ml };
}
