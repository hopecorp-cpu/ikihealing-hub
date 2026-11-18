import type { Ctx, O } from "./types";
import { CHU, GIO, MUC } from "./muc-tieu";
import { chay, docNap, oTuNap, oTrong, type Khung } from "./khung";

const logo: Khung = {
  key: "anh_duyet_logo", phong: "TH", ten: "Ảnh/bài có logo và băm khớp duyệt", donVi: "%",
  mucTieu: MUC.logo, nguon: "manifest duyệt ảnh", tanSuat: "mỗi bài",
  nguongGio: GIO.moiDon,
};
const claim: Khung = {
  key: "vi_pham_claim", phong: "TH", ten: "Vi phạm claim", donVi: "bài",
  mucTieu: MUC.claim, nguon: "rà TH-ALEX-01", tanSuat: "hằng tuần",
  nguongGio: GIO.hangTuan,
};
const duyet: Khung = {
  key: "th_duyet_dung_han", phong: "TH", ten: "Bài TH duyệt đúng hạn", donVi: "bài",
  mucTieu: MUC.thDuyet, nguon: "bang-viec.md", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};

export async function oLogo(sb: any, ctx?: Ctx): Promise<O> {
  return chay(logo, async () => oTuNap(logo, (await docNap(sb, ctx)).anh_duyet_logo, "máy duyệt ảnh"), ctx);
}

export async function oClaim(sb: any, ctx?: Ctx): Promise<O> {
  return chay(claim, async () => { void sb; return oTrong(claim, CHU.claim); }, ctx);
}

export async function oDuyetHan(sb: any, ctx?: Ctx): Promise<O> {
  return chay(duyet, async () => oTuNap(duyet, (await docNap(sb, ctx)).th_duyet_dung_han, "máy sổ việc"), ctx);
}

export async function oTh(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oLogo(sb, ctx), await oClaim(sb, ctx), await oDuyetHan(sb, ctx)];
}
