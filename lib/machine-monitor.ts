import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";

export type MachineRow = {
  name: string;
  what: string;
  schedule: string;
  where: "server" | "may-mac";
  lastRun: string | null;
  ageHours: number | null;
  ok: boolean | null;
  output: string;
  fix: string;
};

const hoursSince = (v: any): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return isFinite(t) ? Math.round(((Date.now() - t) / 3600e3) * 10) / 10 : null;
};
const fmt = (v: any): string | null => {
  if (!v) return null;
  const t = new Date(v);
  return isFinite(t.getTime()) ? new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ") : String(v).slice(0, 16);
};

export async function buildMachineBoard(): Promise<{ rows: MachineRow[]; okCount: number; badCount: number; unknownCount: number }> {
  const sb = getServiceClient();
  const cfg = async (k: string): Promise<any> => {
    try { const v = (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value; return v ? JSON.parse(v) : null; } catch { return null; }
  };
  const cfgRaw = async (k: string): Promise<string | null> => {
    try { return (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value ?? null; } catch { return null; }
  };
  const countSince = async (table: string, col: string, sinceIso: string): Promise<number | null> => {
    try {
      const { count } = await sb.from(table).select("id", { count: "exact", head: true }).gte(col, sinceIso);
      return count ?? 0;
    } catch { return null; }
  };

  const dayAgo = new Date(Date.now() - 26 * 3600e3).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString();

  const [adScout, videoPoster, bankLoop, contentLast, adsCampaigns, aiCost, liveCampaign, backup, jtSession] = await Promise.all([
    cfg("ad_scout_status"), cfg("video_poster_status"), cfg("bank_loop_status"),
    cfg("content_factory_last"), cfg("ads_campaigns"), cfg("covan_api_cost"), cfg("covan_campaign_live"),
    cfg("backup_status"), cfg("jt_session_status"),
  ]);
  const [fbTuongTac, zaloCho, saleworkTT] = await Promise.all([cfg("fb_tuong_tac"), cfg("zalo_unreplied"), cfg("salework_status")]);
  const [draftsToday, tasksToday, consultTomorrow, storiesRaw, queueRaw, recheckRaw] = await Promise.all([
    countSince("content_items", "created_at", dayAgo),
    countSince("tasks", "created_at", dayAgo),
    countSince("consultations", "created_at", weekAgo),
    cfgRaw("customer_stories"), cfgRaw("video_queue"), cfgRaw("quiz_recheck"),
  ]);
  const arrLen = (raw: string | null): number => { try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? a.length : 0; } catch { return 0; } };

  const todayCost = (() => {
    try { const m = aiCost || {}; return m[vnDateStr()]?.vnd || 0; } catch { return 0; }
  })();

  const rows: MachineRow[] = ([
    {
      name: "Bản tin sáng cố vấn", what: "Đọc P&L, cảnh báo, nhịp hòa vốn rồi nhắn CEO", schedule: "7:54 hằng ngày", where: "server",
      lastRun: null, ageHours: null, ok: null,
      output: todayCost > 0 ? `Hôm nay đã tiêu ${Math.round(todayCost).toLocaleString("vi-VN")}đ tiền AI (có gọi não là có chạy)` : "Chưa thấy dấu gọi AI hôm nay",
      fix: "kiểm /api/cron/covan-morning trên Vercel + COVAN_BOT_TOKEN",
    },
    {
      name: "Nhà máy Content", what: "Đẻ bài nháp mỗi ngày cho người duyệt", schedule: "8:05 · 10:00 · 11:00 · 15:00 · 20:00", where: "server",
      lastRun: fmt(contentLast?.at), ageHours: hoursSince(contentLast?.at),
      ok: contentLast?.date === vnDateStr() || (draftsToday ?? 0) > 0,
      output: `${draftsToday ?? 0} bài nháp tạo trong 24h qua`,
      fix: "kiểm /api/cron/content-factory — cần GEMINI_API_KEY_BRAIN",
    },
    {
      name: "Trinh sát quảng cáo đối thủ", what: "Cào Ad Library, rút hook và ưu đãi đối thủ", schedule: "8:35 cào · 9:00 báo cáo", where: "may-mac",
      lastRun: fmt(adScout?.at), ageHours: hoursSince(adScout?.at), ok: adScout ? !!adScout.ok : null,
      output: adScout ? `${adScout.totalAdvertisers || 0} nhà quảng cáo từ ${adScout.keywords || 0} từ khoá` : "Chưa có dấu vết",
      fix: "máy Mac phải bật lúc 8:35 · log /tmp/ad-scout.log · chạy tay: node scripts/ad-scout.mjs --commit",
    },
    {
      name: "Máy đăng video fanpage", what: "Tải video lên Facebook kèm giờ hẹn", schedule: "9:05 hằng ngày", where: "may-mac",
      lastRun: fmt(videoPoster?.at), ageHours: hoursSince(videoPoster?.at), ok: videoPoster ? !!videoPoster.ok : null,
      output: videoPoster ? `${videoPoster.scheduled || 0} video đã hẹn giờ${videoPoster.failed ? `, ${videoPoster.failed} lỗi` : ""} · hàng đợi ${arrLen(queueRaw)} mục` : "Chưa có dấu vết",
      fix: "máy Mac phải bật lúc 9:05 · log /tmp/video-poster.log · chạy tay: node scripts/video-poster.mjs --commit",
    },
    {
      name: "Máy nhắc khách đặt lại", what: "Khách 30-45 ngày chưa quay lại thì giao việc gọi", schedule: "8:30 hằng ngày", where: "server",
      lastRun: null, ageHours: null, ok: (tasksToday ?? 0) > 0 ? true : null,
      output: `${tasksToday ?? 0} việc mới được giao trong 24h (gồm cả máy khác)`,
      fix: "kiểm /api/cron/repeat-cycle",
    },
    {
      name: "Máy gặt câu chuyện khách", what: "Khách mua lần 2 thì xin cảm nhận, đổ về kho content", schedule: "9:30 thứ 3 và thứ 6", where: "server",
      lastRun: null, ageHours: null, ok: null,
      output: `Kho hiện có ${arrLen(storiesRaw)} câu chuyện`,
      fix: "kiểm /api/cron/case-study",
    },
    {
      name: "Vòng lặp đo lại quiz", what: "Khách mua qua quiz tới mốc 30/90 ngày thì mời đo lại", schedule: "9:20 hằng ngày", where: "server",
      lastRun: null, ageHours: null, ok: null,
      output: `${arrLen(recheckRaw)} khách đang trong lịch hẹn đo lại`,
      fix: "kiểm /api/cron/quiz-recheck — cần RESEND_API_KEY để gửi email",
    },
    {
      name: "Nhắc lịch tư vấn 1-1", what: "Giao việc nhắc khách có hẹn ngày mai", schedule: "19:30 hằng ngày", where: "server",
      lastRun: null, ageHours: null, ok: consultTomorrow === null ? null : true,
      output: consultTomorrow === null ? "Bảng lịch tư vấn chưa tạo (cần chạy migration 044)" : `${consultTomorrow} buổi tư vấn đặt trong 7 ngày qua`,
      fix: "chạy supabase/migrations/044_consultations.sql rồi kiểm /api/cron/consult-remind",
    },
    {
      name: "Máy kéo số quảng cáo", what: "Kéo chi tiêu Meta, canh trần CPL 150k, học bài WIN/FLOP", schedule: "8:00 hằng ngày", where: "server",
      lastRun: fmt(adsCampaigns?.generatedAt), ageHours: hoursSince(adsCampaigns?.generatedAt),
      ok: hoursSince(adsCampaigns?.generatedAt) !== null && (hoursSince(adsCampaigns?.generatedAt) as number) < 30,
      output: `${(adsCampaigns?.campaigns || []).length} chiến dịch đọc được`,
      fix: "cần FB_USER_TOKEN còn hạn trên Vercel",
    },
    {
      name: "Vòng lặp dòng tiền ngân hàng", what: "Bóc sổ phụ MB và TCB, cập nhật số dư", schedule: "9:10 và 21:10", where: "may-mac",
      lastRun: fmt(bankLoop?.at), ageHours: hoursSince(bankLoop?.at), ok: bankLoop ? !!bankLoop.ok : null,
      output: bankLoop ? (bankLoop.note || "đã chạy") : "Chưa có dấu vết",
      fix: "máy Mac phải bật · log /tmp/bank-sync.log · chạy tay: node scripts/bank-loop.mjs --commit",
    },
    {
      name: "Đo phễu tương tác", what: "Đếm tin nhắn, bình luận, like, share và ai đang chờ trả lời", schedule: "8:50 và 17:50", where: "may-mac",
      lastRun: fmt(fbTuongTac?.at), ageHours: hoursSince(fbTuongTac?.at),
      ok: fbTuongTac ? true : null,
      output: fbTuongTac
        ? `${(fbTuongTac.perPage || []).length} fanpage · trả lời thường gặp ${fbTuongTac.repMedian ?? "?"} phút · ĐANG CHỜ ${(fbTuongTac.waitingTotal || 0) + (zaloCho?.total || 0)} khách`
        : "Chưa có dấu vết",
      fix: "máy Mac phải bật · log /tmp/fb-tuong-tac.log · chạy tay: node scripts/fb-tuong-tac.mjs --days=14 --commit",
    },
    {
      name: "Cào chat Zalo (Salework)", what: "Kéo danh bạ, mốc hội thoại và ai đang chờ sale trả lời", schedule: "20:00 hằng ngày", where: "may-mac",
      lastRun: fmt(saleworkTT?.at), ageHours: hoursSince(saleworkTT?.at),
      ok: saleworkTT ? !!saleworkTT.ok : null,
      output: saleworkTT
        ? (saleworkTT.ok
          ? `hoạt động 7 ngày ${saleworkTT.active7} · 30 ngày ${saleworkTT.active30} · đang chờ rep ${saleworkTT.unreplied}`
          : `HỎNG: ${saleworkTT.loi}`)
        : "Chưa có dấu vết",
      fix: "phiên Salework hay hết hạn — chạy: node scripts/salework-login.mjs rồi đăng nhập lại · log /tmp/acme-inbox.log",
    },
    {
      name: "Sao lưu dữ liệu", what: "Đổ 16 bảng ra file, nén lên Google Drive, đẩy code lên GitHub", schedule: "23:00 hằng ngày", where: "may-mac",
      lastRun: fmt(backup?.at), ageHours: hoursSince(backup?.at),
      ok: backup ? (!!backup.ok && !!backup.drive) : null,
      output: backup
        ? `${(backup.rows || 0).toLocaleString("vi-VN")} dòng ngày ${backup.day}${backup.drive ? " · đã lên Drive" : " · CHƯA lên Drive"}${backup.note ? ` · ${backup.note}` : ""}`
        : "Chưa có dấu vết",
      fix: "máy Mac phải bật lúc 23:00 · log /tmp/acme-backup.log · chạy tay: node scripts/backup-supabase.mjs",
    },
    {
      name: "Kéo vận đơn J&T", what: "Kéo vận đơn và tiền COD về để đối soát", schedule: "8:15 và 21:15", where: "may-mac",
      lastRun: fmt(jtSession?.at), ageHours: hoursSince(jtSession?.at),
      ok: jtSession ? !!jtSession.ok : null,
      output: jtSession?.ok ? "Phiên đăng nhập còn sống" : `MẤT PHIÊN — ${jtSession?.note || "chưa rõ"}`,
      fix: "CEO chạy: node scripts/jt-login.mjs rồi đăng nhập + giải captcha 1 lần",
    },
    {
      name: "Chiến dịch đang chạy", what: "Sơ đồ sống của chiến dịch tháng", schedule: "khi CEO duyệt", where: "server",
      lastRun: fmt(liveCampaign?.started_at), ageHours: hoursSince(liveCampaign?.started_at),
      ok: liveCampaign ? true : null,
      output: liveCampaign ? `${(liveCampaign.items || []).filter((i: any) => i.status === "xong").length}/${(liveCampaign.items || []).length} việc xong` : "Chưa có chiến dịch nào chạy",
      fix: "xem trang Chiến dịch Live",
    },
  ] as MachineRow[]).filter((r) => r.where !== "may-mac")
    .map((r) => (r.ok === false && r.lastRun == null ? { ...r, ok: null } : r));

  return {
    rows,
    okCount: rows.filter((r) => r.ok === true).length,
    badCount: rows.filter((r) => r.ok === false).length,
    unknownCount: rows.filter((r) => r.ok === null).length,
  };
}
