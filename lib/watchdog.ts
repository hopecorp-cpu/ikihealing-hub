import { getServiceClient } from "@/lib/supabase-server";
import { APP_URL } from "@/lib/app-url";
import { vnDateStr } from "@/lib/payroll";
import { nhomDon } from "@/lib/tg-orderbook";
import { tongDoanhThu } from "@/lib/doanh-thu";

export type SourceHealth = { key: string; label: string; ageHours: number | null; maxHours: number; ok: boolean; note: string; fix: string; chiThamKhao?: boolean;

  tat?: boolean };

const now = () => Date.now();
const hoursSince = (iso: any): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return null;
  return Math.max(0, Math.round((now() - t) / 3600e3 * 10) / 10);
};

const pickTs = (o: any): any => {
  if (typeof o === "string") return Number.isFinite(Date.parse(o)) ? o : null;
  return o?.generatedAt || o?.updatedAt || o?.handledAt || o?.at || o?.lastAt || o?.time || null;
};

const DOC_SAN = new WeakMap<object, Map<string, any>>();

async function docSanCfg(sb: any, keys: string[]): Promise<void> {
  const m = new Map<string, any>();
  try {
    const { data, error } = await sb.from("config").select("key, value").in("key", keys);
    if (error) return;
    for (const k of keys) m.set(k, null);
    for (const r of data || []) m.set(r.key, r.value);
    DOC_SAN.set(sb, m);
  } catch {  }
}

async function cfg(sb: any, key: string): Promise<any> {
  let v: any = null;
  const san = DOC_SAN.get(sb);
  if (san?.has(key)) v = san.get(key);
  else try { v = (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value; } catch { return null; }
  if (!v) return null;

  try { return JSON.parse(v); } catch { return v; }
}

const SOURCES: { key: string; label: string; maxHours: number; fix: string; optional?: boolean; chiThamKhao?: boolean }[] = [

  { key: "nova_app_dosong", label: "Máy đo người dùng app NOVA (09:12, máy CEO)", maxHours: 30, optional: true, fix: "máy Mac chạy: node scripts/nova-app-dosong.mjs --ghi (thiếu khoá thì xem hướng dẫn script tự in ra)" },
  { key: "zalo_bridge_status", label: "Cầu nối Zalo (nguồn Zalo DUY NHẤT từ 24/09)", maxHours: 2, fix: "máy Mac phải bật: node scripts/zalo-bridge.mjs (phiên hỏng thì chạy --login quét QR lại)" },

  { key: "zalo_cau_noi_do_status", label: "Máy đo hộp thư Zalo (khách chờ + lead đã chăm)", maxHours: 14, fix: "máy Mac chạy: node scripts/zalo-cau-noi-do.mjs --commit (exit 1 = kho cầu nối không có tin 48h → cầu nối chết, quét QR lại ở /zalo/ket-noi)" },

  { key: "zalo_nhom_tv_status", label: "Đếm thành viên nhóm Zalo (cầu nối, sau 9h10)", maxHours: 30, fix: "cầu nối Zalo phải sống (xem zalo_bridge_status); log ở /tmp của com.acme.zalo-cau-noi, tìm dòng \"đếm nhóm\"" },

  { key: "zalo_canh_nhom_status", label: "Canh nội dung nhóm Zalo (NĐ 330, 09:25)", maxHours: 30, fix: "máy Mac chạy: node scripts/zalo-canh-nhom.mjs --gio=30 (quét trắng = cầu nối Zalo đứt, sale quét QR lại ở /zalo/ket-noi)" },
  { key: "fb_unreplied", label: "Khách Facebook chờ trả lời", maxHours: 14, fix: "chạy scripts/fb-unreplied.mjs" },
  { key: "fb_graph_latest", label: "Facebook fanpage (Graph API)", maxHours: 30, fix: "chạy scripts/fb-sync.mjs" },

  { key: "ads_campaigns", label: "Chi tiêu quảng cáo Meta", maxHours: 30, fix: "đặt FB_USER_TOKEN (hoặc FB_ADS_TOKEN) trên Vercel; token hết hạn thì chạy scripts/fb-init.mjs" },
  { key: "mkt_top_posts", label: "Bài fanpage hiệu quả (vòng học Nhà máy Content)", maxHours: 30, fix: "cần FB_PAGE_ID + token có quyền pages_read_engagement trên Vercel" },

  { key: "brand_audit_last", label: "Giám đốc Thương hiệu rà soát nội dung (tuần)", maxHours: 200, fix: "kiểm /api/cron/brand-audit — chạy Thứ Hai 09:00 VN, cần GEMINI_API_KEY_BRAIN" },
  { key: "gmail_inbox_latest", label: "Hộp thư công ty (đối soát COD J&T, sổ phụ ngân hàng)", maxHours: 30, fix: "cắm GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN rồi chạy scripts/gmail-sync.mjs" },

  { key: "brain_learn_status", label: "Vòng tự học của Trợ lý (bài học mỗi ngày)", maxHours: 30, fix: "xem lỗi trong config brain_learn_status — thường do bản tin bị cắt trước dấu <<<META>>>" },

  { key: "ad_scout_status", label: "Trinh sát quảng cáo đối thủ (Ad Library)", maxHours: 30, fix: "máy Mac phải bật lúc 8:35; xem log /tmp/ad-scout.log, chạy tay: node scripts/ad-scout.mjs --commit" },
  { key: "video_poster_status", label: "Máy đăng video fanpage", maxHours: 30, fix: "máy Mac phải bật lúc 9:05; xem log /tmp/video-poster.log, chạy tay: node scripts/video-poster.mjs --commit" },
  { key: "ad_library_scout", label: "Dữ liệu đối thủ đang chạy quảng cáo", maxHours: 36, fix: "chạy lại scripts/ad-scout.mjs --commit trên máy Mac" },
  { key: "video_library", label: "Kho video trên máy (danh mục để xếp lịch)", maxHours: 48, fix: "chạy: node scripts/video-poster.mjs --scan" },

  { key: "ca_truc_ai", label: "Ca trực AI (soạn sẵn câu trả lời cho hàng chờ)", maxHours: 30, fix: "mở /api/cron/ca-truc-ai?key=<CRON_SECRET>; nếu soạn ra 0 câu thì kiểm ANTHROPIC_API_KEY và nguồn fb_unreplied/sale_unreplied" },

  { key: "thu_contact_status", label: "Máy báo thư contact@example.com (5 phút/lần)", maxHours: 1, optional: true, fix: "xem lỗi trong config thu_contact_status; sai mật khẩu thì sửa CONTACT_MAIL_PASS trên Vercel; chạy tay /api/cron/thu-contact?key=<CRON_SECRET>" },
  { key: "fb_may_truc_status", label: "Máy trực trả lời Facebook", maxHours: 30, optional: true, fix: "công tắc ở config fb_may_truc ({\"bat\":true}); chưa bật thì im là đúng" },

  { key: "cham_cuoc_goi_status", label: "Máy chép lời + chấm cuộc gọi sale", maxHours: 14, optional: true, fix: "xem loiMau trong config cham_cuoc_goi_status; chạy tay /api/cron/cham-cuoc-goi?key=<CRON_SECRET>; cần GEMINI_API_KEY_BRAIN + ANTHROPIC_API_KEY" },

  { key: "blog_writer_last", label: "Lưới đỡ bài blog trên Vercel (21:00)", maxHours: 30, optional: true, fix: "mở /api/cron/blog-writer?key=<CRON_SECRET> chạy tay; xem sổ agent_runs agent=blog-writer để biết lượt hỏng ở khâu nào" },

  { key: "blog_ngay_last", label: "Lớp bù bài blog theo ngày (máy CEO)", maxHours: 30, optional: true, fix: "máy Mac phải bật; chạy tay: node scripts/blog-ngay.mjs (--xem để chỉ đếm)" },

  { key: "san_tiktok_status", label: "Máy quét TikTok Shop (09:10)", maxHours: 30, optional: true, fix: "máy Mac chạy: node scripts/san-tiktok-quet.mjs --commit (hết phiên thì san-tiktok-login.mjs)" },
  { key: "nhan_vat_may_last", label: "Máy chạy kênh Nhân vật Mẫu (Threads + Instagram)", maxHours: 30, optional: true, fix: "hồ sơ trình duyệt hết phiên thì chạy: node scripts/nhan-vat-may.mjs --setup (đăng nhập một lần); kiểm: --kiem" },

  { key: "so_do_may_last", label: "Máy vẽ sơ đồ máy chạy ngầm (09:12)", maxHours: 30, optional: true, fix: "máy Mac chạy: node scripts/so-do-may-chay-ngam.mjs (xem /tmp/so-do-may.log)" },

  { key: "fb_comment_agent_last", label: "AI trực bình luận fanpage (cron mỗi giờ)", maxHours: 3, fix: "chạy tay /api/cron/fb-comments?key=<CRON_SECRET>; xem lịch trong vercel.json" },
  { key: "chay_bu_last", label: "Lớp bù máy cào (chữa lượt cào trượt vì mất mạng)", maxHours: 2, fix: "trên máy CEO: launchctl list | grep chay-bu, xem /tmp/acme-chay-bu.log; chạy tay node scripts/chay-bu.mjs (thêm --commit để bù thật)" },

  { key: "truc_viec_lap_last", label: "Máy trực việc lặp (canh 56 job launchd trên máy Mac)", maxHours: 30, optional: true, fix: "trên máy CEO: node scripts/truc-viec-lap.mjs (xem /tmp/acme-truc-viec-lap.log); kiểm lịch bằng launchctl list | grep truc-viec" },

  { key: "hoc_the_gioi_last", label: "Máy học thế giới (3 lượt/ngày, nạp kiến thức cho cố vấn)", maxHours: 14, fix: "mở /api/cron/hoc-the-gioi?luot=0&key=<CRON_SECRET>; thêm &dry=1 để xem lượt đó học hướng nào mà không tốn token" },

  { key: "thi_tran_nhac_last", label: "Nhắc chỗ đứt cần anh trả lời (Thị trấn máy, 9:11)", maxHours: 30, fix: "mở /api/cron/thi-tran-nhac?dry=1&key=<CRON_SECRET> xem tin sẽ gửi; bỏ dry để gửi" },
  { key: "nhip_tien_bo_last", label: "Rà soát tiến bộ tuần/tháng/quý/năm", maxHours: 30, fix: "mở /api/cron/nhip-tien-bo?dry=1&key=<CRON_SECRET> xem hôm nay kỳ nào đến hạn; ép chạy bằng &ky=tuan|thang|quy|nam" },

  { key: "quiz_lead_report_last", label: "Báo cáo khách quiz chưa chạm (8:35)", maxHours: 30, optional: true, fix: "mở /api/cron/quiz-lead-report?dry=1&token=<ads_report_token> xem lỗi" },

  { key: "jt_canh_bao_last", label: "Cảnh báo đơn J&T cho sale (8:45 / 21:45)", maxHours: 16, fix: "mở /api/cron/don-jt-canh-bao?dry=1&token=<ads_report_token>; báo nguon_jt_cu nghĩa là máy cào J&T mất phiên — chạy scripts/jt-login.mjs" },

  { key: "chi_muc_quet_last", label: "Máy quét chỉ mục Google (3:40 + 15:40)", maxHours: 30, optional: true, fix: "mở /api/cron/chi-muc-quet?key=<ads_report_token> xem lỗi; hết hạn quyền thì chạy scripts/google-oauth-setup.mjs --day-len" },

  { key: "luong_thang_last", label: "Máy tính lương tháng (mùng 1, 09:10)", maxHours: 35 * 24, optional: true, fix: "mở /api/cron/luong-thang?dry=1&token=<ads_report_token> xem lỗi; cần tính ngay: &force=1&thang=YYYY-MM" },
  { key: "seo_web_last", label: "Báo cáo website tuần (Search Console + GA4)", maxHours: 192, optional: true, fix: "mở /api/cron/seo-web-report?dry=1&key=<CRON_SECRET> xem lỗi; thiếu quyền thì làm theo docs/SETUP-GOOGLE-SEARCH-CONSOLE.md" },

  { key: "seo_agent_bao_last", label: "Agent SEO — thứ hạng + báo cáo Telegram (mỗi giờ)", maxHours: 3, optional: true, fix: "mở /api/cron/seo-agent?dry=1&key=<ads_report_token> xem lỗi; hết hạn quyền Google thì chạy scripts/google-oauth-setup.mjs --day-len" },
  { key: "seo_agent_last", label: "Agent SEO — máy nghiên cứu trên Mac (9:25 + 15:25)", maxHours: 30, optional: true, fix: "trên iMac: node scripts/seo-agent.mjs tat-ca rồi đọc /tmp/seo-agent.log; job là com.acme.seo-agent" },

  { key: "web_ngay_last", label: "Báo cáo web theo ngày (09:15)", maxHours: 30, optional: true, fix: "mở /api/cron/web-ngay?dry=1&key=<ads_report_token> xem lỗi; hết hạn quyền Google thì chạy scripts/google-oauth-setup.mjs --day-len" },

  { key: "tiktok_nova_may_last", label: "TikTok @novabeauty.wellness (11:40 · 19:40)", maxHours: 30, optional: true, fix: "máy Mac chạy: node scripts/tiktok-nova-may.mjs --dang (xem /tmp/tiktok-nova.log; launchd com.acme.tiktok-nova). Báo mất phiên thì CEO chạy --setup" },

  { key: "video_blog_ngay_last", label: "Video YouTube kênh chính (06:35 · 13:35)", maxHours: 30, optional: true, fix: "máy Mac chạy: node scripts/video-blog/chay-ngay.mjs (xem /tmp/video-blog-ngay.log; launchd com.acme.video-blog). Báo đổi token hụt thì CEO chạy node scripts/video-blog/youtube-auth.mjs" },
  { key: "shorts_kenh_phu_last", label: "Shorts kênh phụ @novawellnessvn (10:20 · 17:20)", maxHours: 30, optional: true, fix: "máy Mac chạy: node scripts/video-blog/shorts-kenh-phu.mjs (xem /tmp/shorts-kenh-phu.log; launchd com.acme.shorts-kenh-phu). Báo \"chưa cấp quyền kênh phụ\" thì CEO chạy youtube-auth.mjs --kenh=phu" },
  { key: "nhat_ky_hoc_ai_last", label: "Nhật ký học AI vào Second Brain (22:50)", maxHours: 30, optional: true, fix: "máy Mac chạy: node scripts/nhat-ky-hoc-ai.mjs (xem /tmp/acme-nhat-ky-hoc-ai.log; launchd com.acme.nhat-ky-hoc-ai)" },

  { key: "khach_dongbo_last", label: "Đồng bộ danh sách khách hàng (09:17)", maxHours: 30, optional: true, fix: "máy Mac chạy: node scripts/dong-bo-khach-hang.mjs --commit (xem /tmp/acme-dong-bo-khach.log; launchd com.acme.dong-bo-khach). Lùi lượt ghi gần nhất: config khach_dongbo_backup" },

  { key: "yt_binh_luan_last", label: "Trả lời bình luận YouTube (mỗi giờ 7h-21h)", maxHours: 30, optional: true, fix: "máy Mac chạy: npx tsx --tsconfig tsconfig.json scripts/yt-binh-luan.ts --kho (xem /tmp/yt-binh-luan.log; launchd com.acme.yt-binh-luan). Báo đổi token hụt thì CEO chạy node scripts/video-blog/youtube-auth.mjs" },

  { key: "nghien_cuu_last", label: "Nghiên cứu đối thủ — Google Ads Transparency (thứ 2)", maxHours: 204, optional: true, fix: "máy Mac chạy: node scripts/nghien-cuu-doi-thu.mjs --google (xem /tmp/acme-nghien-cuu.log; launchd com.acme.nghien-cuu)" },

  { key: "dang_cheo_last", label: "Máy soạn bài đăng chéo (Medium, X, LinkedIn...)", maxHours: 30, fix: "mở /api/cron/dang-cheo?dry=1&key=<CRON_SECRET> xem lỗi; nội quy từng nền tảng ở data/so-tay-dang-cheo.json" },

  { key: "dang_cheo_dang_last", label: "Máy ĐĂNG bài đăng chéo (chạy trên máy CEO)", maxHours: 48, optional: true, fix: "trên máy CEO chạy `node scripts/dang-cheo-dang.mjs --dry`; phiên hết hạn thì chạy `--setup` đăng nhập lại" },

  { key: "fb_dang_bai_last", label: "Máy đăng bài fanpage (trình duyệt, máy CEO)", maxHours: 48, optional: true, fix: "trên máy CEO chạy `node scripts/fb-dang-bai.mjs --dry`; phiên FB hết hạn thì chạy `--setup` đăng nhập lại" },

  { key: "tts_process_last", label: "TikTok Shop — xử lý sự kiện + lịch giao (mỗi 3')", maxHours: 1, optional: true, fix: "mở /api/cron/tts-process?key=<CRON_SECRET> xem lỗi; đọc tts_events.error" },
  { key: "tts_poll_last", label: "TikTok Shop — poll đơn dự phòng (mỗi 15')", maxHours: 2, optional: true, fix: "mở /api/cron/tts-poll?dry=1&key=<CRON_SECRET>; token hỏng thì xem docs/tiktok-shop-api.md mục uỷ quyền lại" },
  { key: "tts_token_last", label: "TikTok Shop — làm mới token (mỗi 6h)", maxHours: 14, optional: true, fix: "mở /api/cron/tts-token-refresh?force=1&key=<CRON_SECRET>; refresh token chết thì uỷ quyền lại" },

  { key: "shopee_token_last", label: "Shopee — làm mới token (mỗi giờ, access sống 4h)", maxHours: 3, optional: true, fix: "mở /api/cron/shopee-token-refresh?force=1&key=<CRON_SECRET>; refresh token chết (30 ngày) thì mở /api/shopee/uy-quyen uỷ quyền lại" },
];

async function checkWebAlive(): Promise<SourceHealth> {
  const url = `${APP_URL}/login`;
  const base: Omit<SourceHealth, "ok" | "note"> = {
    key: "web_alive", label: "Web ops-hub (người dùng vào được không)", ageHours: null, maxHours: 0,
    fix: "kiểm tên miền + chứng chỉ SSL trên Vercel (vercel certs ls). Đổi địa chỉ: đặt NEXT_PUBLIC_APP_URL",
  };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(url, { cache: "no-store", redirect: "manual", signal: ctl.signal });
    clearTimeout(t);
    const ok = res.status >= 200 && res.status < 400;
    return { ...base, ok, note: ok ? `mở được (HTTP ${res.status})` : `KHÔNG MỞ ĐƯỢC — HTTP ${res.status} tại ${url}` };
  } catch (e: any) {

    return { ...base, ok: false, note: `KHÔNG MỞ ĐƯỢC ${url} — ${String(e?.message || e).slice(0, 80)}` };
  }
}

async function checkFbTokenExpiry(): Promise<SourceHealth[]> {
  const appId = (process.env.FB_APP_ID || "").trim();
  const appSecret = (process.env.FB_APP_SECRET || "").trim();
  const tokens: { key: string; label: string; token: string }[] = [
    { key: "fb_user_token_expiry", label: "Hạn FB_USER_TOKEN (fanpage + ads)", token: (process.env.FB_USER_TOKEN || "").trim() },
    { key: "fb_ads_token_expiry", label: "Hạn FB_ADS_TOKEN (system user)", token: (process.env.FB_ADS_TOKEN || "").trim() },
  ].filter((t) => t.token);
  const out: SourceHealth[] = [];
  for (const t of tokens) {
    const base = { key: t.key, label: t.label, ageHours: null as number | null, maxHours: 0, fix: "chạy node scripts/fb-init.mjs <APP_ID> <APP_SECRET> <SHORT_TOKEN> để đổi token mới, rồi cập nhật Vercel env" };
    if (!appId || !appSecret) { out.push({ ...base, ok: true, note: "không đo được hạn (thiếu FB_APP_ID/FB_APP_SECRET)" }); continue; }
    try {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 10000);
      const res = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(t.token)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`, { cache: "no-store", signal: ctl.signal });
      clearTimeout(tm);
      const d = (await res.json())?.data;
      if (!d) { out.push({ ...base, ok: true, note: "không đọc được debug_token (Graph API không trả data)" }); continue; }
      if (d.is_valid === false) { out.push({ ...base, ok: false, note: "TOKEN ĐÃ CHẾT (is_valid=false)" }); continue; }

      const expA = Number(d.expires_at || 0);
      const expB = Number(d.data_access_expires_at || 0);
      const exp = expA && expB ? Math.min(expA, expB) : (expA || expB);
      if (!exp) { out.push({ ...base, ok: true, note: "token không hết hạn (system user / vô hạn cả 2 mốc)" }); continue; }
      const daysLeft = Math.floor((exp * 1000 - now()) / 864e5);

      if (!expA && daysLeft <= 7) {
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id&limit=50&access_token=${encodeURIComponent(t.token)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
          const j = await r.json();
          if (r.ok && Array.isArray(j?.data) && j.data.length > 0) {
            out.push({ ...base, ok: true, note: `token vô hạn, page vẫn đọc được (${j.data.length} page) — chỉ quyền dữ liệu người dùng hết ${new Date(exp * 1000).toISOString().slice(0, 10)}, gia hạn khi tiện` });
            continue;
          }
        } catch {  }
      }
      out.push({ ...base, ok: daysLeft > 7, note: daysLeft > 7 ? `còn ${daysLeft} ngày (hết ${new Date(exp * 1000).toISOString().slice(0, 10)})` : `SẮP HẾT HẠN — còn ${daysLeft} ngày (${new Date(exp * 1000).toISOString().slice(0, 10)}), đổi token TRƯỚC khi mù fanpage/ads` });
    } catch (e: any) {

      out.push({ ...base, ok: true, note: `không đo được hạn lần này (${String(e?.message || e).slice(0, 60)})` });
    }
  }
  return out;
}

async function checkTelegramBots(): Promise<SourceHealth[]> {
  const bots = [
    { key: "bot_baocao", label: "Bot Báo Cáo (nút duyệt bài, giao lead)", token: (process.env.TELEGRAM_BOT_TOKEN || "").trim(), hook: "/api/telegram/sale" },
    { key: "bot_troly", label: "Bot Trợ lý Trợ lý AI (hỏi đáp, giao việc)", token: (process.env.TELEGRAM_BRAIN_BOT_TOKEN || "").trim(), hook: "/api/telegram/brain" },

    { key: "bot_chamsoc", label: "Bot Chăm sóc khách (nhắc sale)", token: (process.env.TELEGRAM_SALE_BOT_TOKEN || "").trim(), hook: "" },
  ].filter((b) => b.token);

  const out: SourceHealth[] = [];
  for (const b of bots) {
    const base = { key: b.key, label: b.label, ageHours: null as number | null, maxHours: 0, fix: b.hook ? `mở ${APP_URL}${b.hook}?setup=go để trỏ lại webhook; token bị thu hồi thì tạo lại ở BotFather rồi cập nhật Vercel env` : "kiểm token bot trên Vercel env (BotFather /token nếu đã thu hồi)" };
    try {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 10000);
      const me: any = await (await fetch(`https://api.telegram.org/bot${b.token}/getMe`, { cache: "no-store", signal: ctl.signal })).json();
      clearTimeout(tm);
      if (!me?.ok) { out.push({ ...base, ok: false, note: `BOT CHẾT — Telegram từ chối token (${String(me?.description || "getMe thất bại").slice(0, 60)})` }); continue; }
      const ten = me.result?.username ? `@${me.result.username}` : "bot";
      if (!b.hook) { out.push({ ...base, ok: true, note: `sống (${ten}, chạy kiểu hỏi-lấy)` }); continue; }

      const wh: any = await (await fetch(`https://api.telegram.org/bot${b.token}/getWebhookInfo`, { cache: "no-store" })).json();
      const info = wh?.result || {};
      if (!info.url) { out.push({ ...base, ok: false, note: `${ten} sống nhưng CHƯA CẮM WEBHOOK — Telegram không gọi được vào app, mọi tin nhắn rơi vào hư không` }); continue; }
      if (!String(info.url).includes(b.hook)) { out.push({ ...base, ok: false, note: `${ten} đang trỏ webhook SAI CHỖ (${String(info.url).replace(/https?:\/\//, "").slice(0, 50)}) — phải là ${b.hook}` }); continue; }

      const errAge = info.last_error_date ? (now() - info.last_error_date * 1000) / 36e5 : null;
      if (errAge != null && errAge < 6) { out.push({ ...base, ok: false, note: `${ten} — Telegram gọi vào app BỊ LỖI ${errAge.toFixed(1)}h trước: ${String(info.last_error_message || "").slice(0, 70)}` }); continue; }

      if (Number(info.pending_update_count || 0) > 20) { out.push({ ...base, ok: false, note: `${ten} — ${info.pending_update_count} tin nhắn ĐANG DỒN chưa xử lý, app nhận không nổi` }); continue; }
      out.push({ ...base, ok: true, note: `sống (${ten}, webhook thông${info.pending_update_count ? `, ${info.pending_update_count} tin đang chờ` : ""})` });
    } catch (e: any) {

      out.push({ ...base, ok: true, note: `không hỏi được Telegram lần này (${String(e?.message || e).slice(0, 60)})` });
    }
  }
  return out;
}

export async function checkAllSources(): Promise<SourceHealth[]> {
  const sb = getServiceClient();
  const out: SourceHealth[] = [];

  const [webP, fbP, tgP] = [checkWebAlive(), checkFbTokenExpiry(), checkTelegramBots()];

  const jtMoiP = Promise.resolve(sb.from("jt_waybills").select("order_create_time").order("order_create_time", { ascending: false }).limit(1));
  await docSanCfg(sb, [...SOURCES.map((s) => s.key),
    "aff_day_don", "agent_runs_loi", "bo_bai_doi_tac_cho_video", "bo_bai_doi_tac_day", "bo_bai_doi_tac_soan",
    "bo_bai_doi_tac_video_nhip", "fb_comment_agent", "fb_comment_agent_last", "fb_comment_quyen", "google_ads_daily",
    "jt_reconcile", "jt_reconcile_status", "jt_session_status", "mb_latest", "meta_capi", "meta_capi_trangthai",
    "nguon_boc_don_tele", "push_last", "xuong_video_nhip", "zalo_bridge_status", "zalo_nhom_lenh", "zns_nhip"]);

  const runsP = Promise.resolve(sb.from("agent_runs").select("created_at").order("created_at", { ascending: false }).limit(1));
  const machP = checkMachDutMkt(sb);
  const capiP = checkMetaCapi(sb);
  for (const p of [webP, fbP, tgP, jtMoiP, runsP, machP, capiP]) p.catch(() => {});

  out.push(await webP);

  out.push(...(await fbP));

  out.push(...(await tgP));

  try {
    const { data } = await sb.from("tg_orders").select("ngay, boc_at").order("ngay", { ascending: false }).limit(1);
    const latest = data?.[0]?.ngay || null;
    const days = latest ? Math.round((new Date(vnDateStr()).getTime() - new Date(latest).getTime()) / 864e5) : null;
    out.push({
      key: "so_don_tele", label: "Sổ đơn Telegram (nguồn doanh thu chính)",
      ageHours: days == null ? null : days * 24, maxHours: 48,
      ok: days != null && days <= 1,
      note: latest ? `đơn mới nhất ${latest} (${days} ngày trước)` : "CHƯA CÓ ĐƠN NÀO — chưa chạy migration 048 hoặc bot chưa ở trong nhóm đơn",
      fix: "kiểm: bot Trợ lý AI có trong nhóm đơn chưa (privacy phải Disable), config tg_nhom_don đúng id nhóm chưa, và /api/cron/tg-boc-don?key=<CRON_SECRET> chạy được không",
    });
  } catch { }

  try {
    const st = await cfg(sb, "nguon_boc_don_tele");
    const h = hoursSince(pickTs(st));
    out.push({
      key: "boc_don_tele", label: "Máy bóc đơn từ tin Telegram",

      ageHours: h, maxHours: 2, ok: h != null && h <= 2 && st?.ok !== false,
      note: st ? `lần cuối bóc ${st.tin ?? "?"} tin ra ${st.don ?? "?"} đơn${st.loHong ? `, ${st.loHong} lô hỏng` : ""}` : "chưa chạy lần nào",
      fix: "mở /api/cron/tg-boc-don?key=<CRON_SECRET>; bóc ra 0 đơn thường là thiếu ANTHROPIC_API_KEY",
    });
  } catch { }

  try {
    const st = await cfg(sb, "aff_day_don");
    const h = hoursSince(pickTs(st));
    out.push({
      key: "aff_day_don", label: "Đẩy đơn cộng tác viên sang app affiliate",
      ageHours: h, maxHours: 3, ok: h != null && h <= 3 && st?.ok !== false,
      note: st ? (st.ok === false ? `lỗi: ${st.loi}` : `lần cuối đẩy ${st.don ?? 0} đơn${st.maLa?.length ? `, mã lạ: ${st.maLa.join(", ")}` : ""}`) : "chưa chạy lần nào",
      fix: "mở /api/cron/day-don-ctv?key=<CRON_SECRET>&dry=1 xem lỗi; thiếu AFF_* trên Vercel hoặc app cộng tác viên đang chết",
    });
  } catch { }

  try {
    const st = await cfg(sb, "bo_bai_doi_tac_soan");
    const h = hoursSince(pickTs(st));
    out.push({
      key: "bo_bai_doi_tac_soan", label: "Máy soạn bộ bài đối tác (9:18)",
      ageHours: h, maxHours: 30, ok: h != null && h <= 30 && st?.ok !== false,
      note: st ? (st.ok === false ? `lỗi: ${st.loi}` : `soạn ${st.luu ?? 0} bài${st.coLoi ? `, ${st.coLoi} dính từ cấm` : ""}`) : "chưa chạy lần nào",
      fix: "mở /api/cron/soan-bai-doi-tac?key=<CRON_SECRET>; lỗi thường là thiếu GEMINI_API_KEY_BRAIN",
    });
  } catch { }
  try {
    const st = await cfg(sb, "bo_bai_doi_tac_day");
    const h = hoursSince(pickTs(st));
    out.push({
      key: "bo_bai_doi_tac_day", label: "Đẩy bộ bài đối tác sang app CTV",
      ageHours: h, maxHours: 3, ok: h != null && h <= 3 && st?.ok !== false,
      note: st ? (st.ok === false ? `lỗi: ${st.loi}` : `đang hiện ${st.bai ?? 0} bài trên app CTV`) : "chưa chạy lần nào",
      fix: "mở /api/cron/day-bai-doi-tac?key=<CRON_SECRET>&dry=1; thiếu AFF_* trên Vercel hoặc app nova-ctv chưa có /api/nhap-bai",
    });
  } catch { }

  try {
    const st = await cfg(sb, "bo_bai_doi_tac_video_nhip");
    const cho = (await cfg(sb, "bo_bai_doi_tac_cho_video"))?.cho?.length ?? 0;
    if (st || cho) {
      const h = hoursSince(pickTs(st));
      out.push({
        key: "bo_bai_doi_tac_video_nhip", label: "Máy Mac dựng video bộ bài đối tác",
        ageHours: h, maxHours: 16, ok: (h != null && h <= 16 && st?.ok !== false) || (!cho && st?.ok !== false),
        note: st ? (st.ok === false ? `lỗi: ${st.loi}` : `lượt cuối dựng ${st.dung ?? 0} video, chờ ${cho} bài`) : `chưa chạy lần nào, ${cho} bài chờ`,
        fix: "trên iMac: node scripts/video-doi-tac.mjs --commit; thiếu ffmpeg trong PATH hoặc chưa nạp launchd com.acme.video-doi-tac",
      });
    }
  } catch { }

  try {
    const st = await cfg(sb, "xuong_video_nhip");
    const { data: hang } = await sb.from("config").select("value").like("key", "xuong_video:%").limit(1000);
    const cho = (hang || []).filter((r: any) => /"trang_thai":"(cho_dung|dang_dung)"/.test(r.value || "")).length;
    if (st || cho) {
      const h = hoursSince(pickTs(st));
      out.push({
        key: "xuong_video_nhip", label: "Máy Mac dựng video Xưởng video đại lý",
        ageHours: h, maxHours: 14, ok: (h != null && h <= 14 && st?.ok !== false) || (!cho && st?.ok !== false),
        note: st ? (st.ok === false ? `lỗi: ${st.loi}` : `lượt cuối dựng ${st.dung ?? 0} việc, chờ ${cho} việc`) : `chưa chạy lần nào, ${cho} việc chờ`,
        fix: "trên máy dựng: mở AI Video Factory (~/ai-video-factory/mo-app.command) rồi node scripts/xuong-video.mjs; hoặc chưa nạp launchd com.acme.xuong-video",
      });
    }
  } catch { }

  try {
    const st = await cfg(sb, "zns_nhip");
    if (st) {
      const h = hoursSince(pickTs(st));
      out.push({
        key: "zns_nhip", label: "Máy tin ZBS sau mua (xác nhận đơn, hỏi thăm sau nhận)",
        ageHours: h, maxHours: 14, ok: h != null && h <= 14 && st?.ok !== false,
        note: st.ok === false ? (typeof st.loi === "number" ? `${st.loi} tin gửi hỏng` : `lỗi: ${st.loi}`) : `chế độ ${st.cheDo}: chọn ${st.chon ?? 0}, nháp ${st.nhap ?? 0}, đã gửi ${st.daGui ?? 0}`,
        fix: "mở /api/cron/zns-sau-mua?key=<CRON_SECRET>&thu=1 xem máy định gửi gì; lỗi token thì chạy lại /api/zalo/oa-callback?start=1",
      });
    }
  } catch { }

  try {
    const { data } = await jtMoiP;
    const latest = data?.[0]?.order_create_time || null;
    const h = hoursSince(latest);
    out.push({
      key: "jt_waybills_moi", label: "Vận đơn J&T (bằng chứng đã gửi hàng)",
      ageHours: h, maxHours: 48, ok: h != null && h <= 48,
      note: latest ? `vận đơn mới nhất ${String(latest).slice(0, 10)}` : "chưa có vận đơn nào",
      fix: "phiên J&T hết hạn — chạy node scripts/jt-login.mjs trên máy Mac rồi scripts/jt-fetch.mjs",
    });
  } catch { }

  try {
    const { data: accs } = await sb.from("zalo_bridge_accounts").select("own_id,display_name,sale_name");

    const ds: { id: string; sale: string; ten: string; gio: number | null; nguon: string }[] = await Promise.all(
      ((accs ?? []) as { own_id: string; display_name: string | null; sale_name: string | null }[]).map(async (a) => {
        const { data: m } = await sb.from("zalo_bridge_messages").select("created_at").eq("own_id", a.own_id).order("created_at", { ascending: false }).limit(1);
        return { id: a.own_id, sale: a.sale_name || "?", ten: a.display_name || a.own_id, gio: hoursSince(m?.[0]?.created_at || null), nguon: "cầu nối" };
      }),
    );
    if (ds.length) {
      const chet = ds.filter((d) => d.gio == null || d.gio > 48);
      out.push({
        key: "zalo_nick_song", label: "Nick Zalo của sale còn nhận tin",
        ageHours: Math.min(...ds.map((d) => d.gio ?? 9999)), maxHours: 48, ok: chet.length === 0,
        note: chet.length
          ? `${chet.length}/${ds.length} nick KHÔNG có tin về quá 48h: ` + chet.map((d) => `${d.sale} · ${d.ten} (${d.gio == null ? "chưa có tin" : `${d.gio}h`}, đo qua ${d.nguon})`).join(" · ")
          : `cả ${ds.length} nick còn nhận tin (đo qua kho cầu nối)`,
        fix: "sale mở /zalo/ket-noi quét QR lại nick đó. Nick chết = khách nhắn vào đó không vào hệ thống.",
      });
    }

    try {
      const bridge = await cfg(sb, "zalo_bridge_status");
      const hong = bridge?.nickHong ? String(bridge.nickHong) : null;
      if (hong) {
        const song = Array.isArray(bridge?.nickSong) ? bridge.nickSong.join(", ") : "?";
        out.push({
          key: "zalo_nick_phien", label: "Phiên Zalo của nick cầu nối",
          ageHours: hoursSince(bridge?.at || null), maxHours: 1, ok: false,
          note: `nick "${hong}" MẤT PHIÊN — khách nhắn vào nick này KHÔNG vào hệ thống (nick còn sống: ${song}). ${bridge?.error || ""}`.trim(),
          fix: "người cầm nick đó mở /zalo/ket-noi quét QR lại. Máy KHÔNG quét hộ được. Để càng lâu càng mất tin khách, mà 48h sau nguồn zalo_nick_song mới kêu.",
        });
      }
    } catch {  }

    try {
      const hang = (await cfg(sb, "zalo_nhom_lenh")) || {};
      const ds = Object.values(hang as Record<string, { luc?: string; ten?: string; own?: string }>);
      const cuNhat = ds.map((v) => v?.luc).filter(Boolean).sort()[0] as string | undefined;
      const choPhut = cuNhat ? (Date.now() - new Date(cuNhat).getTime()) / 60000 : 0;
      if (ds.length && choPhut > 10) {
        out.push({
          key: "zalo_lenh_nhom_ket", label: "Lệnh khoá/mở nhóm Zalo",
          ageHours: choPhut / 60, maxHours: 10 / 60, ok: false,
          note: `${ds.length} lệnh nằm chờ, cái cũ nhất ${Math.round(choPhut)} phút (nhóm "${ds[0]?.ten || "?"}"). Đào /zalo/nhom đang hiện "đang chờ máy" mà thật ra nhóm CHƯA đổi.`,
          fix: "bật máy Mac và kiểm cầu nối: launchctl kickstart -k gui/$(id -u)/com.acme.zalo-cau-noi, rồi xem /tmp/acme-zalo-cau-noi.log. Nick của lệnh mà mất phiên thì người cầm nick phải quét QR lại ở /zalo/ket-noi.",
        });
      }
    } catch {  }

    const tu48 = new Date(Date.now() - 48 * 3600e3).toISOString();
    const mu: string[] = (await Promise.all(
      ((accs ?? []) as { own_id: string; display_name: string | null; sale_name: string | null }[]).map(async (a) => {
        const dem = async (dir: string) => (await sb.from("zalo_bridge_messages").select("id", { count: "exact", head: true })
          .eq("own_id", a.own_id).eq("thread_type", "user").eq("direction", dir).gte("sent_at", tu48)).count ?? 0;
        const [vao, ra] = await Promise.all([dem("in"), dem("out")]);
        return vao >= 5 && ra === 0 ? `${a.sale_name || "?"} · ${a.display_name || a.own_id} (${vao} tin khách vào, 0 tin sale ra)` : null;
      }),
    )).filter((x): x is string => !!x);
    out.push({
      key: "zalo_nghe_tin_sale", label: "Cầu nối Zalo nghe được tin SALE gửi (không chỉ tin khách)",
      ageHours: null, maxHours: 48, ok: mu.length === 0,
      note: mu.length ? `48h qua: ${mu.join(" · ")}` : "nick nào có khách nhắn thì cũng có tin sale ra trong 48h",
      fix: "kiểm scripts/zalo-bridge.mjs còn selfListen:true và tiến trình đã khởi động lại (launchctl kickstart -k gui/$UID/com.acme.zalo-cau-noi); nếu cầu nối đúng mà vẫn 0 tin ra thì sale đang bỏ khách — mở /hop-thu-zalo",
    });
  } catch { }

  try {
    const { data } = await jtMoiP;
    const latest = data?.[0]?.order_create_time || null;
    const age = hoursSince(latest);
    out.push({
      key: "jt_waybills", label: "Vận đơn J&T (đối soát COD)", ageHours: age, maxHours: 36,
      ok: age != null && age <= 36,
      note: latest ? `vận đơn mới nhất ${String(latest).slice(0, 10)} (${age}h trước)` : "chưa có vận đơn nào",
      fix: "chạy scripts/jt-login.mjs (đăng nhập tay) rồi scripts/jt-fetch.mjs --days=60 --commit",
    });
  } catch { }

  try {
    const sts: any[] = JSON.parse((await sb.from("config").select("value").eq("key", "jt_cod_statements").maybeSingle()).data?.value || "[]");
    if (Array.isArray(sts) && sts.length) {
      const moiNhat = sts.map(s => String(s?.statementDate || "")).filter(Boolean).sort().pop() || null;
      const ngay = moiNhat ? Math.floor((Date.now() - Date.parse(moiNhat + "T00:00:00+07:00")) / 864e5) : null;
      out.push({
        key: "jt_cod_ky", label: "Kỳ đối soát COD J&T (bảng kê email thứ 2/4/6)",
        ageHours: ngay == null ? null : ngay * 24, maxHours: 5 * 24,
        ok: ngay != null && ngay <= 5,
        note: moiNhat ? `bảng kê mới nhất ${moiNhat} (${ngay} ngày trước) · đã bóc ${sts.length} kỳ` : "chưa bóc được kỳ nào",
        fix: "máy Mac chạy: node scripts/jt-cod-statements.mjs --commit; không thấy email mới thì kiểm hộp thư (gmail-auth.mjs) trước khi kết luận J&T chưa gửi",
      });
    }
  } catch { }

  try {
    const mb = await cfg(sb, "mb_latest");
    const rc = mb?.reconcile;
    if (rc && typeof rc.checked === "number" && rc.checked > 0) {
      out.push({
        key: "jt_tien_ve_khop", label: "Tiền J&T hứa trả ↔ tiền về tài khoản",
        ageHours: null, maxHours: 0, ok: (rc.missing || 0) === 0,
        note: (rc.missing || 0) === 0
          ? `khớp ${rc.matched}/${rc.checked} kỳ${rc.rolledOver ? ` (${rc.rolledOver} kỳ cấn sang kỳ sau)` : ""} · đã đối soát tới sổ phụ ${mb?.window?.to || "?"}`
          : `${rc.missing} kỳ J&T hẹn chuyển mà KHÔNG thấy tiền về (khớp ${rc.matched}/${rc.checked})`,
        fix: "mở /tai-chinh xem từng kỳ; đối chiếu tay với app MB rồi báo J&T kỳ thiếu. Sổ phụ chỉ về theo tháng nên các kỳ của tháng hiện tại chưa ráp được — chưa ráp KHÁC với thiếu tiền.",
      });
    }
  } catch { }

  try {
    const q = await cfg(sb, "fb_comment_quyen");
    if (q && Array.isArray(q.thieu)) {
      const thieu: string[] = q.thieu;
      const ten: string[] = Array.isArray(q.tenThieu) && q.tenThieu.length ? q.tenThieu : thieu;
      out.push({
        key: "fb_comment_quyen_page", label: "Quyền page của bot trả lời bình luận",
        ageHours: null, maxHours: 0, ok: thieu.length === 0,
        note: thieu.length === 0
          ? `đủ quyền ${q.du}/${q.tong} page bot đang trực`
          : `MẤT QUYỀN ${thieu.length}/${q.tong} page: ${ten.join(", ")} — bình luận dưới bài của page đó KHÔNG ai trả lời`,
        fix: "Business Suite > Cài đặt trang > Quyền truy cập: cấp lại vai trò cho tài khoản giữ token FB (hiện là Đỗ Thị Lan); hoặc gỡ page khỏi config fb_comment_agent.pages nếu cố ý thôi trực",
      });
    }
  } catch { }

  const jt = await cfg(sb, "jt_session_status");
  if (jt && (jt.sessionLost || jt.ok === false)) {
    out.push({
      key: "jt_session", label: "Phiên đăng nhập J&T", ageHours: null, maxHours: 0, ok: false,
      note: `PHIÊN HỎNG — ${jt.note || "không rõ lý do"}`,
      fix: "chạy scripts/jt-login.mjs rồi đăng nhập + giải captcha",
    });
  }

  try {
    const rc = await cfg(sb, "jt_reconcile");
    const st = await cfg(sb, "jt_reconcile_status");
    const age = hoursSince(rc?.generatedAt);
    const tt = rc?.traThieu;
    const soDon = Number(tt?.soDon) || 0;
    const tongThieu = Number(tt?.tongThieu) || 0;
    const phienChet = !!(jt && (jt.sessionLost || jt.ok === false));
    const dung = age == null || age > 36;
    const loi = st && st.ok === false;
    let note: string;
    if (!rc) note = "chưa từng chạy jt-reconcile";
    else if (dung) note = `đối soát COD J&T ĐỨNG — lần cuối ${age == null ? "không rõ" : `${Math.round(age)}h trước`}${phienChet ? " · nguyên nhân gốc: PHIÊN J&T HỎNG (xem dòng Phiên đăng nhập J&T)" : ""}`;
    else if (loi) note = `lượt gần nhất lỗi: ${String(st.note || "").slice(0, 160)}${phienChet ? " · nguyên nhân gốc: PHIÊN J&T HỎNG" : ""}`;
    else if (soDon > 0) note = `J&T TRẢ THIẾU ${soDon} vận đơn · ${Math.round(tongThieu).toLocaleString("vi-VN")}đ (thu thiếu ${tt.donThuThieu?.length || 0} · kỳ thiếu ${tt.kyTraThieu?.length || 0} · quá hạn ${tt.quaHan?.length || 0})`;
    else note = `khớp ${rc.matched ?? "?"}/${rc.periods?.length ?? "?"} kỳ · chưa vào bảng kê ${rc.pending?.count ?? 0} đơn · không có vận đơn trả thiếu (${Math.round(age!)}h trước)`;
    out.push({
      key: "jt_reconcile", label: "Đối soát COD J&T (vận đơn trả thiếu)", ageHours: age, maxHours: 36,
      ok: !!rc && !dung && !loi && soDon === 0, note,
      fix: phienChet
        ? "phiên J&T hỏng là gốc: máy Mac chạy node scripts/jt-login.mjs --backfill (đăng nhập + captcha, rồi tự kéo 45 ngày + đối soát)"
        : soDon > 0
          ? "mở /doi-soat-jt, đối chiếu từng vận đơn với bảng kê rồi gửi J&T đòi phần thiếu; chạy lại node scripts/jt-reconcile.mjs --commit sau khi J&T trả bổ sung"
          : "máy Mac chạy: node scripts/jt-reconcile.mjs --commit (bình thường jt-fetch 8:15/21:15 tự gọi nối tiếp)",
    });
  } catch { }

  try {
    const pl = await cfg(sb, "push_last");
    const { data: us } = await sb.from("users").select("id, departments!users_department_id_fkey(name)").eq("active", true);
    const saleIds = (us || []).filter((u: any) => u.departments?.name === "Kinh Doanh & Sale").map((u: any) => u.id);
    let saleSubs = 0;
    if (saleIds.length) {
      const { count } = await sb.from("push_subscriptions").select("*", { count: "exact", head: true }).in("user_id", saleIds);
      saleSubs = count || 0;
    }
    const age = hoursSince(pl?.ts);
    const h0 = saleSubs === 0 ? hoursSince(pl?.saleSubs0Since) : null;
    const ls: any[] = Array.isArray(pl?.lichSu) ? pl.lichSu.filter((x: any) => Number(x?.subs) > 0).slice(-3) : [];
    const hut = ls.length >= 3 && ls.every((x: any) => Number(x.sent) < Number(x.subs));
    const dung = !!pl && (age == null || age > 14);

    const tamDungDen = Date.parse(pl?.tam_dung?.den || "");
    const tamDung = Number.isFinite(tamDungDen) && tamDungDen > Date.now();
    const khong24 = saleSubs === 0 && h0 != null && h0 > 24 && !tamDung;
    let note: string;
    if (!pl) note = `chưa có nhịp push_last (chờ lượt sale-alerts kế tiếp trên máy Mac) · phòng Sale đang có ${saleSubs} thiết bị đăng ký`;
    else if (khong24) note = `phòng Sale 0 THIẾT BỊ đăng ký suốt ${Math.round(h0!)}h — cảnh báo cá nhân không tới điện thoại ai`;
    else if (hut) note = `3 lượt liền gửi HỤT (${ls.map((x: any) => `${x.sent}/${x.subs}`).join(", ")}) — nghi thiếu VAPID hoặc thiết bị hết hạn`;
    else if (dung) note = `nhịp push đứng ${age == null ? "không rõ" : `${Math.round(age)}h`}`;
    else if (tamDung && saleSubs === 0) note = `TẠM DỪNG tới ${String(pl.tam_dung.den).slice(0, 10)}: ${pl.tam_dung.ly_do || "chờ sale bật chuông"} · phòng Sale 0 thiết bị`;
    else note = `lượt cuối (${pl.nguon || "?"}) gửi ${pl.sent ?? 0}/${pl.subs ?? 0} thiết bị · phòng Sale có ${saleSubs} thiết bị${saleSubs === 0 ? " (đang đếm 24h)" : ""}`;
    out.push({
      key: "push_last", label: "Web push tới điện thoại sale", ageHours: age, maxHours: 14,
      ok: !khong24 && !hut && !dung, note,
      fix: khong24
        ? "sale mở ops-hub.example.com trên điện thoại (iPhone: Chia sẻ → Thêm vào MH chính), bấm chuông → Cho phép, rồi Gửi thử; xem /admin/push"
        : hut
          ? "kiểm VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT trên Vercel (vercel env ls production) và POST /api/push/test; thiết bị hết hạn thì sale bật lại chuông"
          : "máy Mac chạy: node scripts/gen-sale-alerts.mjs (launchd com.acme.sale-alerts)",
    });
  } catch { }

  for (const s of SOURCES) {
    const o = await cfg(sb, s.key);

    const tk = s.chiThamKhao;
    if (!o) {
      out.push({ key: s.key, label: s.label, ageHours: null, maxHours: s.maxHours,
        ok: !!s.optional, note: s.optional ? "chưa bật (không canh)" : "chưa từng có dữ liệu", fix: s.fix, chiThamKhao: tk });
      continue;
    }
    const age = hoursSince(pickTs(o));
    if (age == null) { out.push({ key: s.key, label: s.label, ageHours: null, maxHours: s.maxHours, ok: true, note: "có dữ liệu (không có mốc thời gian để đo tuổi)", fix: s.fix, chiThamKhao: tk }); continue; }
    out.push({ key: s.key, label: s.label, ageHours: age, maxHours: s.maxHours, ok: age <= s.maxHours, note: `cập nhật ${age}h trước`, fix: s.fix, chiThamKhao: tk });
  }

  try {
    const { data: moi } = await runsP;
    const age = hoursSince(moi?.[0]?.created_at);
    const fix = "kiểm cron trên Vercel; xem /tasks?view=may và /he-dieu-hanh-ai";
    if (age == null) {
      out.push({ key: "agent_runs", label: "Sổ việc của máy (agent_runs)", ageHours: null, maxHours: 12, ok: false,
        note: "chưa có dòng nào — bảng đã tạo nhưng chưa cron nào ghi", fix });
    } else {
      out.push({ key: "agent_runs", label: "Sổ việc của máy (agent_runs)", ageHours: age, maxHours: 12, ok: age <= 12,
        note: age <= 12 ? `dòng gần nhất ${age}h trước` : `KHÔNG máy nào ghi sổ suốt ${age}h — nghi cron chết hàng loạt`, fix });
    }
  } catch (e: any) {

    out.push({ key: "agent_runs", label: "Sổ việc của máy (agent_runs)", ageHours: null, maxHours: 12, ok: false,
      note: `không đọc được bảng: ${String(e?.message || e).slice(0, 120)}`,
      fix: "chạy migration 050_viec_cua_may.sql trong Supabase SQL Editor" });
  }

  const loiGhi = await cfg(sb, "agent_runs_loi");
  if (loiGhi) {
    const age = hoursSince(loiGhi.luc);
    if (age != null && age <= 24) {
      out.push({ key: "agent_runs_loi", label: "Ghi sổ việc của máy bị lỗi", ageHours: age, maxHours: 24, ok: false,
        note: String(loiGhi.loi || "").slice(0, 160), fix: "xem log Vercel; kiểm quyền service role trên bảng agent_runs" });
    }
  }

  out.push(...(await machP));
  out.push(...(await capiP));

  DOC_SAN.delete(sb);
  return out;
}

async function checkMetaCapi(sb: any): Promise<SourceHealth[]> {
  try {
    const c = await cfg(sb, "meta_capi");
    if (!c || c.bat !== true) return [];
    const base = { key: "meta_capi", label: "Meta Conversions API (gửi Lead/Purchase phía máy chủ)", maxHours: 48,
      fix: "kiểm env META_CAPI_TOKEN trên Vercel + pixel_id trong config meta_capi; xem lỗi ở config meta_capi_trangthai; muốn tắt thì đặt bat=false" };
    if (!(process.env.META_CAPI_TOKEN || "").trim()) {
      return [{ ...base, ageHours: null, ok: false, note: "đã bật nhưng THIẾU env META_CAPI_TOKEN — không gửi được sự kiện nào" }];
    }
    const st = await cfg(sb, "meta_capi_trangthai");
    const h = hoursSince(pickTs(st));
    const ok = h != null && h <= 48 && st?.ok !== false;
    return [{ ...base, ageHours: h, ok,
      note: !st ? "đã bật nhưng chưa gửi lần nào" : st.ok === false ? `lần gửi cuối lỗi: ${String(st.loi || "").slice(0, 120)}`
        : `lần cuối gửi ${st.gui ?? 0} sự kiện ${st.loai || ""}, Meta nhận ${st.nhan ?? 0}${st.thu ? " (chế độ TEST)" : ""}` }];
  } catch { return []; }
}

async function checkMachDutMkt(sb: any): Promise<SourceHealth[]> {
  const out: SourceHealth[] = [];

  try {
    const g = await cfg(sb, "google_ads_daily");
    const hist: any[] = Array.isArray(g) ? g : [];
    const ngay = hist.map((d) => String(d?.date || "")).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop();
    const base = { key: "gads_so_ngay", label: "Sổ Google Ads (lịch Claude lái Chrome, 8:30 máy CEO)", maxHours: 48,
      fix: "lịch Claude bao-cao-google-ads-hang-ngay phải mở được phiên (cwd trỏ thư mục có thật) và Claude in Chrome phải kết nối; chạy tay: Run now trong app Claude, hoặc node scripts/gads-bu-ngay.mjs để xem ngày thiếu" };
    if (!ngay) {
      out.push({ ...base, ageHours: null, ok: false, note: "sổ rỗng — chưa từng có ngày nào" });
    } else {
      const age = hoursSince(new Date(Date.parse(`${ngay}T00:00:00+07:00`) + 864e5).toISOString());
      const ok = age != null && age <= 48;
      out.push({ ...base, ageHours: age, ok,
        note: ok ? `ngày gần nhất ${ngay} (${hist.length} ngày trong sổ)` : `sổ đứng ở ngày ${ngay} — ${Math.floor((age || 0) / 24)} ngày không có số chi Google Ads` });
    }
  } catch { }

  {
    const base = { key: "meta_chi_3_ngay", label: "Chi tiêu Meta 3 ngày (chiến dịch ACTIVE có tiêu không)", ageHours: null as number | null, maxHours: 72,
      fix: "mở Ads Manager xem chiến dịch ACTIVE có bị từ chối/hết ngân sách/thẻ lỗi không; số tháng ở /api/cron/ads-spend" };
    const token = (process.env.FB_ADS_TOKEN || process.env.FB_USER_TOKEN || "").trim();
    let acct = (process.env.FB_AD_ACCOUNT || "000000000000000").trim();
    if (!/^act_/.test(acct)) acct = "act_" + acct.replace(/\D/g, "");
    if (!token) {
      out.push({ ...base, ok: false, note: "không đo được — thiếu FB_ADS_TOKEN/FB_USER_TOKEN" });
    } else {
      try {
        const G = "https://graph.facebook.com/v21.0";
        const q = (u: string) => fetch(u, { cache: "no-store", signal: AbortSignal.timeout(15000) }).then((r) => r.json());
        const [ins, cps]: any[] = await Promise.all([
          q(`${G}/${acct}/insights?fields=spend&date_preset=last_3d&access_token=${encodeURIComponent(token)}`),
          q(`${G}/${acct}/campaigns?fields=id&effective_status=${encodeURIComponent('["ACTIVE"]')}&limit=200&access_token=${encodeURIComponent(token)}`),
        ]);
        if (ins?.error || cps?.error) {
          const e = ins?.error || cps?.error;
          out.push({ ...base, ok: false, note: `Graph API từ chối (mã ${e?.code}): ${String(e?.message || "").slice(0, 80)}` });
        } else {
          const chi = Math.round(Number(ins?.data?.[0]?.spend || 0));
          const active = Array.isArray(cps?.data) ? cps.data.length : 0;
          const ok = !(active > 0 && chi === 0);
          out.push({ ...base, ok,
            note: ok ? `${active} chiến dịch ACTIVE, chi 3 ngày ${chi.toLocaleString("vi-VN")}đ`
                     : `${active} chiến dịch ACTIVE nhưng 3 ngày gần nhất chi 0đ — kênh tiền đang tắt mà nhìn như đang chạy` });
        }
      } catch (e: any) {

        out.push({ ...base, ok: true, note: `không hỏi được Graph lần này (${String(e?.message || e).slice(0, 60)})` });
      }
    }
  }

  try {
    const base = { key: "fb_binh_luan_lead", label: "Máy bóc lead từ bình luận fanpage (có bình luận/lead mới không)", maxHours: 7 * 24,
      fix: "máy vẫn quét mà không thấy gì nghĩa là NGUỒN cạn (page trong fb_comment_agent.pages ít bình luận, hoặc page từng ra lead không còn trong danh sách) — xem pages trong config fb_comment_agent; chạy tay /api/cron/fb-comments?key=<CRON_SECRET>" };
    const { KEY_DUNG, docTrangThai, nhomBiDung } = await import("./dung-khan-cap-core");
    const agentCfg = await cfg(sb, "fb_comment_agent");
    let dung: unknown = null;
    try {
      const raw = (await sb.from("config").select("value").eq("key", KEY_DUNG).maybeSingle()).data?.value;
      dung = nhomBiDung(docTrangThai(raw ?? null), "nhan_khach");
    } catch { }
    if (dung || (Array.isArray(agentCfg?.pages) && agentCfg.pages.length === 0)) {
      out.push({ ...base, ageHours: null, ok: true, tat: true,
        note: dung ? "đang TẮT có chủ đích (dừng khẩn cấp nhóm nhận khách)" : "đang TẮT có chủ đích (fb_comment_agent.pages rỗng)" });
    } else {
      const { data: moi } = await sb.from("leads").select("created_at")
        .or("external_id.like.fbc:%,external_id.like.fbcm:%").order("created_at", { ascending: false }).limit(1);
      const nhip = await cfg(sb, "fb_comment_agent_last");
      const tuoiLead = hoursSince(moi?.[0]?.created_at);
      const tuoiThay = hoursSince(nhip?.thayBinhLuanLuc);
      const ages = [tuoiLead, tuoiThay].filter((x): x is number => x != null);
      const age = ages.length ? Math.min(...ages) : null;
      const ok = age != null && age <= 7 * 24;
      const d = (h: number | null) => (h == null ? "chưa có" : `${Math.floor(h / 24)} ngày trước`);
      out.push({ ...base, ageHours: age, ok,
        note: `lead bình luận cuối: ${d(tuoiLead)} · bình luận khách mới cuối máy thấy: ${d(tuoiThay)} · lượt quét gần nhất ${hoursSince(nhip?.at) ?? "?"}h trước, ${Number(nhip?.scanned || 0)} bình luận mới` });
    }
  } catch { }

  return out;
}

export type Anomaly = { key: string; label: string; note: string; fix: string };

async function soiDonHangTheoNgay(): Promise<Anomaly[]> {
  const out: Anomaly[] = [];

  try {
    const sb2 = getServiceClient();
    const tu = new Date(now() - 24 * 3600e3).toISOString();
    const { data } = await sb2.from("agent_runs").select("agent, agent_ten, trang_thai").gte("created_at", tu).limit(1000);
    const rows = (data ?? []) as Array<{ agent: string; agent_ten: string | null; trang_thai: string }>;

    const theoMay = new Map<string, { ten: string; luot: number; xong: number; hong: number }>();
    for (const r of rows) {
      const g = theoMay.get(r.agent) ?? { ten: r.agent_ten || r.agent, luot: 0, xong: 0, hong: 0 };
      g.luot++;
      if (r.trang_thai === "xong") g.xong++;
      if (r.trang_thai === "hong") g.hong++;
      theoMay.set(r.agent, g);
    }

    for (const [khoa, g] of theoMay) {

      if (g.luot < 3) continue;
      if (g.xong === 0) {
        out.push({
          key: `may_khong_ra_gi_${khoa}`,
          label: `${g.ten} chạy ${g.luot} lượt/24h mà không ra sản phẩm nào`,
          note: g.hong ? `${g.hong}/${g.luot} lượt hỏng hẳn` : `lượt nào cũng trót lọt nhưng đẻ ra 0`,
          fix: `mở /tasks?view=may lọc máy "${khoa}" đọc cột chi tiết`,
        });
      } else if (g.hong / g.luot >= 0.5) {
        out.push({
          key: `may_hong_nhieu_${khoa}`,
          label: `${g.ten} hỏng ${g.hong}/${g.luot} lượt trong 24h`,
          note: "quá nửa số lượt thất bại — chưa chết hẳn nên nhịp tim vẫn xanh",
          fix: `mở /tasks?view=may lọc máy "${khoa}" đọc câu lỗi`,
        });
      }
    }
  } catch {  }

  try {
    const sb = getServiceClient();
    const since = new Date(now() + 7 * 3600e3 - 12 * 86400e3).toISOString().slice(0, 10);
    const todayStr = vnDateStr();

    const { theoNgay } = await tongDoanhThu(sb, since, todayStr);
    if (!theoNgay.length) return out;

    const byDay = new Map<string, { rev: number; orders: number }>();
    for (const r of theoNgay) byDay.set(r.ngay, { rev: r.net, orders: r.don });
    const complete = [...byDay.keys()].filter((d) => d < todayStr).sort();
    if (complete.length < 5) return out;

    const last = complete[complete.length - 1];
    const prevDays = complete.slice(-8, -1);
    if (prevDays.length < 3) return out;
    const lastG = byDay.get(last)!;
    const avgOrders = prevDays.reduce((s, d) => s + byDay.get(d)!.orders, 0) / prevDays.length;
    const avgRev = prevDays.reduce((s, d) => s + byDay.get(d)!.rev, 0) / prevDays.length;

    if (avgOrders >= 5 && lastG.orders === 0) {
      out.push({
        key: "orders_zero",
        label: "Đơn hàng bất thường",
        note: `Ngày ${last} có 0 đơn (TB ~${Math.round(avgOrders)} đơn/ngày).`,
        fix: "Kiểm cron tg-boc-don đã bóc ngày này chưa + đường bán có kẹt không.",
      });
    } else if (avgOrders >= 5 && lastG.orders < avgOrders * 0.4) {
      out.push({
        key: "orders_drop",
        label: "Đơn hàng tụt mạnh",
        note: `Ngày ${last}: ${lastG.orders} đơn vs TB ~${Math.round(avgOrders)} (giảm >60%).`,
        fix: "Đối chiếu nhóm Đơn Hàng + vận đơn J&T trước khi kết luận.",
      });
    }
    if (avgRev >= 1e6 && lastG.rev < avgRev * 0.4) {
      out.push({
        key: "rev_drop",
        label: "Doanh số tụt mạnh",
        note: `Ngày ${last}: ${Math.round(lastG.rev / 1e6)}tr vs TB ~${Math.round(avgRev / 1e6)}tr (giảm >60%).`,
        fix: "Có thể máy bóc đơn sót lô hoặc lệch pha COD — đối chiếu nhóm Đơn Hàng + sổ phụ trước khi kết luận.",
      });
    }
  } catch {

  }
  return out;
}

export type ChamCongInput = {
  homNay: string;
  gioVN: number;
  thu: number;
  recs: { user_id: string; date: string; check_in_time: string | null; check_out_time: string | null; status?: string | null }[];
  ten: Record<string, string>;
  dangNghi: Set<string>;
};

export function soatChamCong(inp: ChamCongInput): Anomaly[] {
  const out: Anomaly[] = [];
  const { homNay, gioVN, thu, recs, ten, dangNghi } = inp;
  const ngay = (lui: number) => new Date(Date.parse(`${homNay}T12:00:00+07:00`) - lui * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

  if (thu !== 0 && gioVN >= 10) {
    const soNgay: Record<string, number> = {};
    const coHomNay = new Set<string>();
    for (const r of recs) {
      if (!r.check_in_time) continue;
      if (r.date === homNay) coHomNay.add(r.user_id);
      else soNgay[r.user_id] = (soNgay[r.user_id] || 0) + 1;
    }
    const thieu = Object.keys(soNgay)
      .filter((id) => soNgay[id] >= 5 && ten[id] && !coHomNay.has(id) && !dangNghi.has(id));
    if (thieu.length) {
      out.push({
        key: "cham_cong_trang_hom_nay",
        label: "Có người đi làm mà chưa chấm công được",
        note: `${thieu.length} người thường chấm công đều nhưng hôm nay (${homNay}) chưa có bản ghi nào, tính tới ${gioVN}h: ${thieu.map((id) => ten[id]).join(" · ")}. Đã trừ người có đơn nghỉ đã duyệt.`,
        fix: "Hỏi họ mở app có bị đá về màn đăng nhập không. Nếu mất mật khẩu thì cấp lại (nút Quên mật khẩu CHƯA chạy vì dự án chưa cắm SMTP). Ngày công thiếu bù bằng scripts/bu-cham-cong.mjs, đừng để trừ lương oan.",
      });
    }
  }

  const NGAN_PHUT = 5;
  const motMoc = ngay(3);
  const nghiNgo = recs.filter((r) => {
    if (!r.check_in_time || !r.check_out_time || r.date < motMoc) return false;
    const phut = (Date.parse(r.check_out_time) - Date.parse(r.check_in_time)) / 60000;
    return phut >= 0 && phut < NGAN_PHUT;
  });
  if (nghiNgo.length) {
    out.push({
      key: "cham_cong_vao_ra_sat_nhau",
      label: "Chấm công vào-ra cách nhau vài phút",
      note: nghiNgo.map((r) => `${ten[r.user_id] || r.user_id} ngày ${r.date}: vào và ra cách nhau ${Math.round((Date.parse(r.check_out_time!) - Date.parse(r.check_in_time!)) / 60000 * 10) / 10} phút${r.status === "late" ? " (đang bị gắn ĐI MUỘN)" : ""}`).join(" · "),
      fix: "Gần như luôn là người bấm vội cuối ngày sau khi cả ngày bấm không ăn — tức HỆ THỐNG hỏng chứ không phải họ gian. Kiểm xem hôm đó app có lỗi đăng nhập không, rồi sửa lại ngày công cho đúng trước khi chốt lương.",
    });
  }
  return out;
}

async function soiChamCong(): Promise<Anomaly[]> {
  try {
    const sb = getServiceClient();
    const homNay = vnDateStr();
    const gioVN = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }));
    const thu = new Date(`${homNay}T12:00:00+07:00`).getUTCDay();

    const { data: recs, error } = await sb.from("attendance")
      .select("user_id, date, check_in_time, check_out_time, status")
      .gte("date", vnDateStr(new Date(now() - 14 * 864e5))).order("date", { ascending: false }).limit(1000);
    if (error || !recs) return [];

    const { data: nv } = await sb.from("users").select("id, full_name, active").eq("active", true).limit(200);
    const ten = Object.fromEntries((nv || []).map((u: any) => [u.id, u.full_name || "(không tên)"]));

    let dangNghi = new Set<string>();
    try {
      const { data: ls } = await sb.from("leaves").select("user_id, from_date, to_date, status")
        .eq("status", "approved").lte("from_date", homNay).gte("to_date", homNay).limit(100);
      dangNghi = new Set((ls || []).map((l: any) => l.user_id));
    } catch {  }

    return soatChamCong({ homNay, gioVN, thu, recs: recs as any, ten, dangNghi });
  } catch {
    return [];
  }
}

export async function checkNumberAnomalies(): Promise<Anomaly[]> {
  const out: Anomaly[] = [];
  out.push(...(await soiDonHangTheoNgay()));
  out.push(...(await soiChamCong()));

  try {
    const sb = getServiceClient();
    const STREAK_SOURCES: { key: string; label: string; fix: string }[] = [
      { key: "fb_unreplied", label: "FB chưa trả lời", fix: "Kiểm phiên Pancake/scraper fb-unreplied — có thể cào trắng chứ không phải hết thật." },
    ];
    for (const s of STREAK_SOURCES) {
      const st = await cfg(sb, `${s.key}_streak`);
      const n = Number(st?.consecutiveEmpty || 0);
      const thr = Number(st?.threshold || 3);
      if (n >= thr) {
        out.push({
          key: `${s.key}_empty_streak`,
          label: `${s.label}: cào rỗng liên tiếp`,
          note: `Nguồn "${s.key}" ra 0 suốt ${n} lần liên tiếp (ngưỡng ${thr}).`,
          fix: s.fix,
        });
      }
    }
  } catch {

  }

  try {
    const sb = getServiceClient();

    try {
      const since = new Date(now() - 48 * 3600e3).toISOString();
      const { data } = await sb.from("leads").select("created_at, first_contact_at").gte("created_at", since).limit(2000);
      const rows = Array.isArray(data) ? data : [];
      const that = rows.filter((r: any) => !r.first_contact_at || new Date(r.first_contact_at) >= new Date(r.created_at));
      const chua = that.filter((r: any) => !r.first_contact_at).length;
      if (that.length >= 30 && chua / that.length >= 0.7) {
        out.push({
          key: "lead_khong_ai_cham",
          label: "Lead mới về mà không ai chạm",
          note: `48h qua có ${that.length} lead mới (đã loại ${rows.length - that.length} dòng nhập từ lịch sử Zalo), ${chua} lead (${Math.round(chua / that.length * 100)}%) chưa ai liên hệ.`,
          fix: "Mở /leads chia lại theo người còn tải; lead quá 24h chưa chạm nên trả về hàng đợi chung thay vì nằm im ở một người.",
        });
      }
    } catch { }

    try {
      const zalo = await cfg(sb, "sale_unreplied");
      const fb = await cfg(sb, "fb_unreplied");
      const tong = Number(zalo?.total || 0) + Number(fb?.total || 0);
      const cuNhat = Math.max(
        ...(zalo?.bySale || []).map((s: any) => Number(s.oldestHours || 0)),
        Number(fb?.oldestHours || 0), 0,
      );
      if (tong >= 150 || cuNhat >= 72) {
        out.push({
          key: "khach_cho_qua_lau",
          label: "Khách đã nhắn đang bị bỏ quên",
          note: `${tong} người đang chờ trả lời (Zalo ${zalo?.total || 0} · Facebook ${fb?.total || 0}); người chờ lâu nhất ${Math.round(cuNhat / 24)} ngày.`,
          fix: "Đây là tệp đắt nhất vì họ tự tìm đến. Dọn theo thứ tự chờ lâu nhất trước, không theo người phụ trách.",
        });
      }

      const auto = await cfg(sb, "fb_autoreply_status");
      const binhLuan = Number(fb?.comment || 0);
      if (!auto && binhLuan >= 30) {
        out.push({
          key: "autoreply_chua_bat",
          label: "Máy trả lời fanpage chưa bật",
          note: `${binhLuan} bình luận chưa ai trả lời, mà webhook trả lời tự động chưa chạy lần nào.`,
          fix: "Đặt FB_VERIFY_TOKEN trên Vercel, khai webhook trong Meta App (trường messages), rồi mở /api/fb/webhook?setup=go&key=<CRON_SECRET>.",
        });
      }
    } catch { }

    try {
      const { data: tinCuoi } = await sb.from("tg_messages").select("sent_at").in("chat_id", await nhomDon()).order("sent_at", { ascending: false }).limit(1);
      const tuoiTin = hoursSince(tinCuoi?.[0]?.sent_at);
      if (tuoiTin != null && tuoiTin > 30) {
        out.push({
          key: "nhom_don_hang_cam_tin",
          label: "Nhóm Đơn Hàng không vào tin nào",
          note: `Tin gần nhất ghi được đã ${tuoiTin}h trước — sale gõ đơn hằng ngày nên quá 30h là bất thường.`,
          fix: "Kiểm chế độ riêng tư của bot (BotFather /setprivacy → Disable) và webhook /api/telegram/sale. KHÔNG phải cứ ít tin là hỏng — ảnh và sticker vốn không được ghi; mốc đáng lo là KHÔNG CÓ TIN NÀO.",
        });
      }
    } catch { }
    try {
      const tuNgay = vnDateStr(new Date(Date.now() - 8 * 864e5));
      const homNay = vnDateStr();
      const { data: don } = await sb.from("tg_orders").select("ngay").gte("ngay", tuNgay).lt("ngay", homNay);
      if (Array.isArray(don)) {
        const coDon = new Set(don.map((o: any) => o.ngay));
        const trong: string[] = [];
        for (let i = 1; i <= 7; i++) {
          const d = vnDateStr(new Date(Date.now() - i * 864e5));
          if (!coDon.has(d)) trong.push(d);
        }

        if (trong.length >= 2) {
          out.push({
            key: "so_don_ngay_trong",
            label: "Sổ đơn có ngày trắng",
            note: `${trong.length}/7 ngày gần nhất không bóc được đơn nào: ${trong.join(", ")}.`,
            fix: "Kiểm cron /api/cron/tg-boc-don (chạy :05 và :35) và bảng tg_messages còn nhận tin không. Ngày trắng giữa tuần gần như luôn là hỏng đường ống, không phải ế hàng.",
          });
        }
      }
    } catch { }

    try {
      const d7 = vnDateStr(new Date(Date.now() - 7 * 864e5));
      const d37 = vnDateStr(new Date(Date.now() - 37 * 864e5));
      const homNay2 = vnDateStr();
      const { data: gan } = await sb.from("tg_orders").select("ngay").gte("ngay", d7).lt("ngay", homNay2);
      const { data: nen } = await sb.from("tg_orders").select("ngay").gte("ngay", d37).lt("ngay", d7);
      if (Array.isArray(gan) && Array.isArray(nen) && nen.length >= 60) {
        const nhipGan = gan.length / 7, nhipNen = nen.length / 30;
        if (nhipNen > 0 && nhipGan < nhipNen * 0.5) {
          out.push({
            key: "nhip_don_tut_sau",
            label: "Nhịp đơn tụt sâu so với nền",
            note: `7 ngày qua ${nhipGan.toFixed(1)} đơn/ngày, nền 30 ngày trước đó ${nhipNen.toFixed(1)} đơn/ngày (còn ${Math.round(nhipGan / nhipNen * 100)}%).`,
            fix: "Đây có thể là bán chậm THẬT, cũng có thể là ống dẫn rò một phần. Kiểm trước: bảng tg_messages 7 ngày qua có ít tin hơn hẳn không, và cron tg-boc-don có lượt nào bóc ra 0 đơn không. Đừng kết luận ế hàng trước khi loại trừ hai cái đó.",
          });
        }
      }
    } catch { }

    try {
      const ads = await cfg(sb, "ads_campaigns");
      const ds = Array.isArray(ads?.campaigns) ? ads.campaigns : [];
      const dangChay = ds.filter((c: any) => String(c.status).toUpperCase() === "ACTIVE");
      const tongChi = ds.reduce((s: number, c: any) => s + (Number(c.spend) || 0), 0);
      if (dangChay.length > 0 && tongChi === 0) {
        out.push({
          key: "ads_bat_ma_khong_chi",
          label: "Quảng cáo Meta bật mà không tiêu đồng nào",
          note: `${dangChay.length} chiến dịch trạng thái ACTIVE nhưng tổng chi tiêu tháng = 0đ.`,
          fix: "Hoặc ngân sách đặt ở nhóm quảng cáo nên đọc không ra, hoặc chiến dịch rỗng. Chặng phần trăm chi phí marketing đang tính bằng 0 = đang mù, không phải đang tốt.",
        });
      }
    } catch { }

    try {
      const g = await cfg(sb, "google_ads_daily");
      const ngay = Array.isArray(g) ? g[g.length - 1] : null;
      const ds = Array.isArray(ngay?.campaigns) ? ngay.campaigns : [];
      const chi = ds.reduce((s: number, c: any) => s + (Number(c.cost) || 0), 0);
      const conv = ds.reduce((s: number, c: any) => s + (Number(c.conv) || 0), 0);
      const click = ds.reduce((s: number, c: any) => s + (Number(c.clicks) || 0), 0);
      if (chi >= 20000 && conv === 0) {
        out.push({
          key: "gads_khong_chuyen_doi",
          label: "Google Ads chi tiền không ra chuyển đổi",
          note: `Ngày ${ngay?.date || "gần nhất"}: chi ${Math.round(chi).toLocaleString("vi-VN")}đ, ${click} nhấp, 0 chuyển đổi.`,
          fix: "Kiểm trang đích có cửa để lại liên hệ không trước khi đổ thêm tiền — thường lỗi nằm ở trang đích chứ không ở từ khoá.",
        });
      }
    } catch { }

    try {
      const g = await cfg(sb, "google_ads_daily");
      const hist: any[] = Array.isArray(g) ? g : [];
      const co = new Set(hist.map((d) => String(d?.date || "")));
      const now = new Date(Date.now() + 7 * 3600 * 1000);
      const thieu: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        const s2 = d.toISOString().slice(0, 10);
        if (!co.has(s2)) thieu.push(s2);
      }

      if (thieu.length >= 2) {
        out.push({
          key: "gads_so_thieu_ngay",
          label: "Sổ Google Ads thủng ngày",
          note: `7 ngày gần nhất thiếu ${thieu.length} ngày: ${thieu.join(", ")}. Không có số thì không đo nổi tiền quảng cáo đã tiêu.`,
          fix: "Máy Mac chạy: node scripts/gads-bu-ngay.mjs (in ra ngày còn thiếu), rồi mở Google Ads lấy đúng những ngày đó và POST lô qua days[] của /api/cron/google-ads-report.",
        });
      }
    } catch { }

    try {
      const r = await fetch("https://example.com/llms.txt", { cache: "no-store" });
      if (r.ok) {
        const nay = (await r.text()).split("\n").filter((l) => /\/blog\/[a-z0-9-]+\.html/.test(l)).length;
        const so = await cfg(sb, "blog_so_bai_hom_qua");
        const truoc = Number(so?.so || 0);
        const ngayTruoc = String(so?.ngay || "");
        if (nay > 0 && ngayTruoc && ngayTruoc !== vnDateStr()) {
          const them = nay - truoc;

          if (them > 5) {
            out.push({
              key: "blog_dang_o_at",
              label: "Blog đăng ồ ạt bất thường",
              note: `Hôm nay web tăng ${them} bài (từ ${truoc} lên ${nay}). Nhịp đã chốt là 1 bài/ngày.`,
              fix: "Xem `git log --diff-filter=A --name-only -- 'blog/*.html'` bên repo nova-website: gần như chắc là một máy tự động vừa gõ `git add -A` và nuốt cả bài cũ. Hiện Google mới lập chỉ mục 74/476 trang nên đẩy lô lớn chỉ làm tệ thêm.",
            });
          }
        }
        if (nay > 0) {
          await sb.from("config").upsert(
            { key: "blog_so_bai_hom_qua", value: JSON.stringify({ so: nay, ngay: vnDateStr() }) },
            { onConflict: "key" },
          );
        }
      }
    } catch { }

    try {
      const { count: nhap } = await sb.from("content_items").select("id", { count: "exact", head: true }).eq("status", "draft");
      const dayStart = `${vnDateStr()}T00:00:00+07:00`;
      const { count: dang } = await sb.from("content_items").select("id", { count: "exact", head: true })
        .eq("status", "published").gte("publish_date", dayStart);
      if (Number(nhap || 0) >= 25 && Number(dang || 0) === 0) {
        out.push({
          key: "bai_ton_khong_ai_dang",
          label: "Bài viết tồn kho, không ai đăng",
          note: `${nhap} bài đang ở dạng nháp, hôm nay chưa bài nào được đăng.`,
          fix: "Gắn việc duyệt bài vào kế hoạch ngày của người trực trang; bài quá 24h chưa duyệt thì nhắc một lần rồi tự bỏ.",
        });
      }
    } catch { }

    try {
      const { data: yc } = await sb.from("yeu_cau_du_lieu").select("id, loai, han_xu_ly, trang_thai, created_at")
        .not("trang_thai", "in", '("xong","tu-choi")').limit(200);
      if (yc && yc.length) {
        const now = Date.now();
        const quaHan = yc.filter((r: any) => r.han_xu_ly && Date.parse(r.han_xu_ly) < now);
        const sapHan = yc.filter((r: any) => r.han_xu_ly && Date.parse(r.han_xu_ly) >= now && Date.parse(r.han_xu_ly) - now < 3 * 86400000);
        const chuaXacNhan = yc.filter((r: any) => r.trang_thai === "moi" && now - Date.parse(r.created_at) > 2 * 86400000);
        if (quaHan.length || sapHan.length || chuaXacNhan.length) {
          out.push({
            key: "yeu_cau_du_lieu_qua_han",
            label: "Yêu cầu dữ liệu cá nhân của khách chưa xử lý đúng hạn",
            note: `${quaHan.length} yêu cầu ĐÃ QUÁ HẠN · ${sapHan.length} sắp hết hạn (dưới 3 ngày) · ${chuaXacNhan.length} quá 2 ngày chưa đánh dấu đã xác nhận. Loại: ${Array.from(new Set(yc.map((r: any) => r.loai))).join(", ")}.`,
            fix: "Mở bảng yeu_cau_du_lieu (Supabase) hoặc việc thẻ du-lieu-ca-nhan trong /tasks; làm theo docs/tuan-thu-nd-330-2026-du-lieu-ca-nhan.md mục 6, xong thì đổi trang_thai='xong' + xu_ly_luc. Quá hạn là 30-40tr/ca theo Đ.44 NĐ 330/2026.",
          });
        }
      }
    } catch { }
  } catch {

  }

  try {
    const { doHangDoiDuyet } = await import("./cc-queue");
    out.push(...(await doHangDoiDuyet()));
  } catch { }

  try {
    const { doHangDoiChayLai } = await import("./may-chay-ngam");
    out.push(...(await doHangDoiChayLai()));
  } catch { }

  return out;
}
