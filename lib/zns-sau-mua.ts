import { chuanSdt } from "@/lib/du-lieu-ca-nhan";
import { CHAT_DAI_LY, trangThaiJt, type VanDon } from "@/lib/affiliate-don";
import { chuanSdt as sdtJt } from "@/lib/don-hang-jt";

export type CheDo = "tat" | "nhap" | "tu_gui";
export type MaLuong = "xac-nhan-don" | "hoi-tham-sau-nhan";
export const NGUON_THAM_SO = ["ten_khach", "ma_don", "ngay_dat", "san_pham", "tong_tien", "ngay_giao"] as const;
export type NguonThamSo = (typeof NGUON_THAM_SO)[number];

export type CauHinhLuong = { bat: boolean; templateId: string; thamSo: Record<string, NguonThamSo>; soNgay?: number };
export type CauHinhZns = { cheDo: CheDo; tranMoiLuot: number; luong: Record<MaLuong, CauHinhLuong> };

export const CAU_HINH_MAC_DINH: CauHinhZns = {
  cheDo: "nhap",
  tranMoiLuot: 100,
  luong: {
    "xac-nhan-don": { bat: true, templateId: "", thamSo: {} },
    "hoi-tham-sau-nhan": { bat: true, templateId: "", thamSo: {}, soNgay: 3 },
  },
};

export function docCauHinh(raw: unknown): CauHinhZns {
  let j: any = raw;
  if (typeof raw === "string") { try { j = JSON.parse(raw); } catch { j = null; } }
  if (!j || typeof j !== "object") j = {};
  const cheDo: CheDo = j.cheDo === "tat" || j.cheDo === "tu_gui" ? j.cheDo : "nhap";
  const tran = Number(j.tranMoiLuot);
  const luong = {} as Record<MaLuong, CauHinhLuong>;
  for (const ma of Object.keys(CAU_HINH_MAC_DINH.luong) as MaLuong[]) {
    const md = CAU_HINH_MAC_DINH.luong[ma], x = j.luong?.[ma] || {};
    const thamSo: Record<string, NguonThamSo> = {};
    for (const [o, n] of Object.entries(x.thamSo || {})) if ((NGUON_THAM_SO as readonly string[]).includes(String(n))) thamSo[o] = n as NguonThamSo;
    luong[ma] = {
      bat: x.bat === undefined ? md.bat : x.bat === true,
      templateId: String(x.templateId || "").trim(),
      thamSo,
      soNgay: Number.isFinite(Number(x.soNgay)) && Number(x.soNgay) >= 1 ? Number(x.soNgay) : md.soNgay,
    };
  }
  return { cheDo, tranMoiLuot: Number.isFinite(tran) && tran > 0 ? Math.min(tran, 500) : CAU_HINH_MAC_DINH.tranMoiLuot, luong };
}

export function coTheGui(ch: CauHinhZns, ma: MaLuong): boolean {
  const l = ch.luong[ma];
  return ch.cheDo === "tu_gui" && !!l?.bat && !!l.templateId;
}

export type DonZns = {
  chat_id: string; message_id: string | number; ngay: string; sdt: string | null; khach: string | null;
  khach_tra: number | null; san_pham: { ten?: string; sl?: number }[] | null;
};
export type TinZns = { khoa: string; luong: MaLuong; sdt: string; templateId: string; params: Record<string, string> };

const ngayCong = (ngay: string, n: number) => new Date(Date.parse(ngay + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const dmy = (ngay: string) => ngay.slice(8, 10) + "/" + ngay.slice(5, 7) + "/" + ngay.slice(0, 4);
const cat = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function giaTri(n: NguonThamSo, o: DonZns, ngayGiao: string | null): string {
  switch (n) {
    case "ten_khach": return cat(String(o.khach || "").trim() || "Quý khách", 30);
    case "ma_don": return String(o.message_id);
    case "ngay_dat": return dmy(o.ngay);
    case "ngay_giao": return ngayGiao ? dmy(ngayGiao) : "";
    case "tong_tien": return (Number(o.khach_tra) || 0).toLocaleString("vi-VN") + "đ";
    case "san_pham": {
      const sp = Array.isArray(o.san_pham) ? o.san_pham : [];
      return cat(sp.map((x) => `${x.ten || ""}${x.sl && x.sl > 1 ? " x" + x.sl : ""}`.trim()).filter(Boolean).join(", "), 90);
    }
  }
}

export function chonTinZns(don: DonZns[], vanDon: VanDon[], opt: {
  cauHinh: CauHinhZns; daGui: Set<string>; tuChoi: Set<string>; daiLy: Set<string>;
  sdt24h: Set<string>;
  homNay: string;
  gioVN: number;
}): { tin: TinZns[]; boQua: Record<string, number> } {
  const boQua: Record<string, number> = {};
  const bo = (ly: string) => { boQua[ly] = (boQua[ly] || 0) + 1; };
  const tin: TinZns[] = [];
  if (opt.cauHinh.cheDo === "tat") return { tin, boQua: { "may-tat": 1 } };
  if (opt.gioVN < 7 || opt.gioVN >= 22) return { tin, boQua: { "ngoai-gio-7h-22h": 1 } };

  const theoSdt = new Map<string, VanDon[]>();
  for (const v of vanDon) {
    const s = sdtJt(v.receiver_phone);
    if (s.length === 10) (theoSdt.get(s) || theoSdt.set(s, []).get(s)!).push(v);
  }
  const homQua = ngayCong(opt.homNay, -1);
  const ungVien: (TinZns & { uuTien: number })[] = [];

  for (const o of don) {
    const sdt = chuanSdt(o.sdt);
    if (String(o.chat_id) === CHAT_DAI_LY || (sdt && opt.daiLy.has(sdt))) { bo("dai-ly"); continue; }
    if (!sdt) { bo("sdt-loi"); continue; }
    if (opt.tuChoi.has(sdt)) { bo("khach-da-xin-dung"); continue; }
    if (opt.sdt24h.has(sdt)) { bo("da-nhan-tin-trong-24h"); continue; }
    const goc = `${o.chat_id}:${o.message_id}`;
    const them = (luong: MaLuong, khoa: string, ngayGiao: string | null, uuTien: number) => {
      const l = opt.cauHinh.luong[luong];
      if (!l.bat) return;
      if (opt.daGui.has(khoa)) { bo("da-gui-roi"); return; }
      const params: Record<string, string> = {};
      for (const [oMau, nguon] of Object.entries(l.thamSo)) params[oMau] = giaTri(nguon, o, ngayGiao);
      ungVien.push({ khoa, luong, sdt, templateId: l.templateId, params, uuTien });
    };

    if (o.ngay >= homQua && o.ngay <= opt.homNay) them("xac-nhan-don", `xn:${goc}`, null, 0);

    const soNgay = opt.cauHinh.luong["hoi-tham-sau-nhan"].soNgay || 3;
    const jt = trangThaiJt(sdt, o.ngay, theoSdt);
    if (jt.tt === "da_giao" && jt.ngayGiao) {
      const den = ngayCong(jt.ngayGiao, soNgay);
      if (den <= opt.homNay && den >= ngayCong(opt.homNay, -3)) them("hoi-tham-sau-nhan", `ht:${goc}`, jt.ngayGiao, 1);
    }
  }

  ungVien.sort((a, b) => a.uuTien - b.uuTien);
  const sdtLuot = new Set<string>();
  for (const t of ungVien) {
    if (sdtLuot.has(t.sdt)) { bo("mot-tin-moi-sdt-moi-luot"); continue; }
    if (tin.length >= opt.cauHinh.tranMoiLuot) { bo("vuot-tran-luot"); continue; }
    sdtLuot.add(t.sdt);
    const { uuTien: _u, ...x } = t;
    tin.push(x);
  }
  return { tin, boQua };
}
