import { requireUser } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { Search, BookOpen, Star, Clock } from "lucide-react";
import Link from "next/link";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function KbPage({ searchParams }: { searchParams: { q?: string; cat?: string } }) {
  const user = await requireUser();
  const sb = getServiceClient();

  const search = searchParams.q?.trim() || "";
  const cat = searchParams.cat || "";

  const { data: categories } = await sb.from("kb_categories").select("*").order("sort_order");

  let q = sb.from("kb_articles").select("*, kb_categories(name, color)").eq("published", true);
  if (cat) q = q.eq("category_id", cat);
  if (search) q = q.or(`title.ilike.%${search}%,content.ilike.%${search}%`);

  const { data: articles } = await q.order("is_must_read", { ascending: false }).order("updated_at", { ascending: false }).limit(100);

  const { data: readLog } = await sb.from("kb_read_log").select("article_id").eq("user_id", user.id);
  const readIds = new Set((readLog ?? []).map((r: any) => r.article_id));

  const mustRead = (articles ?? []).filter((a: any) => a.is_must_read);
  const mustReadUnread = mustRead.filter((a: any) => !readIds.has(a.id));

  const { t } = getT();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-brand-600" /> {t("Knowledge Base — ACME Wiki")}
        </h1>
      </div>

      <form className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" name="q" defaultValue={search}
            placeholder={t("Tìm bài viết... VD: 'xử lý KH giá cao', 'quy trình xin nghỉ', 'Sản phẩm A'")}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
        </div>
        <button className="px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold">{t("Tìm")}</button>
      </form>

      {mustReadUnread.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-yellow-600 fill-yellow-500" />
            <h3 className="font-semibold text-yellow-900">{t("Bài bắt buộc đọc")} ({mustReadUnread.length})</h3>
          </div>
          <div className="space-y-1">
            {mustReadUnread.map((a: any) => (
              <Link key={a.id} href={`/kb/${a.slug}`}
                className="block bg-white hover:bg-yellow-100 p-2 rounded text-sm font-medium border border-yellow-200">
                {t(a.title)}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <a href="/kb" className={`p-3 rounded-lg text-sm font-medium ${!cat ? "bg-brand-50 text-brand-700 border-2 border-brand-300" : "bg-white border border-gray-200 hover:bg-gray-50"}`}>
          {t("Tất cả")} ({articles?.length || 0})
        </a>
        {(categories ?? []).map((c: any) => (
          <a key={c.id} href={`/kb?cat=${c.id}`}
            className={`p-3 rounded-lg text-sm font-medium ${cat === c.id ? "bg-brand-50 text-brand-700 border-2 border-brand-300" : "bg-white border border-gray-200 hover:bg-gray-50"}`}>
            {c.name}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(articles ?? []).map((a: any) => (
          <Link key={a.id} href={`/kb/${a.slug}`}
            className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5 hover:shadow-md transition group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-bold flex-1 group-hover:text-brand-700">
                {a.is_must_read && <Star className="w-4 h-4 inline mr-1 text-yellow-500 fill-yellow-500" />}
                {t(a.title)}
              </div>
              {readIds.has(a.id) && <span className="text-xs text-green-600">{t("✓ Đã đọc")}</span>}
            </div>
            {a.excerpt && <p className="text-sm text-gray-600 line-clamp-2">{a.excerpt}</p>}
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              {a.kb_categories?.name && (
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: (a.kb_categories.color || "#888") + "22", color: a.kb_categories.color || "#666" }}>
                  {a.kb_categories.name}
                </span>
              )}
              <span><Clock className="w-3 h-3 inline" /> {new Date(a.updated_at).toLocaleDateString("vi-VN")}</span>
              {a.view_count > 0 && <span>{a.view_count}</span>}
            </div>
          </Link>
        ))}
        {(!articles || articles.length === 0) && (
          <div className="md:col-span-2 text-center py-12 text-gray-400">
            {search ? `${t("Không tìm thấy bài viết cho")} "${search}"` : t("Chưa có bài viết")}
          </div>
        )}
      </div>
    </div>
  );
}
