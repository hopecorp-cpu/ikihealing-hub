import type { Ctx, O } from "./types";
import { tinhTienMat } from "@/lib/covan/tien-mat";
import { CAT, CHU, GIO, MUC, SO_CUOI_TK } from "./muc-tieu";
import { chay, docBang, docKhoa, docMot, laThieuBang, oSo, oTrong, homNayVN, moiNhat, type Khung } from "./khung";

const tien: Khung = {
  key: "tien_mat", phong: "TC", ten: "Tiền mặt / số dư", donVi: "đồng",
  mucTieu: MUC.tienMat, nguon: "config mb_latest, tcb_latest, bank_loop_status", tanSuat: "hằng ngày",
  nhayCam: true, nguongGio: GIO.hangTuan,
};
const cod: Khung = {
  key: "cod_chua_ve", phong: "TC", ten: "COD chưa về", donVi: "đồng",
  mucTieu: MUC.cod, nguon: "jt_summary + jt_waybills (chưa có collect_time)", tanSuat: "hằng ngày",
  nhayCam: true, nguongGio: GIO.haiLan, watchdog: "jt_waybills",
};
const lai: Khung = {
  key: "lai_gop", phong: "TC", ten: "Lãi gộp ngày", donVi: "đồng",
  mucTieu: MUC.laiGop, nguon: "không dùng misa_daily_profit", tanSuat: "hằng ngày",
  nhayCam: true, nguongGio: GIO.hangNgay,
};
const ads: Khung = {
  key: "chi_ads", phong: "TC", ten: "Chi ads/ngày", donVi: "đồng",
  mucTieu: MUC.ads, nguon: "config ads_campaigns", tanSuat: "hằng ngày",
  nhayCam: true, nguongGio: GIO.hangNgay, watchdog: "ads_campaigns",
};

export async function oTienMat(sb: any, ctx?: Ctx): Promise<O> {
  return chay(tien, async () => {
    const [mb, tcb, mbTx, tcbTx, vong] = await Promise.all([
      docKhoa(sb, "mb_latest", ctx),
      docKhoa(sb, "tcb_latest", ctx),
      docKhoa(sb, "mb_transactions", ctx),
      docKhoa(sb, "tcb_transactions", ctx),
      docKhoa(sb, "bank_loop_status", ctx),
    ]);
    const tm = tinhTienMat({
      mbLatest: mb, mbTx: Array.isArray(mbTx) ? mbTx : null,
      tcbLatest: tcb, tcbTx: Array.isArray(tcbTx) ? tcbTx : null,
      nhapTay: null,
    }, homNayVN());
    if (tm.tong == null) return oTrong(tien, `${tm.ghiChu.join(" ")} ${CHU.bankTx}`.trim());
    const asOf = tm.asOfCuNhat ? `${tm.asOfCuNhat}T00:00:00+07:00` : null;
    const nhip = vong && typeof vong === "object" ? (vong.at || vong.generatedAt || vong.updatedAt || null) : null;
    return oSo(tien, tm.tong, {
      den: tm.cuQua7Ngay ? "vang" : "xanh",
      trangThai: tm.cuQua7Ngay ? "cham" : "song",
      lyDo: [CHU.soPhu, CHU.bankTx, ...tm.ghiChu].join(" · ").replace(new RegExp(`\\.\\.\\.(\\d{${SO_CUOI_TK}})`, "g"), "****$1"),
      capNhatLuc: moiNhat([asOf, typeof nhip === "string" ? nhip : null]),
    });
  }, ctx);
}

export async function oCod(sb: any, ctx?: Ctx): Promise<O> {
  return chay(cod, async () => {
    const [rows, sum] = await Promise.all([
      docBang(sb, "jt_waybills", "cod_value, collect_time, is_void, status_group, updated_at"),
      docMot(sb, "jt_summary", "updated_at, data", (q) => q.eq("id", CAT.mot)).catch((e) => {
        if (laThieuBang(e)) return null;
        throw e;
      }),
    ]);
    const song = rows.filter((r) => r.is_void !== true && r.is_void !== "true");
    if (!song.length) return oTrong(cod, "chưa có vận đơn J&T còn sống");
    const chua = song.filter((r) => !r.collect_time && r.status_group !== "returned" && r.status_group !== "cancelled");
    const tienCod = chua.reduce((s, r) => s + (Number(r.cod_value) || 0), 0);
    return oSo(cod, Math.round(tienCod), {
      den: "xanh",
      lyDo: `${chua.length} vận đơn chưa có collect_time`,
      capNhatLuc: moiNhat([sum?.updated_at, ...song.map((r) => r.updated_at)]),
    });
  }, ctx);
}

export async function oLaiGop(sb: any, ctx?: Ctx): Promise<O> {
  return chay(lai, async () => { void sb; return oTrong(lai, CHU.laiGop); }, ctx);
}

export async function oChiAds(sb: any, ctx?: Ctx): Promise<O> {
  return chay(ads, async () => {
    const raw = await docKhoa(sb, "ads_campaigns", ctx);
    const ds = Array.isArray(raw?.campaigns) ? raw.campaigns : [];
    if (!raw || !ds.length) return oTrong(ads, CHU.adsToken);
    const tong = ds.reduce((s: number, c: any) => s + (Number(c.spend) || 0), 0);
    const hom = homNayVN();
    const ngay = Math.max(CAT.mot, Number(hom.slice(CAT.thang + CAT.mot)) || CAT.mot);
    const moiNgay = Math.round(tong / ngay);
    return oSo(ads, moiNgay, {
      den: "xanh",
      lyDo: "cron ads-spend ghi chi tháng vào ads_campaigns; ô lấy chi tháng chia số ngày đã qua trong tháng, chưa có cột chi từng ngày",
      capNhatLuc: raw.generatedAt || null,
    });
  }, ctx);
}

export async function oTc(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oTienMat(sb, ctx), await oCod(sb, ctx), await oLaiGop(sb, ctx), await oChiAds(sb, ctx)];
}
