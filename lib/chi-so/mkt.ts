import type { Ctx, O } from "./types";
import { CAT, CHU, GIO, MUC, MS, NGAY_TUAN } from "./muc-tieu";
import { chay, docBang, docNap, laThieuBang, oTuNap, oSo, oTrong, homNayVN, dauNgayIso, moiNhat, type Khung } from "./khung";

const seo: Khung = {
  key: "seo", phong: "MKT", ten: "SEO clicks, lượt hiện", donVi: "lượt",
  mucTieu: MUC.seo, nguon: "seo_url_ngay, seo_truy_van_ngay", tanSuat: "hằng tuần",
  nguongGio: GIO.hangTuan,
};
const geo: Khung = {
  key: "geo_tuan", phong: "MKT", ten: "GEO: số câu AI nhắc NOVA", donVi: "câu",
  mucTieu: MUC.geo, nguon: "geo-tuan csv", tanSuat: "hằng tuần",
  nguongGio: GIO.hangTuan,
};
const web: Khung = {
  key: "web_quiz", phong: "MKT", ten: "Người vào web, lead quiz", donVi: "lead",
  mucTieu: MUC.web, nguon: "GA4 web-ngay (chưa lưu bảng) + leads nguồn quiz", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const fb: Khung = {
  key: "fb_do_bai", phong: "MKT", ten: "Tiếp cận, tương tác bài FB", donVi: "lượt",
  mucTieu: MUC.fb, nguon: "do-bai.csv", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const bai: Khung = {
  key: "bai_tuan", phong: "MKT", ten: "Số bài xuất bản/tuần", donVi: "bài",
  mucTieu: MUC.bai, nguon: "content_items", tanSuat: "hằng tuần",
  nguongGio: GIO.hangTuan,
};

export async function oSeo(sb: any, ctx?: Ctx): Promise<O> {
  return chay(seo, async () => {
    let url: any[] = [];
    try {
      url = await docBang(sb, "seo_url_ngay", "ngay, clicks, impressions, cap_nhat_luc");
    } catch (e) {
      if (laThieuBang(e)) return oTrong(seo, CHU.seo);
      throw e;
    }
    const tv = await docBang(sb, "seo_truy_van_ngay", "ngay, clicks, impressions, cap_nhat_luc").catch((e) => {
      if (laThieuBang(e)) return [];
      throw e;
    });
    if (!url.length && !tv.length) return oTrong(seo, CHU.seo);
    const clicks = url.reduce((s, r) => s + (Number(r.clicks) || 0), 0) + tv.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
    const hien = url.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
    return oSo(seo, clicks, {
      den: "xanh",
      lyDo: `clicks ${clicks} · lượt hiện URL ${hien}`,
      capNhatLuc: moiNhat([...url, ...tv].map((r) => r.cap_nhat_luc)),
    });
  }, ctx);
}

export async function oGeo(sb: any, ctx?: Ctx): Promise<O> {
  return chay(geo, async () => {
    const nap = await docNap(sb, ctx);
    const o = oTuNap(geo, nap.geo_tuan, "máy đo GEO");
    if (o.trangThai === "chua-co-du-lieu") return { ...o, lyDo: `${o.lyDo} (${CHU.geo})` };
    return o;
  }, ctx);
}

export async function oWebQuiz(sb: any, ctx?: Ctx): Promise<O> {
  return chay(web, async () => {
    const dau = dauNgayIso(homNayVN());
    const leads = await docBang(sb, "leads", "source, channel, product, created_at", (q) => q.gte("created_at", dau));
    const quiz = leads.filter((r) => /quiz/i.test(`${r.source || ""} ${r.channel || ""} ${r.product || ""}`));
    if (!quiz.length) return oTrong(web, `${CHU.web}; chưa có lead quiz hôm nay`);
    return oSo(web, quiz.length, {
      den: "vang",
      lyDo: CHU.web,
      capNhatLuc: moiNhat(quiz.map((r) => r.created_at)),
    });
  }, ctx);
}

export async function oFb(sb: any, ctx?: Ctx): Promise<O> {
  return chay(fb, async () => {
    const nap = await docNap(sb, ctx);
    const o = oTuNap(fb, nap.fb_do_bai, "máy đo bài FB");
    if (o.trangThai === "chua-co-du-lieu") return { ...o, lyDo: `${o.lyDo} (${CHU.fb})` };
    return o;
  }, ctx);
}

export async function oBaiTuan(sb: any, ctx?: Ctx): Promise<O> {
  return chay(bai, async () => {
    const rows = await docBang(sb, "content_items", "status, publish_date", (q) => q.eq("status", "published"));
    if (!rows.length) return oTrong(bai, "content_items chưa có bài published");
    const moc = Date.now() - NGAY_TUAN * MS.ngay;
    const tuan = rows.filter((r) => r.publish_date && Date.parse(r.publish_date) >= moc);
    return oSo(bai, tuan.length, {
      den: "xanh",
      lyDo: tuan.length ? null : "không có bài published trong 7 ngày qua",
      capNhatLuc: moiNhat(rows.map((r) => r.publish_date)),
    });
  }, ctx);
}

export async function oMkt(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oSeo(sb, ctx), await oGeo(sb, ctx), await oWebQuiz(sb, ctx), await oFb(sb, ctx), await oBaiTuan(sb, ctx)];
}
