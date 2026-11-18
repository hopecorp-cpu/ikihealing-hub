import { requireUser } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Eye, Star, Tag } from "lucide-react";
import Link from "next/link";
import { AckButton } from "./ack-button";
import QuizBlock from "./QuizBlock";
import { isManagerOrAbove } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function KbArticlePage({ params }: { params: { slug: string } }) {
  const user = await requireUser();
  const sb = getServiceClient();

  const { data: article } = await sb.from("kb_articles")
    .select("*, kb_categories(name, color, slug), users:author_id(full_name)")
    .eq("slug", params.slug)
    .eq("published", true)
    .maybeSingle();

  if (!article) notFound();

  await sb.from("kb_articles").update({ view_count: (article.view_count || 0) + 1 }).eq("id", article.id);

  const { data: readEntry } = await sb.from("kb_read_log")
    .select("*").eq("user_id", user.id).eq("article_id", article.id).maybeSingle();

  const { t } = getT();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/kb" className="text-sm text-gray-500 hover:text-brand-600 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> {t("Quay lại KB")}
      </Link>

      <article className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            {article.kb_categories && (
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ backgroundColor: (article.kb_categories.color || "#888") + "22", color: article.kb_categories.color || "#666" }}>
                {article.kb_categories.name}
              </span>
            )}
            {article.is_must_read && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-600" /> {t("Bắt buộc đọc")}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold">{t(article.title)}</h1>
          <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
            <span><Clock className="w-3 h-3 inline" /> {t("Cập nhật")} {new Date(article.updated_at).toLocaleDateString("vi-VN")}</span>
            <span><Eye className="w-3 h-3 inline" /> {article.view_count || 0} {t("lượt xem")}</span>
            {article.users?.full_name && <span>{t("Tác giả:")} {article.users.full_name}</span>}
          </div>
        </div>

        <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }} />

        {article.tags && article.tags.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            {article.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
            ))}
          </div>
        )}

        <QuizBlock articleId={article.id} laQuanLy={isManagerOrAbove((user as any).role)} />

        <AckButton articleId={article.id} alreadyRead={!!readEntry} />
      </article>
    </div>
  );
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
    .replace(/^> ?(.*)$/gm, '<blockquote class="border-l-4 border-amber-400 bg-amber-50 pl-3 py-0.5 text-gray-700 my-1">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>');
}
