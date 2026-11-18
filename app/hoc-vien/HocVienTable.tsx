"use client";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useLang } from "@/components/lang-provider";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: "Lead", color: "bg-gray-100 text-gray-700" },
  contacted: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-700" },
  enrolled: { label: "Đã đăng ký", color: "bg-yellow-100 text-yellow-700" },
  learning: { label: "Đang học", color: "bg-purple-100 text-purple-700" },
  completed: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
  dropped: { label: "Bỏ học", color: "bg-orange-100 text-orange-700" },
  refunded: { label: "Hoàn tiền", color: "bg-red-100 text-red-700" },
};
const vnd = (n: number) => (Number(n) || 0).toLocaleString("vi") + "đ";

export function HocVienTable({ students }: { students: any[] }) {
  const { t } = useLang();
  const columns: Column<any>[] = [
    { key: "full_name", header: t("Họ tên"), sortValue: r => r.full_name || "", render: r => <span className="font-medium">{r.full_name}</span> },
    { key: "course", header: t("Khoá học"), sortValue: r => r.courses?.name || "", render: r => <span className="text-xs">{r.courses?.name || "—"}</span> },
    { key: "phone", header: t("SĐT"), sortable: false, render: r => <span className="text-xs">{r.phone || "—"}</span> },
    { key: "paid_amount", header: t("Đã thanh toán"), align: "right", sortValue: r => r.paid_amount || 0, render: r => <span className="tabular-nums">{vnd(r.paid_amount)}</span> },
    { key: "consultant", header: t("Tư vấn"), sortValue: r => r.users?.full_name || "", render: r => <span className="text-xs">{r.users?.full_name || "—"}</span> },
    {
      key: "status", header: t("Trạng thái"), sortValue: r => r.status || "",
      render: r => { const s = STATUS_LABELS[r.status] || { label: r.status, color: "bg-gray-100" }; return <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${s.color}`}>{t(s.label)}</span>; },
    },
    { key: "enrolled_at", header: t("Ngày"), align: "right", sortValue: r => r.enrolled_at || "", render: r => <span className="text-xs text-gray-500">{r.enrolled_at || "—"}</span> },
  ];
  return (
    <DataTable columns={columns} rows={students} rowKey={r => r.id} searchKeys={["full_name", "phone"]} pageSize={25} dense
      initialSort={{ key: "enrolled_at", dir: "desc" }} empty={t("Chưa có học viên nào")} />
  );
}
