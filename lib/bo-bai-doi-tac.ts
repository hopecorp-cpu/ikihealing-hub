export const KENH_DOI_TAC = "Đối tác";

export type LoaiBai = "fb" | "zalo" | "video";
export const LOAI_BAI: Record<LoaiBai, { ten: string; type: string }> = {
  fb: { ten: "Bài Facebook cá nhân", type: "FB cá nhân" },
  zalo: { ten: "Tin Zalo chăm khách", type: "Tin Zalo" },
  video: { ten: "Kịch bản video tự quay", type: "Kịch bản video" },
};
export function loaiTuType(type: string | null | undefined): LoaiBai {
  const e = (Object.entries(LOAI_BAI) as [LoaiBai, { type: string }][]).find(([, v]) => v.type === type);
  return e ? e[0] : "fb";
}

export const CHO_LINK = "{LINK}";
export const CHO_TEN = "{TEN}";

export const KET_TPBS = "Thực phẩm bổ sung, không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh.";

const boDau = (s: string) =>
  s.replace(/đ/g, "d").replace(/Đ/g, "D").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const NHAC_DAM = /\b(Sản phẩm A|bot dam|dam thuc vat|protein)\b/;
const NHAC_TRA = /\b(san pham b|san pham c|tra thao moc|tra nova)\b/;

const CONG_DUNG_TRA = [
  "mat gan", "an than", "de ngu", "ngu ngon", "ngu sau", "thanh loc", "giai nhiet", "giai doc", "thai doc",
  "bo gan", "mat co the", "ha huyet ap", "tot cho", "khong caffeine", "khong cafein", "khong chua caffeine",
  "giam cang thang", "giam stress", "tinh tao", "tang suc de khang", "tang mien dich",

  "nang luong", "het met", "buon ngu", "ue oai", "giam met", "xua tan",
];

export function loiTra(text: string): string[] {
  const t = boDau(String(text || ""));
  if (!NHAC_TRA.test(t)) return [];

  const coTu = (w: string) => new RegExp(`(^|[^a-z0-9])${w}($|[^a-z0-9])`).test(t) || t.includes("#" + w.replace(/ /g, ""));
  const thay = CONG_DUNG_TRA.filter(coTu);
  return thay.map((w) => `TRÀ NÓI CÔNG DỤNG (${w})`);
}

export function khauKetTpbs(text: string): string {
  const s = String(text || "").trim();
  if (!NHAC_DAM.test(boDau(s)) || s.includes(KET_TPBS)) return s;
  return `${s}\n\n${KET_TPBS}`;
}

export function loiLink(text: string): string[] {
  return /https?:\/\/|www\.|example\.com/i.test(String(text || "")) ? ["DÁN LINK THẬT (phải dùng {LINK})"] : [];
}

export function caNhanHoa(text: string, v: { link?: string; ten?: string }): string {
  let s = String(text || "");
  s = v.link ? s.split(CHO_LINK).join(v.link) : s.split("\n").filter((d) => !d.includes(CHO_LINK)).join("\n");
  return s.split(CHO_TEN).join(v.ten || "mình").replace(/\n{3,}/g, "\n\n").trim();
}

export type BaiGuiCtv = {
  id: string;
  ngay: string;
  loai: LoaiBai;
  tieuDe: string;
  noiDung: string;
  binhLuanDau?: string;
  anh?: string | null;
  sanPham?: string | null;
  video?: string | null;
};

export function banChu(s: string): string {
  let h = 5381;
  for (const c of String(s || "")) h = ((h * 33) ^ c.codePointAt(0)!) >>> 0;
  return h.toString(36);
}

export const MOC_BINH_LUAN = "\n\n--- Bình luận đầu ---\n";
export function tachBinhLuan(brief: string): { noiDung: string; binhLuanDau?: string } {
  const i = String(brief || "").indexOf(MOC_BINH_LUAN);
  if (i < 0) return { noiDung: String(brief || "").trim() };
  return { noiDung: brief.slice(0, i).trim(), binhLuanDau: brief.slice(i + MOC_BINH_LUAN.length).trim() || undefined };
}
