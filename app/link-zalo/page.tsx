import { getT } from "@/lib/i18n-server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth-server";
import { PageHeader, SectionCard } from "@/components/ui/kit";
import { Link2 } from "lucide-react";
import { baoDamLinkZalo, layKhoLink, linkDan } from "@/lib/kenh-dan-duong";
import { taoMaNguon } from "@/lib/ma-nguon";
import { vnDateStr } from "@/lib/payroll";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Link mời Zalo | ACME Ops Hub") };
}

const KENH = [
  ["fb-nova", "Fanpage NOVA"], ["fb-thanhtam", "Fanpage Lan"], ["yt", "YouTube chính"],
  ["yt-phu", "YouTube phụ"], ["tiktok", "TikTok"], ["hm", "Nhân vật Mẫu"], ["web", "Web / blog"],
] as const;

async function taoLink(form: FormData) {
  "use server";
  await requireManager();
  const kenh = String(form.get("kenh") || "");
  const ten = String(form.get("ten") || "").trim().slice(0, 40);
  const sdt = String(form.get("sdt") || "");
  if (!KENH.some(([m]) => m === kenh) || !ten) return;
  await baoDamLinkZalo(kenh, ten, sdt);
  revalidatePath("/link-zalo");
}

export default async function Page() {
  const { t: tDich } = getT();
  await requireManager();
  const kho = await layKhoLink();
  const links = kho.links.filter((l) => l.slug.startsWith("zalo-"));
  const homNay = vnDateStr();
  const tenKenh = (m: string) => KENH.find(([k]) => k === m)?.[1] || m;
  const o = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader icon={Link2} title={tDich("Link mời Zalo")} subtitle={tDich("Mỗi kênh, mỗi sale một link — khách bấm là máy đếm rồi mở Zalo của sale")} />

      <SectionCard>
        <form action={taoLink} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <label className="text-sm space-y-1">
            <span className="text-gray-600">{tDich("Kênh")}</span>
            <select name="kenh" className={o} required>
              {KENH.map(([m, t]) => <option key={m} value={m}>{t}</option>)}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-gray-600">{tDich("Tên sale")}</span>
            <input name="ten" className={o} placeholder={tDich("Sơn")} required maxLength={40} />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-gray-600">{tDich("Số Zalo của sale")}</span>
            <input name="sdt" className={o} placeholder="09xx xxx xxx" required inputMode="tel" />
          </label>
          <button type="submit" className="rounded-lg bg-[#0068FF] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {tDich("Tạo link")}
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-500">{tDich("Cùng kênh + cùng tên sale thì ra lại đúng link cũ (đổi số chỉ đổi đích, giữ số đếm).")}</p>
        <p className="mt-1 text-xs text-gray-500">{tDich("Mã nguồn: Zalo không mang tham số vào cuộc chat, nên đặt mã vào câu mở đầu soạn sẵn cho khách gửi. Tin đầu có mã thì lead đọc ra đúng kênh (đo được, không phải đoán). Messenger dùng m.me/<page>?ref=<mã>.")}</p>
      </SectionCard>

      <SectionCard>
        {links.length === 0 ? (
          <p className="text-sm text-gray-600">{tDich("Chưa có link nào.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">{tDich("Kênh")}</th><th className="py-2 pr-3">Sale</th>
                  <th className="py-2 pr-3">{tDich("Link dán vào bài/tin")}</th>
                  <th className="py-2 pr-3">{tDich("Mã nguồn")}</th>
                  <th className="py-2 pr-3 text-right">{tDich("Hôm nay")}</th><th className="py-2 text-right">{tDich("Tổng bấm")}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.ma} className="border-b last:border-0">
                    <td className="py-2 pr-3">{tenKenh(l.kenh)}</td>
                    <td className="py-2 pr-3">{(tDich(l.tieuDe) || "").replace(/^Zalo /, "")}</td>
                    <td className="py-2 pr-3 select-all text-[#0068FF]">{linkDan(l.ma)}</td>
                    <td className="py-2 pr-3 select-all text-gray-700">{taoMaNguon(l.kenh, l.slug)}</td>
                    <td className="py-2 pr-3 text-right">{l.bamTheoNgay?.[homNay] || 0}</td>
                    <td className="py-2 text-right font-semibold">{l.bam || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
