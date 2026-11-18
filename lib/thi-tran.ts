export type MaPhong = "tlgd" | "th" | "mkt" | "kd" | "cskh" | "vhsp" | "ns" | "tc" | "kt";

export type Phong = {
  id: MaPhong;
  ten: string;

  ngan: string;

  anh: string;
  mau: string;
  moTa: string;

  trang: { href: string; nhan: string }[];
};

export const PHONG_GIUA: Phong = {
  id: "tlgd", ten: "MausBot & Trợ lý Giám đốc", ngan: "MausBot chỉ huy", anh: "tlgd", mau: "#0EA5E9",
  moTa: "MausBot chia việc 9 phòng, duyệt, phân xử; Trợ lý Giám đốc lo bản tin sáng/tối và việc chỉ anh bấm.",
  trang: [{ href: "/bang-dieu-hanh", nhan: "Bảng điều hành" }, { href: "/giam-doc-ai", nhan: "Giám đốc AI" }, { href: "/he-dieu-hanh-ai", nhan: "Hệ điều hành AI" }],
};

export const PHONG_QUANH: Phong[] = [
  { id: "th", ten: "Thương hiệu & Truyền thông", ngan: "Thương hiệu", anh: "th", mau: "#EC4899",
    moTa: "Duyệt gói nội dung trước khi đăng, kênh video/nhân hiệu, đăng chéo, giữ chữ thương hiệu.",
    trang: [{ href: "/content", nhan: "Nội dung" }, { href: "/quy-trinh", nhan: "Brand Bible & quy trình" }, { href: "/dang-cheo", nhan: "Đăng chéo" }] },
  { id: "mkt", ten: "Marketing tăng trưởng", ngan: "Marketing", anh: "mkt", mau: "#F97316",
    moTa: "Fanpage, blog & SEO, quảng cáo Meta, trinh sát đối thủ.",
    trang: [{ href: "/do-luong-mkt", nhan: "Đo lường MKT" }, { href: "/lich-chien-dich", nhan: "Lịch chiến dịch" }, { href: "/chien-luoc-mkt", nhan: "Chiến lược MKT" }] },
  { id: "kd", ten: "Kinh doanh", ngan: "Kinh doanh", anh: "kd", mau: "#3B82F6",
    moTa: "Sàn Shopee/TikTok Shop, khách & lead, cộng tác viên, mục tiêu doanh số.",
    trang: [{ href: "/sales", nhan: "Bán hàng" }, { href: "/leads", nhan: "Chia lead" }, { href: "/doanh-thu", nhan: "Doanh thu" }] },
  { id: "cskh", ten: "Chăm sóc khách hàng", ngan: "CSKH", anh: "cskh", mau: "#6366F1",
    moTa: "Trực hộp thư Zalo/Facebook theo ca, ca trực AI soạn sẵn câu trả lời, bình luận.",
    trang: [{ href: "/hop-thu-zalo", nhan: "Hộp thư Zalo" }, { href: "/ca-truc-ai", nhan: "Ca trực AI" }, { href: "/cham-soc-kh", nhan: "Chăm sóc KH" }] },
  { id: "vhsp", ten: "Vận hành & Sản phẩm", ngan: "Vận hành", anh: "vhsp", mau: "#F59E0B",
    moTa: "Sổ đơn Telegram, giao hàng J&T, kho, app NOVA, hồ sơ sản phẩm.",
    trang: [{ href: "/kho", nhan: "Kho" }, { href: "/don-hang-jt", nhan: "Đơn J&T" }, { href: "/gan-don", nhan: "Gán đơn" }] },
  { id: "tc", ten: "Tài chính & Gọi vốn", ngan: "Tài chính", anh: "tc", mau: "#10B981",
    moTa: "Đối soát tiền về, lương tháng, số liệu cho nhà đầu tư.",
    trang: [{ href: "/bao-cao-tai-chinh", nhan: "Báo cáo tài chính" }, { href: "/doanh-thu", nhan: "Doanh thu" }] },
  { id: "ns", ten: "Nhân sự & Văn hóa", ngan: "Nhân sự", anh: "ns", mau: "#F43F5E",
    moTa: "Nhân sự, nội quy, hợp đồng, đào tạo, kho kiến thức công ty (Second Brain).",
    trang: [{ href: "/nhan-su", nhan: "Nhân sự" }, { href: "/kb", nhan: "Kho kiến thức" }, { href: "/onboarding", nhan: "Onboarding" }] },
  { id: "kt", ten: "Kỹ thuật & Dữ liệu", ngan: "Kỹ thuật", anh: "kt", mau: "#14B8A6",
    moTa: "Canh gác hạ tầng, lớp bù, sổ việc của máy, deploy, 56 job trên máy văn phòng.",
    trang: [{ href: "/may-chay-ngam", nhan: "Máy chạy ngầm" }, { href: "/nhat-ky-ai", nhan: "Nhật ký AI" }, { href: "/he-dieu-hanh-ai", nhan: "Hệ điều hành AI" }] },
];

export const MOI_PHONG: Phong[] = [PHONG_GIUA, ...PHONG_QUANH];
export const timPhong = (id: string): Phong | undefined => MOI_PHONG.find((p) => p.id === id);

export type KieuBan = "may-tinh" | "cskh" | "dong-goi" | "studio" | "ke-toan" | "server";

export const BO_PHAN: Record<MaPhong, { ten: string; ban: KieuBan }[]> = {
  tlgd: [{ ten: "Trợ lý & bản tin", ban: "may-tinh" }],
  th: [{ ten: "Video & kênh", ban: "studio" }, { ten: "Đăng chéo", ban: "may-tinh" }, { ten: "Kiểm duyệt thương hiệu", ban: "may-tinh" }],
  mkt: [{ ten: "Fanpage", ban: "may-tinh" }, { ten: "Blog & SEO", ban: "may-tinh" }, { ten: "Quảng cáo", ban: "may-tinh" }],
  kd: [{ ten: "Sàn TMĐT", ban: "dong-goi" }, { ten: "Khách & lead", ban: "cskh" }, { ten: "Cộng tác viên", ban: "may-tinh" }],
  cskh: [{ ten: "Zalo", ban: "cskh" }, { ten: "Facebook & YouTube", ban: "cskh" }, { ten: "Ca trực AI", ban: "may-tinh" }, { ten: "Hộp thư", ban: "may-tinh" }],
  vhsp: [{ ten: "Sổ đơn", ban: "may-tinh" }, { ten: "Giao hàng J&T", ban: "dong-goi" }, { ten: "App NOVA", ban: "may-tinh" }],
  tc: [{ ten: "Đối soát tiền", ban: "ke-toan" }, { ten: "Lương", ban: "ke-toan" }],
  ns: [{ ten: "Kho kiến thức", ban: "may-tinh" }],
  kt: [{ ten: "Hạ tầng", ban: "server" }, { ten: "Sổ máy", ban: "server" }],
};

export const MAY_VAO_PHONG: Record<string, [MaPhong, string]> = {

  so_don_tele: ["vhsp", "Sổ đơn"], boc_don_tele: ["vhsp", "Sổ đơn"],
  jt_waybills_moi: ["vhsp", "Giao hàng J&T"], jt_waybills: ["vhsp", "Giao hàng J&T"], jt_session: ["vhsp", "Giao hàng J&T"],
  jt_canh_bao_last: ["vhsp", "Giao hàng J&T"], jt_reconcile: ["vhsp", "Giao hàng J&T"],
  nova_app_dosong: ["vhsp", "App NOVA"],

  jt_cod_ky: ["tc", "Đối soát tiền"], jt_tien_ve_khop: ["tc", "Đối soát tiền"], gmail_inbox_latest: ["tc", "Đối soát tiền"],
  luong_thang_last: ["tc", "Lương"],

  zalo_nick_song: ["cskh", "Zalo"], zalo_nghe_tin_sale: ["cskh", "Zalo"], zalo_bridge_status: ["cskh", "Zalo"],
  zalo_cau_noi_do_status: ["cskh", "Zalo"], zalo_nhom_tv_status: ["cskh", "Zalo"],
  fb_may_truc_status: ["cskh", "Facebook & YouTube"], fb_unreplied: ["cskh", "Facebook & YouTube"], yt_binh_luan_last: ["cskh", "Facebook & YouTube"],
  fb_comment_agent_last: ["cskh", "Facebook & YouTube"], fb_comment_quyen_page: ["cskh", "Facebook & YouTube"],
  ca_truc_ai: ["cskh", "Ca trực AI"], thu_contact_status: ["cskh", "Hộp thư"],

  shopee_token_last: ["kd", "Sàn TMĐT"], san_tiktok_status: ["kd", "Sàn TMĐT"], tts_process_last: ["kd", "Sàn TMĐT"],
  tts_poll_last: ["kd", "Sàn TMĐT"], tts_token_last: ["kd", "Sàn TMĐT"],
  quiz_lead_report_last: ["kd", "Khách & lead"], khach_dongbo_last: ["kd", "Khách & lead"], push_last: ["kd", "Khách & lead"],
  aff_day_don: ["kd", "Cộng tác viên"],
  bo_bai_doi_tac_soan: ["kd", "Cộng tác viên"],
  bo_bai_doi_tac_day: ["kd", "Cộng tác viên"],
  bo_bai_doi_tac_video_nhip: ["kd", "Cộng tác viên"],

  video_library: ["th", "Video & kênh"], video_poster_status: ["th", "Video & kênh"], video_blog_ngay_last: ["th", "Video & kênh"],
  shorts_kenh_phu_last: ["th", "Video & kênh"], tiktok_nova_may_last: ["th", "Video & kênh"], nhan_vat_may_last: ["th", "Video & kênh"],
  dang_cheo_last: ["th", "Đăng chéo"], dang_cheo_dang_last: ["th", "Đăng chéo"],
  brand_audit_last: ["th", "Kiểm duyệt thương hiệu"], zalo_canh_nhom_status: ["th", "Kiểm duyệt thương hiệu"],

  fb_graph_latest: ["mkt", "Fanpage"], mkt_top_posts: ["mkt", "Fanpage"], fb_dang_bai_last: ["mkt", "Fanpage"],
  blog_writer_last: ["mkt", "Blog & SEO"], blog_ngay_last: ["mkt", "Blog & SEO"], chi_muc_quet_last: ["mkt", "Blog & SEO"],
  seo_web_last: ["mkt", "Blog & SEO"], web_ngay_last: ["mkt", "Blog & SEO"],
  fb_user_token_expiry: ["mkt", "Quảng cáo"], ads_campaigns: ["mkt", "Quảng cáo"], ad_scout_status: ["mkt", "Quảng cáo"],
  ad_library_scout: ["mkt", "Quảng cáo"], nghien_cuu_last: ["mkt", "Quảng cáo"],
  gads_so_ngay: ["mkt", "Quảng cáo"], meta_chi_3_ngay: ["mkt", "Quảng cáo"], fb_binh_luan_lead: ["cskh", "Facebook & YouTube"],

  hoc_the_gioi_last: ["ns", "Kho kiến thức"], nhat_ky_hoc_ai_last: ["ns", "Kho kiến thức"],

  web_alive: ["kt", "Hạ tầng"], chay_bu_last: ["kt", "Hạ tầng"], truc_viec_lap_last: ["kt", "Hạ tầng"],
  agent_runs: ["kt", "Sổ máy"], so_do_may_last: ["kt", "Sổ máy"],

  brain_learn_status: ["tlgd", "Trợ lý & bản tin"], thi_tran_nhac_last: ["tlgd", "Trợ lý & bản tin"], nhip_tien_bo_last: ["tlgd", "Trợ lý & bản tin"],
};

const PHONG_THEO_CHUOI: Record<string, MaPhong> = {
  "don-hang": "vhsp", "khach-zalo": "cskh", "khach-fb": "cskh", "noi-dung": "th",
  "quang-cao": "mkt", "bao-cao": "tlgd", "he-thong": "kt", khac: "kt",
};

export function phongCuaMay(key: string, chuoi: string): { phong: MaPhong; boPhan: string } {
  const k = MAY_VAO_PHONG[key];
  if (k) return { phong: k[0], boPhan: k[1] };
  return { phong: PHONG_THEO_CHUOI[chuoi] ?? "kt", boPhan: "Khác" };
}

const MA_PHONG = new Set<string>(MOI_PHONG.map((p) => p.id));

export function phongCuaViecGrok(ma: string, moTa = "", phongKhai?: string | null): MaPhong {
  const khai = String(phongKhai ?? "").trim().toLowerCase();
  if (MA_PHONG.has(khai)) return khai as MaPhong;
  const tienTo = String(ma).split(/[-_ ]/)[0].toLowerCase();
  if (MA_PHONG.has(tienTo)) return tienTo as MaPhong;
  const s = `${ma} ${moTa}`.toLowerCase();
  const LUAT: [RegExp, MaPhong][] = [
    [/dang-nhap|phien|imac|api|sql|deploy|bang-viec|cron|launchd|khong-khoa|lich-ngu|may-|server|vercel|supabase/, "kt"],
    [/luong|von|tai-chinh|nha-dau-tu|doi-soat|ngan-hang/, "tc"],
    [/zalo|cskh|inbox|binh-luan/, "cskh"],
    [/shopee|tiktok-shop|san-|\bsan\b|aff|ctv|lead|khach-cu/, "kd"],
    [/blog|seo|ads|quang-cao|fanpage|pin|linkedin/, "mkt"],
    [/video|kich-ban|anh|logo|khung-hinh|thuong-hieu|de-\d|nhan-hieu|th-/, "th"],
    [/jt|kho|don|dam|san-pham|app/, "vhsp"],
    [/nhan-su|hop-dong|noi-quy|dao-tao|van-hoa/, "ns"],
  ];
  for (const [re, p] of LUAT) if (re.test(s)) return p;
  return "tlgd";
}

export const DAU_GIAO_VIEC = "GIAO_VIEC:";
export function tachGiaoViec(traLoi: string): { chu: string; viec: string | null } {
  const dong = traLoi.split("\n");
  const i = dong.findIndex((d) => d.trim().toUpperCase().startsWith(DAU_GIAO_VIEC));
  if (i < 0) return { chu: traLoi.trim(), viec: null };
  const viec = dong[i].trim().slice(DAU_GIAO_VIEC.length).trim();
  const chu = dong.filter((_, j) => j !== i).join("\n").trim();
  return { chu, viec: viec || null };
}

export const duAnPhong = (p: MaPhong) => `thi-tran:${p}`;
export function phongCuaDuAn(project: string): MaPhong | null {
  const m = /^thi-tran:([a-z]+)$/.exec(String(project || ""));
  return m && MA_PHONG.has(m[1]) ? (m[1] as MaPhong) : null;
}
