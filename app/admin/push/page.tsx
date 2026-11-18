import { getT } from "@/lib/i18n-server";
import { requireAdmin } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { PageHeader, SectionCard, Badge } from "@/components/ui/kit";
import { BellRing } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Thông báo điện thoại | ACME Ops Hub") };
}

const SALE_DEPT = "Kinh Doanh & Sale";

export default async function Page() {
  const { t: t } = getT();
  await requireAdmin();
  const sb = getServiceClient();
  const [{ data: users }, { data: subs }, { data: plRow }] = await Promise.all([
    sb.from("users").select("id, full_name, position, departments!users_department_id_fkey(name)").eq("active", true),
    sb.from("push_subscriptions").select("user_id, updated_at"),
    sb.from("config").select("value").eq("key", "push_last").maybeSingle(),
  ]);
  let pl: any = null; try { pl = JSON.parse(plRow?.value || "null"); } catch { pl = null; }

  const byUser: Record<string, { n: number; last: string | null }> = {};
  for (const s of subs || []) {
    const o = (byUser[s.user_id] ??= { n: 0, last: null });
    o.n++;
    if (!o.last || (s.updated_at && s.updated_at > o.last)) o.last = s.updated_at;
  }
  const rows = (users || []).map((u: any) => ({
    id: u.id, name: u.full_name || u.id.slice(0, 8), position: u.position || "", dept: u.departments?.name || "",
    n: byUser[u.id]?.n || 0, last: byUser[u.id]?.last || null,
  })).sort((a, b) => (Number(b.dept === SALE_DEPT) - Number(a.dept === SALE_DEPT)) || (b.n - a.n) || a.name.localeCompare(b.name, "vi"));
  const sale = rows.filter(r => r.dept === SALE_DEPT);
  const saleCoThietBi = sale.filter(r => r.n > 0).length;
  const tongThietBi = (subs || []).length;
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) : "—";

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={t("Thông báo điện thoại (web push)")}
        subtitle={t("Thiết bị đã đăng ký nhận cảnh báo theo từng nhân viên. Sale 0 thiết bị thì cảnh báo cá nhân không tới ai.")}
        icon={BellRing}
        actions={
          <div className="flex gap-2 text-[12px]">
            <Badge tone={saleCoThietBi > 0 ? "green" : "red"} dot>Sale: {saleCoThietBi}/{sale.length} {t("người có thiết bị")}</Badge>
            <Badge tone="gray">{t("Tổng")} {tongThietBi} {t("thiết bị")}</Badge>
          </div>
        }
      />

      <SectionCard title={t("Lượt đẩy gần nhất (config push_last)")}>
        {!pl ? (
          <div className="text-[13px] text-gray-500">{t("Chưa có nhịp nào — script gen-sale-alerts / gen-system-alerts trên máy Mac chưa chạy từ khi cập nhật.")}</div>
        ) : (
          <div className="text-[13px] text-gray-700 space-y-1">
            <div>{t("Lúc")} {fmt(pl.ts)} {t("· nguồn")} <b>{pl.nguon || "?"}</b> {t("· gửi")} <b>{pl.sent ?? 0}/{pl.subs ?? 0}</b> {t("thiết bị cho")} {pl.users ?? 0} {t("người")}</div>
            {typeof pl.saleSubs === "number" && (
              <div>{t("Phòng Sale:")} <b>{pl.saleSubs}</b> {t("thiết bị")}{pl.saleSubs0Since ? ` — bằng 0 từ ${fmt(pl.saleSubs0Since)}` : ""}</div>
            )}
            {Array.isArray(pl.lichSu) && pl.lichSu.length > 0 && (
              <div className="text-[12px] text-gray-500">{t("Lịch sử:")} {pl.lichSu.slice().reverse().map((x: any) => `${fmt(x.ts).slice(0, 16)} ${x.nguon || "?"} ${x.sent ?? 0}/${x.subs ?? 0}`).join(" · ")}</div>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("Theo nhân viên")}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-3 font-medium">{t("Nhân viên")}</th>
                <th className="py-2 pr-3 font-medium">{t("Phòng")}</th>
                <th className="py-2 pr-3 font-medium">{t("Chức danh")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("Thiết bị")}</th>
                <th className="py-2 font-medium">{t("Đăng ký gần nhất")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2 pr-3 text-gray-900">{r.name}</td>
                  <td className="py-2 pr-3 text-gray-600">{r.dept || "—"}</td>
                  <td className="py-2 pr-3 text-gray-600">{r.position || "—"}</td>
                  <td className="py-2 pr-3 text-right">
                    <Badge tone={r.n > 0 ? "green" : r.dept === SALE_DEPT ? "red" : "gray"}>{r.n}</Badge>
                  </td>
                  <td className="py-2 text-gray-600">{fmt(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
