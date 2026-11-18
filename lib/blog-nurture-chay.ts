import { getConfigValue } from "@/lib/app-config";
import { getLeads, markSent, DRIP, guiEmailNuoi, mauDaDuyet, bamMau, type Lead } from "@/lib/blog-nurture";
import { quyetDinhBuoc, BUOC, type LyDoBoQua } from "@/lib/blog-nurture-luat";
import { kiemTran, type LyDoChan } from "@/lib/email-nhip-luat";
import { layLichSuGui } from "@/lib/email-nhip";

export type KetQuaChay = {
  kho: boolean; luc: string; leads: number;
  mau: { khop: number[]; lech: number[]; chuaCo: number[] };
  duDieuKienTheoBuoc: Record<string, number>;
  chan: Record<LyDoBoQua | LyDoChan | "thieu-nhat-ky-gui" | "da-tu-choi", number>;
  seGuiTheoBuoc: Record<string, number>;
  guiThat: number; loi: number; loiMau?: string;
};

export async function chayBlogNurture(o: { kho: boolean; now?: number }): Promise<KetQuaChay> {
  const now = o.now ?? Date.now();
  const leads: Lead[] = await getLeads();
  let soMoi: Record<string, { at?: string }> = {};
  try { soMoi = JSON.parse((await getConfigValue("thu_moi_mua_dau_so")) || "{}"); } catch { soMoi = {}; }

  const mau = { khop: [] as number[], lech: [] as number[], chuaCo: [] as number[] };
  for (const d of DRIP) { if (!d.duyet) mau.chuaCo.push(d.day); else if (mauDaDuyet(d)) mau.khop.push(d.day); else mau.lech.push(d.day); }
  const duyet = new Set(mau.khop);

  const kq: KetQuaChay = {
    kho: o.kho, luc: new Date(now).toISOString(), leads: leads.length, mau,
    duDieuKienTheoBuoc: Object.fromEntries(BUOC.map((b) => [String(b), 0])),
    chan: {} as any, seGuiTheoBuoc: Object.fromEntries(BUOC.map((b) => [String(b), 0])), guiThat: 0, loi: 0,
  };
  const dem = (k: string) => { (kq.chan as any)[k] = ((kq.chan as any)[k] || 0) + 1; };

  for (const lead of leads) {
    const qd = quyetDinhBuoc(lead, now, duyet);
    if ("boQua" in qd) { dem(qd.boQua); continue; }
    kq.duDieuKienTheoBuoc[String(qd.buoc)]++;
    const step = DRIP.find((d) => d.day === qd.buoc)!;

    const lichSu = await layLichSuGui(lead.email, { leads, soMoi, now });
    if (!lichSu) { dem("thieu-nhat-ky-gui"); continue; }
    const kt = kiemTran(lichSu, now, step.neuSanPham);
    if (!kt.ok) { dem(kt.lyDo); continue; }
    kq.seGuiTheoBuoc[String(qd.buoc)]++;
    if (o.kho) continue;
    const r = await guiEmailNuoi(lead.email, step.subject, step.html(lead.id), {
      quangCao: step.day > 0, nhip: { luong: "blog-nurture", mau: `ngay-${step.day}`, neuSanPham: step.neuSanPham },
    });
    if (r.ok) { await markSent(lead.email, step.day, now); kq.guiThat++; }
    else if (r.boQua) { kq.seGuiTheoBuoc[String(qd.buoc)]--; dem(r.boQua as any); }
    else kq.loi++;
    await new Promise((res) => setTimeout(res, 200));
  }
  if (mau.lech.length) kq.loiMau = `mẫu lệch băm (sửa chữ sau khi duyệt?): ngày ${mau.lech.join(", ")} — băm hiện tại ${mau.lech.map((d) => bamMau(DRIP.find((x) => x.day === d)!).slice(0, 12) + "…").join(", ")}`;
  return kq;
}
