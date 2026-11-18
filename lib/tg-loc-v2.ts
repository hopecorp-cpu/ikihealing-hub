import { boDiaChi } from "./tg-che";

export type LoaiGui =
  | "bao-cao"
  | "truc-tiep"
  | "nao"
  | "nut"
  | "anh"
  | "sua"
  | "sale"
  | "tai-lieu"
  | "chuyen-may"
  | "tom-tat";

export type HanhDong =
  | "gui"
  | "ngoai-le"
  | "bao-ngay"
  | "hoi-thoai"
  | "tom-tat"
  | "gom"
  | "bo-trung"
  | "ban-du";

export const KHONG_GUI: ReadonlySet<HanhDong> = new Set(["gom", "bo-trung", "ban-du"]);

export interface CfgV2 {
  bat: boolean; che: boolean; so: boolean;
  gioTomTat: string;
  gioLamViec: [number, number];
  hoiThoai: "giu" | "gom";
  taiLieu: "giu" | "gom";
  cheHoiThoaiCEO: boolean;
  ngoaiLe: { nguon: string[]; nhomKhoa: string };
  baoNgay: string[];
  baoNgayGioLamViec: string[];
  tuKhoaBaoNgay: string[];
  chiNhom: Record<string, string>;
  chanNguon: string[];
  phong: Record<string, [string, string]>;
  dongToiDa: number;
}

export const PHONG_MAC_DINH: Record<string, [string, string]> = {
  "sale-nudge": ["kd", "trong ngày"], "lead-reassign": ["kd", "trong ngày"], "quiz-lead-report": ["kd", "trong ngày"],
  "leads-sync": ["kd", "trong ngày"], "zalo-nhac": ["kd", "trong ngày"], "lead-notify": ["kd", "trong ngày"],
  "telegram-chatquality": ["kd", "2 ngày"], "tg-boc-don": ["kd", "trong ngày"], "telegram-daily": ["kd", "trong ngày"],
  "telegram-neworder": ["kd", "trong ngày"], "quiz-pay": ["kd", "2 giờ"], "repeat-cycle": ["kd", "1 ngày"],
  "telegram/sale": ["kd", "trong ngày"], "day-so-don": ["kd", "trong ngày"], "don-thieu-ma-ctv": ["kd", "trong ngày"],
  "tiktok-shop": ["kd-san", "2 giờ"], "tts": ["kd-san", "2 giờ"], "don-san": ["kd-san", "2 giờ"],
  "don-jt-canh-bao": ["vhsp", "2 giờ"], "kho-van": ["vhsp", "1 ngày"],
  "ca-truc-ai": ["cskh", "2 giờ"], "fb-comments": ["cskh", "2 giờ"],
  "content-report": ["mkt", "1 ngày"], "dang-cheo": ["mkt", "1 ngày"], "web-ngay": ["mkt", "1 ngày"], "seo-web-report": ["mkt", "1 ngày"],
  "funnel-report": ["mkt", "1 ngày"], "mkt-digest": ["mkt", "1 ngày"], "content-factory": ["mkt", "1 ngày"], "ad-scout-digest": ["mkt", "1 ngày"],
  "research-viral": ["mkt", "1 ngày"], "case-study": ["mkt", "1 ngày"], "ads-autopilot": ["mkt", "trong ngày"], "ads-spend": ["mkt", "trong ngày"],
  "brand-audit": ["th", "1 ngày"],
  "telegram-finance": ["tc", "trong ngày"], "telegram-balance": ["tc", "trong ngày"], "telegram-reconcile": ["tc", "trong ngày"],
  "bao-cao-thang": ["tc", "trong ngày"], "profit-playbook": ["tc", "trong ngày"], "misa-watch": ["tc", "trong ngày"],
  "payroll-nudge": ["ns", "1 ngày"], "report-reconcile": ["ns", "1 ngày"], "nhac-duyet-nghi": ["ns", "1 ngày"], "luong-thang": ["ns", "1 ngày"],
  "watchdog": ["kt", "1 ngày"], "telegram-eod": ["kt", "1 ngày"], "hoc-the-gioi": ["kt", "1 ngày"], "covan-eval": ["kt", "1 ngày"],
  "day-plan": ["tlgd", "trong ngày"], "cc-queue": ["tlgd", "trong ngày"], "brain-brief": ["tlgd", "trong ngày"],
};

export const CFG_MAC_DINH: CfgV2 = {
  bat: false, che: false, so: false,
  gioTomTat: "17:00",
  gioLamViec: [8, 21],
  hoiThoai: "giu",
  taiLieu: "giu",
  cheHoiThoaiCEO: false,

  ngoaiLe: { nguon: ["telegram-neworder", "quiz-pay", "tiktok-shop", "tts"], nhomKhoa: "don-moi" },
  baoNgay: ["don-jt-canh-bao", "ca-truc-ai", "fb-comments", "quiz-pay"],
  baoNgayGioLamViec: [],
  tuKhoaBaoNgay: [
    "c[ổo]ng thanh to[áa]n[^\\n]{0,30}l[ỗo]i", "COD[^\\n]{0,15}l[ệe]ch", "l[ệe]ch[^\\n]{0,10}COD", "d[ưu][ớo]i s[àa]n",
    "v[ưu][ợo]t tr[ầa]n", "giao th[ấa]t b[ạa]i", "đ[ơo]n[^\\n]{0,10}k[ẹe]t", "h[ệe] th[ốo]ng đ[ơo]n[^\\n]{0,15}(s[ậa]p|ng[ừu]ng|l[ỗo]i)",
    "l[ãa]i r[òo]ng[^\\n]{0,20}(<|d[ưu][ớo]i)\\s*30\\s*%",
  ],
  chiNhom: { "telegram-eod": "tong-ket-cuoi-ngay", "dang-cheo": "dang-cheo", "web-ngay": "web-ngay" },
  chanNguon: ["brand-audit"],
  phong: PHONG_MAC_DINH,
  dongToiDa: 15,
};

export function docCfgV2(raw: unknown): CfgV2 {
  let j: any = raw;
  if (typeof raw === "string") { try { j = JSON.parse(raw); } catch { j = null; } }
  if (!j || typeof j !== "object") return { ...CFG_MAC_DINH };
  const c: CfgV2 = { ...CFG_MAC_DINH, ...j, phong: { ...PHONG_MAC_DINH, ...(j.phong || {}) } };
  c.bat = j.bat === true; c.che = j.che === true || (j.bat === true && j.che !== false); c.so = j.so === true || j.bat === true;
  return c;
}

const khop = (ds: string[], nguon: string) => ds.some((x) => x && nguon.includes(x));

export function phongCua(nguon: string, cfg: CfgV2): [string, string] {
  const k = Object.keys(cfg.phong).filter((x) => nguon.includes(x)).sort((a, b) => b.length - a.length)[0];
  return k ? cfg.phong[k] : ["kt", "1 ngày"];
}

export interface NguCanh {
  nguon: string;
  loai: LoaiGui;
  dich: string;

  theoKhoa: Record<string, string | undefined>;

  gioVN: number;
}

export interface QuyetDinh { hd: HanhDong; text: string; phong: string; han: string; lyDo: string; daCat?: boolean }

export function laBaoNgay(text: string, ctx: NguCanh, cfg: CfgV2): string | null {
  if (khop(cfg.baoNgay, ctx.nguon)) return "nguồn hạn 2 giờ / mất tiền";
  const [tu, den] = cfg.gioLamViec;
  if (khop(cfg.baoNgayGioLamViec, ctx.nguon) && ctx.gioVN >= tu && ctx.gioVN < den) return "lead mới cần gọi trong giờ làm";
  const tron = String(text || "").replace(/<[^>]*>/g, "");
  for (const k of cfg.tuKhoaBaoNgay) { try { if (new RegExp(k, "iu").test(tron)) return "từ khoá: " + k.slice(0, 24); } catch {  } }
  return null;
}

const TEN_PHONG: Record<string, string> = { kd: "KD", "kd-san": "KD sàn", vhsp: "VHSP", cskh: "CSKH", mkt: "MKT", th: "TH", tc: "TC", ns: "NS", kt: "KT", tlgd: "TLGD" };
export const tenPhong = (p: string) => TEN_PHONG[p] || p.toUpperCase();

export function dinhDangBaoNgay(text: string, phong: string, han: string): [string, boolean] {
  const dong = String(text || "").split("\n").filter((d) => d.replace(/<[^>]*>/g, "").trim());
  let than = dong;
  let cat = false;
  if (dong.length > 4) { than = [...dong.slice(0, 3), "<i>… (rút gọn — bản đủ lưu Acme Ops)</i>"]; cat = true; }

  const mo: string[] = [];
  for (const m of than.join("\n").matchAll(/<(\/?)([a-z-]+)[^>]*>/gi)) {
    const ten = m[2].toLowerCase();
    if (m[1]) { const i = mo.lastIndexOf(ten); if (i >= 0) mo.splice(i, 1); } else mo.push(ten);
  }
  const dong4 = than.join("\n") + mo.reverse().map((t) => `</${t}>`).join("");
  return [`${dong4}\n<i>Phụ trách: ${tenPhong(phong)} · Hạn: ${han}</i>`, cat];
}

export function quyetDinh(text: string, ctx: NguCanh, cfg: CfgV2): QuyetDinh {
  const [phong, han] = phongCua(ctx.nguon, cfg);
  const r = (hd: HanhDong, lyDo: string, t = text, extra: Partial<QuyetDinh> = {}): QuyetDinh => ({ hd, text: t, phong, han, lyDo, ...extra });
  if (!cfg.bat) return r("gui", "luật v2 đang tắt");
  if (!/^-/.test(ctx.dich)) return r("gui", "không phải nhóm");
  if (ctx.loai === "tom-tat") return r("tom-tat", "bản tóm tắt ngày");
  const mayHong = ctx.theoKhoa["may-hong"];
  if (mayHong && ctx.dich === mayHong) return r("ban-du", "nhóm Máy chạy ngầm chỉ nhận 1 tóm tắt/ngày");
  if (ctx.loai === "sua") return r("gui", "sửa tin đã gửi (không phải tin mới)");
  if (ctx.loai === "nao" && /^telegram\/brain/.test(ctx.nguon)) {
    return cfg.hoiThoai === "giu" ? r("hoi-thoai", "trả lời người hỏi trong nhóm") : r("gom", "hội thoại gộp theo cấu hình");
  }
  if (ctx.loai === "tai-lieu" && cfg.taiLieu === "giu") return r("gui", "file (không gộp vào tóm tắt chữ được)");
  if (khop(cfg.chanNguon, ctx.nguon)) return r("ban-du", "nguồn bị CEO chặn khỏi nhóm (tg_nhom_loc.chan)");
  for (const [nguon, khoa] of Object.entries(cfg.chiNhom)) {
    if (ctx.nguon.includes(nguon)) {
      const dung = ctx.theoKhoa[khoa];
      if (dung && ctx.dich !== dung) return r("bo-trung", `nguồn ${nguon} chỉ gửi nhóm ${khoa}`);
    }
  }
  const qldh = ctx.theoKhoa[cfg.ngoaiLe.nhomKhoa];
  if (qldh && ctx.dich === qldh && khop(cfg.ngoaiLe.nguon, ctx.nguon)) return r("ngoai-le", "đơn mới vào QLĐH (ngoại lệ duy nhất)", boDiaChi(text));
  const ly = laBaoNgay(text, ctx, cfg);
  if (ly) {
    const [t, cat] = dinhDangBaoNgay(boDiaChi(text), phong, han.includes("2 giờ") ? han : "2 giờ");
    return r("bao-ngay", ly, t, { daCat: cat, han: han.includes("2 giờ") ? han : "2 giờ" });
  }
  return r("gom", "gộp vào tóm tắt " + cfg.gioTomTat);
}

export interface MucGom { t: string; nguon: string; dich: string; hd: HanhDong; phong: string; han: string; dong1: string; len?: number }

const NHAN_NGUON: Record<string, string> = {
  "sale-nudge": "Nhắc sale chăm lead", "quiz-lead-report": "Lead quiz cần gọi", "leads-sync": "Khách quay lại nhắn",
  "zalo-nhac": "Nhắc chăm khách Zalo", "content-report": "Báo cáo viết blog", "dang-cheo": "Đăng chéo", "web-ngay": "Web ngày",
  "seo-web-report": "SEO tuần", "funnel-report": "Phễu", "telegram-finance": "Bản tin tài chính", "telegram-balance": "Cân đối quỹ",
  "telegram-reconcile": "J&T ↔ MISA", "report-reconcile": "Đối chiếu tự khai", "day-plan": "Chia việc ngày", "telegram-daily": "Bán hàng ngày",
  "telegram-eod": "Tổng kết máy", "tg-boc-don": "Đơn lệch/dưới sàn", "telegram-chatquality": "Chất lượng tư vấn", "ca-truc-ai": "Ca trực AI",
  "watchdog": "Nguồn dữ liệu chết", "don-jt-canh-bao": "Đơn J&T", "payroll-nudge": "Chốt lương", "bao-cao-thang": "Báo cáo tháng",
};
export const nhanNguon = (n: string) => NHAN_NGUON[n] || n;

export function dongDau(text: string, max = 80): string {
  const d = String(text || "").replace(/<[^>]*>/g, "").split("\n").map((x) => x.trim()).find((x) => x.length > 0) || "";
  return d.length > max ? d.slice(0, max - 1) + "…" : d;
}

export function soanTomTat(tenNhom: string, ngay: string, muc: MucGom[], dongToiDa = 15, link = ""): string | null {
  if (!muc.length) return null;
  const theoNguon = new Map<string, MucGom[]>();
  for (const m of muc) { const a = theoNguon.get(m.nguon) || []; a.push(m); theoNguon.set(m.nguon, a); }
  const nhom = [...theoNguon.entries()].sort((a, b) => b[1].length - a[1].length);
  const dd = ngay.slice(8, 10) + "/" + ngay.slice(5, 7);
  const dau = `<b>Tóm tắt ngày ${dd} — ${tenNhom}</b> (${muc.length} tin, ${nhom.length} nguồn)`;
  const cuoi = link ? `Bản đủ (đã che): ${link}` : "Bản đủ (đã che) lưu trong Acme Ops.";
  const choThan = Math.max(1, dongToiDa - 2);
  const than: string[] = [];
  const hien = nhom.length > choThan ? nhom.slice(0, choThan - 1) : nhom;
  for (const [nguon, a] of hien) {
    const moiNhat = a[a.length - 1];
    than.push(`• ${nhanNguon(nguon)} (${a.length}) · ${tenPhong(moiNhat.phong)}, hạn ${moiNhat.han}: ${moiNhat.dong1}`.slice(0, 220));
  }
  if (hien.length < nhom.length) {
    const con = nhom.slice(hien.length);
    than.push(`• +${con.length} nguồn khác (${con.reduce((s, [, a]) => s + a.length, 0)} tin)`);
  }
  return [dau, ...than, cuoi].join("\n");
}

export function soanTomTatMay(ngay: string, muc: MucGom[], dongToiDa = 15): string | null {
  if (!muc.length) return null;
  const dem = new Map<string, number>();
  for (const m of muc) { const k = `${m.nguon} · ${m.hd}`; dem.set(k, (dem.get(k) || 0) + 1); }
  const ds = [...dem.entries()].sort((a, b) => b[1] - a[1]);
  const dd = ngay.slice(8, 10) + "/" + ngay.slice(5, 7);
  const hien = ds.slice(0, Math.max(1, dongToiDa - 2));
  const lines = [`<b>Máy chạy ngầm — ${dd}</b>: lọc ${muc.length} tin từ ${new Set(muc.map((m) => m.nguon)).size} nguồn`,
    ...hien.map(([k, n]) => `• ${k}: ${n}`)];
  if (hien.length < ds.length) lines.push(`• +${ds.length - hien.length} dòng khác`);
  return lines.slice(0, dongToiDa).join("\n");
}

export interface DongViec { ma: string; phong: string; han: string; trang_thai: "mới"; nguon: string; nhom: string; ngay: string; tom_tat: string }

export function taoDongViec(daCo: DongViec[], muc: Array<{ phong: string; han: string; nguon: string; nhom: string; ngay: string; tom_tat: string }>): DongViec[] {
  const so: Record<string, number> = {};
  for (const d of daCo) { const m = d.ma.match(/^TN-(.+)-(\d+)$/); if (m) so[m[1]] = Math.max(so[m[1]] || 0, Number(m[2])); }
  return muc.map((x) => {
    so[x.phong] = (so[x.phong] || 0) + 1;
    return { ma: `TN-${x.phong}-${String(so[x.phong]).padStart(2, "0")}`, phong: x.phong, han: x.han, trang_thai: "mới", nguon: x.nguon, nhom: x.nhom, ngay: x.ngay, tom_tat: x.tom_tat };
  });
}

export function ngayGioVN(d = new Date()): { ngay: string; gio: number } {
  const v = new Date(d.getTime() + 7 * 3600e3);
  return { ngay: v.toISOString().slice(0, 10), gio: v.getUTCHours() + v.getUTCMinutes() / 60 };
}
