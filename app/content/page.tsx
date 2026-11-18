import { getServiceClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText, Eye, ThumbsUp, MessageSquare, Share2 } from "lucide-react";
import { getT } from "@/lib/i18n-server";
import PipelineBoard from "./PipelineBoard";
import GenerateNowButton from "./GenerateNowButton";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string }> = {
  idea: { label: "Ý tưởng", color: "bg-gray-100 text-gray-700" },
  draft: { label: "Đang viết", color: "bg-yellow-100 text-yellow-700" },
  review: { label: "Review", color: "bg-blue-100 text-blue-700" },
  scheduled: { label: "⏰ Đã lên lịch", color: "bg-purple-100 text-purple-700" },
  published: { label: "Đã đăng", color: "bg-green-100 text-green-700" },
  archived: { label: "Lưu trữ", color: "bg-gray-100 text-gray-500" }
};

export default async function ContentPage({ searchParams }: { searchParams: { ch?: string; status?: string; view?: string } }) {
  const { t } = getT();
  const user = await requireUser();
  if (!isManagerOrAbove(user.role) && !isMktPosition((user as any).position)) redirect("/?denied=content");

  const channelFilter = searchParams.ch ?? "";
  const statusFilter = searchParams.status ?? "all";

  const sb = getServiceClient();
  let q = sb.from("content_items").select("*, users!content_items_author_id_fkey(full_name)");
  if (channelFilter) q = q.eq("channel", channelFilter);
  if (statusFilter !== "all") q = q.eq("status", statusFilter);

  const { data: items } = await q.order("publish_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(100);

  const view = searchParams.view === "list" ? "list" : "kanban";
  const all = items ?? [];

  const { getReviews } = await import("@/lib/content-review");
  const reviews = await getReviews().catch(() => ({}));
  const laQuanLy = isManagerOrAbove(user.role);
  const boardItems = all.map((c: any) => ({
    id: c.id, title: c.title, channel: c.channel, type: c.type,
    content_brief: c.content_brief, status: c.status, publish_date: c.publish_date,
    published_url: c.published_url, notes: c.notes, author: c.users?.full_name || "",
  }));
  const totalReach = all.reduce((s: number, c: any) => s + (c.reach || 0), 0);
  const totalEngagement = all.reduce((s: number, c: any) => s + (c.likes || 0) + (c.comments || 0) + (c.shares || 0), 0);
  const published = all.filter((c: any) => c.status === "published").length;
  const scheduled = all.filter((c: any) => c.status === "scheduled").length;

  const channels = ["Facebook", "TikTok", "YouTube", "Zalo", "Blog", "Email", "Live"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-brand-600" /> {t("Pipeline nội dung")}</h1>
        <div className="flex items-center gap-3">
        <GenerateNowButton />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <a href={`/content${channelFilter ? `?ch=${channelFilter}` : ""}`} className={`px-3 py-1 rounded-md text-xs font-medium ${view === "kanban" ? "bg-white shadow-sm text-gray-800" : "text-gray-500"}`}>Pipeline</a>
          <a href={`/content?view=list${channelFilter ? `&ch=${channelFilter}` : ""}`} className={`px-3 py-1 rounded-md text-xs font-medium ${view === "list" ? "bg-white shadow-sm text-gray-800" : "text-gray-500"}`}>{t("Danh sách")}</a>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label={t("TỔNG CONTENT")} value={String(all.length)} color="#1a73e8" />
        <KPICard label={t("ĐÃ ĐĂNG")} value={String(published)} color="#10B981" />
        <KPICard label={t("LÊN LỊCH")} value={String(scheduled)} color="#8B5CF6" />
        <KPICard label={t("TỔNG REACH")} value={totalReach.toLocaleString("vi-VN")} color="#F59E0B" icon={Eye} />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <Pill href={`/content${view === "list" ? "?view=list" : ""}`} active={!channelFilter} label={t("Mọi kênh")} />
          {channels.map(ch => <Pill key={ch} href={`/content?ch=${ch}${view === "list" ? "&view=list" : ""}`} active={channelFilter === ch} label={ch} />)}
        </div>
        {view === "list" && (
        <div className="flex gap-2 flex-wrap">
          <Pill href={`/content?view=list${channelFilter ? `&ch=${channelFilter}` : ""}`} active={statusFilter === "all"} label={t("Mọi status")} />
          {Object.entries(STATUS).map(([s, info]) => (
            <Pill key={s} href={`/content?view=list&status=${s}${channelFilter ? `&ch=${channelFilter}` : ""}`} active={statusFilter === s} label={t(info.label)} />
          ))}
        </div>
        )}
      </div>

      {view === "kanban" && <PipelineBoard items={boardItems} reviews={reviews} laQuanLy={laQuanLy} />}

      {view === "list" && (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">{t("Tiêu đề")}</th>
              <th className="text-left p-3">{t("Kênh")}</th>
              <th className="text-left p-3">{t("Author")}</th>
              <th className="text-left p-3">{t("Status")}</th>
              <th className="text-left p-3">{t("Ngày đăng")}</th>
              <th className="text-right p-3">{t("Engagement")}</th>
            </tr>
          </thead>
          <tbody>
            {all.map((c: any) => {
  const { t: t } = getT();
              const stat = STATUS[c.status] || { label: c.status, color: "bg-gray-100" };
              const totalEng = (c.likes || 0) + (c.comments || 0) + (c.shares || 0);
              return (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium">{t(c.title)}</div>
                    {c.type && <div className="text-xs text-gray-500">{c.type}</div>}
                  </td>
                  <td className="p-3 text-xs">{c.channel}</td>
                  <td className="p-3 text-xs">{c.users?.full_name || "—"}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${stat.color}`}>{t(stat.label)}</span></td>
                  <td className="p-3 text-xs">{c.publish_date ? new Date(c.publish_date).toLocaleDateString("vi-VN") : "—"}</td>
                  <td className="p-3 text-right">
                    {c.status === "published" ? (
                      <div className="text-xs space-x-2">
                        <span>{c.reach?.toLocaleString("vi-VN") || 0}</span>
                        <span>{c.likes || 0}</span>
                        <span>{c.comments || 0}</span>
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
            {all.length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-gray-400">{t("Chưa có content nào — bấm \"+ Tạo content\" để bắt đầu")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function KPICard({ label, value, color, icon: Icon }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500 uppercase font-semibold">{label}</div>
        {Icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "22" }}><Icon className="w-4 h-4" style={{ color }} /></div>}
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function Pill({ href, active, label }: any) {
  return <a href={href} className={`px-3 py-1 rounded-md text-xs font-medium ${active ? "bg-brand-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>{label}</a>;
}
