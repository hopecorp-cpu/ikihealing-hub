import { cookies } from "next/headers";
import { LOCALE_COOKIE, tr, type Locale, type TDich } from "./i18n";

export function getLocale(): Locale {
  const v = cookies().get(LOCALE_COOKIE)?.value;
  return v === "en" || v === "ja" ? v : "vi";
}

export function getT(): { locale: Locale; t: TDich } {
  const locale = getLocale();
  return { locale, t: ((vi: string | null | undefined) => tr(locale, vi)) as TDich };
}
