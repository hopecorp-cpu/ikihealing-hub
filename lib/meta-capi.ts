import { createHash } from "node:crypto";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { VAT_RATE } from "@/lib/money";

export const KHOA_CAPI = "meta_capi";
export const KHOA_TRANG_THAI_CAPI = "meta_capi_trangthai";
const G = "https://graph.facebook.com/v21.0";
const VAT_MUL = 1 + VAT_RATE;

export type CauHinhCapi = { bat: boolean; pixel_id: string; test_event_code: string };

export function docCauHinhCapi(raw: string | null | undefined): CauHinhCapi {
  try {
    const j = JSON.parse(raw || "{}") || {};
    return {
      bat: j.bat === true,
      pixel_id: String(j.pixel_id || "").replace(/\D/g, ""),
      test_event_code: String(j.test_event_code || "").trim(),
    };
  } catch { return { bat: false, pixel_id: "", test_event_code: "" }; }
}

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export function chuanSdtMeta(p: unknown): string | null {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "84" + d.slice(1);
  else if (!d.startsWith("84") && d.length === 9) d = "84" + d;
  return /^84\d{9,10}$/.test(d) ? d : null;
}
export const bamSdt = (p: unknown) => { const d = chuanSdtMeta(p); return d ? sha256(d) : null; };
export const bamEmail = (e: unknown) => {
  const s = String(e ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? sha256(s) : null;
};

export type SuKienCapi = {
  ten: "Lead" | "Purchase";
  eventId: string;
  thoiDiem: number;
  sdt?: unknown;
  email?: unknown;
  giaTri?: number;
};

export function taoSuKienCapi(e: SuKienCapi): Record<string, any> | null {
  const ph = bamSdt(e.sdt), em = bamEmail(e.email);
  if (!ph && !em) return null;
  const user_data: Record<string, string[]> = {};
  if (ph) user_data.ph = [ph];
  if (em) user_data.em = [em];
  const ev: Record<string, any> = {
    event_name: e.ten,
    event_time: Math.floor((Number.isFinite(e.thoiDiem) ? e.thoiDiem : Date.now()) / 1000),
    event_id: String(e.eventId).slice(0, 100),
    action_source: "system_generated",
    user_data,
  };
  if (e.ten === "Purchase") ev.custom_data = { currency: "VND", value: Math.max(0, Math.round(Number(e.giaTri) || 0)) };
  return ev;
}

async function sanSang(): Promise<{ cfg: CauHinhCapi; token: string } | null> {
  const token = (process.env.META_CAPI_TOKEN || "").trim();
  if (!token) return null;
  let raw: string | null = null;
  try { raw = await getConfigValue(KHOA_CAPI); } catch { return null; }
  const cfg = docCauHinhCapi(raw);
  if (!cfg.bat || !cfg.pixel_id) return null;
  return { cfg, token };
}

async function guiLo(suKien: SuKienCapi[]): Promise<{ gui: number; loi?: string } | null> {
  const s = await sanSang();
  if (!s) return null;
  const data = suKien.map(taoSuKienCapi).filter(Boolean) as Record<string, any>[];
  if (!data.length) return { gui: 0 };
  const body: Record<string, any> = { data };
  if (s.cfg.test_event_code) body.test_event_code = s.cfg.test_event_code;
  let loi: string | undefined;
  let nhan = 0;
  try {
    const r = await fetch(`${G}/${s.cfg.pixel_id}/events?access_token=${encodeURIComponent(s.token)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j?.error) loi = String(j?.error?.message || `HTTP ${r.status}`).slice(0, 160);
    else nhan = Number(j?.events_received) || 0;
  } catch (e: any) { loi = String(e?.message || e).slice(0, 160); }
  await setConfigValue(KHOA_TRANG_THAI_CAPI, JSON.stringify({
    at: new Date().toISOString(), ok: !loi, gui: data.length, nhan, loai: suKien[0]?.ten, thu: !!s.cfg.test_event_code, loi: loi || null,
  }), "Nhịp tim Meta CAPI (watchdog đọc khoá này khi meta_capi.bat=true)").catch(() => { });
  return { gui: nhan, loi };
}

export async function guiLeadCapi(lead: { id?: string | null; phone?: string | null; email?: string | null; created_at?: string | null }) {
  if (!lead?.id) return null;
  return guiLo([{ ten: "Lead", eventId: `lead-${lead.id}`, thoiDiem: Date.parse(lead.created_at || "") || Date.now(), sdt: lead.phone, email: lead.email }]);
}

export async function guiDonMuaCapi(rows: Array<{ chat_id: any; message_id: any; sdt?: string | null; khach_tra?: number; sent_at?: string }>) {
  if (!rows?.length) return null;
  return guiLo(rows.map((o) => ({
    ten: "Purchase" as const, eventId: `TG-${o.chat_id}-${o.message_id}`,
    thoiDiem: Date.parse(o.sent_at || "") || Date.now(), sdt: o.sdt,
    giaTri: Math.round((Number(o.khach_tra) || 0) / VAT_MUL),
  })));
}
