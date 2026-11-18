export type AliasMap = Record<string, string[]>;

export const DEFAULT_ALIAS: AliasMap = {

  "33333333-3333-3333-3333-333333333302": ["551", "i", "tien"],
  "33333333-3333-3333-3333-333333333305": ["885", "ii", "mai"],
  "7cf9321c-b273-42c0-b707-5f2fb73001ec": ["8848", "iii", "yen"],
};

export const boDau = (s: string) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export const tachToken = (s: string) => boDau(s).split(/[^a-z0-9]+/).filter(Boolean);

export function doanTheoAlias(tenHienThi: string, alias: AliasMap = DEFAULT_ALIAS): string | null {
  const tokens = new Set(tachToken(tenHienThi));
  if (!tokens.size) return null;
  const khop = Object.entries(alias).filter(([, ds]) => ds.some((t) => tokens.has(boDau(t))));
  return khop.length === 1 ? khop[0][0] : null;
}

export async function docAlias(sb: any): Promise<AliasMap> {
  try {
    const raw = (await sb.from("config").select("value").eq("key", "sale_tg_alias").maybeSingle()).data?.value;
    if (raw) {
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (o && typeof o === "object") return { ...DEFAULT_ALIAS, ...o };
    }
  } catch { }
  return { ...DEFAULT_ALIAS };
}

export async function docMapTg(sb: any): Promise<Record<string, string>> {
  try {
    const raw = (await sb.from("config").select("value").eq("key", "sale_tg_chat").maybeSingle()).data?.value;
    const o = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    return o && typeof o === "object" ? o : {};
  } catch { return {}; }
}

export async function ghiMapTg(sb: any, acmeUserId: string, tgUserId: string): Promise<boolean> {
  const map = await docMapTg(sb);
  if (map[acmeUserId] && String(map[acmeUserId]) === String(tgUserId)) return false;
  if (map[acmeUserId]) return false;
  map[acmeUserId] = String(tgUserId);
  await sb.from("config").upsert(
    { key: "sale_tg_chat", value: JSON.stringify(map), description: "Nhân sự ACME -> mã Telegram (để tag đích danh trong nhóm)" },
    { onConflict: "key" });
  return true;
}

export async function hocTuTinNhom(sb: any, from: any): Promise<{ hoc: boolean; ai?: string }> {
  try {
    if (!from?.id) return { hoc: false };
    const ten = `${from.first_name || ""} ${from.last_name || ""} ${from.username || ""}`.trim();
    const alias = await docAlias(sb);
    const uid = doanTheoAlias(ten, alias);
    if (!uid) return { hoc: false };
    const hoc = await ghiMapTg(sb, uid, String(from.id));
    return { hoc, ai: uid };
  } catch { return { hoc: false }; }
}
