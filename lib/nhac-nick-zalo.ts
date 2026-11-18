import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegramMay } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { vnDateStr } from "@/lib/payroll";

const HAN_GIO = 48;
const MOI_NGAY_MOT_TIN = true;

const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tagOf = (ten: string, tgId?: string) => {
  const id = (tgId || "").trim();
  return /^\d+$/.test(id) ? `<a href="tg://user?id=${id}">${esc(ten)}</a>` : `<b>${esc(ten)}</b>`;
};

export type NickChet = { ownId: string; ten: string; sale: string; gio: number | null };

export async function nhacNickZaloChet(): Promise<{
  ok: boolean; chet: NickChet[]; daNhac: string[]; boQua: string[]; loi?: string;
}> {
  const sb = getServiceClient();

  const { data: accs, error } = await sb
    .from("zalo_bridge_accounts")
    .select("own_id,display_name,sale_name");

  if (error || !accs?.length) {
    return { ok: false, chet: [], daNhac: [], boQua: [], loi: error?.message || "không đọc được zalo_bridge_accounts" };
  }

  const moc = new Date(Date.now() - HAN_GIO * 3600e3).toISOString();
  const chet: NickChet[] = [];
  for (const a of accs as { own_id: string; display_name: string | null; sale_name: string | null }[]) {
    const { data: moi, error: e2 } = await sb
      .from("zalo_bridge_messages")
      .select("sent_at")
      .eq("own_id", a.own_id)
      .gte("sent_at", moc)
      .limit(1);
    if (e2) return { ok: false, chet: [], daNhac: [], boQua: [], loi: e2.message };
    if (moi?.length) continue;

    const { data: cuoi } = await sb
      .from("zalo_bridge_messages")
      .select("sent_at")
      .eq("own_id", a.own_id)
      .order("sent_at", { ascending: false })
      .limit(1);
    const t = cuoi?.[0]?.sent_at ? new Date(cuoi[0].sent_at).getTime() : null;
    chet.push({
      ownId: a.own_id,
      ten: a.display_name || a.own_id,
      sale: a.sale_name || "chưa rõ ai giữ",
      gio: t ? Math.round((Date.now() - t) / 3600e3) : null,
    });
  }
  if (!chet.length) return { ok: true, chet: [], daNhac: [], boQua: [] };

  const [{ data: users }, tgRaw] = await Promise.all([
    sb.from("users").select("id,full_name"),
    getConfigValue("sale_tg_chat"),
  ]);
  let tgMap: Record<string, string> = {};
  try { tgMap = JSON.parse(tgRaw || "{}") || {}; } catch { }
  const tgTheoTen = new Map<string, string>();
  for (const u of (users || []) as { id: string; full_name: string | null }[]) {
    const id = tgMap[u.id];
    if (id) tgTheoTen.set((u.full_name || "").trim().toLowerCase(), id);
  }

  let so: Record<string, string> = {};
  try { so = JSON.parse((await getConfigValue("zalo_nick_nhac")) || "{}") || {}; } catch { }
  const homNay = vnDateStr();
  const canNhac = chet.filter((c) => !MOI_NGAY_MOT_TIN || so[c.ownId] !== homNay);
  const boQua = chet.filter((c) => !canNhac.includes(c)).map((c) => c.ten);
  if (!canNhac.length) return { ok: true, chet, daNhac: [], boQua };

  const lines = [
    `<b>NICK ZALO ĐỨT KẾT NỐI — khách nhắn vào đây KHÔNG vào hệ thống</b>`,
    ``,
    ...canNhac.map((c) => {
      const ai = tagOf(c.sale, tgTheoTen.get(c.sale.trim().toLowerCase()));
      const lau = c.gio == null ? "chưa có tin nào" : c.gio >= 48 ? `${Math.round(c.gio / 24)} ngày không một tin` : `${c.gio}h không một tin`;
      return `• ${ai} — nick <b>${esc(c.ten)}</b>: ${lau}`;
    }),
    ``,
    `Việc này CHỈ người giữ nick làm được (máy không tự nhập được): mở ${appLink("/zalo/ket-noi")} rồi quét QR lại bằng chính điện thoại đang dùng nick đó.`,
    `Nick đã vào cầu nối thì ĐỪNG đăng nhập lại Salework — hai bên đá nhau.`,
  ];

  const r = await sendTelegramMay("doc-viec-sale", lines.join("\n"));
  if (!(r as any).ok) return { ok: false, chet, daNhac: [], boQua, loi: String((r as any).error || "gửi Telegram hỏng") };

  for (const c of canNhac) so[c.ownId] = homNay;
  await setConfigValue("zalo_nick_nhac", JSON.stringify(so), "Ngày gần nhất đã nhắc sale về nick Zalo đứt (1 tin/nick/ngày)")
    .catch(() => undefined);

  return { ok: true, chet, daNhac: canNhac.map((c) => c.ten), boQua };
}
