"use client";
import { useLang } from "@/components/lang-provider";
import { DataTable, type Column } from "@/components/ui/data-table";

type P = { name: string; shipped: number; delivered: number; returned: number; transit: number; orders: number };

export default function KhoClient({ products }: { products: P[] }) {
  const { t } = useLang();

  function exportCsv() {
    const head = [t("Sản phẩm"), t("Tổng gửi"), t("Đã giao"), t("Hoàn về"), t("Đang đi"), t("Số vận đơn")];
    const lines = products.map(p => [p.name, p.shipped, p.delivered, p.returned, p.transit, p.orders]);
    const csv = "﻿" + [head, ...lines].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `kho-hang-gui-di-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }
  const n = (v: number) => v.toLocaleString("vi");

  const columns: Column<P>[] = [
    { key: "name", header: t("Sản phẩm"), sortValue: p => p.name, render: p => <span className="font-medium">{p.name}</span> },
    { key: "shipped", header: t("Tổng gửi"), align: "right", sortValue: p => p.shipped, render: p => <span className="tabular-nums font-semibold">{n(p.shipped)}</span> },
    { key: "delivered", header: t("Đã giao"), align: "right", sortValue: p => p.delivered, render: p => <span className="tabular-nums text-emerald-700">{n(p.delivered)}</span> },
    { key: "returned", header: t("Hoàn về"), align: "right", sortValue: p => p.returned, render: p => <span className="tabular-nums text-red-600">{p.returned ? n(p.returned) : "—"}</span> },
    { key: "transit", header: t("Đang đi"), align: "right", sortValue: p => p.transit, render: p => <span className="tabular-nums text-amber-600">{p.transit ? n(p.transit) : "—"}</span> },
    { key: "orders", header: t("Vận đơn"), align: "right", sortValue: p => p.orders, render: p => <span className="tabular-nums text-gray-400">{p.orders}</span> },
  ];

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{t("Hàng gửi đi theo sản phẩm")}</div>
      <DataTable columns={columns} rows={products} searchKeys={["name"]} pageSize={20} dense
        initialSort={{ key: "shipped", dir: "desc" }}
        toolbar={<button onClick={exportCsv} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">{t("Xuất Excel")}</button>}
        empty={t("Chưa có dữ liệu")} />
    </div>
  );
}
