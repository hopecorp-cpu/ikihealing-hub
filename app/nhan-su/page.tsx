import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { tuChoiBod } from "@/lib/auth-server";
import { AddEmployeeButton } from "./add-employee-button";
import { SearchBar } from "./search-bar";
import { NhanSuTable } from "./nhan-su-table";
import { DungNguoiPanel } from "./DungNguoiPanel";
import { DUNG_NGUOI, KHOA_DISC_NHAN_SU } from "@/lib/covan/knowledge_dungnguoi";
import { PageHeader } from "@/components/ui/kit";
import { Users } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NhanSuPage({ searchParams }: { searchParams: { f?: string; q?: string; dept?: string; role?: string } }) {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  tuChoiBod(user);
  if (user.role !== "admin" && user.role !== "ceo") redirect("/");

  const filter = searchParams.f === "terminated" ? "terminated" : searchParams.f === "all" ? "all" : "active";
  const q = searchParams.q?.trim() ?? "";
  const deptFilter = searchParams.dept ?? "";
  const roleFilter = searchParams.role ?? "";

  const sb = getServiceClient();
  let query = sb.from("users").select("*, departments!users_department_id_fkey(name, color)").order("full_name");
  if (filter === "active") query = query.eq("active", true);
  else if (filter === "terminated") query = query.eq("active", false);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,position.ilike.%${q}%`);
  if (deptFilter) query = query.eq("department_id", deptFilter);
  if (roleFilter) query = query.eq("role", roleFilter);

  let danhDauDisc: Record<string, string> = {};
  try {
    const { data: c } = await sb.from("config").select("value").eq("key", KHOA_DISC_NHAN_SU).maybeSingle();
    danhDauDisc = JSON.parse(c?.value || "{}");
  } catch { danhDauDisc = {}; }

  const [{ data: users }, { data: depts }, { count: activeCount }, { count: terminatedCount }] = await Promise.all([
    query,
    sb.from("departments").select("id, name").order("name"),
    sb.from("users").select("*", { count: "exact", head: true }).eq("active", true),
    sb.from("users").select("*", { count: "exact", head: true }).eq("active", false)
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title={t("Nhân sự")} icon={Users} subtitle={t("Quản lý hồ sơ nhân viên, hợp đồng & trạng thái.")}
        actions={<AddEmployeeButton departments={depts ?? []} />} />

      <div className="inline-flex gap-1 bg-gray-100 p-1 rounded-xl">
        <FilterLink current={filter} value="active" label={`${t("Đang làm")} (${activeCount ?? 0})`} extra={q || deptFilter || roleFilter ? `&q=${q}&dept=${deptFilter}&role=${roleFilter}` : ""} />
        <FilterLink current={filter} value="terminated" label={`${t("Đã thôi việc")} (${terminatedCount ?? 0})`} extra="" />
        <FilterLink current={filter} value="all" label={`${t("Tất cả")} (${(activeCount ?? 0) + (terminatedCount ?? 0)})`} extra="" />
      </div>

      <SearchBar departments={depts ?? []} currentFilter={filter} currentQ={q} currentDept={deptFilter} currentRole={roleFilter} />

      <NhanSuTable users={users ?? []} depts={depts ?? []} />

      <DungNguoiPanel
        nhanVien={(users ?? []).filter((u: any) => u.active).map((u: any) => ({ id: u.id, full_name: u.full_name, position: u.position }))}
        danhDau={danhDauDisc}
        huongDan={DUNG_NGUOI}
      />
    </div>
  );
}

function FilterLink({ current, value, label, extra }: { current: string; value: string; label: string; extra?: string }) {
  const active = current === value;
  return (
    <a href={`/nhan-su?f=${value}${extra || ""}`}
      className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${
        active ? "bg-white shadow-sm text-brand-700" : "text-gray-500 hover:text-gray-700"
      }`}>
      {label}
    </a>
  );
}
