import "server-only";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { getDealers, saveDealers } from "@/lib/dealers";
import { layDoanhThu } from "@/lib/doanh-thu";
import { vnDateStr } from "@/lib/payroll";
import {
  boCccd, canhBaoDocQuyenVung, cauHinhThuongMacDinh, chietKhauTheoBac, doanhSoTheoDaiLy, hanCongNoMacDinh, kyCua, soDuCongNo, thuongQuy, tienDoCamKet,
  type CauHinhThuong, type CongNo, type DaiLy, type DaiLyClient, type DongCongNo, type DongCongNoMoi, type DoanhSoDaiLy, type ChietKhauDaiLy, type ThuongQuy, type TienDoCamKet,
} from "@/lib/dai-ly";

const KEY_CONG_NO = "dai_ly_cong_no";
const KEY_CAU_HINH = "dai_ly_cau_hinh";
const BANG = "dai_ly_cong_no";

export type CauHinhDaiLy = { hanTraNgay: number; thuong: CauHinhThuong; nguon: { thuong: "gia-v4" | "config" } };

export async function layCauHinhDaiLy(): Promise<CauHinhDaiLy> {
  const mac = cauHinhThuongMacDinh();
  let hanTraNgay = hanCongNoMacDinh(); let thuong = mac; let nguonThuong: "gia-v4" | "config" = "gia-v4";
  try {
    const j = JSON.parse((await getConfigValue(KEY_CAU_HINH)) || "{}");
    if (Number.isFinite(Number(j.han_tra_ngay)) && Number(j.han_tra_ngay) > 0) hanTraNgay = Number(j.han_tra_ngay);
    const t = j.thuong;
    if (t && Array.isArray(t.nguongQuy) && Array.isArray(t.pct) && t.nguongQuy.length === t.pct.length && t.nguongQuy.length > 0) {
      thuong = { nguongQuy: t.nguongQuy.map(Number), pct: t.pct.map(Number), trangThai: mac.trangThai };
      nguonThuong = "config";
    }
  } catch {  }
  return { hanTraNgay, thuong, nguon: { thuong: nguonThuong } };
}

export async function laySoDaiLy(): Promise<DaiLy[]> {
  return (await getDealers()) as DaiLy[];
}

export async function luuSoDaiLy(list: DaiLy[], by?: string): Promise<void> {
  await saveDealers(list, by);
}

async function coBang(sb: any): Promise<boolean> {
  try {
    const { error } = await sb.from(BANG).select("id").limit(1);
    return !error;
  } catch { return false; }
}

async function docCongNoConfig(): Promise<DongCongNo[]> {
  try {
    const j = JSON.parse((await getConfigValue(KEY_CONG_NO)) || "[]");
    return Array.isArray(j) ? j : j.dong || [];
  } catch { return []; }
}

export async function layCongNo(): Promise<{ dong: DongCongNo[]; noiLuu: "bang" | "config"; canhBao: string[] }> {
  const sb = getServiceClient();
  const canhBao: string[] = [];
  const tuConfig = await docCongNoConfig();
  if (!(await coBang(sb))) {
    canhBao.push("Bảng dai_ly_cong_no chưa có (migration 060 chưa chạy) — công nợ đang lưu ở config `dai_ly_cong_no`.");
    return { dong: tuConfig, noiLuu: "config", canhBao };
  }
  const out: DongCongNo[] = [];
  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await sb.from(BANG).select("*").order("ngay").range(f, f + 999);
    if (error || !data?.length) break;
    out.push(...(data as any[]).map(chuanDong));
    if (data.length < 1000) break;
  }
  const daCo = new Set(out.map((d) => d.id));
  const them = tuConfig.filter((d) => !daCo.has(d.id));
  if (them.length) canhBao.push(`${them.length} dòng công nợ còn nằm ở config (ghi trước khi có bảng) — đọc gộp, chưa chuyển vào bảng.`);
  return { dong: [...out, ...them], noiLuu: "bang", canhBao };
}

function chuanDong(r: any): DongCongNo {
  const chung = { id: String(r.id), ma_dai_ly: String(r.ma_dai_ly), ngay: String(r.ngay).slice(0, 10), so_tien: Number(r.so_tien) || 0, ghi_chu: r.ghi_chu || undefined, tao_luc: r.tao_luc || undefined, tao_boi: r.tao_boi || undefined };
  return r.loai === "tra"
    ? { ...chung, loai: "tra", kenh: r.kenh || undefined }
    : { ...chung, loai: "no", ma_don: r.ma_don || undefined };
}

export async function ghiCongNo(d: DongCongNoMoi, by: string): Promise<DongCongNo> {
  if (!(d.so_tien > 0)) throw new Error("Số tiền phải lớn hơn 0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.ngay)) throw new Error("Ngày không hợp lệ");
  const sb = getServiceClient();
  const dong = { ...d, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, tao_luc: new Date().toISOString(), tao_boi: by } as DongCongNo;
  if (await coBang(sb)) {
    const { error } = await sb.from(BANG).insert({
      id: dong.id, ma_dai_ly: dong.ma_dai_ly, loai: dong.loai, ngay: dong.ngay, so_tien: dong.so_tien,
      ma_don: dong.loai === "no" ? dong.ma_don || null : null, kenh: dong.loai === "tra" ? dong.kenh || null : null,
      ghi_chu: dong.ghi_chu || null, tao_luc: dong.tao_luc, tao_boi: by,
    });
    if (error) throw new Error("Ghi công nợ thất bại: " + error.message);
    return dong;
  }
  const cu = await docCongNoConfig();
  await setConfigValue(KEY_CONG_NO, JSON.stringify([...cu, dong]), "Công nợ đại lý (fallback khi chưa có bảng dai_ly_cong_no)");
  return dong;
}

export type DongBangDaiLy = {
  dl: DaiLyClient;
  chietKhau: ChietKhauDaiLy[];
  doanhSoThang: DoanhSoDaiLy;
  doanhSoQuy: DoanhSoDaiLy;
  camKet: TienDoCamKet;
  congNo: CongNo;
  thuong: ThuongQuy;
};

export type BangDaiLy = {
  homNay: string;
  ky: ReturnType<typeof kyCua>;
  cauHinh: CauHinhDaiLy;
  dong: DongBangDaiLy[];
  congNoChiTiet: Record<string, DongCongNo[]>;
  canhBao: string[];
  noiLuuCongNo: "bang" | "config";
};

async function doanhSoKy(sb: any, tu: string, den: string): Promise<{ rows: { order_code: string; order_date: string; customer_phone: string | null; net_amount: number }[]; canhBao: string[] }> {

  const thangs: Array<[string, string]> = [];
  let d = new Date(`${tu.slice(0, 7)}-01T00:00:00Z`);
  const cuoi = new Date(`${den}T00:00:00Z`);
  while (d <= cuoi) {
    const ym = d.toISOString().slice(0, 7);
    const next = new Date(d); next.setUTCMonth(next.getUTCMonth() + 1);
    const cuoiThang = new Date(next.getTime() - 86400000).toISOString().slice(0, 10);
    thangs.push([ym === tu.slice(0, 7) ? tu : `${ym}-01`, cuoiThang < den ? cuoiThang : den]);
    d = next;
  }
  const ket = await Promise.all(thangs.map(([a, b]) => layDoanhThu(sb, a, b, { si: "chi" }).catch((e: any) => ({ rows: [], canhBao: [`Không đọc được doanh thu ${a}..${b}: ${e?.message || e}`] }))));
  return { rows: ket.flatMap((k: any) => k.rows), canhBao: ket.flatMap((k: any) => k.canhBao.filter((c: string) => !/Đã TÁCH/.test(c))) };
}

export async function dungBangDaiLy(): Promise<BangDaiLy> {
  const sb = getServiceClient();
  const homNay = vnDateStr();
  const ky = kyCua(homNay);
  const [ds, cauHinh, cn] = await Promise.all([laySoDaiLy(), layCauHinhDaiLy(), layCongNo()]);
  const denThang = homNay < ky.thang.den ? homNay : ky.thang.den;
  const denQuy = homNay < ky.quy.den ? homNay : ky.quy.den;
  const [dsThang, dsQuy] = await Promise.all([doanhSoKy(sb, ky.thang.tu, denThang), doanhSoKy(sb, ky.quy.tu, denQuy)]);
  const gomThang = doanhSoTheoDaiLy(ds, dsThang.rows);
  const gomQuy = doanhSoTheoDaiLy(ds, dsQuy.rows);
  const congNoChiTiet: Record<string, DongCongNo[]> = {};
  for (const d of cn.dong) (congNoChiTiet[d.ma_dai_ly] ||= []).push(d);

  const dong: DongBangDaiLy[] = ds.map((d) => {
    const q = gomQuy.theoMa[d.ma] || { net: 0, gop: 0, don: 0 };
    return {
      dl: boCccd(d),
      chietKhau: chietKhauTheoBac(d),
      doanhSoThang: gomThang.theoMa[d.ma] || { net: 0, gop: 0, don: 0 },
      doanhSoQuy: q,
      camKet: tienDoCamKet(d.cam_ket, homNay),
      congNo: soDuCongNo(congNoChiTiet[d.ma] || [], homNay, cauHinh.hanTraNgay),
      thuong: thuongQuy(q.gop, cauHinh.thuong),
    };
  });
  const canhBao = [
    ...canhBaoDocQuyenVung(ds),
    ...gomThang.canhBao,
    ...cn.canhBao,
    ...Array.from(new Set([...dsThang.canhBao, ...dsQuy.canhBao])),
  ];
  if (homNay < ky.thang.den) canhBao.push(`Tháng ${ky.thang.nhan} và ${ky.quy.nhan} ĐANG CHẠY (tới ${homNay}) — doanh số và thưởng dự kiến còn tăng, không dùng để chốt.`);
  return { homNay, ky, cauHinh, dong, congNoChiTiet, canhBao, noiLuuCongNo: cn.noiLuu };
}
