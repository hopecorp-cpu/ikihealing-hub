import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { PageHeader } from "@/components/ui/kit";
import { BookOpenCheck, Quote } from "lucide-react";
import type { CustomerStory } from "@/lib/case-study";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Thư viện câu chuyện khách | ACME Ops Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let stories: CustomerStory[] = [];
  try {
    const raw = await getConfigValue("customer_stories");
    if (raw) stories = (JSON.parse(raw) as CustomerStory[]).slice().reverse();
  } catch {  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={t("Thư viện câu chuyện khách")}
        subtitle={t("Cảm nhận thật khách đã đồng ý chia sẻ — nguyên liệu viết bài và dẫn chứng khi tư vấn")}
        icon={BookOpenCheck}
        actions={<div className="px-3 py-1.5 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700">{stories.length} {t("câu chuyện")}</div>}
      />

      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-[12.5px] text-amber-800">
        {t("Khi dùng lại: đổi tên khách thành tên viết tắt, chỉ kể hành trình THÓI QUEN và cảm nhận dịch vụ.\n        Tuyệt đối không thêm kết quả sức khoẻ, không dùng làm bằng chứng công dụng.")}
      </div>

      {stories.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-[13px] text-gray-500">
          {t("Kho đang trống. Máy tự giao việc xin cảm nhận cho sale khi khách quay lại mua lần thứ 2 —\n          sale dán câu trả lời của khách vào bình luận của việc rồi bấm hoàn thành là câu chuyện tự về đây.")}
        </div>
      )}

      <div className="space-y-3">
        {stories.map((s) => (
          <article key={s.task_id} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[13.5px] font-bold text-gray-800">{s.customer}</span>
              <span className="text-[11.5px] text-gray-400">{s.at}{s.sale ? ` · ghi nhận bởi ${s.sale}` : ""}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Quote className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
              <p className="text-[13px] text-gray-600 whitespace-pre-wrap leading-relaxed">{s.story}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
