import type { Ctx, O } from "./types";
import { CAT, CHU, GIO, MOT_TRAM, MUC, NGUONG_SAP_HET } from "./muc-tieu";
import { chay, docBang, docKhoa, oSo, oTrong, moiNhat, homNayVN, thangCua, type Khung } from "./khung";

const hoan: Khung = {
  key: "hoan_jt", phong: "VHSP", ten: "Tỉ lệ hoàn J&T", donVi: "%",
  mucTieu: MUC.hoanJt, nguon: "jt_waybills (is_void=false)", tanSuat: "2 lần/ngày",
  nguongGio: GIO.haiLan, watchdog: "jt_waybills",
};
const hong: Khung = {
  key: "that_bai_jt", phong: "VHSP", ten: "Giao thất bại J&T", donVi: "vận đơn",
  mucTieu: MUC.thatBaiJt, nguon: "jt_waybills (status_group=other, đơn vấn đề)", tanSuat: "2 lần/ngày",
  nguongGio: GIO.haiLan, watchdog: "jt_waybills",
};
const kho: Khung = {
  key: "ton_kho", phong: "VHSP", ten: "Tồn kho theo sản phẩm", donVi: "SKU",
  mucTieu: MUC.tonKho, nguon: "config misa_stock", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const ket: Khung = {
  key: "don_ket", phong: "VHSP", ten: "Đơn kẹt chưa giao quá 24h", donVi: "đơn",
  mucTieu: MUC.donKet, nguon: "chưa có hệ kho/đơn thống nhất", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};

function song(r: any): boolean {
  return r?.is_void !== true && r?.is_void !== "true";
}

export async function oHoanJt(sb: any, ctx?: Ctx): Promise<O> {
  return chay(hoan, async () => {
    const rows = await docBang(sb, "jt_waybills", "is_void, status_group, order_create_time, updated_at");
    const thang = thangCua(homNayVN());
    const dung = rows.filter((r) => {
      if (!song(r) || !r.order_create_time) return false;
      const t = Date.parse(r.order_create_time);
      if (!Number.isFinite(t)) return false;
      return homNayVN(new Date(t)).slice(CAT.khong, CAT.thang) === thang;
    });
    if (!dung.length) return oTrong(hoan, "chưa có vận đơn J&T trong tháng (is_void=false)");
    const hoanN = dung.filter((r) => r.status_group === "returned").length;
    const ty = Math.round((hoanN * MOT_TRAM) / dung.length);
    return oSo(hoan, ty, {
      den: "xanh",
      lyDo: `${hoanN}/${dung.length} vận đơn hoàn trong tháng`,
      capNhatLuc: moiNhat(dung.map((r) => r.updated_at || r.order_create_time)),
    });
  }, ctx);
}

export async function oThatBaiJt(sb: any, ctx?: Ctx): Promise<O> {
  return chay(hong, async () => {
    const rows = await docBang(sb, "jt_waybills", "is_void, status_group, updated_at, order_create_time");
    const thang = thangCua(homNayVN());
    const dung = rows.filter((r) => {
      if (!song(r) || !r.order_create_time) return false;
      const t = Date.parse(r.order_create_time);
      if (!Number.isFinite(t)) return false;
      return homNayVN(new Date(t)).slice(CAT.khong, CAT.thang) === thang;
    });
    if (!dung.length) return oTrong(hong, "chưa có vận đơn J&T trong tháng");
    const n = dung.filter((r) => r.status_group === "other").length;
    return oSo(hong, n, {
      den: n > CAT.khong ? "vang" : "xanh",
      lyDo: "trong tháng: status_group=other (mapStatus jt-fetch: đơn vấn đề), không gồm hoàn",
      capNhatLuc: moiNhat(dung.map((r) => r.updated_at)),
    });
  }, ctx);
}

export async function oTonKho(sb: any, ctx?: Ctx): Promise<O> {
  return chay(kho, async () => {
    const raw = await docKhoa(sb, "misa_stock", ctx);
    const items = Array.isArray(raw?.items) ? raw.items : [];
    if (!items.length) return oTrong(kho, "config misa_stock trống — job misa-stock chưa ghi");
    let het = 0;
    let sap = 0;
    for (const it of items) {
      const q = Number(it?.closing);
      if (!Number.isFinite(q)) continue;
      if (q <= CAT.khong) het += CAT.mot;
      else if (q <= NGUONG_SAP_HET) sap += CAT.mot;
    }
    return oSo(kho, het + sap, {
      den: het > CAT.khong ? "do" : sap > CAT.khong ? "vang" : "xanh",
      lyDo: `${het} SKU hết, ${sap} sắp hết (tồn dương và không quá ngưỡng cockpit). ${CHU.misaKho}`,
      capNhatLuc: raw?.generatedAt || null,
    });
  }, ctx);
}

export async function oDonKet(sb: any, ctx?: Ctx): Promise<O> {
  return chay(ket, async () => { void sb; return oTrong(ket, CHU.donKet); }, ctx);
}

export async function oVhsp(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oHoanJt(sb, ctx), await oThatBaiJt(sb, ctx), await oTonKho(sb, ctx), await oDonKet(sb, ctx)];
}
