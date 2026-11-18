import { ganUtm } from "@/lib/utm";

export type LoaiMuc = "youtube" | "fanpage" | "blog" | "them";
export type MucBanTin = {
  id: string;
  loai: LoaiMuc;
  tieuDe: string;
  moTa?: string;
  url: string;
  anh?: string;
  ngay: string;
  nguon: string;
};

const VN = 7 * 3600e3;
const ngayVN = (ms: number) => new Date(ms + VN).toISOString().slice(0, 10);

export function khungTuan(nowMs: number, lui = 1): { tu: number; den: number; tuNgay: string; denNgay: string } {
  const vn = new Date(nowMs + VN);
  const thu = (vn.getUTCDay() + 6) % 7;
  const dauTuanVN = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() - thu - 7 * lui);
  const tu = dauTuanVN - VN;
  const den = tu + 7 * 86400e3 - 1;
  return { tu, den, tuNgay: ngayVN(tu), denNgay: ngayVN(den) };
}

export function khungTuTuNgay(tuNgay: string): { tu: number; den: number; tuNgay: string; denNgay: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuNgay)) return null;
  const tu = Date.parse(`${tuNgay}T00:00:00+07:00`);
  if (!Number.isFinite(tu)) return null;
  const den = tu + 7 * 86400e3 - 1;
  return { tu, den, tuNgay: ngayVN(tu), denNgay: ngayVN(den) };
}

export function lamSachTieuDe(s: string, max = 110): string {
  let t = (s || "").split("\n").map((x) => x.trim()).find(Boolean) || "";
  t = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/#\S+/g, "").replace(/\s+/g, " ").trim();
  t = t.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  if (t.length > max) t = t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  return t;
}

const khoaTrung = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "");

export function locVaGop(muc: MucBanTin[], tuNgay: string, denNgay: string): MucBanTin[] {
  const ids = new Set<string>();
  const tieuDe: Record<string, string[]> = { blog: [], video: [] };
  return muc
    .filter((m) => m.ngay >= tuNgay && m.ngay <= denNgay && m.tieuDe && m.url)
    .sort((a, b) => (a.ngay < b.ngay ? 1 : a.ngay > b.ngay ? -1 : a.loai === "youtube" ? -1 : b.loai === "youtube" ? 1 : 0))
    .filter((m) => {
      const nhom = m.loai === "blog" ? tieuDe.blog : tieuDe.video;
      const k = khoaTrung(m.tieuDe).slice(0, 28);
      if (ids.has(m.id) || nhom.some((x) => x.startsWith(k) || k.startsWith(x))) return false;
      ids.add(m.id); nhom.push(k);
      return true;
    });
}

const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ddmm = (ngay: string) => `${ngay.slice(8, 10)}/${ngay.slice(5, 7)}`;

export const CHU = {
  moDau: "Chào chị,",
  gioiThieu: "Tuần qua NOVA có thêm vài video và bài đọc mới. NOVA gom lại đây để chị xem lúc rảnh, không cần lướt tìm trên từng kênh.",
  muoVideo: "Video trong tuần",
  mucBai: "Bài đọc mới trên blog",
  mucThem: "NOVA chọn thêm cho chị",
  ketThu: "Chị thấy video hay bài nào hữu ích thì cứ chuyển cho người thân cùng xem. Chị muốn NOVA làm video về chủ đề gì, chị trả lời thư này, NOVA đọc hết.",
  kyTen: "NOVA Beauty & Wellness",
  xemVideo: "Xem video",
  docBai: "Đọc bài",
} as const;

export function tieuDeThu(soVideo: number, soBai: number, tuNgay: string, denNgay: string): string {
  const phan: string[] = [];
  if (soVideo) phan.push(`${soVideo} video`);
  if (soBai) phan.push(`${soBai} bài đọc`);
  const noi = phan.length ? phan.join(" và ") + " mới" : "điểm tin";
  return `NOVA tuần này: ${noi} (${ddmm(tuNgay)} - ${ddmm(denNgay)})`;
}

export const linkThu = (url: string, tuNgay: string) => ganUtm(url, { source: "email", medium: "email", campaign: `ban-tin-tuan-${tuNgay}` });

function theMuc(m: MucBanTin, nhan: string, tuNgay: string): string {
  const href = esc(linkThu(m.url, tuNgay));

  const anh = m.anh
    ? `<td width="132" valign="top" style="padding-right:14px"><a href="${href}" style="text-decoration:none"><img src="${esc(m.anh)}" alt="" width="132" style="display:block;width:132px;height:auto;max-height:180px;border-radius:8px;border:0"></a></td>`
    : "";
  const moTa = m.moTa && khoaTrung(m.moTa) !== khoaTrung(m.tieuDe) ? `<div style="color:#475467;font-size:14px;margin-top:4px">${esc(m.moTa)}</div>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse"><tr>${anh}<td valign="top">
  <div style="font-weight:700;font-size:16px;line-height:1.4;color:#101828"><a href="${href}" style="color:#101828;text-decoration:none">${esc(m.tieuDe)}</a></div>${moTa}
  <div style="margin-top:8px"><a href="${href}" style="display:inline-block;background:#B5436A;color:#fff;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:14px">${nhan}</a></div>
  <div style="color:#98a2b3;font-size:12px;margin-top:6px">${esc(m.nguon)} · ${ddmm(m.ngay)}</div>
</td></tr></table>`;
}

const tieuMuc = (s: string) => `<div style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#B5436A;margin:6px 0 12px;border-bottom:1px solid #f2e4ea;padding-bottom:6px">${s}</div>`;

export function thanBanTin(muc: MucBanTin[], tuNgay: string): string {
  const video = muc.filter((m) => m.loai === "youtube" || m.loai === "fanpage");
  const bai = muc.filter((m) => m.loai === "blog");
  const them = muc.filter((m) => m.loai === "them");
  const p = (s: string) => `<p style="margin:0 0 14px">${esc(s)}</p>`;
  let h = p(CHU.moDau) + p(CHU.gioiThieu);
  if (video.length) h += tieuMuc(CHU.muoVideo) + video.map((m) => theMuc(m, CHU.xemVideo, tuNgay)).join("");
  if (bai.length) h += tieuMuc(CHU.mucBai) + bai.map((m) => theMuc(m, CHU.docBai, tuNgay)).join("");
  if (them.length) h += tieuMuc(CHU.mucThem) + them.map((m) => theMuc(m, CHU.xemVideo, tuNgay)).join("");
  h += p(CHU.ketThu) + `<p style="margin:0 0 6px;font-weight:700">${esc(CHU.kyTen)}</p>`;
  return h;
}

export function tachLinkThem(chu: string, ngay: string): MucBanTin[] {
  return (chu || "").split("\n").map((d) => d.trim()).filter(Boolean).flatMap((d, i) => {
    const m = d.match(/^(.*?)\s*\|\s*(https?:\/\/\S+)$/) || d.match(/^()(https?:\/\/\S+)$/);
    if (!m) return [];
    const url = m[2];
    const tieuDe = lamSachTieuDe(m[1] || "") || "Video NOVA chọn cho chị";
    return [{ id: `them:${i}:${url}`, loai: "them" as const, tieuDe, url, ngay, nguon: url.includes("facebook.com") ? "Facebook" : url.includes("youtu") ? "YouTube" : "NOVA" }];
  });
}
