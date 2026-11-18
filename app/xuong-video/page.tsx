import { requireManager } from "@/lib/auth-server";
import { dsMa, dsViec, linkXem, tuCam } from "@/lib/xuong-video-server";
import { KHOA_NHIP } from "@/lib/xuong-video";
import { getConfigValue } from "@/lib/app-config";
import XuongVideoClient from "./XuongVideoClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Xưởng video đại lý | ACME Ops Hub" };

export default async function Page() {
  await requireManager();
  let loi = "";
  let viec: Awaited<ReturnType<typeof dsViec>> = [];
  let ma: { id: string; ten: string; tao_luc: string; thu_hoi?: string }[] = [];
  let link: Record<string, string> = {};
  let nhip: any = null;
  try {
    [viec, ma] = await Promise.all([dsViec(), dsMa().then((d) => d.map(({ bam: _b, ...x }) => x))]);
    viec = viec.slice(0, 60);
    link = await linkXem(viec.flatMap((v) => (v.ket_qua || []).map((k) => k.path)));
    try { nhip = JSON.parse((await getConfigValue(KHOA_NHIP)) || "null"); } catch { nhip = null; }
  } catch (e: any) { loi = String(e?.message || e); }
  const cam: Record<string, string[]> = {};
  for (const v of viec) for (const k of v.ket_qua || []) cam[k.path] = tuCam(k.chu);
  return <XuongVideoClient viec={viec} ma={ma} link={link} cam={cam} nhip={nhip} loiDoc={loi} />;
}
