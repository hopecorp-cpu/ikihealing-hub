export const MARKER_CAN_DUYET = "[CẦN CEO DUYỆT]";

const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const TU_NHAY = [

  "lương", "luong", "thưởng", "hoa hồng", "hoa hong", "thu nhập", "thu nhap", "quỹ lương",

  "giá vốn", "gia von", "giá nhập", "gia nhap", "cogs", "biên lợi nhuận", "biên gộp", "bien gop",
  "lợi nhuận", "loi nhuan", "lãi", "lỗ", "lãi lỗ", "p&l", "pnl",

  "cổ phần", "co phan", "cổ phiếu", "cổ đông", "co dong", "cổ tức", "co tuc", "gọi vốn", "goi von",
  "định giá", "dinh gia", "nhà đầu tư", "nha dau tu", "góp vốn", "gop von", "vốn điều lệ",
  "hội đồng quản trị", "hdqt", "hđqt",

  "số dư", "so du", "dòng tiền", "dong tien", "tiền mặt", "tien mat", "khoản vay", "khoan vay",
  "vay", "nợ", "công nợ", "cong no", "tài khoản ngân hàng", "sao kê", "sao ke",
];

const LOAI_TRU = new RegExp(`${B}thưởng thức${E}`, "giu");
const RE_NHAY = new RegExp(`${B}(${TU_NHAY.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})${E}`, "iu");

export function laCauNhayCam(text: string): boolean {
  const t = String(text || "").toLowerCase().replace(LOAI_TRU, " ");
  return RE_NHAY.test(t);
}

export function coMarkerCanDuyet(out: string): boolean {
  return String(out || "").includes(MARKER_CAN_DUYET);
}

export type CauCho = {
  ma: string; chatId: string; tenNhom: string; fromId: string; ten: string; cau: string; at: string;
};

const HAN_MS = 48 * 3600 * 1000;
const TRAN = 30;

export function taoMa(dangCho: CauCho[], rand: () => number = Math.random): string {
  for (let i = 0; i < 50; i++) {
    const ma = Math.floor(rand() * 0x10000).toString(16).padStart(4, "0");
    if (!dangCho.some((c) => c.ma === ma)) return ma;
  }
  return Date.now().toString(16).slice(-6);
}

export function conHan(ds: CauCho[], now: number): CauCho[] {
  return (Array.isArray(ds) ? ds : []).filter((c) => c && now - Date.parse(c.at) < HAN_MS);
}

export function timTrung(ds: CauCho[], chatId: string, fromId: string, cau: string): CauCho | undefined {
  const k = cau.trim().toLowerCase();
  return ds.find((c) => c.chatId === chatId && c.fromId === fromId && c.cau.trim().toLowerCase() === k);
}

export function themCho(ds: CauCho[], c: CauCho): CauCho[] {
  return [...ds, c].slice(-TRAN);
}

export function docLenhDuyet(text: string): { duyet: boolean; ma: string } | null {
  const m = String(text || "").trim().match(/^\/(duyettl|khongtl)[_\s]+([0-9a-f]{4,6})(?:@\w+)?\s*$/i);
  return m ? { duyet: m[1].toLowerCase() === "duyettl", ma: m[2].toLowerCase() } : null;
}
