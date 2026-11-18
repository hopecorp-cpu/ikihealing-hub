export type San = "shopee" | "tiktok";

export type DongDon = {
  ma: string;
  ngay: string | null;
  trangThai: string;
  nguoiMua: string | null;
  tienHang: number;
  giamGia: number;
  phiShipKhachTra: number;
  tongKhachTra: number;

  phiSanTrongDon: number | null;
  troGiaSan: number;
  lyDoHuy: string | null;
  dong: number;
};

export type DongThanhToan = {
  ma: string;
  ngayThanhToan: string | null;
  thucNhan: number;
  phiSan: number;
  phiShip: number;
  troGia: number;

  khachThanhToan: number | null;
  tienHoan: number;
  dong: number;
};

export type KetQuaDoiSoat = {
  san: San;
  kyTu: string | null; kyDen: string | null;
  soDon: number; soDonCoThanhToan: number;

  soDonConHanTra: number; tienConHanTra: number;
  tongTienHang: number;
  tongSanTru: number;
  tongThucVe: number;
  tiLeThucVe: number;

  lech: Array<{ ma: string; loai: "chua-thanh-toan" | "khong-co-don" | "lech-tien" | "hoan"; chiTiet: string; tien: number }>;

  cotThieu: string[];
  canhBao: string[];
};

const kd = (s: any) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();

export function soTien(v: any): number {
  if (v == null || v === "") return 0;
  let s = String(v).trim().replace(/[đ₫\s]/g, "").replace(/VND|vnd/g, "");
  let am = false;
  if (/^\(.*\)$/.test(s)) { am = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { am = true; s = s.slice(1); }

  const iCham = s.lastIndexOf("."), iPhay = s.lastIndexOf(",");
  if (iCham >= 0 && iPhay >= 0) {
    if (iPhay > iCham) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (iPhay >= 0) {

    const sau = s.length - iPhay - 1;
    s = sau === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (iCham >= 0) {
    const sau = s.length - iCham - 1;
    if (sau === 3 && (s.match(/\./g) || []).length >= 1 && !/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    else if (sau === 3) s = s.replace(/\./g, "");
  }
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return (Number.isFinite(n) ? n : 0) * (am ? -1 : 1);
}

export function ngayChuan(v: any): string | null {
  const s = String(v ?? "").trim();

  let m = /^(\d{4})[-\/](\d{2})[-\/](\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function tachCsv(text: string): string[][] {
  const dau = text.includes("\t") ? "\t" : (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let cur = "", inQ = false, row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (inQ && text[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === dau && !inQ) { row.push(cur); cur = ""; }
    else if ((c === "\n" || c === "\r") && !inQ) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}

function timCot(headers: string[], ungVien: string[]): number {
  const hs = headers.map(kd);
  for (const u of ungVien) {
    const k = kd(u);
    const i = hs.findIndex((h) => h === k);
    if (i >= 0) return i;
  }
  for (const u of ungVien) {
    const k = kd(u);
    const i = hs.findIndex((h) => h.includes(k));
    if (i >= 0) return i;
  }
  return -1;
}

const COT_DON: Record<San, Record<string, string[]>> = {

  shopee: {
    ma: ["Mã đơn hàng", "Order ID", "Order SN"],
    ngay: ["Ngày đặt hàng", "Order Creation Date", "Thời gian đặt hàng"],
    trangThai: ["Trạng Thái Đơn Hàng", "Trạng thái đơn hàng", "Order Status"],
    nguoiMua: ["Người Mua", "Tên Người nhận", "Username (Buyer)", "Buyer Name"],

    giaDong: ["Giá ưu đãi", "Deal Price", "Giá bán"],
    soLuong: ["Số lượng", "Quantity"],
    tienHang: ["Tổng số tiền Người mua thanh toán", "Tổng giá bán (sản phẩm)", "Product Subtotal"],
    giamGia: ["Mã giảm giá của Shop", "Giảm giá từ Combo của Shop", "Seller Voucher"],
    troGiaSan: ["Được Shopee trợ giá", "Mã giảm giá của Shopee", "Giảm giá từ combo Shopee", "Shopee Xu được hoàn"],
    phiShipKhachTra: ["Phí vận chuyển mà người mua trả", "Phí vận chuyển (dự kiến)", "Shipping Fee Paid by Buyer"],
    tongKhachTra: ["Tổng số tiền người mua thanh toán", "Total Amount"],

    phiCoDinh: ["Phí cố định", "Commission Fee"],
    phiDichVu: ["Phí Dịch Vụ", "Service Fee"],
    phiGiaoDich: ["Phí xử lý giao dịch", "Transaction Fee"],
    kyQuy: ["Tiền ký quỹ"],
    lyDoHuy: ["Lý do hủy", "Cancel Reason"],
    trangThaiHoan: ["Trạng thái Trả hàng/Hoàn tiền", "Return / Refund Status"],
  },

  tiktok: {
    ma: ["Order ID", "Mã đơn hàng", "Order No"],
    ngay: ["Created Time", "Thời gian tạo", "Order Created Time", "Ngày tạo"],
    trangThai: ["Order Status", "Trạng thái đơn hàng", "Order Substatus"],
    nguoiMua: ["Buyer Username", "Recipient", "Người mua", "Tên người nhận"],
    giaDong: ["SKU Unit Original Price", "Đơn giá", "Unit Price"],
    soLuong: ["Quantity", "Số lượng"],
    tienHang: ["SKU Subtotal After Discount", "SKU Subtotal Before Discount", "Order Amount", "Tổng tiền hàng"],
    giamGia: ["SKU Seller Discount", "Giảm giá của người bán", "Seller Discount"],
    troGiaSan: ["SKU Platform Discount", "Platform Discount", "Trợ giá nền tảng"],
    phiShipKhachTra: ["Shipping Fee After Discount", "Original Shipping Fee", "Phí vận chuyển"],
    tongKhachTra: ["Order Amount", "Tổng số tiền đơn hàng", "Total Amount"],
    phiCoDinh: [], phiDichVu: [], phiGiaoDich: [], kyQuy: [],
    lyDoHuy: ["Cancel Reason", "Lý do hủy"],
    trangThaiHoan: ["Return Status", "Trạng thái trả hàng"],
  },
};
const COT_TT: Record<San, Record<string, string[]>> = {
  shopee: {
    khachThanhToan: [], tienHoan: [], loaiGiaoDich: [],
    ma: ["Mã đơn hàng", "Order ID", "Order SN"],
    ngayThanhToan: ["Ngày thanh toán", "Payout Completed Date", "Thời gian thanh toán", "Ngày hoàn tất"],
    thucNhan: ["Tổng tiền thanh toán", "Total Released Amount", "Tổng số tiền đã thanh toán", "Số tiền nhận được"],
    phiSan: ["Phí cố định", "Commission Fee", "Phí hoa hồng", "Phí thanh toán", "Service Fee", "Phí dịch vụ"],
    phiShip: ["Phí vận chuyển thực tế", "Actual Shipping Fee", "Phí vận chuyển do người bán trả"],
    troGia: ["Mã giảm giá của Shop", "Seller Voucher", "Shop Voucher"],
  },

  tiktok: {
    ma: ["ID đơn hàng/điều chỉnh", "Order/adjustment ID", "Order ID", "Mã đơn hàng"],
    ngayThanhToan: ["Thời gian quyết toán đơn hàng", "Settled time", "Statement date", "Ngày thanh toán"],
    thucNhan: ["Tổng số tiền quyết toán", "Total settlement amount", "Settlement amount"],
    phiSan: ["Tổng phí", "Total fees"],
    phiShip: [],
    troGia: ["Giảm giá của người bán", "Seller discount"],

    khachThanhToan: ["Khách thanh toán", "Customer payment"],
    tienHoan: ["Tiền hoàn của khách", "Customer refund"],
    loaiGiaoDich: ["Loại giao dịch", "Transaction type"],
  },
};

function congCacCot(headers: string[], row: string[], ungVien: string[]): { tong: number; coCot: boolean } {
  const hs = headers.map(kd);
  let tong = 0, coCot = false;
  for (const u of ungVien) {
    const k = kd(u);
    hs.forEach((h, i) => { if (h.includes(k)) { tong += Math.abs(soTien(row[i])); coCot = true; } });
  }
  return { tong, coCot };
}

export function docFileDon(csv: string, san: San): { rows: DongDon[]; cotThieu: string[] } {
  const bang = tachCsv(csv);
  if (bang.length < 2) return { rows: [], cotThieu: ["file rỗng hoặc chỉ có tiêu đề"] };
  const headers = bang[0];
  const M = COT_DON[san];
  const idx = Object.fromEntries(Object.entries(M).map(([k, v]) => [k, timCot(headers, v)]));
  const cotThieu: string[] = [];
  if (idx.ma < 0) cotThieu.push(`file ĐƠN thiếu cột mã đơn (cần một trong: ${M.ma.join(" / ")})`);
  if (idx.giaDong < 0 && idx.tienHang < 0) cotThieu.push(`file ĐƠN thiếu cột tiền hàng (cần một trong: ${[...(M.giaDong || []), ...M.tienHang].join(" / ")})`);
  if (idx.ma < 0) return { rows: [], cotThieu };
  const rows: DongDon[] = [];
  const daThay = new Map<string, DongDon>();
  for (let r = 1; r < bang.length; r++) {
    const row = bang[r];
    const ma = String(row[idx.ma] || "").trim();
    if (!ma) continue;

    const giaDong = idx.giaDong >= 0 ? soTien(row[idx.giaDong]) : 0;
    const soLuong = idx.soLuong >= 0 ? soTien(row[idx.soLuong]) || 1 : 1;
    const tienDong = giaDong > 0 ? giaDong * soLuong : (idx.tienHang >= 0 ? soTien(row[idx.tienHang]) : 0);
    const giamGia = idx.giamGia >= 0 ? Math.abs(soTien(row[idx.giamGia])) : 0;
    const ship = idx.phiShipKhachTra >= 0 ? soTien(row[idx.phiShipKhachTra]) : 0;
    const tong = idx.tongKhachTra >= 0 ? soTien(row[idx.tongKhachTra]) : 0;
    const phiCD = idx.phiCoDinh >= 0 ? Math.abs(soTien(row[idx.phiCoDinh])) : null;
    const phiDV = idx.phiDichVu >= 0 ? Math.abs(soTien(row[idx.phiDichVu])) : null;
    const phiGD = idx.phiGiaoDich >= 0 ? Math.abs(soTien(row[idx.phiGiaoDich])) : null;
    const coPhi = phiCD != null || phiDV != null || phiGD != null;
    const troGia = congCacCot(headers, row, M.troGiaSan || []).tong;
    const cu = daThay.get(ma);

    if (cu) { cu.tienHang += tienDong; continue; }
    const d: DongDon = {
      ma, ngay: idx.ngay >= 0 ? ngayChuan(row[idx.ngay]) : null,
      trangThai: idx.trangThai >= 0 ? String(row[idx.trangThai] || "") : "",
      nguoiMua: idx.nguoiMua >= 0 ? String(row[idx.nguoiMua] || "") || null : null,
      tienHang: tienDong, giamGia, phiShipKhachTra: ship,
      tongKhachTra: tong || Math.max(0, tienDong - giamGia + ship),
      phiSanTrongDon: coPhi ? (phiCD || 0) + (phiDV || 0) + (phiGD || 0) : null,
      troGiaSan: troGia,
      lyDoHuy: idx.lyDoHuy >= 0 ? String(row[idx.lyDoHuy] || "") || null : null,
      dong: r + 1,
    };
    daThay.set(ma, d); rows.push(d);
  }
  return { rows, cotThieu };
}

export function docFileThanhToan(csv: string, san: San): { rows: DongThanhToan[]; cotThieu: string[] } {
  const bang = tachCsv(csv);
  if (bang.length < 2) return { rows: [], cotThieu: ["file rỗng hoặc chỉ có tiêu đề"] };
  const headers = bang[0];
  const M = COT_TT[san];
  const iMa = timCot(headers, M.ma), iNgay = timCot(headers, M.ngayThanhToan), iNhan = timCot(headers, M.thucNhan);
  const cotThieu: string[] = [];
  if (iMa < 0) cotThieu.push(`file THANH TOÁN thiếu cột mã đơn (cần: ${M.ma.join(" / ")})`);
  if (iNhan < 0) cotThieu.push(`file THANH TOÁN thiếu cột tiền thực nhận (cần: ${M.thucNhan.join(" / ")})`);
  if (iMa < 0 || iNhan < 0) return { rows: [], cotThieu };
  const rows: DongThanhToan[] = [];
  const gop = new Map<string, DongThanhToan>();
  for (let r = 1; r < bang.length; r++) {
    const row = bang[r];
    const ma = String(row[iMa] || "").trim();
    if (!ma) continue;
    const thucNhan = soTien(row[iNhan]);
    const phiSan = congCacCot(headers, row, M.phiSan).tong;
    const phiShip = congCacCot(headers, row, M.phiShip).tong;
    const troGia = congCacCot(headers, row, M.troGia).tong;
    const iKT = timCot(headers, M.khachThanhToan || []), iHoan = timCot(headers, M.tienHoan || []);
    const khachThanhToan = iKT >= 0 ? soTien(row[iKT]) : null;
    const tienHoan = iHoan >= 0 ? Math.abs(soTien(row[iHoan])) : 0;
    const cu = gop.get(ma);
    if (cu) { cu.thucNhan += thucNhan; cu.phiSan += phiSan; cu.phiShip += phiShip; cu.troGia += troGia; cu.tienHoan += tienHoan; continue; }
    const d: DongThanhToan = { ma, ngayThanhToan: iNgay >= 0 ? ngayChuan(row[iNgay]) : null, thucNhan, phiSan, phiShip, troGia, khachThanhToan, tienHoan, dong: r + 1 };
    gop.set(ma, d); rows.push(d);
  }
  return { rows, cotThieu };
}

const HOAN = /(?:^|\s)(?:đã\s+)?(?:huỷ|hủy|cancel\w*|return\w*|refund\w*|trả hàng|hoàn (?:hàng|tiền|trả|lại|về)|hoàn$|da huy|hoan (?:hang|tien|tra|lai|ve))/i;

const THANH_CONG = /hoàn thành|hoàn tất|completed|delivered|đã giao|da giao|thành công|đã nhận được hàng|da nhan duoc hang/i;
const laHoan = (tt: string) => !THANH_CONG.test(tt) && HOAN.test(tt);

export const conHanTra = (tt: string) => /có thể gửi yêu cầu trả hàng|co the gui yeu cau tra hang|can still request/i.test(tt);

export function doiSoat(san: San, don: DongDon[], tt: DongThanhToan[], cotThieu: string[] = []): KetQuaDoiSoat {
  const ttTheoMa = new Map(tt.map((t) => [t.ma, t]));
  const donTheoMa = new Map(don.map((d) => [d.ma, d]));
  const lech: KetQuaDoiSoat["lech"] = [];
  let tongTienHang = 0, tongThucVe = 0, soDonCoThanhToan = 0;
  const ngays = don.map((d) => d.ngay).filter(Boolean) as string[];

  const coFileTT = tt.length > 0;
  const coPhiTrongDon = don.some((d) => d.phiSanTrongDon != null);
  for (const d of don) {
    const hoan = laHoan(d.trangThai);

    const t = ttTheoMa.get(d.ma) || (!coFileTT && d.phiSanTrongDon != null && !hoan
      ? { ma: d.ma, ngayThanhToan: null, thucNhan: Math.max(0, d.tongKhachTra - d.phiSanTrongDon), phiSan: d.phiSanTrongDon, phiShip: 0, troGia: d.troGiaSan, khachThanhToan: null, tienHoan: 0, dong: d.dong }
      : undefined);
    if (hoan) {
      if (t && t.thucNhan > 0) lech.push({ ma: d.ma, loai: "hoan", chiTiet: `Đơn báo ${d.trangThai} nhưng sàn vẫn trả ${t.thucNhan.toLocaleString("vi")} — xem có phải hoàn một phần`, tien: t.thucNhan });
      continue;
    }
    tongTienHang += d.tienHang;
    if (!t) { lech.push({ ma: d.ma, loai: "chua-thanh-toan", chiTiet: `Có đơn (${d.trangThai || "?"}) nhưng chưa có dòng thanh toán — chưa được trả, hoặc file thanh toán xuất thiếu kỳ`, tien: d.tienHang }); continue; }

    if (t.khachThanhToan != null && t.tienHoan > 0 && t.tienHoan >= t.khachThanhToan - 1 && t.thucNhan <= 0) {
      tongTienHang -= d.tienHang;
      lech.push({ ma: d.ma, loai: "hoan", chiTiet: `Sàn báo hoàn toàn bộ ${t.tienHoan.toLocaleString("vi")} (quyết toán 0) — file đơn vẫn ghi "${d.trangThai || "?"}"`, tien: -t.tienHoan });
      continue;
    }
    soDonCoThanhToan++;
    tongThucVe += t.thucNhan;

    const tran = d.tienHang + d.phiShipKhachTra + 1000;
    if (t.thucNhan > tran) lech.push({ ma: d.ma, loai: "lech-tien", chiTiet: `Sàn trả ${t.thucNhan.toLocaleString("vi")} LỚN HƠN tiền hàng ${d.tienHang.toLocaleString("vi")} — kiểm lại đơn gộp hoặc điều chỉnh`, tien: t.thucNhan - d.tienHang });
    else if (t.thucNhan < 0) lech.push({ ma: d.ma, loai: "lech-tien", chiTiet: `Sàn thu ngược ${Math.abs(t.thucNhan).toLocaleString("vi")} (điều chỉnh/hoàn sau)`, tien: t.thucNhan });
  }
  let soHoanTrongTT = 0, tienHoanTrongTT = 0;
  for (const t of tt) {
    if (donTheoMa.has(t.ma)) continue;
    const hoanHet = t.khachThanhToan != null && t.tienHoan > 0 && t.tienHoan >= t.khachThanhToan - 1 && t.thucNhan <= 0;
    if (hoanHet) { soHoanTrongTT++; tienHoanTrongTT += t.tienHoan; lech.push({ ma: t.ma, loai: "hoan", chiTiet: `Sàn báo HOÀN toàn bộ ${t.tienHoan.toLocaleString("vi")} (khách trả rồi hoàn) — không có trong file đơn kỳ này`, tien: -t.tienHoan }); continue; }
    lech.push({ ma: t.ma, loai: "khong-co-don", chiTiet: `Có thanh toán ${t.thucNhan.toLocaleString("vi")} nhưng không có trong file đơn — file đơn xuất thiếu kỳ, hoặc đơn kỳ trước`, tien: t.thucNhan });
  }

  const canhBao: string[] = [];
  if (!don.length && tt.length) canhBao.push(`Chỉ có file THANH TOÁN, không có file đơn — ${tt.length} dòng quyết toán${soHoanTrongTT ? `, trong đó ${soHoanTrongTT} đơn HOÀN toàn bộ (${tienHoanTrongTT.toLocaleString("vi")}đ)` : ""}. Thả thêm file đơn để ra đủ ba cột.`);
  else if (!don.length) canhBao.push("File đơn không đọc được dòng nào.");
  if (!coFileTT && coPhiTrongDon) canhBao.push("Chưa có file thanh toán — 'thực về' đang SUY RA từ phí sàn ghi trong file đơn (khách trả − phí). Đủ để soi phí và biên; tiền về ngân hàng thật vẫn phải khớp sao kê.");
  else if (!coFileTT) canhBao.push("File thanh toán không có và file đơn không ghi phí sàn — ba cột dưới chỉ có 'bán được', chưa có 'thực về'.");
  const tongSanTru = Math.max(0, tongTienHang - tongThucVe);
  return {
    san, kyTu: ngays.length ? ngays.sort()[0] : null, kyDen: ngays.length ? ngays.sort()[ngays.length - 1] : null,
    soDon: don.filter((d) => !laHoan(d.trangThai)).length, soDonCoThanhToan,
    soDonConHanTra: don.filter((d) => conHanTra(d.trangThai)).length,
    tienConHanTra: don.filter((d) => conHanTra(d.trangThai)).reduce((a, d) => a + d.tienHang, 0),
    tongTienHang, tongSanTru, tongThucVe,
    tiLeThucVe: tongTienHang > 0 ? tongThucVe / tongTienHang : 0,
    lech: lech.sort((a, b) => Math.abs(b.tien) - Math.abs(a.tien)),
    cotThieu, canhBao,
  };
}
