import { getConfigValue } from "@/lib/app-config";

export const NGUONG_CU_NGAY = 7;

export type TaiKhoanTienMat = {
  nganHang: string;
  taiKhoan: string;
  soDu: number;
  asOf: string;
  nguon: "sao kê ngân hàng" | "nhập tay";
  soNgayCu: number | null;
  cuQua7Ngay: boolean;
};

export type TienMat = {
  taiKhoan: TaiKhoanTienMat[];
  tong: number | null;
  asOfCuNhat: string | null;
  cuQua7Ngay: boolean;
  ghiChu: string[];
};

type Latest = { balance?: { closing?: unknown; opening?: unknown; file?: unknown } | null; window?: { to?: unknown } | null } | null;
type Tx = { date?: string | null; file?: string | null } | null;
type ChiTietNhapTay = { tk?: unknown; amount?: unknown; as_of?: unknown };
type NhapTay = { amount?: unknown; as_of?: unknown; chi_tiet?: unknown; nguon?: unknown } | number | null;

export type DuLieuTienMat = {
  mbLatest: Latest; mbTx: Tx[] | null;
  tcbLatest: Latest; tcbTx: Tx[] | null;
  nhapTay: NhapTay;
};

const soNgay = (asOf: string, today: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null;
  const d = Math.floor((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${asOf}T00:00:00Z`).getTime()) / 864e5);
  return Number.isFinite(d) ? Math.max(0, d) : null;
};

function taiKhoanTuFile(txs: Tx[] | null, latest: Latest): string {
  const files = [
    ...(txs || []).map((t) => String(t?.file || "")),
    String(latest?.balance?.file || ""),
  ];
  for (const f of files) {
    const m = f.match(/(\d{4})_\d{6,8}/);
    if (m) return `...${m[1]}`;
  }
  return "...????";
}

function ngayCuoiKyTuFile(f: string): string {
  const thang = f.match(/_(\d{4})(\d{2})_MONTHLY/i);
  if (thang) return new Date(Date.UTC(Number(thang[1]), Number(thang[2]), 0)).toISOString().slice(0, 10);
  const ngay = f.match(/_(\d{4})(\d{2})(\d{2})\.pdf$/i);
  return ngay ? `${ngay[1]}-${ngay[2]}-${ngay[3]}` : "";
}

function ngayCuoiKy(latest: Latest, txs: Tx[] | null): string {
  const to = latest?.window?.to;
  if (typeof to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(to)) return to;
  const tuBalance = ngayCuoiKyTuFile(String(latest?.balance?.file || ""));
  if (tuBalance) return tuBalance;
  return (txs || []).map((t) => ngayCuoiKyTuFile(String(t?.file || ""))).filter(Boolean).sort().at(-1) || "";
}

function motTaiKhoan(nganHang: string, latest: Latest, txs: Tx[] | null, today: string): TaiKhoanTienMat | null {
  const closing = Number(latest?.balance?.closing);
  if (!latest?.balance || !Number.isFinite(closing)) return null;
  const dates = (txs || []).map((t) => String(t?.date || "")).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const giaoDichCuoi = dates.at(-1) || "";

  const cuoiKy = ngayCuoiKy(latest, txs);
  const asOf = cuoiKy && cuoiKy <= today && cuoiKy >= giaoDichCuoi ? cuoiKy : giaoDichCuoi;
  const n = asOf ? soNgay(asOf, today) : null;
  return {
    nganHang,
    taiKhoan: taiKhoanTuFile(txs, latest),
    soDu: Math.round(closing),
    asOf,
    nguon: "sao kê ngân hàng",
    soNgayCu: n,
    cuQua7Ngay: n == null ? true : n > NGUONG_CU_NGAY,
  };
}

function nhanNhapTay(tk: unknown): string {
  const s = String(tk ?? "").trim();
  if (!s) return "Nhập tay";
  const soChuSo = (s.match(/\d/g) || []).length;
  if (soChuSo >= 6) return `${s.replace(/\d[\d\s.-]*\d/g, "").trim() || "TK"} ...${s.replace(/\D/g, "").slice(-4)}`;
  return s.slice(0, 12);
}

function dongNhapTay(nhapTay: NhapTay, today: string): TaiKhoanTienMat[] {
  const motDong = (nganHang: string, taiKhoan: string, amountRaw: unknown, asOfRaw: unknown): TaiKhoanTienMat | null => {
    const amount = Number(amountRaw);
    const asOf = typeof asOfRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw) ? asOfRaw : "";
    if (!Number.isFinite(amount) || amount <= 0 || !asOf) return null;
    const n = soNgay(asOf, today);
    return { nganHang, taiKhoan, soDu: Math.round(amount), asOf, nguon: "nhập tay", soNgayCu: n, cuQua7Ngay: n == null ? true : n > NGUONG_CU_NGAY };
  };
  if (!nhapTay || typeof nhapTay !== "object") return [];
  const chiTiet = Array.isArray(nhapTay.chi_tiet) ? (nhapTay.chi_tiet as ChiTietNhapTay[]) : [];
  const dong = chiTiet
    .map((c) => (c && typeof c === "object" ? motDong(nhanNhapTay(c.tk), "(nhập tay)", c.amount, c.as_of) : null))
    .filter((x): x is TaiKhoanTienMat => !!x);
  if (dong.length) return dong;
  const tong = motDong("Nhập tay", "(covan_cash_balance)", nhapTay.amount, nhapTay.as_of);
  return tong ? [tong] : [];
}

export function tinhTienMat(d: DuLieuTienMat, today: string): TienMat {
  const tk: TaiKhoanTienMat[] = [];
  const mb = motTaiKhoan("MB", d.mbLatest, d.mbTx, today);
  const tcb = motTaiKhoan("TCB", d.tcbLatest, d.tcbTx, today);
  if (mb) tk.push(mb);
  if (tcb) tk.push(tcb);
  const ghiChu: string[] = [];

  if (!tk.length) {

    const dong = dongNhapTay(d.nhapTay, today);
    if (dong.length) {
      tk.push(...dong);
      ghiChu.push("Chưa bóc được sổ phụ ngân hàng nào — đang dùng số NHẬP TAY (config covan_cash_balance).");
    } else {
      ghiChu.push("Chưa có số dư tiền mặt: chưa bóc sổ phụ ngân hàng và chưa có số nhập tay kèm ngày.");
      return { taiKhoan: [], tong: null, asOfCuNhat: null, cuQua7Ngay: false, ghiChu };
    }
  }
  for (const t of tk) {
    if (t.cuQua7Ngay) {
      ghiChu.push(
        t.soNgayCu == null
          ? `Số ${t.nganHang} ${t.taiKhoan} không có ngày giao dịch cuối — coi như cũ.`
          : `Số ${t.nganHang} ${t.taiKhoan} đã cũ ${t.soNgayCu} ngày (tính đến ${t.asOf}).`
      );
    }
  }
  const asOfs = tk.map((t) => t.asOf).filter(Boolean).sort();
  return {
    taiKhoan: tk,
    tong: tk.reduce((s, t) => s + t.soDu, 0),
    asOfCuNhat: asOfs[0] || null,
    cuQua7Ngay: tk.some((t) => t.cuQua7Ngay),
    ghiChu,
  };
}

const docJson = async <T,>(key: string): Promise<T | null> => {
  try {
    const raw = await getConfigValue(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const homNayVN = (): string => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function layTienMat(today = homNayVN()): Promise<TienMat> {
  const [mbLatest, mbTx, tcbLatest, tcbTx, nhapTay] = await Promise.all([
    docJson<Latest>("mb_latest"),
    docJson<Tx[]>("mb_transactions"),
    docJson<Latest>("tcb_latest"),
    docJson<Tx[]>("tcb_transactions"),
    docJson<NhapTay>("covan_cash_balance"),
  ]);
  return tinhTienMat(
    { mbLatest, mbTx: Array.isArray(mbTx) ? mbTx : null, tcbLatest, tcbTx: Array.isArray(tcbTx) ? tcbTx : null, nhapTay },
    today
  );
}

const trieu = (n: number): string => `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
const ddmm = (iso: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso || "?");

export function tienMatThanhChu(tm: TienMat): string {
  if (tm.tong == null || !tm.taiKhoan.length) return `Tiền mặt: chưa có (${tm.ghiChu[0] || "không có nguồn"}).`;
  const nguon = tm.taiKhoan.every((t) => t.nguon === "nhập tay") ? "nhập tay" : "sao kê ngân hàng";
  const tk = tm.taiKhoan
    .map((t) => `${t.nganHang} ${t.taiKhoan} ${trieu(t.soDu)} (tính đến ${ddmm(t.asOf)}${t.cuQua7Ngay ? `, đã cũ ${t.soNgayCu ?? "?"} ngày` : ""})`)
    .join(" · ");
  return `Tiền mặt (theo số dư mới nhất từng tài khoản, nguồn ${nguon}): tổng ${trieu(tm.tong)} — ${tk}`;
}

export function tienMatTungTaiKhoan(tm: TienMat): Array<{ account: string; amount: number; as_of: string; stale_days: number | null }> {
  return tm.taiKhoan.map((t) => ({ account: `${t.nganHang} ${t.taiKhoan}`, amount: t.soDu, as_of: t.asOf || "?", stale_days: t.soNgayCu }));
}
