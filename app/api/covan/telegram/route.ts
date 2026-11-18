import { NextResponse } from "next/server";
import { askAdvisor } from "@/lib/covan/advisor";
import { CHUYEN_GIA, danhSachChuyenGia } from "@/lib/covan/chuyen-gia";
import { runAlerts } from "@/lib/covan/alerts";
import { buildBriefing } from "@/lib/covan/briefing";
import { buildForecast } from "@/lib/covan/forecast";
import { approve, listRecommendations, measureDue } from "@/lib/covan/learning";
import { createTask, draftBrief, listAiTasks } from "@/lib/covan/delegation";
import {
  loadPendingBrief,
  savePendingBrief,
  loadPendingCampaign,
  savePendingCampaign,
} from "@/lib/covan/state";
import { detectCampaignIntent, draftCampaign, formatPlan, runCampaign } from "@/lib/covan/orchestrator";
import { tr } from "@/lib/covan/pnl";
import { covanSend, covanSendCEO, covanSendDocumentCEO } from "@/lib/covan/telegram";
import { costReport, costLineForBriefing } from "@/lib/covan/cost";
import { docChatAllow, lopCuaChat, type LopChat } from "@/lib/covan/chat-allow";
import { TU_CHOI_NOI_BO } from "@/lib/covan/loc-y-dinh";
import { docDaTuChoi, themDaTuChoi, tinTuChoi } from "@/lib/covan/tu-choi";
import { bamChatId } from "@/lib/covan/state";
import { laLenhGhi, laNguoiGoCeo, TU_CHOI_LENH_GHI } from "@/lib/covan/quyen-lenh";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

const HELP_TEXT =
  "Em là AI Cố vấn kinh doanh của anh.\n" +
  "- Nhắn câu hỏi bất kỳ: em trả lời bằng số thật.\n" +
  "- /bantin: bản tin sáng\n- /canhbao: cảnh báo đang mở\n" +
  "- /dubao: dòng tiền 13 tuần\n- /dexuat: đề xuất chờ duyệt\n" +
  "- /duyet <số>: duyệt đề xuất (em chốt baseline, 7 ngày sau đo)\n" +
  "- /doluong: đo đề xuất đến hạn -> thắng/thua\n" +
  "- /giaoviec <mô tả>: em soạn brief -> /ok để giao vào ikihealing-hub\n" +
  "- /vieccho: việc đã giao + ai chưa nhận/chưa xong\n" +
  "- /chiendich <mục tiêu>: em rã kế hoạch (AI làm + giao người) -> /ok để chạy\n" +
  "- /chiendichngay <mục tiêu>: như trên nhưng em cứ thế làm luôn, không chờ duyệt\n" +
  "- /chiphi: em đốt bao nhiêu tiền API — ngày/tuần/tháng/quý/năm\n" +
  "BỐN TRỢ LÝ CHUYÊN MÔN (gõ trống = em tự chẩn đoán mảng đó bằng số thật):\n" +
  danhSachChuyenGia();

async function runAndReport(plan: Parameters<typeof runCampaign>[0]): Promise<string> {
  const { results, report } = await runCampaign(plan, (msg) => covanSendCEO(msg));
  const done = results.filter((r) => r.status === "done").length;
  const tasks = results.filter((r) => r.status === "task_created").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const file = await covanSendDocumentCEO(
    `chien-dich-${new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)}.md`,
    report
  );
  return (
    `XONG CHIẾN DỊCH: ${done} sản phẩm AI, ${tasks} việc đã giao người, ${failed} lỗi.\n` +
    (file.ok
      ? "Báo cáo đầy đủ (kèm toàn bộ sản phẩm) trong file đính kèm trên."
      : `Không gửi được file (${file.error}) — anh nhắn "xem chi tiết" em gửi dạng tin nhắn.`)
  );
}

async function handle(
  text: string,
  chiCeo = false,
  lop: LopChat = "noi_bo",
  chatId: string | number = "",
  laNhom = false,
  laCeoGo = false
): Promise<string> {
  const t = (text || "").trim();
  const low = t.toLowerCase();
  const askOpts = { lop, chatId, loaiChat: laNhom ? ("nhom" as const) : ("rieng" as const), nguon: "nguoi" as const };

  if (low === "/start" || low === "/help") return HELP_TEXT;

  if (lop === "noi_bo" && /^\/(bantin|dubao|canhbao|chiphi|dexuat)\b/.test(low)) return TU_CHOI_NOI_BO;

  if (laLenhGhi(low) && !laCeoGo) return TU_CHOI_LENH_GHI;

  if (low.startsWith("/dexuat")) {
    const d = await listRecommendations();
    const parts: string[] = [];
    if (d.proposed.length) {
      parts.push("CHỜ DUYỆT (gõ /duyet <số>):");
      for (const r of d.proposed) {
        const ev = (r.evidence || []).join("; ");
        parts.push(`#${r.id} ${r.title}\n  Bằng chứng: ${ev}\n  Việc: ${r.action}`);
      }
    }
    if (d.approved.length) {
      parts.push("\nĐANG ĐO:");
      for (const r of d.approved) parts.push(`#${r.id} ${r.title} (đo ngày ${r.measure_at})`);
    }
    if (d.measured.length) {
      parts.push("\nĐÃ ĐO GẦN ĐÂY:");
      for (const r of d.measured.slice(0, 5)) parts.push(`#${r.id} ${r.outcome}`);
    }
    return parts.join("\n") || "Chưa có đề xuất nào.";
  }

  if (low.startsWith("/duyet")) {
    const m = low.match(/(\d+)/);
    if (!m) return "Cú pháp: /duyet <số đề xuất> (xem số trong /dexuat)";
    const d = await approve(Number(m[1]));
    if (!d.ok) return `Không duyệt được: ${d.error}`;
    const head =
      typeof d.baseline === "number"
        ? `Đã duyệt #${d.id}: ${d.title}\nBaseline ${d.metric} = ${Math.round(d.baseline).toLocaleString("vi-VN")}\n`
        : `Đã duyệt #${d.id}: ${d.title}\n`;
    return head + `Em sẽ đo lại ngày ${d.measure_at} và báo thắng/thua.`;
  }

  if (low.startsWith("/chiendichngay") || low.startsWith("/chiendich")) {
    const isNow = low.startsWith("/chiendichngay");
    const goal = t.slice(isNow ? "/chiendichngay".length : "/chiendich".length).trim();
    if (!goal) {
      return (
        "Cú pháp: /chiendich <mục tiêu>. VD: /chiendich ra mắt combo Đôi Trà tuần sau, " +
        "ngân sách quà 2tr, cần bài đăng + FAQ + dự toán + giao sale đăng nhóm Zalo"
      );
    }
    const d = await draftCampaign(goal);
    if (!d.ok) return `Không rã được kế hoạch: ${d.error}`;
    if (!isNow) {
      await savePendingCampaign(d.plan);
      return formatPlan(d.plan);
    }

    await covanSendCEO(formatPlan(d.plan).replace("Gõ /ok để CHẠY cả kế hoạch, /huy để bỏ.", "Chế độ làm ngay — em chạy luôn đây."));
    return runAndReport(d.plan);
  }

  if (low.startsWith("/giaoviec")) {
    const desc = t.slice("/giaoviec".length).trim();
    if (!desc) {
      return "Cú pháp: /giaoviec <mô tả việc>. VD: /giaoviec nhắc Sơn gọi lại 20 lead nguội tuần này";
    }
    const d = await draftBrief(desc);
    if (!d.ok) return `Không soạn được brief: ${d.error}`;
    await savePendingBrief({
      title: d.title,
      description: d.description,
      assignee_name: d.assignee_name,
      assignee_id: d.assignee_id,
      assignee_position: d.assignee_position,
      priority: d.priority,
      due_days: d.due_days,
    });
    return (
      "BRIEF GIAO VIỆC (chưa gửi):\n" +
      `Việc: ${d.title}\n` +
      `Người nhận: ${d.assignee_name} (${d.assignee_position})\n` +
      `Ưu tiên: ${d.priority} | Hạn: ${d.due_days} ngày\n` +
      `---\n${d.description}\n---\n` +
      "Gõ /ok để GIAO, /huy để bỏ."
    );
  }

  if (low === "/ok") {

    const plan = await loadPendingCampaign();
    if (plan) {
      await savePendingCampaign(null);
      await covanSendCEO(`Bắt đầu chạy ${plan.items.length} đầu việc — em báo từng việc xong.`);
      return runAndReport(plan);
    }
    const brief = await loadPendingBrief();
    if (!brief) return "Không có kế hoạch/brief nào đang chờ. Dùng /chiendich hoặc /giaoviec trước.";
    const d = await createTask(brief);
    if (!d.ok) return `Ghi task thất bại: ${d.error}`;
    await savePendingBrief(null);
    return (
      `ĐÃ GIAO: ${d.title}\nCho: ${d.assignee} | Hạn: ${d.due_date}\n` +
      "Việc nằm trong /tasks của ikihealing-hub, theo dõi bằng /vieccho."
    );
  }

  if (low === "/huy") {
    const plan = await loadPendingCampaign();
    if (plan) {
      await savePendingCampaign(null);
      return "Đã bỏ kế hoạch chiến dịch.";
    }
    const brief = await loadPendingBrief();
    if (!brief) return "Không có gì để hủy.";
    await savePendingBrief(null);
    return "Đã bỏ brief.";
  }

  if (low.startsWith("/vieccho")) {
    const d = await listAiTasks();
    if (!d.tasks.length) return "Cố vấn chưa giao việc nào.";
    const lines = d.tasks.map((x) => {
      let st = `${x.status}${x.acknowledged ? " (đã nhận)" : " (CHƯA nhận)"}`;
      if (x.completed_at) st = "XONG";
      return `- ${x.title}\n  ${x.assignee} | hạn ${x.due_date || "?"} | ${st}`;
    });
    return "VIỆC CỐ VẤN ĐÃ GIAO:\n" + lines.join("\n");
  }

  if (low.startsWith("/doluong")) {
    const d = await measureDue(false);
    if (!d.measured.length) return "Chưa có đề xuất nào đến hạn đo.";
    return d.measured
      .map((m) => `#${m.id} [${m.verdict.toUpperCase()}] ${m.title}\n  ${m.outcome}`)
      .join("\n");
  }

  if (low.startsWith("/chiphi")) {
    return costReport();
  }

  if (low.startsWith("/bantin")) {
    const d = await buildBriefing();
    const cost = await costLineForBriefing();
    return (d.briefing || "Chưa có bản tin.") + (cost ? `\n\n${cost}` : "");
  }

  if (low.startsWith("/canhbao")) {
    const d = await runAlerts();
    if (!d.alerts.length) return "Không có cảnh báo nào đang mở.";
    return d.alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.title}\n${a.detail}`).join("\n\n");
  }

  if (low.startsWith("/dubao")) {
    const d = await buildForecast();
    if (!d.ok) return `Chưa dự báo được: ${d.reason || "thiếu dữ liệu"}`;
    const growth = d.weekly_growth_pct >= 0 ? `+${d.weekly_growth_pct}` : `${d.weekly_growth_pct}`;
    const lines = [
      `DỰ BÁO 13 TUẦN (nền ${tr(d.base_weekly_revenue)}/tuần, đà ${growth}%/tuần):`,
      `Tổng dòng tiền vận hành: ${tr(d.total_net_flow_13w)}`,
      ...d.caveats.slice(0, 2).map((c) => `- ${c}`),
    ];
    return lines.join("\n");
  }

  for (const cg of CHUYEN_GIA) {
    if (low === `/${cg.id}` || low.startsWith(`/${cg.id} `)) {
      const hoi = t.slice(cg.id.length + 1).trim();
      return askAdvisor(hoi || `Chẩn đoán mảng ${cg.ten} của ACME lúc này bằng số thật.`, cg.id, chiCeo, askOpts);
    }
  }

  if (lop === "ceo" && (await detectCampaignIntent(t))) {
    const d = await draftCampaign(t);
    if (d.ok) {
      await savePendingCampaign(d.plan);
      return (
        "Em nhận đây là MỆNH LỆNH CHIẾN DỊCH (anh không cần gõ /chiendich).\n" +
        formatPlan(d.plan)
      );
    }

    await covanSendCEO(`Em nhận ra đây là mệnh lệnh chiến dịch nhưng RÃ KẾ HOẠCH LỖI: ${d.error.slice(0, 150)}. Em trả lời dạng tư vấn trước, anh thử lại /chiendich sau.`);
  }

  return askAdvisor(t, undefined, chiCeo, askOpts);
}

type TgUpdate = {
  message?: {
    chat?: { id?: number | string };
    from?: { id?: number | string };
    text?: string;
  };
};

export async function POST(req: Request) {

  const secret = (process.env.COVAN_TG_SECRET || "").trim();
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text || "").trim();

  if (chatId === undefined || chatId === null || !text) {
    return NextResponse.json({ ok: true });
  }

  const chatType = (msg?.chat as any)?.type || "private";
  const laNhom = chatType === "group" || chatType === "supergroup";

  if (laNhom && (msg as any)?.from?.is_bot) return NextResponse.json({ ok: true, imLang: true, botMsg: true });
  const tenBot = (process.env.COVAN_BOT_USERNAME || "ACMECoVanAlex_bot").replace(/^@/, "");
  const traLoiBot = String((msg as any)?.reply_to_message?.from?.username || "") === tenBot;
  const duocGoi = text.includes(`@${tenBot}`) || text.startsWith("/") || traLoiBot ||
    /^\s*(alex|c[oố]\s*v[aấ]n)\b/i.test(text);
  if (laNhom && !duocGoi) return NextResponse.json({ ok: true, imLang: true });

  const allowedChat = (process.env.COVAN_CHAT_ID || "").trim();
  let allowRaw: unknown = null;
  try {
    const { getServiceClient } = await import("@/lib/supabase-server");
    allowRaw = (await getServiceClient().from("config").select("value").eq("key", "covan_chat_allow").maybeSingle()).data?.value ?? null;
  } catch {  }
  const lop = lopCuaChat(chatId, allowedChat, docChatAllow(allowRaw));

  if (!lop) {

    console.warn(`[covan] chat chưa cấp quyền: hash=${bamChatId(chatId)} loai=${laNhom ? "nhom" : "rieng"}`);
    const tin = tinTuChoi(laNhom);
    if (tin) {
      try {
        const { getServiceClient } = await import("@/lib/supabase-server");
        const sb = getServiceClient();
        const k = "covan_da_tu_choi";
        const raw = (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value ?? null;
        if (!docDaTuChoi(raw).has(String(chatId).trim())) {
          await covanSend(chatId, tin);
          await sb.from("config").upsert({ key: k, value: JSON.stringify(themDaTuChoi(raw, chatId)),
            description: "Các chat đã báo 'chưa cấp quyền' rồi — không báo lại để khỏi spam" }, { onConflict: "key" });
        }
      } catch {  }
    }
    return NextResponse.json({ ok: true, denied: true });
  }

  let reply: string;
  try {
    reply = await handle(text, lop === "ceo", lop, chatId, laNhom, laNguoiGoCeo(lop, msg?.from?.id, allowedChat));
  } catch (e) {
    reply = `Em gặp lỗi khi xử lý: ${String(e instanceof Error ? e.message : e).slice(0, 200)}. Anh thử lại giúp em.`;
  }
  const sent = await covanSend(chatId, reply);

  if (reply.length > 2500) {
    const ngay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    await covanSendDocumentCEO(`bao-cao-co-van-${ngay}.md`, reply).catch(() => null);
  }
  return NextResponse.json({ ok: true, sent: sent.ok });
}
