"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { AppUser } from "@/lib/supabase-client";
import {
  isAdmin, isBodRole, isManagerOrAbove, isMktPosition, isAccountantPosition,
  isSalePosition, isCskhPosition, isKhoPosition, canViewDataroom, inFinanceWL,
} from "@/lib/auth";
import { quyetDinhDuong } from "@/lib/bod-quyen";

type Item = { href: string; label: string; group: string; kw?: string; external?: boolean };
const INDEX: Item[] = [

  { href: "/", label: "Tổng quan", group: "Cá nhân", kw: "home dashboard trang chu" },
  { href: "/brief", label: "Bản tin sáng (digest hằng ngày)", group: "Cá nhân", kw: "morning brief tong hop" },
  { href: "/cham-cong", label: "Chấm công Face ID", group: "Cá nhân", kw: "attendance check in" },
  { href: "/tasks", label: "Task & Giao việc", group: "Cá nhân", kw: "cong viec todo" },
  { href: "/daily-report", label: "Báo cáo cuối ngày", group: "Cá nhân", kw: "daily report bao cao ngay" },
  { href: "/kpi", label: "KPI cá nhân", group: "Cá nhân", kw: "chi tieu" },
  { href: "/phieu-luong", label: "Phiếu lương", group: "Cá nhân", kw: "payslip luong" },
  { href: "/xin-nghi", label: "Xin nghỉ phép", group: "Cá nhân", kw: "leave nghi phep" },

  { href: "/onboarding", label: "Lộ trình 30 ngày", group: "Học & Văn hoá", kw: "onboarding" },
  { href: "/kb", label: "Knowledge Base", group: "Học & Văn hoá", kw: "kien thuc tai lieu" },
  { href: "/playbook", label: "Sales Playbook", group: "Học & Văn hoá", kw: "kich ban ban hang" },

  { href: "/sales/checklist", label: "Checklist Sale hằng ngày", group: "Kinh doanh & CSKH", kw: "tag cong viec sale" },
  { href: "/sales/huong-dan", label: "Sale: Bắt đầu ở đây", group: "Kinh doanh & CSKH", kw: "huong dan sale" },
  { href: "/sales", label: "Bán hàng", group: "Kinh doanh & CSKH", kw: "sale" },
  { href: "/sales/khach-cua-toi", label: "Khách của tôi", group: "Kinh doanh & CSKH", kw: "khach hang" },
  { href: "/sales/don-online", label: "Đơn online", group: "Kinh doanh & CSKH", kw: "order don hang" },
  { href: "/ke-hoach-doanh-thu", label: "Mục tiêu doanh thu", group: "Kinh doanh & CSKH", kw: "kpi doanh thu target" },
  { href: "/bao-cao-sale", label: "Báo cáo Sale theo ngày", group: "Kinh doanh & CSKH", kw: "sale report" },
  { href: "/sales/tro-ly", label: "Trợ lý Sale (AI)", group: "Kinh doanh & CSKH", kw: "ai assistant" },
  { href: "/sales/telesales", label: "Kịch bản Telesales", group: "Kinh doanh & CSKH", kw: "goi dien script" },
  { href: "/cham-soc-kh", label: "Chăm sóc khách", group: "Kinh doanh & CSKH", kw: "care customer cham soc" },
  { href: "/hieu-qua-cham-soc", label: "Hiệu quả chăm sóc", group: "Kinh doanh & CSKH", kw: "conversion" },
  { href: "/danh-ba-khach", label: "Khách chờ trả lời (Zalo)", group: "Kinh doanh & CSKH", kw: "zalo unreplied" },
  { href: "/chat-quality", label: "AI chấm tư vấn sale", group: "Kinh doanh & CSKH", kw: "chat quality" },
  { href: "/khach-360", label: "Hồ sơ khách 360", group: "Kinh doanh & CSKH", kw: "customer 360" },
  { href: "/hoc-vien", label: "Học viên", group: "Kinh doanh & CSKH", kw: "student" },
  { href: "/seeding", label: "Cẩm nang Seeding", group: "Kinh doanh & CSKH", kw: "seeding" },

  { href: "/chien-luoc-mkt", label: "Chiến lược MKT", group: "Marketing", kw: "strategy" },
  { href: "/bao-cao-mkt", label: "Báo cáo đăng bài / FB", group: "Marketing", kw: "mkt report facebook" },
  { href: "/pheu-chien-dich", label: "Phễu & Chiến dịch", group: "Marketing", kw: "funnel campaign" },
  { href: "/content", label: "Content MKT", group: "Marketing", kw: "noi dung" },
  { href: "/tools/prompter", label: "Prompter Studio", group: "Marketing", kw: "video quay" },
  { href: "https://mkt-studio.example.com", label: "Đo lường đa kênh (MKT Studio)", group: "Marketing", kw: "measurement", external: true },
  { href: "https://mkt-studio.example.com/ads", label: "Bơm tiền Ads", group: "Marketing", kw: "ads quang cao", external: true },
  { href: "https://mkt-studio.example.com/ads-auto", label: "Tự động hoá Ads", group: "Marketing", kw: "ads automation", external: true },

  { href: "/kho", label: "Quản lý Kho", group: "Kho & Vận hành", kw: "warehouse ton kho" },
  { href: "/doi-soat-jt", label: "Đối soát J&T", group: "Kho & Vận hành", kw: "shipping van chuyen" },
  { href: "/doanh-thu-san-pham", label: "DT theo mặt hàng", group: "BGĐ & BI", kw: "product revenue thi phan san pham" },

  { href: "/tai-chinh", label: "Chi phí & Lợi nhuận (P&L)", group: "Tài chính", kw: "finance pnl loi nhuan" },
  { href: "/doanh-thu", label: "Doanh thu (nhập tay)", group: "Tài chính", kw: "revenue" },
  { href: "/hoa-hong-sale", label: "Hoa hồng Sale (KPI)", group: "Tài chính", kw: "commission thuong bac" },
  { href: "/bang-luong", label: "Bảng lương", group: "Tài chính", kw: "payroll luong" },
  { href: "/admin/ke-toan", label: "Kế toán + Bank", group: "Tài chính", kw: "accounting bank" },
  { href: "/admin/loans", label: "Nợ vay & Lãi suất", group: "Tài chính", kw: "loan no vay" },
  { href: "/admin/products", label: "Sản phẩm + Giá vốn", group: "Tài chính", kw: "product cost gia von" },
  { href: "/admin/bonus-rules", label: "Cấu hình bậc thưởng", group: "Tài chính", kw: "bonus tier bac thuong" },

  { href: "/bang-dieu-hanh", label: "Bảng điều hành (AOV · mua lại · P&L · dự báo · sức khoẻ startup)", group: "BGĐ & BI", kw: "exec aov repeat retention runway suc khoe startup du bao forecast ltv cac" },
  { href: "/dashboard", label: "Dashboard BI", group: "BGĐ & BI", kw: "bi leaderboard" },
  { href: "/chi-so", label: "Bảng chỉ số", group: "BGĐ & BI", kw: "chi so" },
  { href: "/bao-cao-thang", label: "Báo cáo tháng", group: "BGĐ & BI", kw: "bao cao thang" },
  { href: "/gop-y-bod", label: "Góp ý BOD", group: "BGĐ & BI", kw: "bod gop y" },
  { href: "/danh-gia-ca-nhan", label: "Đánh giá cá nhân", group: "BGĐ & BI", kw: "review scorecard" },
  { href: "/du-an", label: "Dự án", group: "BGĐ & BI", kw: "project" },

  { href: "/tuan-thu", label: "Tuân thủ pháp lý", group: "Investor & Pháp lý", kw: "compliance legal" },

  { href: "/nhan-su", label: "Nhân sự", group: "Quản trị", kw: "hr employee" },
  { href: "/phong-ban", label: "Phòng ban", group: "Quản trị", kw: "department" },
  { href: "/hop-dong", label: "Hồ sơ & Hợp đồng", group: "Quản trị", kw: "contract hop dong" },
  { href: "/tuyen-dung", label: "Tuyển dụng", group: "Quản trị", kw: "recruit hiring" },
  { href: "/admin/accounts", label: "Kho tài khoản (Bảo mật)", group: "Quản trị", kw: "password account vault" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

export function CommandPalette({ user }: { user: AppUser }) {
  const { t: t } = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const role = user.role, pos = (user as any).position, email = user.email;
    if (isBodRole(role)) return INDEX.filter((it) => quyetDinhDuong(role, it.href) === "cho");
    const admin = isAdmin(role), manager = isManagerOrAbove(role);
    const isSale = isSalePosition(pos), isMkt = isMktPosition(pos) && !isSale;
    const isCskh = isCskhPosition(pos), isKho = isKhoPosition(pos), isFin = isAccountantPosition(pos);
    const finWL = inFinanceWL(email), dataroom = canViewDataroom(user as any);
    const groupOk = (g: string) =>
      g === "Cá nhân" || g === "Học & Văn hoá" ? true :
      g === "Kinh doanh & CSKH" ? (manager || isSale || isCskh) :
      g === "Marketing" ? (manager || isMkt) :
      g === "Kho & Vận hành" ? (manager || isKho) :
      g === "Tài chính" ? (isFin || (manager && finWL)) :
      g === "BGĐ & BI" ? manager :
      g === "Investor & Pháp lý" ? dataroom :
      g === "Quản trị" ? admin : manager;
    return INDEX.filter(it => groupOk(it.group));
  }, [user]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(o => !o); }
      if (e.key === "Escape") setOpen(false);

      if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyJ" && (user.role === "ceo" || user.role === "admin")) {
        e.preventDefault();
        router.push("/tro-ly-giong?goi=1");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  const results = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return visible;
    return visible.filter(it => norm(it.label).includes(nq) || norm(it.group).includes(nq) || (it.kw && norm(it.kw).includes(nq)));
  }, [q, visible]);

  const go = (it: Item) => {
    setOpen(false);
    if (it.external) window.open(it.href, "_blank");
    else router.push(it.href);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} title={t("Tìm tính năng (⌘K)")}
        className="flex items-center gap-2 text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
        <Search className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("Tìm tính năng…")}</span> <kbd className="hidden sm:inline text-[10px] bg-gray-100 rounded px-1">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-1/2 top-20 -translate-x-1/2 w-[92%] max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
              <Search className="w-4 h-4 text-gray-400" />
              <input ref={inputRef} value={q}
                onChange={e => { setQ(e.target.value); setSel(0); }}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
                  if (e.key === "Enter" && results[sel]) go(results[sel]);
                }}
                placeholder={t("Tìm mọi trang / tính năng…")} className="flex-1 text-sm outline-none" />
              <kbd className="text-[10px] text-gray-400 bg-gray-100 rounded px-1">esc</kbd>
            </div>
            <div className="max-h-[60vh] overflow-auto py-1">
              {results.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-400">{t("Không tìm thấy.")}</div>}
              {results.map((it, i) => (
                <button key={it.href + i} onClick={() => go(it)} onMouseEnter={() => setSel(i)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${i === sel ? "bg-brand-50" : ""}`}>
                  <span className="text-sm text-gray-800 truncate">{t(it.label)} {it.external && <span className="text-[10px] text-gray-400">↗</span>}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{t(it.group)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
