import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/ui/kit";
import { Users, ArrowLeftRight } from "lucide-react";
import { vnDateStr } from "@/lib/payroll";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Tệp khách theo dòng sản phẩm | IKIHEALING Hub") };
}

const tr = (n: number) => `${(Math.round(n / 1e5) / 10).toLocaleString("vi-VN")}tr`;

type Line = "dam" | "tra" | "khoa" | "khac";
const LINE_META: Record<Line, { label: string; color: string; goiY: string }> = {
  dam: { label: "Khách dùng đạm", color: "#0F766E", goiY: "Mời thêm trà buổi tối để tròn nếp ngày — bán chéo tự nhiên nhất." },
  tra: { label: "Khách dùng trà", color: "#B45309", goiY: "Giới thiệu đạm thực vật cho bữa sáng — nâng giá trị đơn lên bậc combo." },
  khoa: { label: "Khách học khóa học", color: "#6D28D9", goiY: "Tệp tin tưởng cao nhất — ưu tiên mời thẻ thành viên và combo dài ngày." },
  khac: { label: "Khách sản phẩm khác", color: "#64748B", goiY: "Xem lại đơn để phân đúng dòng, tránh chăm sai thứ khách cần." },
};

function lineOf(name: string): Line {
  const s = (name || "").toLowerCase();
  if (/đạm|dam|vegan|protein/.test(s)) return "dam";
  if (/trà|tra |tuệ minh|thanh hương|san pham c|san pham b/.test(s)) return "tra";
  if (/khóa|khoa hoc|học|course|ndv/.test(s)) return "khoa";
  return "khac";
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sb = getServiceClient();
  const since = new Date(Date.now() + 7 * 3600e3 - 180 * 86400e3).toISOString().slice(0, 10);
  let rows: any[] = [];
  try {

    rows = (await layDoanhThuNhieuThang(sb, since, vnDateStr())).rows;
  } catch {  }

  type Cust = { name: string; phone: string; lines: Set<Line>; spent: number; last: string; orders: Set<string> };
  const byPhone = new Map<string, Cust>();
  for (const r of rows) {
    const phone = (r.customer_phone || "").trim();
    if (!phone) continue;
    const c = byPhone.get(phone) || { name: r.customer_name || "Khách", phone, lines: new Set<Line>(), spent: 0, last: "", orders: new Set<string>() };
    c.lines.add(lineOf(r.product_name || ""));
    c.spent += r.net_amount || 0;
    if ((r.order_date || "") > c.last) c.last = r.order_date || "";
    if (r.order_code) c.orders.add(r.order_code);
    if (r.customer_name) c.name = r.customer_name;
    byPhone.set(phone, c);
  }
  const custs = [...byPhone.values()];

  const groups = (["dam", "tra", "khoa", "khac"] as Line[]).map((ln) => {
    const list = custs.filter((c) => c.lines.has(ln));

    const onlyThis = list.filter((c) => c.lines.size === 1);
    return {
      line: ln,
      total: list.length,
      onlyThis: onlyThis.length,
      revenue: list.reduce((s, c) => s + c.spent, 0),
      top: onlyThis.sort((a, b) => b.spent - a.spent).slice(0, 8),
    };
  });

  const both = custs.filter((c) => c.lines.has("dam") && c.lines.has("tra")).length;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={t("Tệp khách theo dòng sản phẩm")}
        subtitle={`${custs.length} khách có đơn trong 180 ngày · nguồn: sổ đơn Telegram (cửa doanh thu)`}
        icon={Users}
      />

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-[13px] text-emerald-900 flex items-start gap-2">
        <ArrowLeftRight className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <b>{both} {t("khách")}</b> {t("đã dùng cả đạm và trà — đây là tệp đã tin cả hai dòng, ưu tiên mời combo lớn và thẻ thành viên.\n          Cột &quot;chỉ mua dòng này&quot; bên dưới là danh sách bán chéo dễ nhất.")}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => {
  const { t: t } = getT();
          const meta = LINE_META[g.line];
          return (
            <section key={g.line} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50" style={{ background: `${meta.color}0D` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-gray-800">{t(meta.label)}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: meta.color }}>{g.total} {t("khách")}</span>
                </div>
                <div className="text-[11.5px] text-gray-500 mt-0.5">
                  {t("Doanh số 180 ngày")} {tr(g.revenue)} · <b>{g.onlyThis}</b> {t("khách chỉ mua dòng này")}
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                <div className="text-[11.5px] text-gray-500 italic">{meta.goiY}</div>
                {g.top.map((c) => (
                  <div key={c.phone} className="flex items-center justify-between text-[12.5px] border-b border-gray-50 pb-1">
                    <span className="text-gray-700 truncate">{c.name}</span>
                    <span className="text-gray-400 tabular-nums shrink-0 ml-2">{tr(c.spent)} · {c.orders.size} {t("đơn ·")} {c.last.slice(5)}</span>
                  </div>
                ))}
                {g.top.length === 0 && <div className="text-[12px] text-gray-400">{t("Chưa có khách chỉ mua riêng dòng này.")}</div>}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400">
        {t("Danh sách chỉ hiện tên và mức chi để chọn khách gọi — số điện thoại đầy đủ lấy ở pipeline chăm khách.\n        Khi mời bán chéo vẫn giữ luật: tặng quà, không giảm phần trăm, không hứa công dụng.")}
      </p>
    </div>
  );
}
