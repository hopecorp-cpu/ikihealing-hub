import {
  DEFAULT_LEAD_CONFIG, chonSaleNhanLead, docLeadConfig, gioLamViec, khopChuHoiThoaiZalo, laZalo, phaiGiuKhach,
  type LeadConfig, type SaleLite,
} from "@/lib/leads";
import type { CaEval, KetQuaCham } from "./chung";

const SALES: SaleLite[] = [
  { id: "sale-a", name: "Sale A", position: "Sale" },
  { id: "sale-b", name: "Sale B", position: "Sale" },
  { id: "sale-c", name: "Sale C", position: "Sale" },
];
const cfg = (p: Partial<LeadConfig> = {}): LeadConfig => ({ ...DEFAULT_LEAD_CONFIG, ...p });

function phaiLa(thucTe: string | null, monDoi: string | null, viec: string): KetQuaCham {
  const dat = thucTe === monDoi;
  return { dat, ghiChu: dat ? `${viec}: đúng ${monDoi}` : `${viec}: ra ${thucTe ?? "null"}, mong đợi ${monDoi ?? "null"}` };
}

const vn = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h - 7, mi);

export const CA_CHIA_LEAD: CaEval[] = [
  {
    id: "lead-1", loai: "chia_moi", moTa: "ít lead nhất nhận trước",
    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg(), counts: { "sale-a": 3, "sale-b": 1, "sale-c": 2 } }).id, "sale-b", "least_loaded"),
  },
  {
    id: "lead-2", loai: "chia_moi", moTa: "hoà số lead thì thứ tự id ổn định (không ngẫu nhiên)",
    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg(), counts: { "sale-a": 2, "sale-b": 2, "sale-c": 2 } }).id, "sale-a", "least_loaded hoà"),
  },
  {
    id: "lead-3", loai: "chia_moi", moTa: "người trong excludeFromPool (trực ca tối) không nhận dù ít lead nhất",
    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg({ excludeFromPool: ["sale-b"] }), counts: { "sale-a": 3, "sale-b": 0, "sale-c": 2 } }).id, "sale-c", "excludeFromPool"),
  },
  {
    id: "lead-4", loai: "chia_moi", moTa: "route theo nguồn thắng luật ít lead",
    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg({ sourceRouting: { quiz: "sale-c" } }), counts: { "sale-a": 0, "sale-b": 0, "sale-c": 9 }, source: "quiz" }).id, "sale-c", "sourceRouting"),
  },
  {
    id: "lead-5", loai: "chia_moi", moTa: "route theo nguồn trỏ vào người đã nghỉ -> rơi về luật thường, không trả null",
    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg({ sourceRouting: { quiz: "sale-da-nghi" } }), counts: { "sale-a": 4, "sale-b": 1, "sale-c": 2 }, source: "quiz" }).id, "sale-b", "sourceRouting người nghỉ"),
  },
  {
    id: "lead-6", loai: "chia_moi", moTa: "tỉ trọng 4:3:2 lúc chưa ai có lead -> người tỉ trọng lớn nhất nhận",
    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg({ assignRule: "weighted", weights: { "sale-a": 2, "sale-b": 4, "sale-c": 3 } }), counts: {} }).id, "sale-b", "weighted"),
  },
  {
    id: "lead-7", loai: "chia_moi", moTa: "tỉ trọng: ai đang thiếu so với phần của mình nhiều nhất thì nhận",

    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg({ assignRule: "weighted", weights: { "sale-a": 2, "sale-b": 4, "sale-c": 3 } }), counts: { "sale-a": 1, "sale-b": 5, "sale-c": 2 } }).id, "sale-a", "weighted bù thiếu"),
  },
  {
    id: "lead-8", loai: "chia_moi", moTa: "tỉ trọng 0 phần = không bao giờ nhận lead tự động, kể cả đang rảnh nhất",
    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg({ assignRule: "weighted", weights: { "sale-a": 1, "sale-b": 1 } }), counts: { "sale-a": 7, "sale-b": 6, "sale-c": 0 } }).id, "sale-b", "weighted 0 phần"),
  },
  {
    id: "lead-9", loai: "chia_moi", moTa: "tỉ trọng nhưng không ai có phần -> rơi về ít lead nhất, KHÔNG để lead vào hư không",
    chay: () => phaiLa(chonSaleNhanLead({ sales: SALES, cfg: cfg({ assignRule: "weighted", weights: {} }), counts: { "sale-a": 5, "sale-b": 5, "sale-c": 1 } }).id, "sale-c", "weighted rỗng"),
  },
  {
    id: "lead-10", loai: "chia_moi", moTa: "chia lần lượt: sau người cuối thì vòng về người đầu, và báo nơi gọi ghi con trỏ",
    chay: () => {
      const r1 = chonSaleNhanLead({ sales: SALES, cfg: cfg({ assignRule: "round_robin" }), counts: {}, rrLast: "sale-a" });
      const r2 = chonSaleNhanLead({ sales: SALES, cfg: cfg({ assignRule: "round_robin" }), counts: {}, rrLast: "sale-c" });
      const dat = r1.id === "sale-b" && r2.id === "sale-a" && r1.vongLanLuot && r2.vongLanLuot;
      return { dat, ghiChu: dat ? "round_robin a->b, c->a, có cờ ghi con trỏ" : `round_robin ra ${r1.id}/${r2.id} (cờ ${r1.vongLanLuot}/${r2.vongLanLuot}), mong đợi sale-b/sale-a + cờ true` };
    },
  },
  {
    id: "lead-11", loai: "chia_moi", moTa: "chia lại (exclude người đang giữ) không bao giờ trả lại chính người đó; hết người thì null",
    chay: () => {
      const r = chonSaleNhanLead({ sales: SALES.slice(0, 1), cfg: cfg(), counts: {}, exclude: "sale-a" });
      return phaiLa(r.id, null, "pool rỗng sau exclude");
    },
  },
  {
    id: "lead-12", loai: "zalo_chu", moTa: "khách Zalo về đúng chủ hội thoại theo tên trong source (bỏ dấu, hoa thường)",
    chay: () => phaiLa(
      khopChuHoiThoaiZalo("Zalo nguyen van an", [{ id: "u-an", full_name: "Nguyễn Văn An" }, { id: "u-binh", full_name: "Trần Thị Bình" }]),
      "u-an", "chủ hội thoại Zalo"),
  },
  {
    id: "lead-13", loai: "zalo_chu", moTa: "tên chủ hội thoại không khớp ai (đã nghỉ) -> null để rơi về vòng chia, không gán bừa",
    chay: () => phaiLa(khopChuHoiThoaiZalo("Zalo Lê Văn Cường", [{ id: "u-an", full_name: "Nguyễn Văn An" }]), null, "chủ Zalo không khớp"),
  },
  {
    id: "lead-14", loai: "zalo_chu", moTa: "nhận diện lead Zalo (kênh hoặc nguồn) để miễn chuyền tay; lead Facebook thì không",
    chay: () => {
      const dat = laZalo({ channel: "zalo" }) && laZalo({ source: "Zalo Nguyễn Văn An" }) && !laZalo({ channel: "facebook", source: "fb ads" });
      return { dat, ghiChu: dat ? "laZalo đúng cả 3 kiểu" : "laZalo nhận diện sai" };
    },
  },
  {
    id: "lead-15", loai: "khong_gianh", moTa: "KHÔNG GIÀNH GIẬT: cấu hình trống/chuỗi lạ vẫn BẬT giữ khách; người giữ còn làm thì giữ, nghỉ việc thì mới chuyển",
    chay: () => {
      const macDinh = docLeadConfig(null).khongChuyenTay && docLeadConfig("{}").khongChuyenTay
        && docLeadConfig('{"khongChuyenTay":"false"}').khongChuyenTay && docLeadConfig("hỏng json").khongChuyenTay;
      const tatRo = docLeadConfig('{"khongChuyenTay":false}').khongChuyenTay === false;
      const giu = phaiGiuKhach(true, true) === true;
      const nghi = phaiGiuKhach(true, false) === false;
      const dat = macDinh && tatRo && giu && nghi;
      return {
        dat,
        ghiChu: dat ? "mặc định giữ khách; chỉ chuyển khi người giữ nghỉ hoặc CEO tắt cờ rõ ràng"
          : `macDinh=${macDinh} tatRo=${tatRo} giu=${giu} nghi=${nghi}`,
      };
    },
  },
  {
    id: "lead-16", loai: "gio_lam", moTa: "đồng hồ nguội chỉ chạy 8h-21h: 21h tối -> 8h sáng = 0 giờ; 20h -> 9h hôm sau = 2 giờ",
    chay: () => {
      const a = gioLamViec(vn(2026, 10, 9, 21), vn(2026, 10, 10, 8));
      const b = gioLamViec(vn(2026, 10, 9, 20), vn(2026, 10, 10, 9));
      const dat = a === 0 && b === 2;
      return { dat, ghiChu: dat ? "giờ làm việc đếm đúng" : `ra ${a} và ${b}, mong đợi 0 và 2` };
    },
  },
];
