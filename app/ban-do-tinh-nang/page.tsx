import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { visibleGroups } from "@/lib/feature-map";
import { PageHeader } from "@/components/ui/kit";
import { MapIcon, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bản đồ tính năng | ACME Ops Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const groups = visibleGroups(isManagerOrAbove(user.role));

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={t("Bản đồ tính năng")}
        subtitle={t("Cần làm việc gì thì vào trang nào — mỗi mục một câu, không cần hỏi ai")}
        icon={MapIcon}
      />
      <p className="text-[13px] text-gray-500 max-w-3xl">
        {t("Thanh bên trái chia theo phòng ban, còn trang này chia theo VIỆC CẦN LÀM. Mục nào bạn không đủ quyền sẽ tự ẩn.\n        Trang mới được thêm sẽ xuất hiện ở đây kèm nhãn Mới.")}
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g.key} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-50" style={{ background: `${g.color}0D` }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                <span className="text-sm font-bold text-gray-800">{t(g.title)}</span>
              </div>
              <p className="text-[11.5px] text-gray-500 mt-1">{t(g.intro)}</p>
            </div>
            <div className="p-3 space-y-2.5 flex-1">
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className="block group">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold text-gray-800 group-hover:text-emerald-700 transition">{t(it.label)}</span>
                    {it.moi && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{t("Mới")}</span>}
                    <ArrowUpRight className="w-3 h-3 text-gray-300 group-hover:text-emerald-600 transition" />
                  </div>
                  <div className="text-[12px] text-gray-500 leading-snug">{t(it.desc)}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
