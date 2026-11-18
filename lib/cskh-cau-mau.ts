import BO_CAU from "@/data/cskh-cau-mau-da-duyet.json";

export type KenhCauMau = "cong-khai" | "inbox" | "ca-hai";

export type CauMau = {
  ma: string;
  tinhHuong: string;
  kenh: KenhCauMau;
  kenhGoc: string;
  dieuKien: string;
  cau: string;
  banDuyet: string;
  congKhaiThay: string;
  khongTraLoi: boolean;
};

export const DS_CAU_MAU: CauMau[] = (BO_CAU as any).cau as CauMau[];
export const NGUON_CAU_MAU = { ban: String((BO_CAU as any).ban || ""), sha256Nguon: String((BO_CAU as any).sha256Nguon || "") };

export const CAM_TRONG_CAU = /36\s*tháng/i;

export const CAM_HANG_CU = /500\s*g\b|01\/ACME Corp/i;

export const timCauMau = (ma: string): CauMau | undefined => DS_CAU_MAU.find((c) => c.ma === ma);

export const boDau = (s: string) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9&]+/g, " ").replace(/\s+/g, " ").trim();

const co = (t: string, cum: string) => new RegExp(`(^|[^a-z0-9])(?:${cum})(?=[^a-z0-9]|$)`).test(t);

export function nhanDienTinhHuong(text: string): string | null {
  const t = boDau(text);
  if (!t) return null;
  if (co(t, "mang thai|co thai|co bau|dang bau|bau bi|cho con bu|sau sinh|me bau|dang mang bau|dang bau")) return "CM06";
  if (co(t, "benh|thuoc|tieu duong|huyet ap|ung thu|tim mach|da day|dai trang|xo gan|gan nhiem mo|suy than|tuyen giap|bac si|benh vien|dang dieu tri|phac do|hoa tri|xa tri")) return "CM07";

  if (co(t, "han dung|han su dung|hsd|het han|36 thang")) {
    if (co(t, "36 thang|nhan ghi|tren nhan|ghi khac|bao bi ghi")) return "CM20a";
    if (co(t, "san pham c")) return "CM20";
    return "CM11";
  }
  if (co(t, "hang that|hang gia|chinh hang|that hay gia|gia mao|fake|hang nhai|that khong|co phai hang that|hang chuan")) return "CM10";
  if (co(t, "lua dao|lua gat|lua khach|scam|hang dom|dom|bip bom|bip|kem chat luong|that vong|tien mat tat mang|khong ra gi|vo tich su|chui|ban lao|quang cao lao")) return "CM13";
  if (co(t, "dai ly|cong tac vien|ctv|hop tac|gia si|lay si|ban si|phan phoi|nha phan phoi|affiliate|tiep thi lien ket|lam dai ly")) return "CM16";
  if (co(t, "nova healing") && co(t, "zalo|ten|sao|tai sao|vi sao")) return "CM19";
  if (co(t, "cham|lau qua|chua nhan duoc|chua thay hang|mai chua|bao gio moi nhan|chua toi|chua giao|lau the|cham qua|van chua nhan|mai khong thay|chua thay giao")) return "CM08";
  if (co(t, "doi tra|tra hang|doi hang|hoan tien|hoan hang|tra lai|doi lai|khong hai long|muon tra|doi duoc khong|tra duoc khong")) {
    if (co(t, "da mo|da dung|mo roi|dung roi|khui|boc roi|da boc|dung do")) return "CM09a";
    if (co(t, "phi doi|phi tra|phi ship doi|ai chiu phi|mat phi|ton phi|phi gui|chiu phi|phi van chuyen")) return "CM09b";
    return "CM09";
  }
  if (co(t, "thanh phan|so sanh|so voi|khac gi|hon gi|tot hon|co gi khac|cua hang khac|ben khac|loai nao tot|hang khac|co nhung gi|gom nhung gi|lam tu gi")) {

    if (co(t, "31 goi|hop 31|22 goi|hop 22|goi nho|dang goi")) return "CM11";
    return "CM17";
  }
  if (co(t, "tac dung|cong dung|co tot khong|tot khong|hieu qua|dung de lam gi|giup gi|co ich|tot cho|co tac dung|uong co tot|uong vao|dung co")) {

    if (co(t, "san pham c")) return "CM11";
    if (co(t, "san pham b")) return "CM05b";
    if (co(t, "tra")) return "CM11";
    return "CM05";
  }
  if (co(t, "cach dung|cach pha|pha the nao|pha nhu the nao|uong the nao|uong nhu the nao|dung the nao|dung nhu the nao|pha voi gi|uong luc nao|ngay may lan|bao nhieu muong|may muong|lieu luong|huong dan su dung|cach su dung|hdsd|pha sao|dung sao|uong sao|uong khi nao|uong truoc|uong sau")) return "CM02";
  if (co(t, "khuyen mai|giam gia|uu dai|voucher|ma giam|co qua tang|co qua khong|qua gi|tang qua|qua kem|qua tang|tang gi|tang kem|freeship|mien phi ship|free ship|ma khuyen mai|co giam")) return "CM12";
  if (co(t, "ship|giao hang|phi giao|van chuyen|j&t|jt|giao toi|co giao|giao tan|phi van chuyen|gui hang|co ship|giao den|giao ve|giao o")) return "CM03";
  if (co(t, "gia|bao nhieu|nhieu tien|bao tien|bao nhiu|gia ca|bn tien|bao nhieu tien|1 hop|mot hop|gia sao|nhieu xien") && !co(t, "gia dinh|gia vi|gia cong|gia han|gia su|nguoi gia|tuoi gia|gia roi|ong gia|ba gia")) return "CM01";
  if (co(t, "bao lau|may ngay|khi nao nhan|bao gio nhan|bao gio toi|khi nao toi|may hom|bao nhieu ngay|bao gio co|bao gio den|may ngay nhan")) return "CM04";
  if (co(t, "mua lai|dat lai|lay lai|lan truoc|mua them|dat them|mua tiep|lay them|khach cu|lan nua|dat tiep|dung het roi|het roi")) return "CM15";
  if (co(t, "tu van|inbox|ib|inb|dung duoc khong|uong duoc khong|co dung duoc|nhan rieng|nhan tin|de lai so|sdt|so dien thoai|lien he|ket ban|zalo|dat hang|mua o dau|mua nhu the nao|dat mua|quan tam|can mua|muon mua|mua the nao|mua ntn|mua hang|mua san pham|mua 1|mua mot|mua 2|dat 1|dat mot|dat 2|dang ky|lay 1|lay mot|minh muon|toi muon|em muon|chi muon|anh muon|order|xin thong tin|gui thong tin|cho thong tin|thong tin chi tiet|thong tin san pham")) return "CM11";
  return null;
}

const theoKenh = (ma: string, kenh: "cong-khai" | "inbox") => (ma === "CM01" ? (kenh === "cong-khai" ? "CM01a" : "CM01b") : ma);

export type KetQuaChon = {
  ma: string | null;
  cau: string | null;
  mau: CauMau | null;
  lyDo: string;
};

export function chonCauMau(text: string, kenh: "cong-khai" | "inbox", epMa?: string): KetQuaChon {
  const ma0 = epMa || nhanDienTinhHuong(text);
  if (!ma0) return { ma: null, cau: null, mau: null, lyDo: "không nhận ra tình huống — để người trả lời" };
  const ma = theoKenh(ma0, kenh);
  const mau = timCauMau(ma);
  if (!mau) return { ma, cau: null, mau: null, lyDo: `không có câu mẫu ${ma} trong bộ đã duyệt` };
  if (CAM_TRONG_CAU.test(mau.cau)) return { ma, cau: null, mau, lyDo: `${ma}: câu nhắc "36 tháng" — cấm theo bản 05/10, người xử` };
  if (CAM_HANG_CU.test(mau.cau)) return { ma, cau: null, mau, lyDo: `${ma}: câu nhắc hũ đạm 500 g đã ngừng bán (16/10/2026) — người xử, chờ câu duyệt cho hộp 22 gói` };
  if (mau.khongTraLoi) return { ma, cau: null, mau, lyDo: `${ma}: ${mau.cau}` };
  const hop = mau.kenh === "ca-hai" || mau.kenh === kenh;
  if (hop) return { ma, cau: mau.cau, mau, lyDo: `câu mẫu ${ma}` };
  if (kenh === "cong-khai" && mau.congKhaiThay) {
    const thay = timCauMau(mau.congKhaiThay);
    if (thay && (thay.kenh === "ca-hai" || thay.kenh === "cong-khai"))
      return { ma, cau: thay.cau, mau: thay, lyDo: `câu mẫu ${thay.ma} (thay cho ${ma} ở bình luận công khai)` };
  }
  return { ma, cau: null, mau, lyDo: `${ma} chỉ có câu ${mau.kenhGoc} — kênh ${kenh === "cong-khai" ? "bình luận công khai" : "inbox"} chưa có câu duyệt, người xử` };
}

export function dienCauMau(cau: string, o: { xung?: "anh" | "chị" | "anh/chị"; sanPham?: { n: string; price: number }[] }): string {
  let t = String(cau || "");
  if (o.xung === "anh") t = t.replace(/(^|[^\p{L}])chị(?![\p{L}])/gu, "$1anh").replace(/(^|[^\p{L}])Chị(?![\p{L}])/gu, "$1Anh");
  if (o.sanPham) t = dienGiaShop(t, o.sanPham);
  return t;
}

const NHAN_SAN_PHAM: { trongCau: RegExp; trongShop: RegExp }[] = [
  { trongCau: /Sản phẩm A|bột đạm/i, trongShop: /Sản phẩm A|dam thuc vat|protein/ },
  { trongCau: /trà thanh hương/i, trongShop: /san pham b/ },
  { trongCau: /trà tuệ minh/i, trongShop: /san pham c/ },
];
export const dinhDangGia = (d: number) => `${Math.round(d).toLocaleString("vi-VN")}đ`;

export function dienGiaShop(cau: string, sanPham: { n: string; price: number }[]): string {
  if (!/\[GIÁ từ shop\]/.test(cau)) return cau;
  const nhan = NHAN_SAN_PHAM.find((x) => x.trongCau.test(cau));
  const sp = nhan ? sanPham.find((p) => nhan.trongShop.test(boDau(p.n)) && p.price > 0) : undefined;
  return sp ? cau.replace(/\[GIÁ từ shop\]/g, dinhDangGia(sp.price)) : cau;
}
