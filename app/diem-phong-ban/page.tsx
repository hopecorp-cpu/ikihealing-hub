import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { buildScoreboard, type Light } from "@/lib/dept-scoreboard";
import { LayoutGrid, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Điểm phòng ban | IKIHEALING Hub") };
}

const DOT: Record<Light, string> = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500", gray: "bg-gray-300" };
const RING: Record<Light, string> = {
  green: "border-emerald-200", yellow: "border-amber-200", red: "border-red-200", gray: "border-gray-200",
};

export default async function Page() {
  const { t: t, locale } = getT();

  const tv = (v: string) => locale === "vi" ? v : locale === "ja"
    ? v.replace("(kỳ vọng", "(期待値").replace(/ ngày$/, "日").replace(/^chưa có$/, "なし")
    : v.replace("(kỳ vọng", "(expected").replace(/ ngày$/, " days").replace(/^chưa có$/, "n/a");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=diem-phong-ban");

  const { month, cards } = await buildScoreboard();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutGrid className="w-6 h-6 text-brand-600" /> {t("Điểm phòng ban")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Sức khoẻ mỗi phòng đọc từ dữ liệu sống — tháng")} {month}{t(". Đèn xanh/vàng/đỏ = ổn / cần chú ý / gấp.")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link key={c.key} href={c.link} className={`group bg-white border rounded-xl p-4 hover:shadow-sm transition ${RING[c.light]}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${DOT[c.light]}`} />
                <span className="font-semibold">{t(c.name)}</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500" />
            </div>
            <div className="space-y-1.5">
              {c.metrics.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t(m.label)}</span>
                  <span className={`font-medium text-gray-900 tabular-nums${/đ$/.test(m.value) ? " sensitive" : ""}`}>{tv(m.value)}</span>
                </div>
              ))}
              {c.metrics.length === 0 && <div className="text-sm text-gray-400">{t("Chưa có dữ liệu.")}</div>}
            </div>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">{t(c.note)}</p>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400">{t("Nguồn: Vòng lặp doanh thu, Lead SLA, pool chưa trả lời (FB/Zalo), care tới hạn, sổ phụ ngân hàng, tồn kho MISA. Bấm thẻ để xem chi tiết phòng.")}</p>
    </div>
  );
}
