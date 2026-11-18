import { getServiceClient } from "@/lib/supabase-server";
import { checkAllSources, type SourceHealth } from "@/lib/watchdog";
import { APP_URL } from "@/lib/app-url";

export type NoiChay = "server" | "mac";
export type TrangThai = "chay" | "chet" | "chua-ro" | "tat";

export type KieuDo = "lich" | "tuc-thoi" | "tat";

export type CachChayLai =

  | { kieu: "cron"; route: string }

  | { kieu: "mac"; args: string[] }

  | { kieu: "nguoi"; lenh: string };

export type MayChay = {
  key: string;
  ten: string;
  chuoi: string;
  noiChay: NoiChay;
  trangThai: TrangThai;
  tuoiGio: number | null;
  tranGio: number;
  ghiChu: string;
  cachSua: string;
  chiThamKhao: boolean;
  kieuDo: KieuDo;
  chayLai: CachChayLai;
};

export type DayChuyen = { ma: string; ten: string; moTa: string; may: MayChay[] };

export type YeuCauChayLai = {
  key: string; ten: string; args: string[];
  boi: string; luc: string;
  xong?: string; ok?: boolean; loi?: string;
};

export const KHOA_HANG_DOI = "may_chay_lai_hang_doi";
export const KHOA_SO = "may_chay_lai_so";

const KHAI: Record<string, { chuoi: string; noi: NoiChay; lai: CachChayLai; do?: KieuDo; job?: string }> = {

  tg_boc_don_last: { chuoi: "don-hang", noi: "server", lai: { kieu: "cron", route: "/api/cron/tg-boc-don" } },

  so_don_tele: { chuoi: "don-hang", noi: "server", lai: { kieu: "nguoi", lenh: "sổ đơn trống nghĩa là bot không nghe được nhóm Đơn Hàng — kiểm webhook /api/telegram/brain và quyền đọc tin của bot" } },
  boc_don_tele: { chuoi: "don-hang", noi: "server", lai: { kieu: "cron", route: "/api/cron/tg-boc-don" } },
  jt_session: { chuoi: "don-hang", noi: "mac", lai: { kieu: "nguoi", lenh: "node scripts/jt-login.mjs (có captcha) rồi node scripts/jt-fetch.mjs --days=45 --commit" }, do: "tuc-thoi" },
  jt_waybills: { chuoi: "don-hang", noi: "mac", lai: { kieu: "mac", args: ["scripts/jt-fetch.mjs", "--days=45", "--commit"] } },
  jt_waybills_moi: { chuoi: "don-hang", noi: "mac", lai: { kieu: "mac", args: ["scripts/jt-fetch.mjs", "--days=45", "--commit"] } },
  jt_cod_ky: { chuoi: "don-hang", noi: "mac", lai: { kieu: "mac", args: ["scripts/jt-cod-statements.mjs", "--commit"] }, do: "tuc-thoi" },
  jt_tien_ve_khop: { chuoi: "don-hang", noi: "server", lai: { kieu: "nguoi", lenh: "lệch tiền về là việc ĐỐI SOÁT của kế toán, không phải máy chạy lại — mở /doi-soat-jt" }, do: "tuc-thoi" },
  gmail_inbox_latest: { chuoi: "don-hang", noi: "mac", lai: { kieu: "mac", args: ["scripts/gmail-sync.mjs"] } },

  jt_canh_bao_last: { chuoi: "don-hang", noi: "server", lai: { kieu: "nguoi", lenh: "tin này gửi vào nhóm Sale — chạy lại sẽ bắn trùng. Bắn tay: /api/cron/don-jt-canh-bao?key=<CRON_SECRET>" } },

  shopee_token_last: { chuoi: "don-hang", noi: "server", lai: { kieu: "cron", route: "/api/cron/shopee-token-refresh?force=1" } },
  tts_token_last: { chuoi: "don-hang", noi: "server", lai: { kieu: "cron", route: "/api/cron/tts-token-refresh?force=1" } },
  tts_poll_last: { chuoi: "don-hang", noi: "server", lai: { kieu: "cron", route: "/api/cron/tts-poll" } },

  tts_process_last: { chuoi: "don-hang", noi: "server", lai: { kieu: "nguoi", lenh: "máy này GỬI NHÃN đơn giao tay, tự chạy 3 phút/lượt — đứng lâu thì xem lỗi: /api/cron/tts-process?dry=1, đọc tts_events.error" } },

  san_tiktok_status: { chuoi: "don-hang", noi: "mac", lai: { kieu: "mac", args: ["scripts/san-tiktok-quet.mjs", "--commit"] } },

  jt_reconcile: { chuoi: "don-hang", noi: "mac", lai: { kieu: "mac", args: ["scripts/jt-reconcile.mjs", "--commit"] } },

  aff_day_don: { chuoi: "don-hang", noi: "server", lai: { kieu: "nguoi", lenh: "máy này ĐẨY ĐƠN sang app CTV — chạy đôi có thể cộng trùng. Xem lỗi: /api/cron/day-don-ctv?key=<CRON_SECRET>&dry=1" } },
  bo_bai_doi_tac_soan: { chuoi: "noi-dung", noi: "server", lai: { kieu: "nguoi", lenh: "mỗi lượt soạn THÊM 3 bài nháp, không phải bù. Soạn tay ở /bo-bai-doi-tac (nút Soạn bộ bài hôm nay)" } },
  bo_bai_doi_tac_day: { chuoi: "noi-dung", noi: "server", lai: { kieu: "cron", route: "/api/cron/day-bai-doi-tac" } },
  bo_bai_doi_tac_video_nhip: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "mac", args: ["scripts/video-doi-tac.mjs", "--commit"] } },

  sale_unreplied: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/zalo-cau-noi-do.mjs", "--commit"] } },
  zalo_cau_noi_do_status: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/zalo-cau-noi-do.mjs", "--commit"] } },
  zalo_nhom_tv_status: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "nguoi", lenh: "đếm nhóm chạy trong tiến trình cầu nối (sau 9h10, tự thử lại mỗi giờ) — cầu nối sống thì tự lành; chết thì quét QR lại ở /zalo/ket-noi" } },
  zalo_nghe_tin_sale: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "nguoi", lenh: "khởi động lại cầu nối: launchctl kickstart -k gui/$UID/com.acme.zalo-cau-noi (bridge phải có selfListen:true); vẫn 0 tin ra thì sale đang bỏ khách — mở /hop-thu-zalo" }, do: "tuc-thoi" },
  salework_session_status: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/salework-unreplied.mjs"] } },
  salework_dacham_status: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/salework-da-cham.mjs", "--commit", "--limit=400"] } },
  zalo_hop_thu_status: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/zalo-hop-thu.mjs"] } },
  zalo_unreplied: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/salework-fetch-contacts.mjs", "--commit"] } },
  salework_status: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/salework-inbox.mjs", "--commit"] } },
  zalo_bridge_status: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "nguoi", lenh: "phiên bị đá ra thì phải QUÉT QR lại: mở /zalo/ket-noi, chọn nick, bấm Lấy mã QR" } },
  zalo_nick_song: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "nguoi", lenh: "sale mở /zalo/ket-noi quét QR lại nick đó (đừng đăng nhập lại Salework — hai bên đá nhau)" } },
  zalo_canh_nhom_last: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/zalo-canh-nhom.mjs"] } },

  khach_dongbo_last: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "mac", args: ["scripts/dong-bo-khach-hang.mjs", "--commit"] } },

  zalo_canh_nhom_status: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này GỬI báo cáo tin vi phạm vào Telegram — chạy tay: node scripts/zalo-canh-nhom.mjs --gio=30 (quét trắng = cầu nối Zalo đứt, sale quét QR lại ở /zalo/ket-noi)" } },

  zalo_nick_phien: { chuoi: "khach-zalo", noi: "mac", lai: { kieu: "nguoi", lenh: "nick mất phiên — người cầm nick mở /zalo/ket-noi quét QR lại. Máy không quét hộ được." }, do: "tuc-thoi" },

  fb_unreplied: { chuoi: "khach-fb", noi: "mac", lai: { kieu: "mac", args: ["scripts/fb-unreplied.mjs", "--commit"] } },
  fb_graph_latest: { chuoi: "khach-fb", noi: "mac", lai: { kieu: "mac", args: ["scripts/fb-sync.mjs", "--commit"] } },
  fb_tuong_tac: { chuoi: "khach-fb", noi: "mac", lai: { kieu: "mac", args: ["scripts/fb-tuong-tac.mjs", "--days=14", "--commit"] } },

  fb_may_truc_status: { chuoi: "khach-fb", noi: "server", lai: { kieu: "nguoi", lenh: "máy này NHẮN KHÁCH — không tự chạy lại. Xem công tắc config fb_may_truc" }, do: "tat" },
  ca_truc_ai: { chuoi: "khach-fb", noi: "server", lai: { kieu: "cron", route: "/api/cron/ca-truc-ai?n=25" } },
  care_summary: { chuoi: "khach-fb", noi: "mac", lai: { kieu: "mac", args: ["scripts/build-summary.mjs"] } },
  salework_chat_analysis: { chuoi: "khach-zalo", noi: "server", lai: { kieu: "nguoi", lenh: "AI chấm chất lượng chat ghi vào BẢNG salework_chat_analysis — chạy lại tốn token, xem /chat-quality trước" } },

  fb_comment_agent_last: { chuoi: "khach-fb", noi: "server", lai: { kieu: "nguoi", lenh: "máy này TRẢ LỜI BÌNH LUẬN khách công khai — chạy lại có thể trả lời đôi. Chạy tay: /api/cron/fb-comments?key=<CRON_SECRET>" } },

  mkt_top_posts: { chuoi: "noi-dung", noi: "server", lai: { kieu: "cron", route: "/api/cron/ads-spend" } },

  blog_writer_last: { chuoi: "noi-dung", noi: "server", lai: { kieu: "nguoi", lenh: "mỗi lượt là THÊM một bài mới, không phải bù bài hụt. Muốn chạy thật: /api/cron/blog-writer?key=[CRON_SECRET]" } },
  brand_audit_last: { chuoi: "noi-dung", noi: "server", lai: { kieu: "cron", route: "/api/cron/brand-audit" } },
  chi_muc_quet_last: { chuoi: "noi-dung", noi: "server", lai: { kieu: "cron", route: "/api/cron/chi-muc-quet" } },
  dang_cheo_last: { chuoi: "noi-dung", noi: "server", lai: { kieu: "cron", route: "/api/cron/dang-cheo" } },

  dang_cheo_dang_last: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này ĐĂNG THẬT ra Medium/X/Substack — chạy lại có thể đăng đôi. Máy Mac: node scripts/dang-cheo-dang.mjs --tu-dong" } },
  fb_dang_bai_last: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này ĐĂNG THẬT lên fanpage — chạy lại có thể đăng đôi. Máy Mac: node scripts/fb-dang-bai.mjs" }, job: "com.acme.fb-dang-bai" },
  fb_canh_bai_status: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "mac", args: ["scripts/fb-canh-bai.mjs"] } },

  fb_comment_quyen_page: { chuoi: "noi-dung", noi: "server", lai: { kieu: "nguoi", lenh: "Business Suite > Cài đặt trang > Quyền truy cập: cấp lại vai trò cho tài khoản giữ token FB trên page đang thiếu" }, do: "tuc-thoi" },
  video_poster_status: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này ĐĂNG video lên fanpage. Máy Mac: node scripts/video-poster.mjs --commit" } },
  video_library: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "mac", args: ["scripts/video-poster.mjs", "--scan"] } },
  video_blog_ngay_last: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "mac", args: ["scripts/video-blog/chay-ngay.mjs"] }, job: "com.acme.video-blog" },
  tiktok_nova_may_last: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này ĐĂNG THẬT lên TikTok @novabeauty.wellness. Máy Mac: node scripts/tiktok-nova-may.mjs --dang" } },
  shorts_kenh_phu_last: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "mac", args: ["scripts/video-blog/shorts-kenh-phu.mjs"] } },

  yt_binh_luan_last: { chuoi: "khach-fb", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này TRẢ LỜI bình luận YouTube công khai. Xem trước: npx tsx --tsconfig tsconfig.json scripts/yt-binh-luan.ts --kho" }, job: "com.acme.yt-binh-luan" },
  blog_ngay_last: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "mac", args: ["scripts/blog-ngay.mjs"] } },
  nhan_vat_may_last: { chuoi: "noi-dung", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này ĐĂNG THẬT lên Threads + Instagram. Máy Mac: node scripts/nhan-vat-may.mjs --dang (hoặc --do để chỉ đo)" } },

  ads_campaigns: { chuoi: "quang-cao", noi: "server", lai: { kieu: "cron", route: "/api/cron/ads-spend" } },

  gads_so_ngay: { chuoi: "quang-cao", noi: "mac", lai: { kieu: "nguoi", lenh: "lịch Claude bao-cao-google-ads-hang-ngay (app Claude máy CEO, lái Chrome) — bấm Run now; không chạy được bằng launchd" } },
  meta_chi_3_ngay: { chuoi: "quang-cao", noi: "server", lai: { kieu: "nguoi", lenh: "đo tức thời từ Graph (chỉ đọc) — chiến dịch ACTIVE mà không tiêu thì xem Ads Manager: duyệt quảng cáo, ngân sách, thẻ thanh toán" }, do: "tuc-thoi" },
  fb_binh_luan_lead: { chuoi: "khach-fb", noi: "server", lai: { kieu: "nguoi", lenh: "máy fb-comments TRẢ LỜI/nhắn khách — chạy lại không chữa được nguồn cạn. Xem danh sách page trong config fb_comment_agent" } },
  ad_scout_status: { chuoi: "quang-cao", noi: "mac", lai: { kieu: "mac", args: ["scripts/ad-scout.mjs", "--commit"] } },
  ad_library_scout: { chuoi: "quang-cao", noi: "mac", lai: { kieu: "mac", args: ["scripts/ad-scout.mjs", "--commit"] } },
  fb_user_token_expiry: { chuoi: "quang-cao", noi: "mac", lai: { kieu: "nguoi", lenh: "token hết hạn phải xin lại tay: node scripts/fb-init.mjs" }, do: "tuc-thoi" },
  fb_ads_token_expiry: { chuoi: "quang-cao", noi: "mac", lai: { kieu: "nguoi", lenh: "token system user hết hạn — xin lại trong Business Settings của Meta" }, do: "tuc-thoi" },

  nghien_cuu_last: { chuoi: "quang-cao", noi: "mac", lai: { kieu: "mac", args: ["scripts/nghien-cuu-doi-thu.mjs", "--google"] } },

  web_ngay_last: { chuoi: "bao-cao", noi: "server", lai: { kieu: "cron", route: "/api/cron/web-ngay?bu=7" } },
  seo_web_last: { chuoi: "bao-cao", noi: "server", lai: { kieu: "cron", route: "/api/cron/seo-web-report" } },
  quiz_lead_report_last: { chuoi: "bao-cao", noi: "server", lai: { kieu: "nguoi", lenh: "bản tin này gửi nhóm Sale + CEO — chạy lại là gửi trùng. Xem trước: /api/cron/quiz-lead-report?dry=1" } },
  hoc_the_gioi_last: { chuoi: "bao-cao", noi: "server", lai: { kieu: "cron", route: "/api/cron/hoc-the-gioi?luot=0" } },
  thi_tran_nhac_last: { chuoi: "bao-cao", noi: "server", lai: { kieu: "nguoi", lenh: "tin nhắc gửi chat riêng CEO — chạy lại là gửi trùng. Xem trước: /api/cron/thi-tran-nhac?dry=1" } },
  nhip_tien_bo_last: { chuoi: "bao-cao", noi: "server", lai: { kieu: "cron", route: "/api/cron/nhip-tien-bo" } },
  brain_learn_status: { chuoi: "bao-cao", noi: "server", lai: { kieu: "nguoi", lenh: "vòng học nằm trong bản tin — chạy lại bản tin là gửi trùng. Xem lỗi trong config brain_learn_status" } },
  nhat_ky_hoc_ai_last: { chuoi: "bao-cao", noi: "mac", lai: { kieu: "mac", args: ["scripts/nhat-ky-hoc-ai.mjs"] } },

  nova_app_dosong: { chuoi: "bao-cao", noi: "mac", lai: { kieu: "nguoi", lenh: "chạy trên MacBook (chỉ máy này có khoá app NOVA, iMac không có): node scripts/nova-app-dosong.mjs --ghi — lịch launchd com.acme.nova-app-dosong 9h12, MacBook tắt hôm nào thì hôm đó thiếu số" } },
  luong_thang_last: { chuoi: "bao-cao", noi: "server", lai: { kieu: "nguoi", lenh: "lương là số CEO-only, máy không tự chạy lại. Xem trước: /api/cron/luong-thang?dry=1" } },

  chay_bu_last: { chuoi: "he-thong", noi: "mac", lai: { kieu: "nguoi", lenh: "chính lớp bù đang đứng → máy Mac tắt hoặc launchd rớt: launchctl list | grep chay-bu" } },
  mo_may_don_viec_last: { chuoi: "he-thong", noi: "mac", lai: { kieu: "mac", args: ["scripts/mo-may-don-viec.mjs"] } },
  so_do_may_last: { chuoi: "he-thong", noi: "mac", lai: { kieu: "mac", args: ["scripts/so-do-may-chay-ngam.mjs"] } },

  truc_viec_lap_last: { chuoi: "he-thong", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này GỬI tin báo việc cần người — chạy tay trên máy CEO: node scripts/truc-viec-lap.mjs --bao (xem /tmp/acme-truc-viec-lap.log)" } },
  thu_contact_status: { chuoi: "he-thong", noi: "server", lai: { kieu: "nguoi", lenh: "máy này GỬI thư mới vào Telegram, tự chạy 5 phút/lượt — xem lỗi trong config thu_contact_status; sai mật khẩu thì sửa CONTACT_MAIL_PASS trên Vercel" } },
  push_last: { chuoi: "he-thong", noi: "mac", lai: { kieu: "nguoi", lenh: "máy này GỬI thông báo tới điện thoại sale — chạy tay: node scripts/gen-sale-alerts.mjs; sale 0 thiết bị thì sale bật chuông ở /admin/push" } },
  agent_runs: { chuoi: "he-thong", noi: "server", lai: { kieu: "nguoi", lenh: "sổ việc của máy trống nghĩa là cron không chạy — kiểm trang Deployments của Vercel" } },
  agent_runs_loi: { chuoi: "he-thong", noi: "server", lai: { kieu: "nguoi", lenh: "mở bảng agent_runs lọc status=error để xem việc nào hỏng" } },
  bot_baocao: { chuoi: "he-thong", noi: "server", lai: { kieu: "nguoi", lenh: "bot chết là token/webhook — mở /api/telegram/sale?setup=go&key=<ads_report_token>" }, do: "tuc-thoi" },
  bot_troly: { chuoi: "he-thong", noi: "server", lai: { kieu: "nguoi", lenh: "bot chết là token/webhook — mở /api/telegram/brain?setup=1&key=<CRON_SECRET>" }, do: "tuc-thoi" },
  bot_chamsoc: { chuoi: "he-thong", noi: "server", lai: { kieu: "nguoi", lenh: "kiểm TELEGRAM_CARE_BOT_TOKEN trên Vercel" }, do: "tuc-thoi" },
  web_alive: { chuoi: "he-thong", noi: "server", lai: { kieu: "nguoi", lenh: "web không mở được là sự cố Vercel — mở trang Deployments, xem lượt deploy gần nhất" }, do: "tuc-thoi" },
};

const TEN_CHUOI: Record<string, { ten: string; moTa: string }> = {
  "don-hang": { ten: "Đơn hàng & tiền về", moTa: "Sổ đơn Telegram → vận đơn J&T → sao kê ngân hàng" },
  "khach-zalo": { ten: "Khách Zalo", moTa: "Hội thoại, bằng chứng đã chăm, cầu nối nick" },
  "khach-fb": { ten: "Khách Facebook", moTa: "Hàng chờ trả lời, chỉ số fanpage, ca trực AI" },
  "noi-dung": { ten: "Nội dung & đăng bài", moTa: "Nhà máy content, blog, đăng chéo, video" },
  "quang-cao": { ten: "Quảng cáo", moTa: "Chi tiêu Meta, trinh sát đối thủ, hạn token" },
  "bao-cao": { ten: "Báo cáo & bộ não", moTa: "Bản tin, học thế giới, rà soát tiến bộ, lương" },
  "he-thong": { ten: "Hạ tầng canh gác", moTa: "Lớp bù, sổ việc của máy, ba con bot" },
  khac: { ten: "Chưa xếp dây chuyền", moTa: "Nguồn mới chưa khai trong lib/may-chay-ngam.ts" },
};
const THU_TU = ["don-hang", "khach-zalo", "khach-fb", "noi-dung", "quang-cao", "bao-cao", "he-thong", "khac"];

function doiTrangThai(s: SourceHealth, kieu: KieuDo): TrangThai {
  if (kieu === "tat") return "tat";

  if (kieu === "tuc-thoi") return s.ok ? "chay" : "chet";
  if (s.ok && s.ageHours === null) return "chua-ro";
  return s.ok ? "chay" : "chet";
}

export async function layBanDoMay(): Promise<{
  chuoi: DayChuyen[];
  dem: { tong: number; chay: number; chet: number; chuaRo: number; tat: number; chetKhongChayLaiDuoc: number };
  hangDoi: YeuCauChayLai[];
  nhipMac: { song: boolean; gio: number | null };
}> {
  const sb = getServiceClient();
  const [sources, hangDoiRaw, chayBu, jobTatRaw] = await Promise.all([
    checkAllSources().catch(() => [] as SourceHealth[]),
    docCfg(sb, KHOA_HANG_DOI),
    docCfg(sb, "chay_bu_last"),
    docCfg(sb, "mac_job_tat"),
  ]);

  const jobTat = new Set<string>(
    jobTatRaw?.at && Date.now() - Date.parse(jobTatRaw.at) < 6 * 36e5 && Array.isArray(jobTatRaw.tat) ? jobTatRaw.tat : [],
  );

  const gom = new Map<string, SourceHealth>();
  for (const s of sources) {
    const cu = gom.get(s.key);
    if (!cu || (cu.ok && !s.ok)) gom.set(s.key, s);
  }

  const may: MayChay[] = [...gom.values()].map((s) => {
    const k = KHAI[s.key];
    const tatLenh = !!k?.job && jobTat.has(k.job);
    return {
      key: s.key,
      ten: s.label,
      chuoi: k?.chuoi ?? "khac",
      noiChay: k?.noi ?? "server",

      trangThai: tatLenh || s.tat ? "tat" : doiTrangThai(s, k?.do ?? "lich"),
      tuoiGio: s.ageHours,
      tranGio: s.maxHours,
      ghiChu: tatLenh ? `đang TẮT có chủ đích (launchd ${k!.job} disabled) — ${s.note}` : s.note,
      cachSua: tatLenh ? `Muốn chạy lại thì CEO bật: launchctl enable gui/$(id -u)/${k!.job} — máy này đăng/trả lời ra ngoài, không tự bật.` : s.fix,
      chiThamKhao: !!s.chiThamKhao,
      kieuDo: k?.do ?? "lich",
      chayLai: k?.lai ?? { kieu: "nguoi", lenh: s.fix },
    };
  });

  const chuoi: DayChuyen[] = THU_TU.map((ma) => ({
    ma, ten: TEN_CHUOI[ma].ten, moTa: TEN_CHUOI[ma].moTa,
    may: may.filter((m) => m.chuoi === ma).sort((a, b) => Number(a.trangThai === "chay") - Number(b.trangThai === "chay")),
  })).filter((c) => c.may.length > 0);

  const chet = may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao);
  const gioBu = chayBu?.at ? (Date.now() - Date.parse(chayBu.at)) / 36e5 : null;

  return {
    chuoi,
    dem: {
      tong: may.length,
      chay: may.filter((m) => m.trangThai === "chay").length,
      chet: chet.length,
      chuaRo: may.filter((m) => m.trangThai === "chua-ro").length,
      tat: may.filter((m) => m.trangThai === "tat").length,
      chetKhongChayLaiDuoc: chet.filter((m) => m.chayLai.kieu === "nguoi").length,
    },
    hangDoi: Array.isArray(hangDoiRaw) ? hangDoiRaw : [],

    nhipMac: { song: gioBu !== null && gioBu <= 2, gio: gioBu === null ? null : Math.round(gioBu * 10) / 10 },
  };
}

async function docCfg(sb: any, key: string): Promise<any> {
  try {
    const v = (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value;
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export function timMay(banDo: { chuoi: DayChuyen[] }, key: string): MayChay | null {
  for (const c of banDo.chuoi) { const m = c.may.find((x) => x.key === key); if (m) return m; }
  return null;
}

export async function soatMayChayNgam(sources: SourceHealth[]): Promise<{
  ngayDut: Record<string, number>;
  boMac: { ten: string; ngay: number }[];
  bamHomNay: number;
  bamHong: number;
}> {
  const sb = getServiceClient();
  const [lichSu, so] = await Promise.all([docCfg(sb, "nguon_chet_lich_su"), docCfg(sb, KHOA_SO)]);

  const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const ngayGiua = (tuNgay: string): number => {
    const a = Date.parse(tuNgay + "T00:00:00Z"), b = Date.parse(homNay + "T00:00:00Z");
    return isFinite(a) && isFinite(b) ? Math.max(0, Math.round((b - a) / 864e5)) : 0;
  };

  const chet = sources.filter((s) => !s.ok && !s.chiThamKhao);
  const ngayDut: Record<string, number> = {};
  const boMac: { ten: string; ngay: number }[] = [];
  for (const s of chet) {
    const tu = lichSu?.[s.key]?.tuNgay;
    if (!tu) continue;
    const n = ngayGiua(tu);
    ngayDut[s.key] = n;

    if (n >= 3) boMac.push({ ten: s.label, ngay: n });
  }
  boMac.sort((a, b) => b.ngay - a.ngay);

  const dsBam: any[] = Array.isArray(so) ? so : [];

  const ngayVn = (iso: string) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10);
  const homNayBam = dsBam.filter((r) => r?.luc && ngayVn(String(r.luc)) === homNay);
  return {
    ngayDut, boMac,
    bamHomNay: homNayBam.length,
    bamHong: homNayBam.filter((r) => String(r?.ketQua || "").startsWith("loi")).length,
  };
}

export async function chayLaiMay(key: string, boi: string): Promise<{
  chay: boolean; kieu?: "cron" | "mac"; ok?: boolean | null; canNguoi?: boolean;
  lenh?: string; thongBao: string; route?: string;
}> {
  const banDo = await layBanDoMay();
  const may = timMay(banDo, key);
  if (!may) return { chay: false, thongBao: `Không có cỗ máy nào tên "${key}".` };

  if (may.trangThai !== "chet") {
    return {
      chay: false,
      thongBao: `"${may.ten}" đang chạy bình thường (${may.ghiChu}) — không chạy lại. Máy còn sống mà bấm lại thì chỉ tạo bản trùng.`,
    };
  }

  const sb = getServiceClient();
  const luc = new Date().toISOString();

  if (may.chayLai.kieu === "nguoi") {
    await ghiSoChayLai(sb, { key, ten: may.ten, boi, luc, ketQua: "can-nguoi" });
    return {
      chay: false, canNguoi: true, lenh: may.chayLai.lenh,
      thongBao: `"${may.ten}" không tự chạy lại được (hoặc chạy lại sẽ gửi trùng ra ngoài).`,
    };
  }

  if (may.chayLai.kieu === "cron") {
    const secret = (process.env.CRON_SECRET || "").trim();
    if (!secret) { await ghiSoChayLai(sb, { key, ten: may.ten, boi, luc, ketQua: "loi-thieu-secret" }); return { chay: false, thongBao: "Máy chủ chưa có CRON_SECRET — không gọi được." }; }
    try {

      const r = await fetch(APP_URL + may.chayLai.route, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(45000) });
      await ghiSoChayLai(sb, { key, ten: may.ten, boi, luc, ketQua: r.ok ? "xong" : `loi-${r.status}` });
      return {
        chay: true, kieu: "cron", ok: r.ok, route: may.chayLai.route,
        thongBao: r.ok ? `Đã chạy lại "${may.ten}" xong.` : `Đã gọi "${may.ten}" nhưng nó báo lỗi HTTP ${r.status}.`,
      };
    } catch (e: any) {
      const hetGio = String(e?.name || "").includes("Timeout") || String(e?.message || "").includes("timeout");
      await ghiSoChayLai(sb, { key, ten: may.ten, boi, luc, ketQua: hetGio ? "dang-chay" : "loi-goi" });
      return {
        chay: true, kieu: "cron", ok: null, route: may.chayLai.route,
        thongBao: hetGio
          ? `Đã gọi "${may.ten}". Việc này lâu hơn 45 giây nên nó đang chạy tiếp ở máy chủ — vài phút nữa xem lại.`
          : `Không gọi được "${may.ten}": ${String(e?.message || e).slice(0, 140)}`,
      };
    }
  }

  const hangDoi: YeuCauChayLai[] = Array.isArray(banDo.hangDoi) ? [...banDo.hangDoi] : [];
  if (hangDoi.some((h) => h.key === key && !h.xong)) {
    return { chay: false, kieu: "mac", thongBao: `"${may.ten}" đã nằm trong hàng đợi rồi, chưa tới lượt. ${loiHuaThatMac(banDo.nhipMac)}` };
  }
  hangDoi.push({ key, ten: may.ten, args: may.chayLai.args, boi, luc });
  await sb.from("config").upsert(
    { key: KHOA_HANG_DOI, value: JSON.stringify(hangDoi.slice(-40)), description: "Hàng đợi chạy lại máy cào — scripts/chay-bu.mjs nhặt" },
    { onConflict: "key" },
  );
  await ghiSoChayLai(sb, { key, ten: may.ten, boi, luc, ketQua: "xep-hang" });
  return { chay: true, kieu: "mac", thongBao: `Đã xếp "${may.ten}" vào hàng đợi máy văn phòng. ${loiHuaThatMac(banDo.nhipMac)}` };
}

export function loiHuaThatMac(nhip: { song: boolean; gio: number | null }): string {
  if (nhip.song) return `Máy văn phòng đang chạy (nhịp cuối ${nhip.gio}h trước) — lượt bù kế tiếp trong vòng 30 phút sẽ nhận.`;
  if (nhip.gio === null) return "CẢNH BÁO: máy văn phòng chưa từng báo nhịp — việc sẽ nằm im tới khi bật máy.";
  return `CẢNH BÁO: máy văn phòng đang TẮT (nhịp cuối ${nhip.gio}h trước) — việc nằm im tới khi bật máy.`;
}

async function ghiSoChayLai(sb: any, r: { key: string; ten: string; boi: string; luc: string; ketQua: string }) {
  try {
    const cu = (await sb.from("config").select("value").eq("key", KHOA_SO).maybeSingle()).data?.value;
    const so = cu ? JSON.parse(cu) : [];
    so.push(r);
    await sb.from("config").upsert(
      { key: KHOA_SO, value: JSON.stringify(so.slice(-200)), description: "Sổ bấm chạy lại máy: ai, lúc nào, máy nào, kết quả" },
      { onConflict: "key" },
    );
  } catch {  }
}

export async function banTinSoatMay(): Promise<{ text: string; bamDuoc: { key: string; ten: string }[] }> {
  const banDo = await layBanDoMay();
  const may = banDo.chuoi.flatMap((c) => c.may);
  const chet = may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao);
  const soat = await soatMayChayNgam(
    may.map((m) => ({ key: m.key, label: m.ten, ageHours: m.tuoiGio, maxHours: m.tranGio, ok: m.trangThai !== "chet", note: m.ghiChu, fix: m.cachSua, chiThamKhao: m.chiThamKhao })),
  );

  const L: string[] = [];

  L.push(`MÁY CHẠY NGẦM — ${banDo.dem.chay}/${banDo.dem.tong} chạy · ${banDo.dem.chet} đứt`
    + (banDo.dem.chuaRo ? ` · ${banDo.dem.chuaRo} chưa ghi mốc` : "")
    + (banDo.dem.tat ? ` · ${banDo.dem.tat} tắt theo lệnh` : ""));
  L.push("");
  for (const c of banDo.chuoi) {
    const d = c.may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao).length;
    L.push(`${d ? "ĐỨT" : " ok"}  ${c.ten} — ${c.may.length - d}/${c.may.length}`);
  }
  if (chet.length) {
    L.push("", "ĐANG ĐỨT:");
    for (const m of chet) {
      const n = soat.ngayDut[m.key];
      const cach = m.chayLai.kieu === "nguoi" ? "cần chính tay anh" : m.chayLai.kieu === "cron" ? "bấm là chạy ngay" : "bấm là xếp cho máy văn phòng";
      L.push(`• ${m.ten}${n ? ` — đứt ${n} ngày` : ""} (${cach})`);
      if (m.chayLai.kieu === "nguoi") L.push(`  ${m.chayLai.lenh}`);
    }
  } else {
    L.push("", "Không cỗ máy nào đứt.");
  }
  if (soat.boMac.length) L.push("", `CẢNH BÁO: ${soat.boMac.length} máy đứt từ 3 ngày trở lên chưa ai đụng. Tới mốc này thứ cần quyết là sửa dứt điểm hay chốt bỏ hẳn.`);
  L.push("", `Hôm nay ${soat.bamHomNay} lượt bấm Chạy lại${soat.bamHong ? ` · ${soat.bamHong} lượt bấm rồi vẫn hỏng` : ""}.`);
  const chuaRo = may.filter((m) => m.trangThai === "chua-ro");
  if (chuaRo.length) {
    L.push("", `CHƯA GHI MỐC (chạy theo lịch mà không để lại nhịp — không chứng minh được là đang chạy):`);
    for (const m of chuaRo) L.push(`• ${m.ten} — ${m.ghiChu}`);
  }
  const tat = may.filter((m) => m.trangThai === "tat");
  if (tat.length) L.push("", `TẮT THEO LỆNH: ${tat.map((m) => m.ten).join(" · ")}`);
  L.push(`Bản đầy đủ có sơ đồ: ${APP_URL}/may-chay-ngam`);

  const khongTheHtml = (t: string) => t.replace(/</g, "[").replace(/>/g, "]");
  return { text: khongTheHtml(L.join("\n")), bamDuoc: chet.filter((m) => m.chayLai.kieu !== "nguoi").map((m) => ({ key: m.key, ten: m.ten })) };
}

const HAN_CHO_GIO = 6;

const HAN_BO_QUEN_NGAY = 3;

export async function doHangDoiChayLai(): Promise<{ key: string; label: string; note: string; fix: string }[]> {
  const sb = getServiceClient();
  const [hangDoiRaw, chayBu] = await Promise.all([docCfg(sb, KHOA_HANG_DOI), docCfg(sb, "chay_bu_last")]);
  const cho: YeuCauChayLai[] = (Array.isArray(hangDoiRaw) ? hangDoiRaw : []).filter((h) => h && !h.xong);
  if (!cho.length) return [];

  const gioTu = (iso: string) => (Date.parse(iso) ? (Date.now() - Date.parse(iso)) / 36e5 : null);
  const treo = cho.map((h) => ({ h, gio: gioTu(h.luc) })).filter((x) => x.gio !== null && x.gio > HAN_CHO_GIO)
    .sort((a, b) => (b.gio || 0) - (a.gio || 0));
  if (!treo.length) return [];

  const gioBu = chayBu?.at ? (Date.now() - Date.parse(chayBu.at)) / 36e5 : null;
  const macSong = gioBu !== null && gioBu <= 2;
  const lauNhat = treo[0];
  const ngay = Math.floor((lauNhat.gio || 0) / 24);
  const boQuen = ngay >= HAN_BO_QUEN_NGAY;

  return [{
    key: "chay_lai_khong_troi",
    label: "Việc BẤM CHẠY LẠI mà không trôi",
    note: `${treo.length} việc anh đã bấm Chạy lại nhưng chưa chạy — lâu nhất ${ngay >= 1 ? `${ngay} ngày` : `${Math.round((lauNhat.gio || 0) * 10) / 10}h`} ("${(lauNhat.h.ten || "").slice(0, 50)}").`
      + ` Lớp bù trên máy văn phòng ${macSong ? `còn nhịp ${Math.round((gioBu || 0) * 10) / 10}h trước nhưng KHÔNG nhặt việc` : gioBu === null ? "CHƯA từng báo nhịp" : `đang TẮT (nhịp cuối ${Math.round(gioBu * 10) / 10}h trước)`}.`
      + (boQuen ? " Quá 3 ngày rồi — đây không còn là chờ, mà là bỏ quên." : ""),
    fix: macSong
      ? "Lớp bù còn thở mà việc không trôi — xem /tmp/acme-chay-bu.log trên máy Mac; thường là script của việc đó lỗi ngay khi chạy."
      : "Bật máy Mac là nó tự chạy (mo-may-don-viec chạy lúc mở máy sẽ kích ngay). Chạy tay: node scripts/chay-bu.mjs --commit",
  }];
}
