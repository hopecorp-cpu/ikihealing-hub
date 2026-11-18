import { cheDuLieu } from "./tg-che";
import { docCfgV2, quyetDinh, KHONG_GUI, ngayGioVN, dongDau, type CfgV2, type LoaiGui, type HanhDong } from "./tg-loc-v2";

export function telegramConfigured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN || "").trim() && !!(process.env.TELEGRAM_CHAT_ID || "").trim();
}

function ceoChatId() { return (process.env.TELEGRAM_CHAT_ID || "").trim(); }
export function nguonGoi(): string {
  const st = new Error().stack || "";
  const m = st.match(/api\/(cron\/[a-z0-9-]+|[a-z0-9-]+(?:\/[a-z0-9-]+)?)\/route/);
  if (m) return m[1].replace(/^cron\//, "");
  const l = st.match(/lib\/([a-z0-9/-]+?)\.[jt]s/);
  return l ? l[1] : "?";
}
let _locCEO: { at: number; chan: string[] } | null = null;
async function docLocCEO(): Promise<string[]> {
  if (_locCEO && Date.now() - _locCEO.at < 60_000) return _locCEO.chan;
  try {
    const { getServiceClient } = await import("./supabase-server");
    const v = (await getServiceClient().from("config").select("value").eq("key", "tg_ceo_loc").maybeSingle()).data?.value;
    const chan: string[] = (v ? JSON.parse(v) : {})?.chan || [];
    _locCEO = { at: Date.now(), chan };
    return chan;
  } catch { return _locCEO?.chan || []; }
}
async function ghiLogCEO(nguon: string, chan: boolean, len: number) {
  try {
    const { getServiceClient } = await import("./supabase-server");
    const sb = getServiceClient();
    const v = (await sb.from("config").select("value").eq("key", "tg_ceo_log").maybeSingle()).data?.value;
    const ds: any[] = (v ? JSON.parse(v) : []) || [];
    ds.push({ t: new Date().toISOString(), nguon, chan, len });
    await sb.from("config").upsert({ key: "tg_ceo_log", value: JSON.stringify(ds.slice(-400)), description: "Sổ tin gửi vào chat riêng CEO (nguồn, bị lọc hay không) — để đo rồi chỉnh tg_ceo_loc" }, { onConflict: "key" });
  } catch {}
}

const CHE_KHOA = "<đã che>";
export function cheKhoa(s: string): string {
  return String(s ?? "")
    .replace(/\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g, "<khoá bot đã che>")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}/g, "<JWT đã che>")
    .replace(/\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|EAA[A-Za-z0-9]{40,}|ya29\.[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}|glpat-[A-Za-z0-9_-]{16,}|whsec_[A-Za-z0-9]{16,}|rk_live_[A-Za-z0-9]{16,}|pk_live_[A-Za-z0-9]{16,})/g, "<khoá đã che>")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, "<khoá riêng đã che>")
    .replace(/\b([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|PASSWD|PASS|PWD|_PW|OTP|COOKIE|SESSION)[A-Z0-9_]*)(\s*[=:]\s*)("[^"\n]*"|'[^'\n]*'|(?!<)[^\s,;]+)/g, `$1$2${CHE_KHOA}`)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]{8,}/g, `$1 ${CHE_KHOA}`)
    .replace(/((?:mật[ \t]*khẩu|mat[ \t]*khau|password|passwd|passcode|pwd|otp|mã[ \t]*otp|token|secret|api[_ \t-]?key|apikey|access[_ \t-]?key|private[_ \t-]?key|cookie|khoá|khóa)["']?[ \t]*(?:[:=]|là)[ \t]*["']?)([^\s"',;<>]+)/giu, `$1${CHE_KHOA}`)
    .replace(/([?&#](?:key|token|secret|access_token|refresh_token|api_key|apikey|sig|signature|password|pw|code|auth|session)=)[^&\s#"'<>]+/gi, `$1${CHE_KHOA}`)
    .replace(/[A-Za-z0-9_\-+\/]{32,}={0,2}/g, (m) => (/[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m) && !/^https?/.test(m) ? "<chuỗi khoá đã che>" : m));
}
export async function ghiLogMayNgam(nguon: string, nhan: string, text: string): Promise<void> {
  try {
    let t = cheKhoa(String(text ?? ""));
    t = cheDuLieu(t, { nguon });
    await themVaoConfig("tg_may_ngam_log", { t: new Date().toISOString(), nguon, nhan, text: t.slice(0, 1500) }, 300,
      "Sổ NỘI DUNG (đã che) tin vào nhóm Máy chạy ngầm — để quét việc/chép báo cáo (KT-TELE-LUU-1010)");
  } catch {  }
}
async function chuyenSangMay(nguon: string, text: string, nhan = "lọc khỏi chat CEO") {
  const dich = await dichCuaMay("may-hong");
  const token = (process.env.TELEGRAM_BRAIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!dich || !token) return;
  try {
    await goiApi(token, "sendMessage",
      { chat_id: dich, text: `[${nhan} · ${tgEscape(nguon)}]\n${text}`.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true },
      "chuyen-may", nguon);
  } catch {}
  await ghiLogMayNgam(nguon, nhan, text);
}

export async function locCEO(text: string, nguon = nguonGoi()): Promise<{ chan: boolean; nguon: string }> {
  const ds = await docLocCEO();
  const chan = ds.some((d) => d && nguon.includes(d));
  void ghiLogCEO(nguon, chan, (text || "").length);
  if (chan) await chuyenSangMay(nguon, text);
  return { chan, nguon };
}

let _locNhom: { at: number; chan: string[]; tranNgay: number; tranNhom: number; tranKyTu: number; mienTran: string[]; mienRutGon: string[] } | null = null;
async function docLocNhom() {
  if (_locNhom && Date.now() - _locNhom.at < 60_000) return _locNhom;
  try {
    const { getServiceClient } = await import("./supabase-server");
    const v = (await getServiceClient().from("config").select("value").eq("key", "tg_nhom_loc").maybeSingle()).data?.value;
    const j = (v ? JSON.parse(v) : {}) || {};
    _locNhom = { at: Date.now(), chan: j.chan || [], tranNgay: Number(j.tranNgay) || 8, tranNhom: Number(j.tranNhom) || 6,
      tranKyTu: Number(j.tranKyTu) || 1200, mienTran: j.mienTran || [], mienRutGon: j.mienRutGon || [] };
    return _locNhom;
  } catch { return _locNhom || { at: 0, chan: [], tranNgay: 8, tranNhom: 6, tranKyTu: 1200, mienTran: [], mienRutGon: [] }; }
}
const ngayVN = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

export function rutGonTin(text: string, tran: number): string | null {
  if (!text || text.length <= tran) return null;
  let cat = text.slice(0, tran);
  const xuong = cat.lastIndexOf("\n");
  if (xuong > tran * 0.5) cat = cat.slice(0, xuong);
  cat = cat.replace(/<[^>]*$/, "").replace(/&[a-z#0-9]*$/i, "");
  if (cat.trim().length < tran * 0.3) return null;
  const mo: string[] = [];
  for (const m of cat.matchAll(/<(\/?)([a-z-]+)[^>]*>/gi)) {
    const ten = m[2].toLowerCase();
    if (m[1]) { const i = mo.lastIndexOf(ten); if (i >= 0) mo.splice(i, 1); } else mo.push(ten);
  }
  return cat.trimEnd() + mo.reverse().map((t) => `</${t}>`).join("") + "\n<i>… (đã rút gọn — bản đủ ở nhóm Máy chạy ngầm)</i>";
}

export async function locNhom(text: string, dich: string, nguon = nguonGoi()): Promise<{ chan: boolean; nguon: string; text: string }> {
  try {
    if (!/^-/.test(dich)) return { chan: false, nguon, text };
    if ((await docLocV2()).bat) return { chan: false, nguon, text };
    const mayHong = await dichCuaMay("may-hong");
    if (dich === mayHong) return { chan: false, nguon, text };
    const cfg = await docLocNhom();
    const { getServiceClient } = await import("./supabase-server");
    const sb = getServiceClient();
    const v = (await sb.from("config").select("value").eq("key", "tg_nhom_log").maybeSingle()).data?.value;
    const ds: any[] = (v ? JSON.parse(v) : []) || [];
    const homNay = ngayVN(new Date().toISOString());
    const coMat = (d: string[]) => d.some((x) => x && nguon.includes(x));
    const homNayNhom = ds.filter((r) => r.dich === dich && !r.chan && ngayVN(String(r.t)) === homNay);
    const daGui = homNayNhom.filter((r) => r.nguon === nguon).length;
    const tongNhom = homNayNhom.filter((r) => !cfg.mienTran.some((x) => x && String(r.nguon).includes(x))).length;
    const theoNguon = coMat(cfg.chan);
    const mien = coMat(cfg.mienTran);
    const quaNguon = !mien && daGui >= cfg.tranNgay;
    const quaNhom = !mien && tongNhom >= cfg.tranNhom;
    const chan = theoNguon || quaNguon || quaNhom;
    const gon = chan || coMat(cfg.mienRutGon) ? null : rutGonTin(text, cfg.tranKyTu);
    ds.push({ t: new Date().toISOString(), nguon, dich, chan, len: (text || "").length, ...(gon ? { gon: gon.length } : {}) });
    await sb.from("config").upsert({ key: "tg_nhom_log", value: JSON.stringify(ds.slice(-400)), description: "Sổ tin gửi vào NHÓM Telegram (nguồn, nhóm đích, bị lọc hay không) — để đo rồi chỉnh tg_nhom_loc" }, { onConflict: "key" });
    if (chan) await chuyenSangMay(nguon, text, theoNguon ? "lọc khỏi nhóm" : quaNguon ? "quá trần tin/ngày của nguồn" : "quá trần tổng tin/ngày của nhóm");
    else if (gon) await chuyenSangMay(nguon, text, "bản đủ của tin đã rút gọn trong nhóm");
    return { chan, nguon, text: gon || text };
  } catch { return { chan: false, nguon, text }; }
}

let _v2: { at: number; cfg: CfgV2 } | null = null;
export async function docLocV2(): Promise<CfgV2> {
  if (_v2 && Date.now() - _v2.at < 60_000) return _v2.cfg;
  try {
    const { getServiceClient } = await import("./supabase-server");
    const v = (await getServiceClient().from("config").select("value").eq("key", "tg_loc_v2").maybeSingle()).data?.value;
    const cfg = docCfgV2(v ?? null);
    _v2 = { at: Date.now(), cfg };
    return cfg;
  } catch { return _v2?.cfg || docCfgV2(null); }
}
let _bang: { at: number; v: Record<string, string | undefined> } | null = null;
async function bangDinhTuyen(): Promise<Record<string, string | undefined>> {
  if (_bang && Date.now() - _bang.at < 60_000) return _bang.v;
  try {
    const { getServiceClient } = await import("./supabase-server");
    const raw = (await getServiceClient().from("config").select("value").eq("key", "tg_dinh_tuyen").maybeSingle()).data?.value;
    const b = raw ? JSON.parse(raw) : {};
    const v: Record<string, string | undefined> = {};
    for (const [k, x] of Object.entries(b || {})) { const id = (x as any)?.chat || x; if (typeof id === "string" && id) v[k] = id; }
    _bang = { at: Date.now(), v };
    return v;
  } catch { return _bang?.v || {}; }
}

export async function themVaoConfig(key: string, muc: any, giu: number, description: string) {
  try {
    const { getServiceClient } = await import("./supabase-server");
    const sb = getServiceClient();
    const v = (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value;
    const ds: any[] = (v ? JSON.parse(v) : []) || [];
    ds.push(muc);
    await sb.from("config").upsert({ key, value: JSON.stringify(ds.slice(-giu)), description }, { onConflict: "key" });
  } catch {  }
}
async function tenKhachDeChe(): Promise<string[]> {
  try { const { danhSachTenKhach } = await import("./covan/pii-ten"); return await danhSachTenKhach(); } catch { return []; }
}

export async function cuaGui(chatId: string, text: string, loai: LoaiGui, nguon = nguonGoi()): Promise<{ boQua: boolean; text: string; hd: HanhDong; nguon: string }> {
  const cfg = await docLocV2();
  if (!cfg.bat && !cfg.che && !cfg.so) return { boQua: false, text, hd: "gui", nguon };
  const dich = String(chatId || "").trim();
  const laNhom = /^-/.test(dich);
  const laCEO = !!dich && dich === ceoChatId();
  let t = String(text ?? "");
  try {
    const hoiThoaiCEO = laCEO && loai === "nao" && /^telegram\/brain/.test(nguon) && !cfg.cheHoiThoaiCEO;
    if (cfg.che && (laNhom || (laCEO && !hoiThoaiCEO))) t = cheDuLieu(t, { nguon, tenKhach: await tenKhachDeChe() });
  } catch {  if (cfg.che) t = cheDuLieu(String(text ?? ""), { nguon }); }
  if (!laNhom) return { boQua: false, text: t, hd: "gui", nguon };
  const { ngay, gio } = ngayGioVN();
  const theoKhoa = await bangDinhTuyen();
  const q = quyetDinh(t, { nguon, loai, dich, theoKhoa, gioVN: gio }, cfg);
  const nay = new Date().toISOString();
  const boQua = KHONG_GUI.has(q.hd);
  if (cfg.bat) {
    if (boQua || q.daCat) {

      await themVaoConfig(`tg_ban_du_${ngay}`, { t: nay, nguon, dich, loai, hd: q.hd, text: t.slice(0, 3500) }, 2000,
        "Bản đủ (đã che) tin nhóm bị gộp/lọc theo luật v2 — nội bộ, ≤90 ngày (KT-TNLOC)");
    }
    if (boQua) {
      await themVaoConfig(`tg_gom_${ngay}`, { t: nay, nguon, dich, hd: q.hd, phong: q.phong, han: q.han, dong1: dongDau(t), len: t.length }, 2000,
        "Hàng tin chờ tóm tắt 17:00 theo luật lọc v2 (KT-TNLOC)");
    }
    if (q.hd === "bao-ngay") {
      await themVaoConfig("tn_viec_cho", { t: nay, ngay, nguon, dich, phong: q.phong, han: q.han, tom_tat: dongDau(t) }, 500,
        "Việc từ tin báo ngay chờ cron tom-tat-nhom đánh mã TN-<phòng>-NN (KT-TNLOC)");
    }
  }

  if (cfg.so && (cfg.bat || loai !== "bao-cao")) {
    await themVaoConfig("tg_nhom_log", { t: nay, nguon, dich, chan: boQua, len: t.length, loai, hd: q.hd }, 1500,
      "Sổ tin gửi vào NHÓM Telegram (nguồn, nhóm đích, bị lọc hay không) — để đo rồi chỉnh tg_nhom_loc");
  }
  return { boQua, text: q.text, hd: q.hd, nguon };
}

async function goiApi(token: string, method: string, body: Record<string, any>, loai: LoaiGui, nguon = nguonGoi()): Promise<Response> {
  const truong = typeof body.caption === "string" ? "caption" : "text";
  if (typeof body[truong] === "string" && body.chat_id != null) {
    const g = await cuaGui(String(body.chat_id), body[truong], loai, nguon);
    if (g.boQua) return new Response(JSON.stringify({ ok: true, result: {}, gom: g.hd }), { status: 200, headers: { "Content-Type": "application/json" } });
    body = { ...body, [truong]: truong === "caption" ? g.text.slice(0, 1024) : g.text.slice(0, 4096) };
  }
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
}

export async function sendTelegram(text: string, chatIdOverride?: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (chatIdOverride || process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) return { ok: false, error: "missing_env" as const };
  if (chatId === ceoChatId()) { const g = await locCEO(text); if (g.chan) return { ok: true, chan: true as const, nguon: g.nguon }; }
  else { const g = await locNhom(text, chatId); if (g.chan) return { ok: true, chan: true as const, nguon: g.nguon }; text = g.text; }
  try {
    const res = await goiApi(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }, "bao-cao");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, status: res.status, resp: j };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function dichCuaMay(may: string): Promise<string | undefined> {
  try {
    const { getServiceClient } = await import("./supabase-server");
    const v = (await getServiceClient().from("config").select("value").eq("key", "tg_dinh_tuyen").maybeSingle()).data?.value;
    const bang = v ? JSON.parse(v) : null;
    const id = bang?.[may]?.chat || bang?.[may];
    return typeof id === "string" && id ? id : undefined;
  } catch { return undefined; }
}

export async function sendTelegramMay(may: string, text: string) {
  const nguon = nguonGoi();
  const dich = await dichCuaMay(may);
  if (!dich) return sendTelegram(text);
  const g = await locNhom(text, dich);
  if (g.chan) return { ok: true, chan: true as const, nguon: g.nguon };
  text = g.text;
  const token = (process.env.TELEGRAM_BRAIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) return { ok: false, error: "missing_env" as const };
  try {
    const res = await goiApi(token, "sendMessage", { chat_id: dich, text, parse_mode: "HTML", disable_web_page_preview: true }, "bao-cao");
    const j: any = await res.json().catch(() => ({}));
    if (dich === (await dichCuaMay("may-hong"))) await ghiLogMayNgam(nguon, "gửi thẳng nhóm máy", text);
    return { ok: res.ok && j.ok !== false, status: res.status, resp: j };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

const KHOA_TAI_LIEU = "tg_tai_lieu_cho_phep";

async function docTaiLieuChoPhep(): Promise<string[] | null> {
  try {
    const { getConfigValue } = await import("./app-config");
    const raw = await getConfigValue(KHOA_TAI_LIEU);
    if (raw == null || !String(raw).trim()) return null;
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return null;
    const ids = j.map((x) => String(x ?? "").trim()).filter(Boolean);
    return ids.length ? ids : null;
  } catch { return null; }
}
export async function sendTelegramDocumentMay(
  may: string,
  file: { ten: string; noiDung: Buffer | Uint8Array | string; kieu?: string },
  opts?: { caption?: string; chatIdOverride?: string },
) {
  const dich = (opts?.chatIdOverride || (await dichCuaMay(may)) || process.env.TELEGRAM_CHAT_ID || "").trim();
  const token = (process.env.TELEGRAM_BRAIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token || !dich) return { ok: false as const, error: "missing_env" as const, dich };
  try {
    const choPhep = await docTaiLieuChoPhep();
    if (!choPhep) console.warn("tg_tai_lieu_cho_phep trống — gửi file vào đích gốc");
    else if ((await docLocV2()).bat && !choPhep.includes(dich)) {
      console.warn(`tg_tai_lieu: nguồn ${may} · 1`);
      return { ok: false as const, error: "khong_trong_tg_tai_lieu_cho_phep" as const, dich };
    }
    const g = await cuaGui(dich, opts?.caption || "", "tai-lieu");
    if (g.boQua) return { ok: true, status: 200, dich, loi: undefined as string | undefined };
    const fd = new FormData();
    fd.append("chat_id", dich);
    if (opts?.caption) fd.append("caption", g.text.slice(0, 1000));
    const bytes = typeof file.noiDung === "string" ? new TextEncoder().encode(file.noiDung) : new Uint8Array(file.noiDung);
    fd.append("document", new Blob([bytes], { type: file.kieu || "application/octet-stream" }), file.ten);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: fd, cache: "no-store" });
    const j: any = await res.json().catch(() => ({}));

    return { ok: res.ok && j.ok !== false, status: res.status, dich, loi: j?.description as string | undefined };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e), dich };
  }
}

export async function sendTelegramTrucTiep(chatId: string, text: string, opts?: { token?: string; disablePreview?: boolean }) {
  const token = (opts?.token || process.env.TELEGRAM_BRAIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const dich = (chatId || "").trim();
  if (!token || !dich) return { ok: false as const, error: "missing_env" as const };
  try {
    const res = await goiApi(token, "sendMessage", { chat_id: dich, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: opts?.disablePreview ?? true }, "truc-tiep");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, status: res.status, loi: j?.description as string | undefined, messageId: j?.result?.message_id as number | undefined };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e) };
  }
}

export function tgEscape(s: string) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function tgFromMarkdown(s: string) {
  let t = tgEscape(s);
  t = t.replace(/\*\*([^\n*]+?)\*\*/g, "<b>$1</b>");
  t = t.replace(/__([^\n_]+?)__/g, "<b>$1</b>");
  t = t.replace(/^[ \t]*#{1,6}[ \t]*/gm, "");
  t = t.replace(/^[ \t]*[*\-][ \t]+/gm, "• ");
  t = t.replace(/\*/g, "");
  return t;
}

export async function sendTelegramWithButtons(
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
  chatIdOverride?: string,
) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (chatIdOverride || process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) return { ok: false, error: "missing_env" as const };
  if (chatId === ceoChatId()) { const g = await locCEO(text); if (g.chan) return { ok: true, chan: true as const, nguon: g.nguon }; }
  try {
    const res = await goiApi(token, "sendMessage", {
      chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons },
    }, "nut");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, status: res.status, resp: j };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function sendTelegramPhoto(
  photoUrl: string,
  caption: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
  chatIdOverride?: string,
) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (chatIdOverride || process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) return { ok: false, error: "missing_env" as const };
  if (chatId === ceoChatId()) { const g = await locCEO(caption); if (g.chan) return { ok: true, chan: true as const, nguon: g.nguon }; }
  try {
    const res = await goiApi(token, "sendPhoto", {
      chat_id: chatId, photo: photoUrl, caption: caption.slice(0, 1024), parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    }, "anh");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, status: res.status, resp: j };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function editTelegramMessage(chatId: string | number, messageId: number, text: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) return { ok: false, error: "missing_env" as const };
  try {
    const res = await goiApi(token, "editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true }, "sua");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, resp: j };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function editTelegramCaption(chatId: string | number, messageId: number, caption: string, buttons?: Array<Array<{ text: string; callback_data: string }>>) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) return { ok: false, error: "missing_env" as const };
  try {
    const res = await goiApi(token, "editMessageCaption", {
      chat_id: chatId, message_id: messageId, caption: caption.slice(0, 1024), parse_mode: "HTML",
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    }, "sua");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, resp: j };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function answerCallback(callbackId: string, text: string, alert = false) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) return { ok: false };
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, text: text.slice(0, 190), show_alert: alert }),
      cache: "no-store",
    });
    return { ok: true };
  } catch { return { ok: false }; }
}

export function saleBotToken() { return (process.env.TELEGRAM_SALE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim(); }
export function saleBotUsername() { return (process.env.TELEGRAM_SALE_BOT_USERNAME || "").trim().replace(/^@/, ""); }
export function saleBotConfigured() { return !!saleBotToken() && !!saleBotUsername(); }

export async function sendSaleTelegram(chatId: string, text: string) {
  const token = saleBotToken();
  if (!token || !chatId) return { ok: false, error: "missing_env" as const };
  try {
    const res = await goiApi(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }, "sale");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, status: res.status, resp: j };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export function brainBotToken() { return (process.env.TELEGRAM_BRAIN_BOT_TOKEN || "").trim(); }
export function brainBotConfigured() { return !!brainBotToken(); }

export async function sendBrainTelegram(chatId: string, text: string) {
  const token = brainBotToken();
  if (!token || !chatId) return { ok: false, error: "missing_env" as const };
  if (chatId === ceoChatId()) { const g = await locCEO(text); if (g.chan) return { ok: true, chan: true as const, nguon: g.nguon }; }
  try {
    const res = await goiApi(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }, "nao");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, status: res.status, resp: j };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function brainSendTyping(chatId: string) {
  const token = brainBotToken(); if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }), cache: "no-store",
    });
  } catch {}
}

export async function brainSetWebhook(url: string, secret: string) {
  const token = brainBotToken(); if (!token) return { ok: false, error: "missing_env" as const };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true }), cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    return { ok: !!j.ok, resp: j };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function saleBotGetUpdates(offset: number) {
  const token = saleBotToken(); if (!token) return { ok: false, result: [] as any[] };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=0&offset=${offset}`, { cache: "no-store" });
    const j: any = await res.json().catch(() => ({}));
    return { ok: !!j.ok, result: (j.result || []) as any[] };
  } catch { return { ok: false, result: [] as any[] }; }
}

export async function guiTomTatNhom(chatId: string, text: string) {
  const token = (process.env.TELEGRAM_BRAIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token || !chatId) return { ok: false as const, error: "missing_env" as const };
  try {
    const res = await goiApi(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }, "tom-tat", "tom-tat-nhom");
    const j: any = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, status: res.status, loi: j?.description as string | undefined };
  } catch (e: any) { return { ok: false as const, error: String(e?.message || e) }; }
}
