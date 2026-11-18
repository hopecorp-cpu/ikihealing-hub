import { findBanned } from "@/lib/banned-words";
import type { KetQuaCham } from "@/lib/cham-diem-zalo";

export const TRAN = {
  tinMoiKhachMoiNgay: 1,
  tinToiDaMoiChuoi: 3,
  gioSomNhat: 8,
  gioMuonNhat: 21,
  tranTongMoiNgay: 60,
  khongChenNeuKhachNhanTrongGio: 24,
};

export type Khoi = { ma: string; ten: string; mau: string };
export type Buoc = { khoi: string; sauNgay: number };
export type Chuoi = {
  ma: string; ten: string; moTa: string;
  bat: boolean;
  tuGui: boolean;
  buoc: Buoc[];

  dieuKien: { bacToiThieu?: KetQuaCham["bac"][]; coTinHieu?: string[]; khongCoTinHieu?: string[]; daMua?: boolean };
};

export const KHOI_MAC_DINH: Khoi[] = [
  { ma: "nhac-hoi-gia", ten: "Nhắc khách từng hỏi giá",
    mau: "Dạ {ten} ơi, hôm trước mình có hỏi em về sản phẩm bên NOVA. Em gửi lại thông tin để mình tiện xem ạ. Mình cần em tư vấn thêm gì cứ nhắn em nhé." },
  { ma: "nhac-mua-lai", ten: "Hỏi thăm khách dùng hết chưa",
    mau: "Dạ {ten} ơi, sản phẩm lần trước mình dùng tới đâu rồi ạ? Nếu sắp hết em chuẩn bị đơn mới giúp mình nhé." },
  { ma: "hoi-tham-sau-mua", ten: "Hỏi thăm sau khi nhận hàng",
    mau: "Dạ {ten} ơi, hàng mình nhận được rồi đúng không ạ? Mình dùng có gì thắc mắc cứ nhắn em, em hướng dẫn thêm." },
];

export const CHUOI_MAC_DINH: Chuoi[] = [
  { ma: "hoi-gia-chua-chot", ten: "Khách hỏi giá mà chưa chốt", bat: true, tuGui: false,
    moTa: "Khách có hỏi giá nhưng chưa thấy đơn — nhắc lại một lần sau 3 ngày, không nhắc lần hai.",
    buoc: [{ khoi: "nhac-hoi-gia", sauNgay: 3 }],
    dieuKien: { coTinHieu: ["hoi-gia"], daMua: false } },
  { ma: "cham-sau-mua", ten: "Hỏi thăm sau khi mua", bat: true, tuGui: false,
    moTa: "Khách đã mua — hỏi thăm sau 5 ngày, rồi hỏi dùng hết chưa sau 40 ngày.",
    buoc: [{ khoi: "hoi-tham-sau-mua", sauNgay: 5 }, { khoi: "nhac-mua-lai", sauNgay: 40 }],
    dieuKien: { daMua: true } },
];

export type TinSoan = {
  chuoi: string; buoc: number; zalo_uid: string; own_id?: string;
  ten: string; sdt: string | null; noiDung: string;
};
export type KetQuaChay = {
  soan: TinSoan[];
  boQua: { ly: string; so: number }[];
  loi: string[];
};

const NHAN_NOI_BO = /^(tvb|tvv|vip|nd\d*|k\d+|kh|c|a|ch[iị]|anh|em|b[áa]c|cô|chú|m[ẹe]|\d+%|\d+)$/i;

const GHI_CHU = /^([,.\-–]|đạm|dam|cafe|caf[eê]|tr[àa]|b[ộo]t|đamk|page|h[àa]ng|b[ùu]ng|ch[ờo]|mua|đ[ạa]i|l[ýy]|kg|h[ộo]p|combo|si|s[ỉi]|kh[áa]ch|zalo|fb|face|shop|đ[ơo]n|test|m[ớo]i|c[ũu]|vip|hp|hn|tphcm|sg)$/i;

export function tenGoi(tenLienHe: string): string | null {
  let s = String(tenLienHe || "").trim();
  if (!s) return null;

  s = s.replace(/[\s(]*(0|84)[\d\s.]{8,}.*$/, " ").trim();

  let tu = s.split(/\s+/).filter(Boolean);
  while (tu.length && NHAN_NOI_BO.test(tu[0])) tu.shift();

  tu = tu.filter((x) => !/\d/.test(x) && /[\p{L}]/u.test(x));

  while (tu.length > 1 && GHI_CHU.test(tu[tu.length - 1])) tu.pop();
  if (!tu.length) return null;
  const ten = tu.slice(-2).join(" ").trim();

  if (ten.length < 2 || ten.length > 25) return null;
  return ten;
}

const thay = (mau: string, tenLienHe: string) => {
  const ten = tenGoi(tenLienHe);
  if (ten) return mau.replace(/\{ten\}/g, ten);

  return mau.replace(/\s*\{ten\}\s*ơi\s*,?\s*/g, ", ").replace(/^Dạ\s*,\s*,/, "Dạ,").replace(/\s+/g, " ").trim();
};

/**
 * Soạn danh sách tin cho một lượt chạy. HÀM THUẦN — không gửi, không ghi DB; nơi gọi quyết định
 * đẩy vào hàng đợi hay để người duyệt. Tách vậy để test được bằng dữ liệu thật mà không nhắn ai.
 *
 * @param daGuiHomNay số tin tự động đã gửi hôm nay (để chặn trần tổng)
 * @param lichSu      map zalo_uid -> { chuoi, buoc, lucGui } của những gì đã gửi trước đó
 */
export function soanTinChoLuot(
  khachs: KetQuaCham[],
  opt: {
    chuois: Chuoi[]; khois: Khoi[];
    lichSu: Map<string, { chuoi: string; buoc: number; luc: string }[]>;
    daGuiHomNay: number;
    gioHienTai: number;
    lanChamKhachNhan: Map<string, string | null>;
    daTuChoi: Set<string>;
    ownTheoKhach: Map<string, string>;
  }
): KetQuaChay {
  const soan: TinSoan[] = [];
  const dem: Record<string, number> = {};
  const loi: string[] = [];
  const bo = (ly: string) => { dem[ly] = (dem[ly] || 0) + 1; };

  if (opt.gioHienTai < TRAN.gioSomNhat || opt.gioHienTai >= TRAN.gioMuonNhat) {
    return { soan: [], boQua: [{ ly: `ngoài giờ cho phép (${TRAN.gioSomNhat}h-${TRAN.gioMuonNhat}h)`, so: khachs.length }], loi };
  }

  const khoiTheoMa = new Map(opt.khois.map((k) => [k.ma, k]));
  let conCho = Math.max(0, TRAN.tranTongMoiNgay - opt.daGuiHomNay);

  for (const kh of khachs) {
    if (conCho <= 0) { bo("chạm trần tổng tin/ngày"); continue; }
    if (opt.daTuChoi.has(kh.zalo_uid)) { bo("khách đã xin ngừng nhận tin"); continue; }

    const nhanCuoi = opt.lanChamKhachNhan.get(kh.zalo_uid);
    if (nhanCuoi && (Date.now() - new Date(nhanCuoi).getTime()) / 36e5 < TRAN.khongChenNeuKhachNhanTrongGio) {
      bo("khách vừa nhắn — để người trả lời"); continue;
    }

    if (kh.loiCuaMinh) { bo("mình đang nợ trả lời — không chèn tin tự động"); continue; }

    const daGui = opt.lichSu.get(kh.zalo_uid) || [];
    if (daGui.some((x) => (Date.now() - new Date(x.luc).getTime()) / 864e5 < 1)) { bo("đã gửi trong hôm nay"); continue; }

    for (const ch of opt.chuois) {
      if (!ch.bat) continue;
      const dk = ch.dieuKien;
      const maTinHieu = new Set(kh.tinHieu.map((t) => t.ma));
      const daMua = maTinHieu.has("da-mua") || maTinHieu.has("mua-lai");
      if (dk.daMua === true && !daMua) continue;
      if (dk.daMua === false && daMua) continue;
      if (dk.bacToiThieu && !dk.bacToiThieu.includes(kh.bac)) continue;
      if (dk.coTinHieu && !dk.coTinHieu.some((m) => maTinHieu.has(m))) continue;
      if (dk.khongCoTinHieu && dk.khongCoTinHieu.some((m) => maTinHieu.has(m))) continue;

      const daGuiChuoiNay = daGui.filter((x) => x.chuoi === ch.ma);
      if (daGuiChuoiNay.length >= Math.min(ch.buoc.length, TRAN.tinToiDaMoiChuoi)) continue;

      const buocKe = daGuiChuoiNay.length;
      const b = ch.buoc[buocKe];
      if (!b) continue;

      const moc = daGuiChuoiNay.length ? daGuiChuoiNay[daGuiChuoiNay.length - 1].luc : (nhanCuoi || null);
      if (!moc) continue;
      const daQua = (Date.now() - new Date(moc).getTime()) / 864e5;
      if (daQua < b.sauNgay) continue;

      const khoi = khoiTheoMa.get(b.khoi);
      if (!khoi) { loi.push(`chuỗi ${ch.ma} trỏ tới khối không có: ${b.khoi}`); continue; }
      const noiDung = thay(khoi.mau, kh.ten);

      const cam = findBanned(noiDung);
      if (cam.length) { loi.push(`khối ${khoi.ma} dính từ cấm (${cam.join(", ")}) — đã bỏ, sửa mẫu rồi chạy lại`); continue; }

      soan.push({
        chuoi: ch.ma, buoc: buocKe, zalo_uid: kh.zalo_uid, own_id: opt.ownTheoKhach.get(kh.zalo_uid),
        ten: kh.ten, sdt: kh.sdt, noiDung,
      });
      conCho--;
      break;
    }
  }

  return { soan, boQua: Object.entries(dem).map(([ly, so]) => ({ ly, so })).sort((a, b) => b.so - a.so), loi };
}
