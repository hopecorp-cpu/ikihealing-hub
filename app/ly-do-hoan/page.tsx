import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { PageHeader, SectionCard, Card } from "@/components/ui/kit";
import { PackageX } from "lucide-react";
import { isManagerOrAbove } from "@/lib/auth";
import { thongKeHoan, LY_DO_HOAN, TEN_NHOM_LY_DO } from "@/lib/ly-do-hoan";
import { vnDateStr } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { tu?: string; den?: string } }) {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove((user as any).role)) redirect("/");
  const den = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.den || "") ? searchParams.den! : vnDateStr();
  const tu = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.tu || "") ? searchParams.tu! : new Date(new Date(den).getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const sb = getServiceClient();
  const { data: sp } = await sb.from("products").select("name").eq("active", true);
  const tk = await thongKeHoan(sb, tu, den, (sp || []).map((x: any) => x.name));
  const mau: Record<string, string> = { khach: "#F59E0B", minh: "#DC2626", "ky-thuat": "#6B7280" };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader title={t("Lý do hoàn")} subtitle={t("Đơn hoàn về vì sao — theo nhóm lỗi, sản phẩm, sale. Sale đóng việc đơn hoàn là phải chọn lý do.")} icon={PackageX} iconColor="#DC2626" />
      <form className="flex flex-wrap items-end gap-2 text-sm">
        <label><span className="mb-1 block text-xs text-gray-500">{t("Từ")}</span><input type="date" name="tu" defaultValue={tu} className="rounded-lg border px-2 py-1.5" /></label>
        <label><span className="mb-1 block text-xs text-gray-500">{t("Đến")}</span><input type="date" name="den" defaultValue={den} className="rounded-lg border px-2 py-1.5" /></label>
        <button className="rounded-lg border bg-white px-3 py-1.5 hover:bg-gray-50">Xem</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><div className="text-[11px] uppercase tracking-wide text-gray-500">{t("Đơn hoàn có lý do")}</div><div className="mt-1 text-2xl font-bold">{tk.tong}</div><div className="text-xs text-gray-500">{tu} → {den}</div></Card>
        {tk.theoNhom.slice(0, 2).map((n) => (
          <Card key={t(n.nhom)}><div className="text-[11px] uppercase tracking-wide text-gray-500">{t(n.ten)}</div><div className="mt-1 text-2xl font-bold" style={{ color: mau[t(n.nhom)] }}>{n.pct}%</div><div className="text-xs text-gray-500">{n.so} {t("đơn")}</div></Card>
        ))}
      </div>
      {tk.chuaGhiLyDo > 0 && <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">{tk.chuaGhiLyDo} {t("việc đơn hoàn đã đóng mà KHÔNG ghi lý do (đóng trước khi có chốt này, hoặc đóng bằng đường khác). Không tính vào thống kê.")}</Card>}

      <div className="grid gap-5 md:grid-cols-2">
        <SectionCard title={t("Theo lý do")}>
          {!tk.theoLyDo.length ? <p className="text-sm text-gray-500">{t("Chưa có đơn hoàn nào ghi lý do trong kỳ.")}</p> : (
            <div className="space-y-2">{tk.theoLyDo.map((l) => (
              <div key={l.ma} className="flex items-center gap-3 text-sm">
                <span className="w-56 shrink-0 text-gray-700">{t(l.ten)}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${Math.round((l.so / tk.tong) * 100)}%`, background: mau[t(l.nhom)] }} /></div>
                <span className="w-8 text-right font-semibold">{l.so}</span>
              </div>))}</div>
          )}
          <p className="mt-3 text-[11px] text-gray-500">{t("Màu:")} <span style={{ color: mau.khach }}>{t("phía khách")}</span> · <span style={{ color: mau.minh }}>{t("phía mình")}</span> · <span style={{ color: mau["ky-thuat"] }}>{t("kỹ thuật")}</span>{t(". Nhóm &quot;phía mình&quot; là chỗ sửa được ngay.")}</p>
        </SectionCard>
        <div className="space-y-5">
          <SectionCard title={t("Theo sản phẩm")}>
            {!tk.theoSanPham.length ? <p className="text-sm text-gray-500">—</p> : <ul className="space-y-1 text-sm">{tk.theoSanPham.slice(0, 10).map((x) => <li key={t(x.ten)} className="flex justify-between"><span>{t(x.ten)}</span><span className="font-semibold">{x.so}</span></li>)}</ul>}
          </SectionCard>
          <SectionCard title="Theo sale">
            {!tk.theoSale.length ? <p className="text-sm text-gray-500">—</p> : <ul className="space-y-1 text-sm">{tk.theoSale.map((x) => <li key={t(x.ten)} className="flex justify-between"><span>{t(x.ten)}</span><span className="font-semibold">{x.so}</span></li>)}</ul>}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
