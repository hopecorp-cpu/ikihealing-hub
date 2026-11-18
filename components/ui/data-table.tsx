"use client";
import { useLang } from "@/components/lang-provider";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight, Inbox } from "lucide-react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (row: T, i: number) => ReactNode;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
  className?: string;
};

export function DataTable<T extends Record<string, any>>({
  columns, rows, searchable = true, searchKeys, pageSize = 20, dense = false,
  rowKey, onRowClick, empty = "Chưa có dữ liệu", toolbar, stickyHeader = true, initialSort,
}: {
  columns: Column<T>[];
  rows: T[];
  searchable?: boolean;
  searchKeys?: string[];
  pageSize?: number;
  dense?: boolean;
  rowKey?: (row: T, i: number) => string | number;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  toolbar?: ReactNode;
  stickyHeader?: boolean;
  initialSort?: { key: string; dir: "asc" | "desc" };
}) {
  const { t: t } = useLang();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [page, setPage] = useState(1);

  const norm = (s: any) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const nq = norm(q).trim();

  const filtered = useMemo(() => {
    if (!nq) return rows;
    const keys = searchKeys ?? columns.map(c => c.key);
    return rows.filter(r => keys.some(k => norm(r[k]).includes(nq)));
  }, [rows, nq, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find(c => c.key === sort.key);
    const val = (r: T) => col?.sortValue ? col.sortValue(r) : r[sort.key];
    const arr = [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av ?? "").localeCompare(String(bv ?? ""), "vi", { numeric: true });
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * pageSize, curPage * pageSize);

  const toggleSort = (key: string) => {
    setPage(1);
    setSort(s => s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null);
  };
  const cellPad = dense ? "px-3 py-1.5" : "px-4 py-2.5";
  const alignCls = (a?: string) => a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
          {searchable && (
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder={t("Tìm trong bảng…")}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition" />
            </div>
          )}
          {toolbar}
          <span className="ml-auto text-xs text-gray-400">{sorted.length.toLocaleString("vi")} {t("dòng")}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr className="bg-gray-50">
              {columns.map(col => {
                const sortable = col.sortable !== false;
                const active = sort?.key === col.key;
                return (
                  <th key={col.key} style={{ width: col.width }}
                    className={`${cellPad} ${alignCls(col.align)} text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 ${sortable ? "cursor-pointer select-none hover:text-gray-700" : ""}`}
                    onClick={sortable ? () => toggleSort(col.key) : undefined}>
                    <span className={`inline-flex items-center gap-1 ${col.align === "right" ? "flex-row-reverse" : ""}`}>
                      {col.header}
                      {sortable && (active ? (sort!.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronsUpDown className="w-3 h-3 text-gray-300" />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={rowKey ? rowKey(row, i) : i}
                className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map(col => (
                  <td key={col.key} className={`${cellPad} ${alignCls(col.align)} text-gray-700 ${col.className || ""}`}>
                    {col.render ? col.render(row, (curPage - 1) * pageSize + i) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={columns.length} className="py-12 text-center">
                <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <div className="text-sm text-gray-400">{empty}</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Trang {curPage}/{totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage <= 1}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage >= totalPages}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
