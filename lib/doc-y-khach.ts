import { khongDau } from "@/lib/covan/loc-y-dinh";
import { laTinTuChoi } from "@/lib/du-lieu-ca-nhan";

export type YKhach = {
  chenLenh: boolean;
  ngungNhan: boolean;
  khieuNaiNang: boolean;
  muonGapNguoi: boolean;
  macCa: boolean;

  lyDoChuyen: string[];
};

const cum = (ds: string[]) => ds.map((s) => ` ${s} `);
const co = (kd: string, ds: string[]) => ds.some((c) => kd.includes(c));

const GHI_DE = cum([
  "bo qua quy tac", "bo qua huong dan", "bo qua cac huong dan", "bo qua het quy tac", "bo qua moi quy tac",
  "quen het quy tac", "quen cac quy tac", "quen het huong dan", "quen moi quy tac", "quen het cac quy tac",
  "system prompt", "prompt cua ban", "prompt cua em", "lenh he thong", "chi dan he thong",
  "ignore previous", "ignore all", "ignore your instructions", "forget your instructions", "you are now", "developer mode", "jailbreak",
  "ban bay gio la", "em bay gio la", "tu gio em la", "dong vai",
]);

const MOI_DU_LIEU = cum([
  "danh sach khach", "danh sach so dien thoai", "danh sach sdt", "so dien thoai cua khach", "sdt cua khach",
  "so dien thoai khach hang khac", "so dien thoai cua nguoi khac", "so cua khach khac", "thong tin khach hang khac",
  "thong tin cua khach khac", "dia chi cua khach", "data khach hang", "du lieu khach hang",
]);

const KHIEU_NAI_NANG = cum([
  "hoan tien", "tra lai tien", "doi lai tien", "lua dao", "bi lua", "boc phot", "phot", "to cao", "khieu nai",
  "kien ra toa", "khoi kien", "kien cong ty", "dang len group", "dang len mang", "dang len facebook", "lam lon chuyen",
]);
const GAP_NGUOI = cum([
  "gap nguoi", "noi chuyen voi nguoi", "nguoi that", "tu van vien", "nhan vien tu van", "goi cho chi", "goi cho anh",
  "goi cho minh", "goi lai cho", "goi dien cho", "so hotline", "khong muon noi chuyen voi bot",
  "khong noi chuyen voi may", "ban la bot a", "em la bot a", "gap quan ly",
]);

const MAC_CA = cum([
  "giam them", "giam gia", "bot cho chi", "bot cho anh", "bot cho minh", "bot cho em", "bot them", "bot chut",
  "re hon", "gia tot hon", "chiet khau", "uu dai rieng", "mac ca", "giam phan tram", "khuyen mai them",
]);

export function docYKhach(text: string): YKhach {
  const kd = ` ${khongDau(String(text || "")).replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim()} `;
  const chenLenh = co(kd, GHI_DE) || co(kd, MOI_DU_LIEU);
  const ngungNhan = laTinTuChoi(text);
  const khieuNaiNang = co(kd, KHIEU_NAI_NANG);
  const muonGapNguoi = co(kd, GAP_NGUOI);
  const macCa = co(kd, MAC_CA);
  const lyDoChuyen: string[] = [];
  if (chenLenh) lyDoChuyen.push("Tin có dấu hiệu cố chèn lệnh hoặc moi dữ liệu khách khác — bot không trả lời");
  if (ngungNhan) lyDoChuyen.push("Khách xin ngừng nhận tin — đã ghi danh sách từ chối, đừng nhắn quảng cáo");
  if (khieuNaiNang) lyDoChuyen.push("Khiếu nại nặng (hoàn tiền / dọa đăng công khai / pháp lý) — người thật xử lý ngay");
  if (muonGapNguoi) lyDoChuyen.push("Khách muốn nói chuyện với người thật");
  if (macCa) lyDoChuyen.push("Khách mặc cả giá — ACME không giảm %, chỉ tặng quà theo chương trình đã duyệt");
  return { chenLenh, ngungNhan, khieuNaiNang, muonGapNguoi, macCa, lyDoChuyen };
}
