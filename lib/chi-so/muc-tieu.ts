export const Q4_DOANH_THU_VND = 950_000_000;
export const Q4 = { nam: 2026, thangDau: 10, thangSauCuoi: 1, namSauLech: 1 };

const MS_NGAY = 86_400_000;

export function soNgayQ4(nam = Q4.nam): number {
  const tu = Date.UTC(nam, Q4.thangDau - 1, 1);
  const den = Date.UTC(nam + Q4.namSauLech, Q4.thangSauCuoi - 1, 1);
  return Math.round((den - tu) / MS_NGAY);
}

export function mucTieuDoanhThuNgay(): number {
  const n = soNgayQ4();
  if (!(n > 0)) return 0;
  return Math.round(Q4_DOANH_THU_VND / n);
}

export function chuMucTieuDoanhThuNgay(): string {
  const n = mucTieuDoanhThuNgay();
  return `${n.toLocaleString("vi-VN")}đ/ngày (Q4 ${Q4_DOANH_THU_VND.toLocaleString("vi-VN")}đ chia ${soNgayQ4()} ngày)`;
}

export const MUC = {
  viecTre: "0 việc trễ quá 1 ngày",
  loiLap: "lỗi lặp = 0",
  doanhThuNgay: chuMucTieuDoanhThuNgay(),
  soDon: null as string | null,
  lead: null as string | null,
  chotLead: null as string | null,
  duoiSan: "0",
  gmvTts: "20 triệu đồng tháng 10",
  donSan: null as string | null,
  laiRongSan: "30–35%, dưới 30% dừng chi",
  hoanSan: null as string | null,
  roas: "≥5",
  hoanJt: null as string | null,
  thatBaiJt: null as string | null,
  tonKho: null as string | null,
  donKet: "0",
  zalo: null as string | null,
  chat: null as string | null,
  chamHan: "0",
  quayLai: null as string | null,
  seo: null as string | null,
  geo: null as string | null,
  web: null as string | null,
  fb: null as string | null,
  bai: null as string | null,
  logo: "100%",
  claim: "0",
  thDuyet: null as string | null,
  tienMat: null as string | null,
  cod: null as string | null,
  laiGop: null as string | null,
  ads: "trong trần đã duyệt",
  muonVang: null as string | null,
  lech: "0 lệch",
  viecNguoi: "0 quá 1 ngày",
  mayHong: null as string | null,
  nguonChet: "0 nguồn KPI bị chết",
  token: "trong trần lượt (600k/lượt sửa)",
  tinBot: "≤1 tóm tắt/nhóm/ngày",
};

export const GMV_TTS_T10_VND = 20_000_000;
export const NGUONG_SAP_HET = 10;
export const DON_QUAY_LAI = 2;
export const BA_CANH_BAO = 3;
export const MOT_TRAM = 100;
export const TRAN_TIN_NHOM = 1;

export const GIO = {
  lienTuc: 1,
  nhieuLan: 8,
  moiDon: 8,
  phut15: 0.25,
  hangNgay: 36,
  haiLan: 18,
  hangTuan: 192,
  thuHai: 192,
  agent: 24,
};

export const CAT = { khong: 0, mot: 1, thang: 7, ngay: 10, gio: 16, lyDo: 180, ten: 80 };
export const MS = { giay: 1000, phut: 60_000, gio: 3_600_000, ngay: 86_400_000 };
export const LECH_VN_GIO = 7;
export const TRANG = 1000;
export const TRAN_VONG = 40;
export const PHUT_GIO = 60;
export const GIO_NGAY = 24;
export const NGAY_TUAN = 7;
export const NGAY_ZALO = 2;
export const DODAI_NHAN = 6;

export const SO_CUOI_TK = 4;

export const CHU = {
  soPhu: "sổ phụ về theo tháng, trễ tới ~30 ngày",
  misaKho: "số MISA, chưa phải sổ kho thật",
  chuaChot: "chưa chốt",
  chuaDuLieu: "chưa có dữ liệu",
  chotLead: "chưa có công thức ghép leads × tg_orders theo SĐT băm",
  laiSan: "chưa có bảng phí sàn",
  hoanSan: "chưa có dữ liệu (chờ SQL 071 giám sát đơn)",
  roas: "bắt đầu từ 22/10",
  donKet: "chưa có hệ kho/đơn thống nhất (spec kho vận KV-1…7)",
  seo: "chờ migration 071 seo-do",
  gmv: "chưa có dữ liệu API TikTok Shop",
  web: "chưa lưu bảng (web-ngay chỉ gửi Telegram)",
  claim: "chờ rà TH-ALEX-01 (hạn 12/10)",
  laiGop: "misa_daily_profit dừng 30/07; CEO 06/08 bỏ MISA làm số bán",
  geo: "lần đo đầu 12/10",
  fb: "đo thật từ 09/10",
  adsToken: "Chưa cắm token quảng cáo Meta hoặc cron ads-spend chưa ghi ads_campaigns",
  bankTx: "không dùng bank_transactions (dừng 21/06)",
};
