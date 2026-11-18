"use client";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/kit";
import { TerminateButton } from "./terminate-button";
import { EditEmployeeButton } from "./edit-employee-modal";
import { ZaloButton } from "@/components/zalo-button";
import { useLang } from "@/components/lang-provider";

const vnd = (n: number) => (n || 0).toLocaleString("vi") + "đ";

export function NhanSuTable({ users, depts }: { users: any[]; depts: any[] }) {
  const { t } = useLang();
  const columns: Column<any>[] = [
    {
      key: "full_name", header: t("Họ tên"), sortValue: r => r.full_name || "",
      render: r => (<div><div className="font-medium text-gray-900">{r.full_name}</div><div className="text-xs text-gray-500">{r.email}</div></div>),
    },
    {
      key: "dept", header: t("Phòng ban"), sortValue: r => r.departments?.name || "",
      render: r => r.departments?.name
        ? <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: (r.departments?.color || "#888") + "22", color: r.departments?.color || "#666" }}>{r.departments.name}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: "position", header: t("Chức vụ"), sortValue: r => r.position || "",
      render: r => (<div><div>{r.position}</div>
        {r.work_mode === "remote" && <span className="text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">REMOTE</span>}
        {r.work_mode === "hybrid" && <span className="text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">HYBRID</span>}</div>),
    },
    { key: "contract_type", header: t("Loại HĐ"), sortValue: r => r.contract_type || "", render: r => <span className="text-xs">{r.contract_type}</span> },
    { key: "base_salary", header: t("Lương Gross"), align: "right", sortValue: r => r.base_salary || 0, render: r => <span className="tabular-nums sensitive">{vnd(r.base_salary)}</span> },
    {
      key: "active", header: t("Trạng thái"), sortValue: r => (r.active ? 1 : 0),
      render: r => r.active
        ? <Badge tone="green" dot>{t("Đang làm")}</Badge>
        : (<div><Badge tone="red" dot>{t("Đã nghỉ")}</Badge>{r.terminated_at && <div className="text-[11px] text-gray-500 mt-1">{r.terminated_at}{r.termination_reason && <span> · {r.termination_reason}</span>}</div>}</div>),
    },
    {
      key: "actions", header: t("Hành động"), align: "right", sortable: false, width: "150px",
      render: r => (<div className="flex justify-end gap-1">
        {r.active && r.phone && <ZaloButton phone={r.phone} label="" />}
        {r.active && <EditEmployeeButton user={r} departments={depts} />}
        <TerminateButton userId={r.id} userName={r.full_name} isActive={r.active} currentTerminatedAt={r.terminated_at} />
      </div>),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={users}
      rowKey={r => r.id}
      searchable={false}
      pageSize={25}
      dense
      initialSort={{ key: "full_name", dir: "asc" }}
      empty={t("Chưa có NV")}
    />
  );
}
