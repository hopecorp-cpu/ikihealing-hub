"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutGrid, Clock, CalendarOff, Mic, Wallet, Target, MessageSquare, Users, Building2, Calendar, Receipt,
  Castle, FileSignature, Flame, Link2, Heart, Lightbulb, ShoppingCart, GraduationCap, FileText, Briefcase,
  FolderKanban, BarChart3, Shield, ShieldCheck, Edit3, Banknote, ListTodo, BookOpen, BookOpenCheck,
  Rocket, Settings, CalendarCheck, Package, Truck, Search, ChevronDown,
  PieChart, Boxes, FileSpreadsheet, Upload, Landmark, ClipboardCheck, CalendarClock, ClipboardList, Palette, Radio, Video, KeyRound, Mail, Repeat, Brain, Map as MapIcon, Shuffle, ListChecks, Activity,
  TrendingUp, Percent, Award, Megaphone, UserCheck, Filter, Star, Home, ArrowUpRight, Network, BrainCircuit, Route, CalendarRange, Scale, Tag, Trophy, FolderOpen, Gauge, Radar, Zap
, MessagesSquare, Share2, Inbox,
  UserSearch, Store, PackageX, BellRing, FlaskConical, Languages, PhoneCall, QrCode,
} from "lucide-react";
import Image from "next/image";
import type { AppUser } from "@/lib/supabase-types";
import { isAdmin as roleIsAdmin, isBodRole, isManagerOrAbove, isMktPosition, isAccountantPosition, isSalePosition, isCskhPosition, isKhoPosition, canViewDataroom, isFullTruInvestor, BOD_EMAILS, ACCOUNTANT_EMAILS } from "@/lib/auth";
import { useLang } from "./lang-provider";

const WL = [...BOD_EMAILS, ...ACCOUNTANT_EMAILS];

const DEFAULT_OPEN = new Set(["Ghim", "Cá nhân"]);

const personalItems = [
  { href: "/",             label: "Tổng quan",         icon: LayoutGrid },
  { href: "/ban-do-tinh-nang", label: "Bản đồ tính năng", icon: MapIcon },
  { href: "/cham-cong",    label: "Chấm công Face ID", icon: Clock, short: "Chấm công" },
  { href: "/tasks",        label: "Việc & Kanban",      icon: ListTodo },
  { href: "/ke-hoach-ngay", label: "Kế hoạch ngày",     icon: CalendarClock },
  { href: "/daily-report", label: "Báo cáo cuối ngày", icon: MessageSquare, short: "Báo cáo ngày" },
  { href: "/kpi",          label: "KPI cá nhân",       icon: Target },
  { href: "/thi-dua",      label: "Bảng vinh danh",    icon: Trophy },
  { href: "/phieu-luong",  label: "Phiếu lương",       icon: Wallet },
  { href: "/luong-cua-toi", label: "Lương của tôi",    icon: Percent },
  { href: "/xin-nghi",     label: "Xin nghỉ phép",     icon: CalendarOff },
];
const briefItem = { href: "/brief", label: "Bản tin sáng", icon: Radio };

const giongItem = { href: "/tro-ly-giong", label: "Trợ lý giọng nói", icon: Mic };
const dichHopItem = { href: "/dich-hop", label: "Dịch họp", icon: Languages };

const hopDuyetItem = { href: "/hop-duyet", label: "Hộp duyệt", icon: ClipboardCheck };

const learningItems = [
  { href: "/onboarding", label: "Lộ trình 30 ngày", icon: Rocket },
  { href: "/kb",         label: "Knowledge Base",   icon: BookOpen },
  { href: "/quy-trinh",  label: "Thư viện quy trình", icon: ClipboardList, short: "Quy trình" },
  { href: "/tai-lieu",   label: "Trung tâm tài liệu", icon: FolderOpen, short: "Tài liệu" },
  { href: "/gop-y-bod",  label: "Góp ý BOD",          icon: MessageSquare },
];
const salesPlaybookItem = { href: "/playbook", label: "Sales Playbook", icon: BookOpenCheck };

const salesItems = [
  { href: "/sales",               label: "Bán hàng",                icon: ShoppingCart },
  { href: "/viec-hom-nay",        label: "Việc hôm nay",            icon: ListChecks },
  { href: "/leads",               label: "Chia lead",               icon: Shuffle },
  { href: "/quiz-leads",          label: "Khách từ Quiz",           icon: Activity },
  { href: "/sales/khach-cua-toi", label: "Khách của tôi",           icon: ClipboardList, badgeKey: "myAssigned" as const },
  { href: "/sales/don-online",    label: "Đơn online",              icon: ShoppingCart, badgeKey: "onlineOrders" as const },
  { href: "/vong-lap-doanh-thu",  label: "Vòng lặp doanh thu",      icon: Repeat, short: "Vòng lặp DT" },
  { href: "/ket-cau-ban-hang",    label: "Kết cấu bán hàng",        icon: Package },
  { href: "/chinh-sach-kenh/bang-gia", label: "Bảng giá v4",        icon: Percent },
  { href: "/dai-ly",              label: "Đại lý & NPP",            icon: Store },
  { href: "/xuong-video",         label: "Xưởng video đại lý",      icon: Video, short: "Xưởng video" },
  { href: "/ra-mat-san-pham",     label: "Ra mắt sản phẩm mới",     icon: Rocket, short: "Ra mắt SP" },
  { href: "/playbook-loi-nhuan",  label: "Profit Playbook",         icon: TrendingUp },
  { href: "/ke-hoach-doanh-thu",  label: "Mục tiêu doanh thu",      icon: Target, short: "Mục tiêu DT" },
  { href: "/bao-cao-sale",        label: "Báo cáo Sale",            icon: BarChart3 },
  { href: "/phan-tich-ban-hang",  label: "Phân tích bán hàng",      icon: PieChart, short: "Phân tích BH" },
  { href: "/nhan-khau-hoc",       label: "Nhân khẩu học khách",     icon: Users, short: "Nhân khẩu học" },
  { href: "/kenh-tuong-tac",      label: "Phễu tương tác",          icon: MessageSquare },
  { href: "/insights/customer",   label: "Kịch bản theo nhóm khách", icon: Lightbulb, short: "Kịch bản tệp KH" },
];

const cskhItems = [
  { href: "/zalo",                label: "Zalo CRM",                icon: Inbox },
  { href: "/khach-nong",          label: "Khách nóng Zalo",         icon: Flame },
  { href: "/link-zalo",           label: "Link mời Zalo",           icon: Link2 },
  { href: "/tin-soan",            label: "Tin chờ duyệt",           icon: MessagesSquare },
  { href: "/thu-bot",             label: "Thử bot trả lời khách",   icon: FlaskConical, short: "Thử bot" },
  { href: "/cham-soc-kh",         label: "Pipeline chăm khách",     icon: Heart, short: "Pipeline chăm" },
  { href: "/don-hang-jt",         label: "Tình trạng đơn J&T",      icon: Truck, short: "Đơn J&T" },
  { href: "/ly-do-hoan",          label: "Lý do hoàn",              icon: PackageX },
  { href: "/ca-truc-ai",          label: "Ca trực AI (soạn sẵn)",   icon: MessagesSquare, short: "Ca trực AI" },
  { href: "/lich-tu-van",         label: "Lịch tư vấn 1-1",         icon: CalendarClock },
  { href: "/hieu-qua-cham-soc",   label: "Hiệu quả chăm sóc",       icon: TrendingUp, short: "Hiệu quả chăm" },
  { href: "/danh-ba-khach",       label: "Khách chờ Zalo",          icon: ClipboardList },
  { href: "/chat-quality",        label: "AI chấm tư vấn",          icon: MessageSquare },
  { href: "/khach-360",           label: "Phân loại khách & VIP",   icon: Users, short: "Khách & VIP" },
  { href: "/tep-khach",           label: "Tệp khách theo dòng SP",  icon: Filter, short: "Tệp khách / SP" },
  { href: "/thu-vien-case",       label: "Thư viện câu chuyện KH",  icon: BookOpenCheck, short: "Thư viện case" },
  { href: "/hoc-vien",            label: "Học viên",                icon: GraduationCap },
  { href: "/seeding",             label: "Cẩm nang Seeding",        icon: BookOpenCheck, short: "Seeding" },
  { href: "/chia-tai-lieu",       label: "Gửi tài liệu cho khách",  icon: FileText, short: "Gửi tài liệu" },
];

const mktItems = [
  { href: "/may-ban-hang",    label: "Máy bán hàng tự động", icon: Zap, short: "Máy bán hàng" },
  { href: "/dispatch",        label: "Dispatch (điều phối)", icon: Network, short: "Dispatch" },
  { href: "/kho-app-ai",      label: "Kho app AI",         icon: Boxes },
  { href: "/quan-tri-app-ai", label: "Quản trị app AI",    icon: Settings },
  { href: "/nhat-ky-ai",      label: "Nhật ký AI",         icon: ClipboardCheck },
  { href: "/lich-chien-dich", label: "Lịch chiến dịch",    icon: CalendarRange },
  { href: "/lich-dang-video", label: "Lịch đăng video",   icon: Video },
  { href: "/ban-tin-tuan",    label: "Bản tin email tuần", icon: Mail, short: "Bản tin tuần" },
  { href: "/tuyen-bai",       label: "Tuyến bài (phễu)",   icon: Route },
  { href: "/content",         label: "Pipeline nội dung",  icon: FileText, short: "Nội dung" },
  { href: "/dang-cheo",       label: "Đăng chéo blog",     icon: Share2, short: "Đăng chéo" },
  { href: "/admin/blog-leads", label: "Khách từ Blog",     icon: UserCheck },
  { href: "/admin/cua-hang",  label: "Cửa hàng web (/shop)", icon: Store, short: "Cửa hàng web" },
  { href: "/admin/don-web",   label: "Đơn web (/shop)",   icon: Receipt, short: "Đơn web" },
  { href: "/chien-luoc-mkt",  label: "Chiến lược MKT",     icon: Lightbulb },
  { href: "/goi-y-report",    label: "Gợi ý báo cáo PR",   icon: Lightbulb },
  { href: "/so-tay-truc-trang", label: "Sổ tay trực trang", icon: ShieldCheck, short: "Sổ tay trực" },
  { href: "/pheu-chien-dich", label: "Phễu & Chiến dịch",  icon: Filter, short: "Phễu chiến dịch" },
  { href: "/nguon-lead",      label: "Nguồn lead về từ đâu", icon: Route, short: "Nguồn lead" },
  { href: "/seo-agent",       label: "Agent SEO: từ khoá, thứ hạng, đối thủ", icon: Search, short: "Agent SEO" },
  { href: "/pheu-mkt",        label: "Phễu MKT: chi → lead → đơn", icon: Gauge, short: "Phễu MKT" },
  { href: "/bao-cao-mkt",     label: "Báo cáo đăng bài",   icon: BarChart3 },
  { href: "/tools/prompter",  label: "Prompter Studio",    icon: Video },
  { href: "/tao-qr",          label: "Tạo mã QR",          icon: QrCode },
];

const khoItems = [
  { href: "/kho",                label: "Quản lý Kho",      icon: Package },
  { href: "/doi-soat-jt",        label: "Đối soát J&T",     icon: Truck },
  { href: "/doi-soat-san",        label: "Đối soát sàn Shopee/TikTok", icon: Store, short: "Đối soát sàn" },
];

const financeItems = [
  { href: "/bao-cao-thang",        label: "Báo cáo tháng",        icon: CalendarRange },
  { href: "/bao-cao-tai-chinh",    label: "Báo cáo tài chính",    icon: Scale, short: "BC tài chính" },
  { href: "/tai-chinh",            label: "Chi phí & Lợi nhuận",  icon: Banknote, short: "Chi phí & Lãi" },
  { href: "/chi-phi-cong-cu",      label: "Chi phí công cụ",      icon: Wallet },
  { href: "/doanh-thu",            label: "Doanh thu tay",        icon: Receipt },
  { href: "/hoa-hong-sale",        label: "Hoa hồng Sale",        icon: Percent },
  { href: "/phan-tich-km",         label: "Phân tích khuyến mãi", icon: Tag, short: "Phân tích KM" },
  { href: "/gan-don",              label: "Gán đơn cho sale",     icon: UserCheck },
  { href: "/bang-luong",           label: "Bảng lương",           icon: Receipt },
  { href: "/admin/products",       label: "Sản phẩm & Giá vốn",   icon: Boxes, short: "SP & Giá vốn" },
  { href: "/admin/ke-toan",        label: "Kế toán & Bank",       icon: Banknote },
  { href: "/email",                label: "Email công ty",        icon: Mail },
];

const financeConfigItems = [
  { href: "/admin/livestream",     label: "Thưởng Livestream",    icon: Video, short: "Thưởng Live" },
];

const financeAdminItems = [
  { href: "/admin/payroll-import", label: "Import lương",         icon: FileSpreadsheet },
  { href: "/admin/bonus-rules",    label: "Bậc thưởng",           icon: Settings },
  { href: "/admin/loans",          label: "Nợ vay & Lãi suất",    icon: Landmark, short: "Nợ vay & Lãi" },
];

const biItems = [

  { href: "/may-chay-ngam",     label: "Máy chạy ngầm",        icon: Activity },
  { href: "/thi-tran-may",      label: "Thị trấn máy",         icon: Castle },
  { href: "/suc-khoe-cron",     label: "Sức khỏe Cron",        icon: Radar },
  { href: "/loc-cv",            label: "Lọc CV bằng AI",       icon: FileText },
  { href: "/chi-so",            label: "Bảng chỉ số",     icon: PieChart, short: "Chỉ số" },
  { href: "/trung-tam-chi-huy", label: "Trung tâm chỉ huy", icon: Gauge, short: "Chỉ huy" },
  { href: "/chien-dich-live",   label: "Chiến dịch Live", icon: Radar },
  { href: "/he-dieu-hanh-ai",   label: "Bản đồ Hệ điều hành AI", icon: Network, short: "Bản đồ HĐH AI" },
  { href: "/tri-nho",           label: "Đồ thị trí nhớ",   icon: BrainCircuit, short: "Trí nhớ" },
  { href: "/giam-doc-ai",       label: "Giám đốc KD (Trợ lý AI)", icon: Brain, short: "Giám đốc KD" },
  { href: "/ban-do-chien-luoc", label: "Bản đồ chiến lược", icon: MapIcon, short: "Chiến lược" },
  { href: "/diem-phong-ban",    label: "Điểm phòng ban",   icon: LayoutGrid },
  { href: "/chinh-sach-kenh",   label: "Chính sách kênh",  icon: Percent },

  { href: "/dashboard",         label: "Dashboard BI",     icon: BarChart3 },
  { href: "/tracking",          label: "Phễu mua hàng",    icon: Filter },
  { href: "/trai-nghiem-kh",    label: "Trải nghiệm KH (CX)", icon: Heart, short: "Trải nghiệm KH" },
  { href: "/doanh-thu-san-pham", label: "DT theo mặt hàng", icon: Package },
  { href: "/doi-chieu-bao-cao", label: "Đối chiếu báo cáo", icon: ClipboardCheck, short: "Đối chiếu BC" },
  { href: "/danh-gia-ca-nhan",  label: "Đánh giá cá nhân", icon: Award },
  { href: "/cuoc-goi",          label: "Ghi âm cuộc gọi",  icon: PhoneCall },
  { href: "/du-an",             label: "Dự án",            icon: FolderKanban },
];
const biFinanceItems = [
  { href: "/bang-dieu-hanh",   label: "Bảng điều hành", icon: BarChart3 },
  { href: "/tai-san",          label: "Bảng Tài Sản",   icon: Landmark },
  { href: "/can-doi",          label: "Cân đối nhanh",  icon: Scale },
];

const investorItems = [
  { href: "/tuan-thu",          label: "Tuân thủ pháp lý",  icon: Shield },
  { href: "/phap-che",          label: "Sổ pháp chế",       icon: Scale },
];

const hrItems = [
  { href: "/nhan-su",            label: "Nhân sự",             icon: Users },
  { href: "/phong-ban",          label: "Phòng ban",           icon: Building2 },
  { href: "/chu-ky",             label: "Chu kỳ KPI",          icon: Calendar },
  { href: "/co-che-thuong",      label: "Cơ chế thưởng phòng ban", icon: Award, short: "Cơ chế thưởng" },
  { href: "/hop-dong",           label: "Hồ sơ & Hợp đồng",    icon: FileSignature },
  { href: "/tuyen-dung",         label: "Tuyển dụng",          icon: Briefcase },
  { href: "/cong-cu-nhan-su",    label: "Công cụ tham khảo",   icon: UserSearch },
  { href: "/admin/cham-cong",    label: "Duyệt chấm công",     icon: CalendarCheck, badgeKey: "corrections" as const },
  { href: "/admin/xin-nghi",     label: "Duyệt nghỉ phép",     icon: CalendarClock, badgeKey: "leaves" as const },
  { href: "/admin/daily-report", label: "Duyệt báo cáo",       icon: ClipboardCheck, badgeKey: "reports" as const },
];

const sysItems = [
  { href: "/admin/orders/import", label: "Import đơn CSV", icon: Upload },
  { href: "/admin/push",          label: "Thông báo điện thoại", icon: BellRing, short: "Push điện thoại" },
  { href: "/admin/bang-viec",     label: "Bảng việc iMac", icon: ListChecks },
];
const securityItem = { href: "/admin/accounts", label: "Kho tài khoản", icon: KeyRound };
const secretVaultItem = { href: "/admin/api-keys", label: "Két API Key", icon: KeyRound };

const ALL_NAV_ITEMS: { href: string; label: string; icon: any; external?: boolean; short?: string }[] = [
  ...personalItems, briefItem, giongItem, hopDuyetItem, ...learningItems, salesPlaybookItem,
  ...salesItems, ...cskhItems, ...mktItems, ...khoItems,
  ...financeItems, ...financeConfigItems, ...financeAdminItems,
  ...biItems, ...biFinanceItems, ...investorItems, ...hrItems, ...sysItems, securityItem, secretVaultItem,
];
const NAV_BY_HREF = new Map(ALL_NAV_ITEMS.map(it => [it.href, it] as const));

type Badges = { leaves: number; corrections: number; reports: number; total: number; myAssigned: number; onlineOrders: number };

export function Sidebar({ user, badges, open = false, onClose }: { user: AppUser; badges?: Badges; open?: boolean; onClose?: () => void }) {
  const { t: tDich } = useLang();
  const pathname = usePathname();
  const { t } = useLang();
  const admin = roleIsAdmin(user.role);
  const manager = isManagerOrAbove(user.role);
  const bod = isBodRole(user.role);
  const pos = (user as any).position;
  const email = (user.email || "").toLowerCase().trim();
  const fullTruInvestor = isFullTruInvestor(email);
  const inFinanceWL = admin || WL.includes(email) || fullTruInvestor;
  const isSale = isSalePosition(pos);
  const isMkt = isMktPosition(pos) && !isSale;
  const isCskh = isCskhPosition(pos);
  const isKho = isKhoPosition(pos);
  const isFinance = isAccountantPosition(pos);
  const accountantView = isFinance;
  const noAtt = WL.includes(email);

  let personalForUser = [...personalItems];
  if (bod) personalForUser = personalForUser.filter(it => it.href === "/");
  else if (manager || isSale) personalForUser = [personalItems[0], briefItem, ...personalItems.slice(1)];
  if (noAtt) personalForUser = personalForUser.filter(it => it.href !== "/cham-cong");
  if (!bod && (manager || isSale || isCskh || isMkt)) personalForUser = [personalForUser[0], hopDuyetItem, ...personalForUser.slice(1)];
  if (user.role === "admin" || user.role === "ceo") personalForUser = [personalForUser[0], giongItem, ...personalForUser.slice(1)];
  if (manager) personalForUser = [...personalForUser, dichHopItem];

  const learningForUser = [
    ...learningItems,
    ...((isSale || manager) ? [salesPlaybookItem] : []),
  ];

  const b: Badges = badges || { leaves: 0, corrections: 0, reports: 0, total: 0, myAssigned: 0, onlineOrders: 0 };

  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setCollapsed(JSON.parse(localStorage.getItem("sidebar_collapsed") || "{}")); } catch { } }, []);
  const toggle = (t: string) => setCollapsed(c => { const n = { ...c, [t]: !c[t] }; try { localStorage.setItem("sidebar_collapsed", JSON.stringify(n)); } catch { } return n; });

  const [pins, setPins] = useState<string[]>([]);
  useEffect(() => { try { setPins(JSON.parse(localStorage.getItem("sidebar_pins") || "[]")); } catch { } }, []);
  const togglePin = (href: string) => setPins(p => {
    const n = p.includes(href) ? p.filter(x => x !== href) : [...p, href];
    try { localStorage.setItem("sidebar_pins", JSON.stringify(n)); } catch { }
    return n;
  });
  const isPinned = (href: string) => pins.includes(href);
  const pinnedItems = pins.map(h => NAV_BY_HREF.get(h)).filter(Boolean) as { href: string; label: string; icon: any; external?: boolean; short?: string }[];
  const nq = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const matchLabel = (l: string) => !nq || norm(l).includes(nq) || norm(t(l)).includes(nq);

  const roleLabel =
    user.role === "admin" || user.role === "ceo" ? { text: "ADMIN", color: "bg-red-100 text-red-700 border-red-200" } :
    user.role === "manager" ? { text: "MANAGER", color: "bg-blue-100 text-blue-700 border-blue-200" } :
    user.role === "bod" ? { text: "BOD", color: "bg-indigo-100 text-indigo-700 border-indigo-200" } :
    user.role === "bod_viewer" ? { text: "BOD XEM", color: "bg-indigo-50 text-indigo-700 border-indigo-200" } :
    { text: t("NHÂN VIÊN"), color: "bg-gray-100 text-gray-600 border-gray-200" };

  const renderGroup = (
    title: string | null,
    items: { href: string; label: string; icon: any; badgeKey?: "leaves" | "corrections" | "reports" | "myAssigned" | "onlineOrders"; external?: boolean; short?: string }[],
    accentClass: string,
    GroupIcon?: any
  ) => {
    const shown = items.filter(it => matchLabel(it.label));
    if (!shown.length) return null;
    const hasActive = shown.some(it => !it.external && (pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href))));

    const defaultCollapsed = title ? !DEFAULT_OPEN.has(title) : false;
    const isCollapsed = !nq && title ? (collapsed[title] ?? defaultCollapsed) : false;
    const open = !title || nq || !isCollapsed || hasActive;

    const twoCol = shown.length >= 8;
    return (
    <>
      {title && (
        <button onClick={() => toggle(title)} className="w-full pt-4 pb-1 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 hover:text-gray-600">
          {GroupIcon && <GroupIcon className="w-3.5 h-3.5 shrink-0" />} <span className="flex-1 text-left">{t(title)}</span>
          {!nq && <ChevronDown className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`} />}
        </button>
      )}
      {open && (
      <div className={`grid grid-cols-1 gap-y-0.5 ${twoCol ? "md:grid-cols-2 md:gap-x-1" : ""}`}>
      {shown.map(({ href, label, icon: Icon, badgeKey, external, short }) => {
        const active = !external && (pathname === href || (href !== "/" && pathname.startsWith(href)));
        const badgeCount = badgeKey ? b[badgeKey] : 0;
        const pinned = isPinned(href);

        const disp = twoCol && short ? short : label;

        const dense = twoCol ? `md:gap-2 md:pl-2 md:text-[12.5px] ${external ? "md:pr-0" : pinned ? "md:pr-6" : "md:pr-2"}` : "";
        const cls = `relative flex items-center gap-3 pl-3 pr-8 py-2 rounded-xl text-sm transition ${dense} ${
          active ? "bg-gradient-to-r from-[#0B1F14] to-[#143020] text-[#F5C518] font-semibold shadow-sm dark:bg-none dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-1 dark:ring-inset dark:ring-emerald-400/25 dark:shadow-[0_0_18px_-6px_rgba(16,185,129,0.55)]" : "text-gray-600 font-medium hover:bg-gray-100/70 hover:text-gray-900"
        }`;
        const inner = (
          <>
            {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-current" />}
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate flex-1">{t(disp)}</span>
            {external && <ArrowUpRight className="w-3 h-3 text-gray-400 shrink-0" />}
            {badgeCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center animate-pulse">
                {badgeCount}
              </span>
            )}
          </>
        );
        const row = external
          ? <a href={href} target="_blank" rel="noopener noreferrer" title={t(label)} className={cls}>{inner}</a>
          : <Link href={href} title={t(label)} className={cls}>{inner}</Link>;
        return (
          <div key={href} className="relative group min-w-0">
            {row}
            {!external && (
              <button type="button" aria-label={pinned ? tDich("Bỏ ghim") : tDich("Ghim lên đầu")} title={pinned ? tDich("Bỏ ghim") : tDich("Ghim lên đầu")}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(href); }}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-200/60 transition ${twoCol ? "md:right-0" : ""} ${
                  pinned ? "text-amber-500 opacity-100" : "text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-500"
                }`}>
                <Star className={`w-3.5 h-3.5 ${twoCol ? "md:w-3 md:h-3" : ""}`} fill={pinned ? "currentColor" : "none"} />
              </button>
            )}
          </div>
        );
      })}
      </div>
      )}
    </>
    );
  };

  const inner = (
    <>
      <div className="px-5 py-5 border-b border-gray-200 flex items-center gap-3 bg-gradient-to-br from-[#0B1F14] to-[#143020]">
        <div className="w-10 h-10 flex items-center justify-center">
          <Image src="/logo/acme-mark.svg" alt="ACME" width={36} height={36} priority />
        </div>
        <div>
          <div className="font-bold text-base text-white" style={{ letterSpacing: "0.05em" }}>ACME</div>
          <div className="text-xs text-[#F5C518]" style={{ letterSpacing: "0.15em" }}>CORP</div>
        </div>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        <div className="relative px-1 pb-1.5">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm trang…")}
            className="w-full pl-9 pr-2 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition" />
        </div>

        {pinnedItems.length > 0 && renderGroup("Ghim", pinnedItems, "bg-amber-50 text-amber-800", Star)}


        {renderGroup(tDich("Cá nhân"), personalForUser, "bg-brand-50 text-brand-700", Home)}

        {bod && renderGroup(tDich("Báo cáo chung"), [
          { href: "/dashboard", label: "Dashboard BI", icon: BarChart3 },
          { href: "/chi-so", label: tDich("Bảng chỉ số"), icon: PieChart, short: tDich("Chỉ số") },
          { href: "/bao-cao-thang", label: tDich("Báo cáo tháng"), icon: CalendarRange },
          { href: "/gop-y-bod", label: tDich("Góp ý BOD"), icon: MessageSquare },
          ...(user.role === "bod" ? [{ href: "/admin/bang-viec", label: tDich("Bảng việc iMac"), icon: ListChecks }] : []),
        ], "bg-indigo-50 text-indigo-700", BarChart3)}

        {!bod && renderGroup(tDich("Đào tạo & Văn hoá"), learningForUser, "bg-yellow-50 text-yellow-800", GraduationCap)}

        {!bod && (manager || isSale) && renderGroup(tDich("Bán hàng"), salesItems, "bg-blue-50 text-blue-700", Briefcase)}

        {!bod && (manager || isSale || isCskh) && renderGroup(tDich("Chăm sóc khách hàng"), cskhItems, "bg-rose-50 text-rose-700", Heart)}

        {!bod && (manager || isMkt) && renderGroup("Marketing", mktItems, "bg-pink-50 text-pink-700", Megaphone)}

        {!bod && (isFinance || (manager && inFinanceWL)) && renderGroup(tDich("Tài chính & Kế toán"),
          [...financeItems, ...financeConfigItems, ...(admin ? financeAdminItems : [])],
          "bg-amber-50 text-amber-800", Wallet)}

        {!bod && (manager || isKho) && renderGroup(tDich("Kho & Vận hành"), khoItems, "bg-orange-50 text-orange-700", Package)}

        {!bod && manager && renderGroup(tDich("Điều hành & BI"),
          [...biItems, ...(inFinanceWL ? biFinanceItems : [])],
          "bg-purple-50 text-purple-700", BarChart3)}

        {!bod && canViewDataroom(user as any) && renderGroup(tDich("Investor & Pháp lý"), investorItems, "bg-indigo-50 text-indigo-700", Landmark)}

        {admin && (
          <>
            <div className="my-3 border-t border-gray-200" />
            <div className="px-3 py-1 text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1 justify-between">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {t("KHU VỰC ADMIN")}</span>
              {b.total > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse normal-case">
                  {b.total} {t("cần duyệt")}
                </span>
              )}
            </div>
            {renderGroup(tDich("Quản trị"), [...hrItems, ...sysItems, secretVaultItem, ...(inFinanceWL ? [securityItem] : [])], "bg-brand-50 text-brand-700", Users)}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-gray-200 flex items-center gap-3 bg-gray-50">
        <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
          {user.full_name?.[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{user.full_name}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${roleLabel.color}`}>{roleLabel.text}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex w-80 shrink-0 bg-white border-r border-gray-200 flex-col">
        {inner}
      </aside>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <aside
            className="absolute inset-y-0 left-0 w-72 max-w-[82%] bg-white flex flex-col shadow-2xl animate-[slidein_.2s_ease-out]"
            onClick={(e) => { if ((e.target as HTMLElement).closest("a")) onClose?.(); }}
          >
            {inner}
          </aside>
          <style jsx>{`@keyframes slidein{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
        </div>
      )}
    </>
  );
}
