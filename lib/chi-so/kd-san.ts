import type { Ctx, O } from "./types";
import { CAT, CHU, GIO, GMV_TTS_T10_VND, MUC } from "./muc-tieu";
import {
  chay, docBang, docNap, laThieuBang, oTuNap, oSo, oTrong, homNayVN, dauNgayIso, thangCua, moiNhat, type Khung,
} from "./khung";

const gmv: Khung = {
  key: "gmv_tts", phong: "KD-SÀN", ten: "GMV TikTok Shop luỹ kế tháng", donVi: "đồng",
  mucTieu: MUC.gmvTts, nguon: "tts_orders", tanSuat: "hằng ngày",
  nhayCam: true, nguongGio: GIO.hangNgay,
};
const donSan: Khung = {
  key: "don_san", phong: "KD-SÀN", ten: "Số đơn sàn/ngày, đơn chuyển Sơn, lỗi bot", donVi: "đơn",
  mucTieu: MUC.donSan, nguon: "don_san + iMac ~/.acme-bot-don-san/logs/", tanSuat: "15 phút",
  nguongGio: GIO.phut15,
};
const lai: Khung = {
  key: "lai_rong_san", phong: "KD-SÀN", ten: "Lãi ròng sàn %", donVi: "%",
  mucTieu: MUC.laiRongSan, nguon: "chưa có bảng phí sàn", tanSuat: "hằng tuần",
  nguongGio: GIO.hangTuan,
};
const hoan: Khung = {
  key: "hoan_san", phong: "KD-SÀN", ten: "Tỉ lệ hoàn / giao thất bại sàn", donVi: "%",
  mucTieu: MUC.hoanSan, nguon: "chưa có", tanSuat: "hằng tuần",
  nguongGio: GIO.hangTuan,
};
const roas: Khung = {
  key: "roas_gmv_max", phong: "KD-SÀN", ten: "ROAS GMV Max", donVi: "lần",
  mucTieu: MUC.roas, nguon: "chưa có", tanSuat: "hằng ngày khi chạy",
  nguongGio: GIO.hangNgay,
};

function trongThang(iso: unknown, thang: string): boolean {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return false;
  return homNayVN(new Date(t)).slice(CAT.khong, CAT.thang) === thang;
}

export async function oGmvTts(sb: any, ctx?: Ctx): Promise<O> {
  return chay(gmv, async () => {
    const rows = await docBang(sb, "tts_orders", "total_amount, create_time, updated_at");
    if (!rows.length) return oTrong(gmv, CHU.gmv);
    const thang = thangCua(homNayVN());
    const dung = rows.filter((r) => trongThang(r.create_time, thang));
    if (!dung.length) return oTrong(gmv, CHU.gmv);
    const tien = dung.reduce((s, r) => s + (Number(r.total_amount) || CAT.khong), CAT.khong);
    return oSo(gmv, Math.round(tien), {
      den: tien >= GMV_TTS_T10_VND ? "xanh" : "vang",
      lyDo: null,
      capNhatLuc: moiNhat(dung.map((r) => r.updated_at || r.create_time)),
    });
  }, ctx);
}

export async function oDonSan(sb: any, ctx?: Ctx): Promise<O> {
  return chay(donSan, async () => {
    const nap = await docNap(sb, ctx);
    const file = oTuNap({ ...donSan, key: "bot_don_san" }, nap.bot_don_san, "iMac");
    let dem: number | null = null;
    let loiBang: string | null = null;
    try {
      const dau = dauNgayIso(homNayVN());
      const rows = await docBang(sb, "don_san", "id, created_at", (q) => q.gte("created_at", dau));
      dem = rows.length;
    } catch (e) {
      if (!laThieuBang(e)) throw e;
      loiBang = "chưa có bảng don_san trên Supabase, chưa tách được đơn chuyển Sơn";
    }
    if (dem == null && file.trangThai === "chua-co-du-lieu") {
      return oTrong(donSan, `${loiBang}. ${file.lyDo}`);
    }
    if (dem == null) return { ...file, key: donSan.key, ten: donSan.ten, phong: donSan.phong, lyDo: loiBang };
    const ly = [loiBang, file.trangThai === "chua-co-du-lieu" ? file.lyDo : `log bot: ${file.giaTri}`].filter(Boolean).join(" · ");
    return oSo(donSan, dem, { den: "xanh", lyDo: ly || null, capNhatLuc: file.capNhatLuc });
  }, ctx);
}

export async function oLaiRongSan(sb: any, ctx?: Ctx): Promise<O> {
  return chay(lai, async () => { void sb; return oTrong(lai, CHU.laiSan); }, ctx);
}

export async function oHoanSan(sb: any, ctx?: Ctx): Promise<O> {
  return chay(hoan, async () => { void sb; return oTrong(hoan, CHU.hoanSan); }, ctx);
}

export async function oRoas(sb: any, ctx?: Ctx): Promise<O> {
  return chay(roas, async () => { void sb; return oTrong(roas, CHU.roas); }, ctx);
}

export async function oKdSan(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oGmvTts(sb, ctx), await oDonSan(sb, ctx), await oLaiRongSan(sb, ctx), await oHoanSan(sb, ctx), await oRoas(sb, ctx)];
}
