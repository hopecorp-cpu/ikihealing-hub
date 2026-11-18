"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { ROLE_GAN } from "@/lib/auth";

export function SearchBar({ departments, currentFilter, currentQ, currentDept, currentRole }: any) {
  const { t } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(currentQ ?? "");
  const [dept, setDept] = useState(currentDept ?? "");
  const [role, setRole] = useState(currentRole ?? "");

  const apply = () => {
    const p = new URLSearchParams();
    p.set("f", currentFilter);
    if (q) p.set("q", q);
    if (dept) p.set("dept", dept);
    if (role) p.set("role", role);
    router.push(`/nhan-su?${p.toString()}`);
  };

  const clear = () => {
    setQ(""); setDept(""); setRole("");
    router.push(`/nhan-su?f=${currentFilter}`);
  };

  const hasFilter = q || dept || role;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && apply()}
          placeholder={t("Tìm theo tên, email, chức vụ...")}
          className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
        />
      </div>
      <select value={dept} onChange={e => setDept(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
        <option value="">{t("Tất cả phòng ban")}</option>
        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <select value={role} onChange={e => setRole(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
        <option value="">{t("Tất cả vai trò")}</option>
        {ROLE_GAN.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
      </select>
      <button onClick={apply} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
        {t("Áp dụng")}
      </button>
      {hasFilter && (
        <button onClick={clear} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1">
          <X className="w-3 h-3" /> {t("Xoá lọc")}
        </button>
      )}
    </div>
  );
}
