import { listViecMay, type ViecMay } from "./viec-may";

export type TrangThaiBuoc =
  | "xong"
  | "cho_nguoi_duyet"
  | "hong"
  | "khong_ra_gi"
  | "cho"
  | "qua_sla"
  | "chua_cam_so";

export type BuocDef = {
  ten: string;
  tu: string;
  den: string;
  slaGio: number;
  runKey?: string;
  congDuyet?: boolean;
  nguoiLam?: boolean;
};

export type LuongDef = {
  ma: string;
  ten: string;
  moTa: string;
  link?: string;
  buoc: BuocDef[];
};

export const LUONG: LuongDef[] = [
  {
    ma: "NOIDUNG-01",
    ten: "Bài fanpage — từ nghiên cứu tới đo hiệu quả",
    moTa: "Dây chuyền nội dung hằng ngày, có cổng CEO duyệt qua Telegram",
    link: "/content",
    buoc: [
      { ten: "Quét thị trường, đối thủ, nỗi đau khách → brief", tu: "Lịch tuần", den: "Agent Research", slaGio: 168, runKey: "mkt-research" },
      { ten: "Viết bài nháp theo khung phễu của ngày", tu: "Agent Research", den: "Nhà máy Content", slaGio: 24, runKey: "content-factory" },
      { ten: "Cửa QA — soi từ cấm + chấm giọng thương hiệu", tu: "Nhà máy Content", den: "Dispatch", slaGio: 1 },
      { ten: "Đẩy từng bài kèm nút vào Telegram CEO", tu: "Dispatch", den: "CEO", slaGio: 24, congDuyet: true },
      { ten: "Chép bài đã duyệt, đăng lên fanpage", tu: "CEO", den: "Nhân viên nội dung", slaGio: 24, nguoiLam: true },
      { ten: "Đo tương tác, nạp bài thắng/bài trượt vào Campaign Memory", tu: "Fanpage", den: "Campaign Memory", slaGio: 168 },
    ],
  },
  {
    ma: "BLOG-01",
    ten: "Bài blog example — từ chọn chủ đề tới lên web",
    moTa: "Hai lượt/ngày, có lớp bù tự chữa khi lượt khung giờ gãy",
    link: "/content",
    buoc: [
      { ten: "Chọn chủ đề chưa trùng trong kho slug đã có", tu: "Lịch 6:08 / 14:20", den: "Máy viết blog", slaGio: 12, runKey: "blog-writer" },
      { ten: "Viết bài dài tối thiểu 2500 từ", tu: "Máy viết blog", den: "Máy viết blog", slaGio: 12, runKey: "blog-writer" },
      { ten: "Cổng rào pháp lý thực phẩm bổ sung", tu: "Máy viết blog", den: "Cửa từ cấm", slaGio: 1 },
      { ten: "Dựng ảnh hero ba tầng (Gemini → free → tự vẽ)", tu: "Cửa từ cấm", den: "Máy dựng ảnh", slaGio: 1 },
      { ten: "Build tĩnh + đẩy lên GitHub Pages", tu: "Máy dựng ảnh", den: "example.com/blog", slaGio: 2 },
      { ten: "Đếm bài trong ngày, thiếu thì viết bù", tu: "Sổ blog_writer_ngay", den: "Lớp bù 12:30 / 20:30", slaGio: 24, runKey: "blog-bu" },
    ],
  },
  {
    ma: "DON-01",
    ten: "Đơn hàng — từ tin nhắn nhóm tới tiền về két",
    moTa: "Nguồn doanh thu số một; ba lớp chốt số của lib/doanh-thu-that.ts",
    link: "/gan-don",
    buoc: [
      { ten: "Webhook ghi tin thô trong nhóm Đơn Hàng", tu: "Sale gõ tin", den: "Bảng tg_messages", slaGio: 1 },
      { ten: "Bóc tin thành đơn bằng mô hình", tu: "Bảng tg_messages", den: "Máy bóc đơn", slaGio: 1, runKey: "tg-boc-don" },
      { ten: "Gán sale theo CHỮ KÝ trong tin, không theo máy gửi", tu: "Máy bóc đơn", den: "Bảng tg_orders", slaGio: 1, runKey: "tg-boc-don" },
      { ten: "Đối soát vận đơn J&T — giao được bao nhiêu, thu hộ bao nhiêu", tu: "Bảng tg_orders", den: "Máy cào J&T", slaGio: 48 },
      { ten: "Chốt tiền thật đã về bằng sổ phụ ngân hàng", tu: "Máy cào J&T", den: "Máy đọc sao kê MB", slaGio: 720 },
    ],
  },
];

export type BuocLive = BuocDef & {
  stt: number;
  trangThai: TrangThaiBuoc;
  luc: string | null;
  soLuong: number;
  donVi: string | null;
  chiTiet: string | null;
};

export type LuongLive = LuongDef & {
  buocLive: BuocLive[];
  soXong: number;
  tong: number;
  dangTacO: number | null;
  choNguoi: boolean;
  chuaCamSo: number;
};

export async function trangThaiLuong(cuaSoGio = 48): Promise<LuongLive[]> {
  const runs = await listViecMay({ limit: 500 });
  const moc = Date.now() - cuaSoGio * 3600e3;
  const trongCuaSo = runs.filter((r) => new Date(r.created_at).getTime() >= moc);

  const moiNhat = new Map<string, ViecMay>();
  for (const r of trongCuaSo) if (!moiNhat.has(r.agent)) moiNhat.set(r.agent, r);

  return LUONG.map((l) => {
    let xongGanNhat: number | null = null;
    const buocLive: BuocLive[] = l.buoc.map((b, i) => {
      const base = { ...b, stt: i + 1, luc: null as string | null, soLuong: 0, donVi: null as string | null, chiTiet: null as string | null };

      if (!b.runKey) {

        return { ...base, trangThai: "chua_cam_so" as TrangThaiBuoc };
      }

      const r = moiNhat.get(b.runKey);
      if (!r) {

        const tac = xongGanNhat != null && Date.now() - xongGanNhat > b.slaGio * 3600e3;
        return { ...base, trangThai: (tac ? "qua_sla" : "cho") as TrangThaiBuoc };
      }

      const luc = r.created_at;
      const chung = { ...base, luc, soLuong: r.so_luong, donVi: r.don_vi, chiTiet: r.chi_tiet };
      if (r.trang_thai === "hong") return { ...chung, trangThai: "hong" as TrangThaiBuoc };
      if (r.trang_thai === "khong_co_gi") return { ...chung, trangThai: "khong_ra_gi" as TrangThaiBuoc };
      if (r.can_duyet && !r.duyet_luc) {
        xongGanNhat = new Date(luc).getTime();
        return { ...chung, trangThai: "cho_nguoi_duyet" as TrangThaiBuoc };
      }
      xongGanNhat = new Date(luc).getTime();
      return { ...chung, trangThai: "xong" as TrangThaiBuoc };
    });

    const tac = buocLive.find((b) => b.trangThai === "hong" || b.trangThai === "qua_sla" || b.trangThai === "khong_ra_gi");
    return {
      ...l,
      buocLive,
      soXong: buocLive.filter((b) => b.trangThai === "xong").length,
      tong: buocLive.length,
      dangTacO: tac ? tac.stt : null,
      choNguoi: buocLive.some((b) => b.trangThai === "cho_nguoi_duyet"),
      chuaCamSo: buocLive.filter((b) => b.trangThai === "chua_cam_so").length,
    };
  });
}
