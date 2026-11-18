import { getT } from "@/lib/i18n-server";
import { requireManager } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { normalizePhone } from "@/lib/zalo";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { MetricCard, Panel } from "@/components/dashboard-ui";
import { Heart, Repeat, UserMinus, UserPlus, Clock, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Trải nghiệm khách hàng (CX) | IKIHEALING Hub") };
}

type Cust = { orders: Set<string>; first: string; last: string };

async function readJson(key: string): Promise<any> {
  try { return JSON.parse((await getConfigValue(key)) || "null"); } catch { return null; }
}

async function loadBuyers(): Promise<Map<string, Cust>> {
  const sb = getServiceClient();
  const by = new Map<string, Cust>();

  const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const { rows } = await layDoanhThuNhieuThang(sb, "2026-03-01", homNay);
  for (const r of rows) {
    const ph = normalizePhone(r.customer_phone);
    if (!ph || !r.order_code || !r.order_date) continue;
    const d = String(r.order_date).slice(0, 10);
    const c = by.get(ph);
    if (!c) by.set(ph, { orders: new Set([r.order_code]), first: d, last: d });
    else {
      c.orders.add(r.order_code);
      if (d < c.first) c.first = d;
      if (d > c.last) c.last = d;
    }
  }
  return by;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default async function CxPage() {
  const { t: t } = getT();
  await requireManager();

  const cutoff90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const [buyers, saleUn, fbUn] = await Promise.all([
    loadBuyers().catch(() => new Map<string, Cust>()),
    readJson("sale_unreplied"),
    readJson("fb_unreplied"),
  ]);

  const total = buyers.size;
  let repeat = 0, active90 = 0, dormant90 = 0, new90 = 0;
  buyers.forEach((c) => {
    if (c.orders.size >= 2) repeat++;
    if (c.last >= cutoff90) active90++; else dormant90++;
    if (c.first >= cutoff90) new90++;
  });

  const zaloWait = Array.isArray(saleUn?.bySale) ? saleUn.bySale.reduce((s: number, x: any) => s + (x.count || 0), 0) : 0;
  const zaloOldest = Array.isArray(saleUn?.bySale) ? Math.max(0, ...saleUn.bySale.map((x: any) => x.oldestHours || 0)) : 0;
  const fbWait = fbUn?.total || 0;
  const fbOldest = fbUn?.oldestHours || 0;
  const worstWaitH = Math.max(zaloOldest, fbOldest);

  const repeatRate = pct(repeat, total);
  const churn90 = pct(dormant90, total);
  const retention90 = pct(active90, total);

  const rows: Array<{ name: string; val: string; target: string; status: "ok" | "warn" | "na"; note?: string }> = [
    {
      name: "Thời gian chờ trả lời lâu nhất (FRT)",
      val: worstWaitH ? `~${Math.round(worstWaitH)} giờ` : "0 giờ",
      target: "≤ 24 giờ",
      status: worstWaitH <= 24 ? "ok" : "warn",
      note: `Zalo ${zaloWait} khách chờ · Facebook ${fbWait} tin/bình luận chưa trả lời`,
    },
    {
      name: "Tỷ lệ mua lại (Repeat Purchase Rate)",
      val: `${repeatRate}%`,
      target: "theo dõi xu hướng tăng",
      status: "ok",
      note: `${repeat.toLocaleString("vi-VN")}/${total.toLocaleString("vi-VN")} khách có từ 2 đơn (toàn lịch sử có SĐT)`,
    },
    {
      name: "Khách còn hoạt động 90 ngày (retention)",
      val: `${retention90}%`,
      target: "tham chiếu playbook ≥ 70%/năm",
      status: "ok",
      note: t("Đo cửa sổ 90 ngày — so xu hướng tháng trước, không so thẳng chuẩn năm"),
    },
    {
      name: "Khách ngủ quên >90 ngày (churn)",
      val: `${churn90}%`,
      target: "tham chiếu playbook ≤ 5%/năm",
      status: "ok",
      note: t("Danh sách khách ngủ quên xem tại Khách 360 (phân khúc churn) để đánh thức"),
    },
    { name: "NPS (mức sẵn sàng giới thiệu)", val: "Chưa đo", target: "≥ 50", status: "na", note: t("Cần khảo sát 1 câu sau mua (Zalo) — chưa có nguồn đo") },
    { name: "CSAT (hài lòng sau tương tác)", val: "Chưa đo", target: "≥ 90%", status: "na", note: t("Cần khảo sát nhanh sau chăm sóc — chưa có nguồn đo") },
    { name: "Tỷ lệ khiếu nại (Complaint Rate)", val: "Chưa đo", target: "theo dõi giảm", status: "na", note: t("Chưa có sổ ghi khiếu nại tập trung") },
  ];

  const badge = (s: "ok" | "warn" | "na") =>
    s === "ok" ? <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">{t("Đang đo")}</span>
    : s === "warn" ? <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700">{t("Vượt ngưỡng")}</span>
    : <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">{t("Chưa đo")}</span>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Heart className="w-5 h-5 text-emerald-600" /> {t("Trải nghiệm khách hàng (CX)")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Bảng điểm CX theo khung playbook — chỉ hiện số đo được từ dữ liệu thật (sổ đơn Telegram, hàng chờ trả lời).\n          Khách POS không có SĐT không tính được mua lại nên KHÔNG gồm ở đây.")}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label={t("Khách có SĐT đã mua")} value={total.toLocaleString("vi-VN")} icon={UserPlus} sub={`${new90.toLocaleString("vi-VN")} khách mới 90 ngày`} sensitive={false} />
        <MetricCard label={t("Tỷ lệ mua lại")} value={`${repeatRate}%`} icon={Repeat} sub={`${repeat.toLocaleString("vi-VN")} khách mua từ 2 đơn`} sensitive={false} />
        <MetricCard label={t("Ngủ quên >90 ngày")} value={`${churn90}%`} icon={UserMinus} color="#DC2626" sub={`${dormant90.toLocaleString("vi-VN")} khách cần đánh thức`} sensitive={false} />
        <MetricCard label={t("Đang chờ trả lời")} value={(zaloWait + fbWait).toLocaleString("vi-VN")} icon={MessageSquare} color={worstWaitH > 24 ? "#DC2626" : "#10B981"} sub={worstWaitH ? `lâu nhất ~${Math.round(worstWaitH)} giờ` : t("không có khách chờ")} sensitive={false} />
      </div>

      <Panel title={t("Bảng điểm CX (khung playbook — mục tiêu bên cạnh)")} icon={Clock}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-[12px] border-b border-gray-100">
                <th className="py-2 pr-3 font-medium">{t("Chỉ số")}</th>
                <th className="py-2 pr-3 font-medium">{t("Hiện tại")}</th>
                <th className="py-2 pr-3 font-medium">{t("Mục tiêu")}</th>
                <th className="py-2 font-medium">{t("Trạng thái")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-gray-50 align-top">
                  <td className="py-2.5 pr-3">
                    <div className="text-gray-800">{r.name}</div>
                    {t(r.note) && <div className="text-[12px] text-gray-400 mt-0.5">{t(r.note)}</div>}
                  </td>
                  <td className={`py-2.5 pr-3 font-semibold ${r.status === "na" ? "text-gray-400" : "text-gray-900"}`}>{r.val}</td>
                  <td className="py-2.5 pr-3 text-gray-500">{r.target}</td>
                  <td className="py-2.5">{badge(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-gray-400 mt-3">
          {t("NPS/CSAT muốn đo thật chỉ cần 1 câu hỏi sale gửi Zalo sau khi khách nhận hàng — khi CEO duyệt, hệ thống sẽ thêm nút ghi nhận vào Chăm sóc KH.")}
        </p>
      </Panel>
    </div>
  );
}
