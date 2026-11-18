import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getLeads, leadStats } from "@/lib/blog-nurture";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { Mail, BookOpen, Download, MousePointerClick, Users, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

function vn(ts: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const nPhone = (p?: string) => (p || "").replace(/[^0-9]/g, "").replace(/^84/, "0");
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";

export default async function BlogLeadsPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove((user as any).role)) redirect("/");

  const leads = (await getLeads()).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const phones = new Set(leads.map((l) => nPhone(l.phone)).filter(Boolean));
  const orderByPhone: Record<string, { count: number; total: number }> = {};
  if (phones.size) {
    try {
      const sb = getServiceClient();
      const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const { rows } = await layDoanhThuNhieuThang(sb, "2026-03-01", homNay);
      const seen: Record<string, Set<string>> = {};
      for (const r of rows) {
        const p = nPhone(r.customer_phone || "");
        if (!p || !phones.has(p)) continue;
        if (!orderByPhone[p]) { orderByPhone[p] = { count: 0, total: 0 }; seen[p] = new Set(); }
        orderByPhone[p].total += Number(r.net_amount) || 0;
        if (r.order_code && !seen[p].has(r.order_code)) { seen[p].add(r.order_code); orderByPhone[p].count++; }
      }
    } catch {  }
  }

  const s = leads.map((l) => ({ l, st: leadStats(l), order: orderByPhone[nPhone(l.phone)] }));
  const tot = leads.length;
  const opened = s.filter((x) => x.st.opened).length;
  const readers = s.filter((x) => x.st.read.length > 0).length;
  const downloaded = s.filter((x) => x.st.downloaded).length;
  const clickers = s.filter((x) => x.st.clicks > 0).length;
  const ordered = s.filter((x) => x.order && x.order.count > 0).length;

  const Card = ({ icon: I, label, val, sub }: any) => (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex items-center gap-2 text-gray-500 text-sm"><I size={16} />{label}</div>
      <div className="text-2xl font-bold mt-1">{val}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{t("Khách từ Blog (Lead magnet)")}</h1>
      <p className="text-gray-500 text-sm mb-4">{t("Theo dõi từng khách để lại email: mở mail, đọc bài, click sản phẩm, tải cẩm nang.")}</p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        <Card icon={Users} label={t("Tổng lead")} val={tot} />
        <Card icon={Mail} label={t("Đã mở email")} val={opened} sub={tot ? `${Math.round((opened / tot) * 100)}%` : ""} />
        <Card icon={BookOpen} label={t("Đã đọc bài")} val={readers} sub={tot ? `${Math.round((readers / tot) * 100)}%` : ""} />
        <Card icon={MousePointerClick} label={t("Click sản phẩm/app")} val={clickers} />
        <Card icon={Download} label={t("Tải cẩm nang")} val={downloaded} />
        <Card icon={ShoppingCart} label={t("Đã ra đơn")} val={ordered} sub={tot ? `${Math.round((ordered / tot) * 100)}%` : ""} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">{t("SĐT")}</th>
              <th className="p-3 font-medium">{t("Đăng ký")}</th>
              <th className="p-3 font-medium">{t("Mở email")}</th>
              <th className="p-3 font-medium">{t("Đọc bài")}</th>
              <th className="p-3 font-medium">Click</th>
              <th className="p-3 font-medium">{t("Tải PDF")}</th>
              <th className="p-3 font-medium">{t("Ra đơn")}</th>
              <th className="p-3 font-medium">{t("Hoạt động cuối")}</th>
            </tr>
          </thead>
          <tbody>
            {s.map(({ l, st, order }) => (
              <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="p-3 font-medium">{l.email}</td>
                <td className="p-3 text-gray-500">{l.phone || <span className="text-gray-300">—</span>}</td>
                <td className="p-3 text-gray-500">{vn(l.ts)}</td>
                <td className="p-3">{st.opened ? <span className="text-emerald-600 font-semibold">✓</span> : <span className="text-gray-300">—</span>}</td>
                <td className="p-3">{st.read.length ? <span title={st.read.join(", ")} className="text-emerald-600 font-semibold">{st.read.length} {t("bài")}</span> : <span className="text-gray-300">—</span>}</td>
                <td className="p-3">{st.clicks ? <span className="text-emerald-600 font-semibold">{st.clicks}</span> : <span className="text-gray-300">—</span>}</td>
                <td className="p-3">{st.downloaded ? <span className="text-emerald-600 font-semibold">✓</span> : <span className="text-gray-300">—</span>}</td>
                <td className="p-3">{order && order.count ? <span className="text-emerald-700 font-semibold" title={fmt(order.total)}>{order.count} {t("đơn")}</span> : <span className="text-gray-300">—</span>}</td>
                <td className="p-3 text-gray-500">{vn(st.lastActive)}</td>
              </tr>
            ))}
            {!leads.length && <tr><td colSpan={9} className="p-6 text-center text-gray-400">{t("Chưa có lead nào.")}</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {t("\"Đọc bài / Click / Tải\" đo qua beacon gắn mã lead trong link email. \"Ra đơn\" khớp SĐT lead với sổ đơn (chỉ lead có để lại SĐT). \"Mở email\" cần bật Open Tracking trong Resend + trỏ webhook về")} <code>/api/resend-webhook</code>.
      </p>
    </div>
  );
}
