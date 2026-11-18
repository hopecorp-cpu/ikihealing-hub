import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { ganUtm } from "@/lib/utm";
import { createHash } from "crypto";
import { doanSangHtml, htmlToText, type Doan } from "./blog-nurture-chu";
import { KHUNG, MAU_DUYET, type DuyetMau } from "./blog-nurture-mau";

const SITE = "https://example.com";

const LOGO = `${SITE}/assets/footer-20260909/nova-rose.png`;

export type LeadEvent = { t: number; e: string; m?: string };

export type Lead = { id: string; email: string; phone?: string; source: string; ts: number; sent: number[]; guiLuc?: Record<string, number>; consent?: boolean; consentLuc?: number; tuChoi?: string; events?: LeadEvent[] };

export function duocGuiQC(l: Lead): boolean {
  if (l.tuChoi || l.consent === false) return false;
  return !!(l.consent && l.consentLuc);
}

export const BLOG_NURTURE_LY_DO_TAT = "blog-nurture tat cho TH duyet (Grok Bot 03/10)";
export async function blogNurtureBat(): Promise<boolean> {
  if (process.env.BLOG_NURTURE_BAT === "1") return true;
  try { return (await getConfigValue("blog_nurture_bat")) === "1"; } catch { return false; }
}

export async function getLeads(): Promise<Lead[]> {
  const raw = await getConfigValue("blog_leads");
  if (!raw) return [];
  try { return JSON.parse(raw) as Lead[]; } catch { return []; }
}
async function saveLeads(list: Lead[]) {
  await setConfigValue("blog_leads", JSON.stringify(list.slice(-20000)), "Lead email từ blog NOVA (lead magnet)");
}
function newId(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toLowerCase();
}

const normPhone = (p?: string) => (p || "").replace(/[^0-9]/g, "").replace(/^84/, "0");

export async function addLead(email: string, source: string, consent = true, phone?: string): Promise<{ lead: Lead; isNew: boolean }> {
  const norm = email.trim().toLowerCase();
  const ph = normPhone(phone);
  const list = await getLeads();
  const existing = list.find((l) => l.email === norm);
  if (existing) {
    let dirty = false;

    if (consent && !existing.consent) { existing.consent = true; existing.consentLuc = Date.now(); dirty = true; }
    if (consent && existing.consent && !existing.consentLuc) { existing.consentLuc = Date.now(); dirty = true; }
    if (!existing.id) { existing.id = newId(); dirty = true; }
    if (ph && !existing.phone) { existing.phone = ph; dirty = true; }
    if (dirty) await saveLeads(list);
    return { lead: existing, isNew: false };
  }
  const lead: Lead = { id: newId(), email: norm, phone: ph || undefined, source: source || "blog", ts: Date.now(), sent: [], consent, ...(consent ? { consentLuc: Date.now() } : {}), events: [] };
  list.push(lead);
  await saveLeads(list);
  return { lead, isNew: true };
}

export async function danhDauTuChoi(email: string, kenh = "email", nguon?: string): Promise<{ ok: boolean; daCo: boolean }> {
  const norm = (email || "").trim().toLowerCase();
  if (!norm) return { ok: false, daCo: false };
  const list = await getLeads();
  const l = list.find((x) => x.email === norm);
  const daCo = !!l?.tuChoi;
  if (l) { l.tuChoi = l.tuChoi || new Date().toISOString(); l.consent = false; await saveLeads(list); }
  try {
    const { getServiceClient } = await import("@/lib/supabase-server");
    const { ghiTuChoi } = await import("@/lib/du-lieu-ca-nhan");
    await ghiTuChoi(getServiceClient(), { email: norm, kenh, lyDo: "khach-yeu-cau", nguon, daXacNhan: true });
  } catch {  }
  return { ok: true, daCo };
}

export type NhipThu = { luong: string; mau: string; neuSanPham?: boolean };
export async function guiEmailNuoi(
  to: string, subject: string, html: string, opts?: { quangCao?: boolean; replyTo?: string; nhip?: NhipThu },
): Promise<{ ok: boolean; skipped?: boolean; id?: string; error?: string; boQua?: string }> {
  const norm = (to || "").trim().toLowerCase();
  const { resendConfigured, sendResend } = await import("@/lib/resend");
  const { linkHuy, ganNhanQC, daTuChoi } = await import("@/lib/du-lieu-ca-nhan");

  const list = await getLeads();
  const l = list.find((x) => x.email === norm);
  if (l?.tuChoi) return { ok: false, skipped: true, boQua: "da-tu-choi" };
  try {
    const { getServiceClient } = await import("@/lib/supabase-server");
    if (await daTuChoi(getServiceClient(), { email: norm })) return { ok: false, skipped: true, boQua: "da-tu-choi" };
  } catch {  }

  if (opts?.nhip) {
    const { lyDoDung } = await import("@/lib/dung-khan-cap");
    const dung = await lyDoDung("nhan_khach");
    if (dung) return { ok: false, skipped: true, boQua: "dung-khan-cap", error: dung };
  }
  if (!resendConfigured()) return { ok: false, skipped: true, error: "RESEND_API_KEY chưa cấu hình" };
  if (opts?.nhip) {
    const { layLichSuGui } = await import("@/lib/email-nhip");
    const { kiemTran } = await import("@/lib/email-nhip-luat");
    const lichSu = await layLichSuGui(norm, { leads: list });
    if (!lichSu) return { ok: false, skipped: true, boQua: "thieu-nhat-ky-gui" };
    const kt = kiemTran(lichSu, Date.now(), !!opts.nhip.neuSanPham);
    if (!kt.ok) return { ok: false, skipped: true, boQua: kt.lyDo };
  }
  const link = linkHuy(norm);
  const body = html.split("{{LINK_HUY}}").join(link);
  const r = await sendResend(norm, opts?.quangCao ? ganNhanQC(subject) : subject, body, { replyTo: opts?.replyTo, listUnsubscribe: link });
  if (r.ok && opts?.nhip) {
    const { ghiNhatKyGui } = await import("@/lib/email-nhip");
    await ghiNhatKyGui({ email: norm, luong: opts.nhip.luong, mau: opts.nhip.mau, neuSanPham: opts.nhip.neuSanPham, resendId: r.id });
  }
  return r;
}

export async function logEventByEmail(email: string, e: string, m?: string): Promise<boolean> {
  const norm = (email || "").trim().toLowerCase();
  const list = await getLeads();
  const l = list.find((x) => x.email === norm);
  return l ? logEvent(l.id, e, m) : false;
}

export async function markSent(email: string, day: number, luc = Date.now()) {
  const list = await getLeads();
  const l = list.find((x) => x.email === email);
  if (!l) return;
  if (!l.sent.includes(day)) l.sent.push(day);
  l.guiLuc = { ...(l.guiLuc || {}), [String(day)]: luc };
  await saveLeads(list);
}

export async function logEvent(id: string, e: string, m?: string): Promise<boolean> {
  if (!id || !e) return false;
  const list = await getLeads();
  const l = list.find((x) => x.id === id);
  if (!l) return false;
  if (!l.events) l.events = [];

  const now = Date.now();
  if (l.events.some((x) => x.e === e && x.m === m && now - x.t < 5 * 60 * 1000)) return true;
  l.events.push({ t: now, e, m: m ? String(m).slice(0, 120) : undefined });
  if (l.events.length > 200) l.events = l.events.slice(-200);
  await saveLeads(list);
  return true;
}
export const leadStats = (l: Lead) => {
  const ev = l.events || [];
  return {
    opened: ev.some((x) => x.e === "open"),
    read: [...new Set(ev.filter((x) => x.e === "read").map((x) => x.m))].filter(Boolean),
    clicks: ev.filter((x) => x.e === "click").length,
    downloaded: ev.some((x) => x.e === "download"),
    lastActive: ev.length ? Math.max(...ev.map((x) => x.t)) : 0,
  };
};

export function wrap(title: string, inner: string): string {
  const dau = KHUNG.dau.map((d) => doanSangHtml(d, "", LOGO, "color:#ffffff;font-weight:700;letter-spacing:.12em;font-size:12px;text-transform:uppercase;margin-top:12px")).join("");
  const cuoi = KHUNG.cuoi.map((d, i) => doanSangHtml(d, "", LOGO, i === 0 ? "font-weight:700;color:#101828;font-size:15px" : i === 1 ? "color:#667085;font-size:13px;margin-top:2px" : "font-size:12px;color:#667085;margin-top:8px")).join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:0 auto;color:#1d2430;line-height:1.6">
  <div style="background:#B5436A;border-radius:16px;padding:26px 24px;color:#fff;text-align:center">${dau}<div style="font-size:22px;font-weight:700;margin-top:4px">${title}</div></div>
  <div style="padding:22px 6px;font-size:15px">${inner}</div>
  <div style="border-top:1px solid #eef0f3;margin-top:14px;padding-top:16px">${cuoi}</div>
</div>`;
}

export const trk = (url: string, lid: string) => { const u = ganUtm(url, { source: "email", medium: "email", campaign: "drip-blog" }); return lid ? u + (u.includes("?") ? "&" : "?") + "lid=" + encodeURIComponent(lid) : u; };
export const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#B5436A;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;margin:6px 0">${label}</a>`;

export const thanSangHtml = (than: Doan[], lid: string) => than.map((d) => doanSangHtml(d, lid, LOGO, "margin:0 0 14px")).join("");

export type { DuyetMau };
export type MauThu = { day: number; subject: string; tieuDeKhung: string; neuSanPham: boolean; html: (lid: string) => string; duyet: DuyetMau | false };
export const xuatChu = (d: Pick<MauThu, "subject" | "html">): string => d.subject + "\n\n" + htmlToText(d.html("LID"));
export const bamMau = (d: Pick<MauThu, "subject" | "html">): string => createHash("sha256").update(xuatChu(d), "utf8").digest("hex");
export const mauDaDuyet = (d: MauThu): boolean => !!d.duyet && d.duyet.banDuyet === bamMau(d);

export const DRIP: MauThu[] = MAU_DUYET.map((m) => ({
  day: m.day, subject: m.subject, tieuDeKhung: m.tieuDeKhung, neuSanPham: m.neuSanPham, duyet: m.duyet,
  html: (lid) => wrap(m.tieuDeKhung, thanSangHtml(m.than, lid)),
}));
