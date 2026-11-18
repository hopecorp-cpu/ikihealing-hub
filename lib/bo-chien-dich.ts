import { decomposeTarget } from "./kpi-planner";
import { getLoopAssumptions, adCeilings } from "./revenue-loop";
import { getServiceClient } from "./supabase-server";

export const GIO_TB_MAC_DINH = 1_390_000;
export const CUOC_GOI_MOI_SALE_NGAY = 25;

export type GoiViecPhong = {
  phong: string;
  tieuDe: string;
  chiTieu: string;
  viec: string[];
  vaiTro: "truc-tiep" | "ho-tro";
};

export type BanRaChienDich = {
  ten: string;
  thang: string;
  mucTieu: number;

  doanhThuNgay: number;
  donCanThang: number;
  donCanNgay: number;
  leadCanThang: number;
  khachCanThang: number;
  tranAdsThang: number;
  cpoTran: number;
  cplTran: number;
  gioTB: number;

  soSaleThat: number;
  donMoiSaleNgay: number;
  goi: GoiViecPhong[];
  canhBao: string[];
};

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";

export async function boChienDich(mucTieu: number, thang: string, ten?: string): Promise<BanRaChienDich> {
  const gt = await getLoopAssumptions();
  const canhBao: string[] = [];

  let soSaleThat = 0;
  let tenSale: string[] = [];
  try {
    const { data } = await getServiceClient().from("users")
      .select("full_name, position, active").eq("active", true);
    const sale = (data ?? []).filter((u: any) => /sale/i.test(u.position || ""));
    soSaleThat = sale.length;
    tenSale = sale.map((u: any) => u.full_name);
  } catch {  }

  if (soSaleThat === 0) {
    soSaleThat = 1;
    canhBao.push("Không đọc được đội sale từ hệ thống — đang tạm tính 1 người. Kiểm lại /nhan-su trước khi giao việc.");
  }

  const c = decomposeTarget({
    monthTarget: mucTieu,
    workDaysPerMonth: gt.workDaysPerMonth,
    weeksPerMonth: gt.weeksPerMonth,
    aov: GIO_TB_MAC_DINH,
    ordersPerCustomer: gt.ordersPerCustomer,
    closeRate: gt.closeRate,
  });

  const aovNet = GIO_TB_MAC_DINH / 1.08;
  const tran = adCeilings(aovNet, gt.grossMargin, gt.desiredMargin, gt.closeRate);
  const tranAdsThang = mucTieu * gt.mktCostCapPct;
  const donMoiSaleNgay = c.ordersDay / soSaleThat;

  const chamToiDaNgay = soSaleThat * CUOC_GOI_MOI_SALE_NGAY;
  const chamCanNgay = c.leadsDay;
  if (chamCanNgay > chamToiDaNgay) {
    canhBao.push(
      `VƯỢT TRẦN NĂNG LỰC: cần chạm ${Math.round(chamCanNgay)} lead/ngày nhưng ${soSaleThat} sale ` +
      `(${tenSale.join(", ")}) gọi hết sức chỉ được ${chamToiDaNgay}. Hoặc hạ mục tiêu, hoặc tuyển thêm, ` +
      `hoặc đẩy phần chênh sang kênh tự chốt (web/quiz) — đừng giao rồi mong họ cố.`
    );
  }
  if (donMoiSaleNgay > 8) {
    canhBao.push(`Mỗi sale phải chốt ${donMoiSaleNgay.toFixed(1)} đơn/ngày — cao hơn nhịp T7 (10,5 đơn/ngày cho cả đội). Cân nhắc lại.`);
  }
  canhBao.push("Combo và giá lấy từ offer_architecture ĐÃ DUYỆT. Sáu combo S1-S6 hiện còn draft nên CHƯA được đưa vào chiến dịch bán.");
  canhBao.push("Khuyến mãi là TẶNG QUÀ, không chiết khấu %. Quà tính theo giá vốn đã gồm VAT và phải trừ vào doanh số tính hoa hồng.");

  const goi: GoiViecPhong[] = [
    {
      phong: "Kinh Doanh & Sale",
      vaiTro: "truc-tiep",
      tieuDe: `Chốt ${Math.round(c.ordersMonth)} đơn — mục tiêu ${vnd(mucTieu)} tháng ${thang}`,
      chiTieu: `${Math.round(c.ordersMonth)} đơn/tháng · ${c.ordersDay.toFixed(1)} đơn/ngày cả đội · ${donMoiSaleNgay.toFixed(1)} đơn/ngày mỗi người`,
      viec: [
        `Chốt ${donMoiSaleNgay.toFixed(1)} đơn/ngày, ghi đơn vào nhóm Đơn Hàng kèm chữ ký của mình`,
        `Trả lời hết khách đang chờ trong 24h — xem /cham-soc-kh`,
        `Gọi lại tệp khách ngủ 90-180 ngày, ưu tiên người đã mua ≥2 lần`,
        `Ghi quà tặng và chiết khấu vào từng đơn — thiếu là không trừ được vào doanh số tính hoa hồng`,
      ],
    },
    {
      phong: "Marketing",
      vaiTro: "truc-tiep",
      tieuDe: `Đổ ${Math.round(c.leadsMonth)} lead — mục tiêu ${vnd(mucTieu)} tháng ${thang}`,
      chiTieu: `${Math.round(c.leadsMonth)} lead/tháng · ${Math.round(c.leadsDay)} lead/ngày · CPL trần ${vnd(tran.cplCeiling)} · ngân sách trần ${vnd(tranAdsThang)}`,
      viec: [
        `Giữ CPL dưới ${vnd(tran.cplCeiling)} và CPO dưới ${vnd(tran.cpoCeiling)} — vượt là ăn vào biên`,
        `Không tiêu quá ${vnd(tranAdsThang)} cả tháng (trần ${Math.round(gt.mktCostCapPct * 100)}% doanh thu)`,
        `Đủ 5 bài/ngày qua nhà máy content, duyệt trong ngày, không để tồn nháp`,
        `Mọi nội dung qua cửa từ cấm — thực phẩm bổ sung, cấm chữa/trị/thải độc, khuyến mãi là tặng quà`,
      ],
    },
    {
      phong: "Chăm Sóc Khách Hàng",
      vaiTro: "truc-tiep",
      tieuDe: `Kéo đơn mua lại — mục tiêu ${vnd(mucTieu)} tháng ${thang}`,
      chiTieu: `Đánh thức khách ngủ >90 ngày · nâng tỉ lệ quay lại 30 ngày trên nền 13,7%`,
      viec: [
        `Chăm chủ động theo careFlows ở /cham-soc-kh, ghi lại từng lượt`,
        `Đơn mua lại có giỏ cao hơn 47% so với đơn lần đầu — ưu tiên tệp đã mua`,
        `Không báo khách chuyện nhân sự nghỉ, chỉ nói "giờ em là người hỗ trợ chị"`,
      ],
    },
    {
      phong: "Kho & Hỗ Trợ",
      vaiTro: "ho-tro",
      tieuDe: `Sẵn hàng cho ${Math.round(c.ordersMonth)} đơn — tháng ${thang}`,
      chiTieu: `Đủ tồn cho ${Math.round(c.ordersMonth)} đơn · không để hết hàng giữa chiến dịch`,
      viec: [
        `Soát tồn theo số đơn dự kiến, báo sớm món sắp hết`,
        `Chuẩn bị đủ quà tặng theo định mức, ghi rõ giá vốn để trừ đúng`,
      ],
    },
    {
      phong: "Tài Chính",
      vaiTro: "ho-tro",
      tieuDe: `Theo dòng tiền chiến dịch — tháng ${thang}`,
      chiTieu: `Đối soát COD J&T và sổ phụ MB · canh lệch pha 3-7 ngày`,
      viec: [
        `Đối soát đơn ↔ vận đơn ↔ tiền về, chênh phải giải thích được`,
        `Tiền về tài khoản KHÁC doanh thu ghi nhận — trừ lệch pha COD trước khi kêu thất thoát`,
      ],
    },
  ];

  return {
    ten: ten?.trim() || `Chiến dịch ${vnd(mucTieu)} — tháng ${thang}`,
    thang, mucTieu,
    doanhThuNgay: c.day,
    donCanThang: c.ordersMonth, donCanNgay: c.ordersDay,
    leadCanThang: c.leadsMonth, khachCanThang: c.customersMonth,
    tranAdsThang, cpoTran: tran.cpoCeiling, cplTran: tran.cplCeiling,
    gioTB: GIO_TB_MAC_DINH,
    soSaleThat, donMoiSaleNgay, goi, canhBao,
  };
}
