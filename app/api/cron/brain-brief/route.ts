import { NextResponse } from "next/server";
import { appLink, APP_HOST } from "@/lib/app-url";
import { getServiceClient } from "@/lib/supabase-server";
import { brainBotConfigured, sendBrainTelegram, tgFromMarkdown } from "@/lib/telegram";
import { geminiConfigured, askGemini } from "@/lib/gemini";
import { contentDailyStatus } from "@/lib/content-factory";
import { ACME_IDENTITY, buildDeepSnapshot, getLearnings, saveLearnings, getHocTheGioi } from "@/lib/acme-brain";
import { vnDateStr } from "@/lib/payroll";
import { ghiViecMay } from "@/lib/viec-may";
import { baoCaoDonThieuMa } from "@/lib/affiliate-thieu-ma";
import { dichCuaMay, sendTelegramMay } from "@/lib/telegram";
import { mucCoVanSang } from "@/lib/covan/muc-co-van-sang";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

const getCfg = async (sb: any, k: string) => (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value ?? null;
const setCfg = (sb: any, k: string, v: string) => sb.from("config").upsert({ key: k, value: v }, { onConflict: "key" });

export async function GET(req: Request) {
  const t0 = Date.now();
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  if (!brainBotConfigured() || !geminiConfigured()) {
    return NextResponse.json({ ok: false, error: "Chưa cấu hình TELEGRAM_BRAIN_BOT_TOKEN / GEMINI_API_KEY" });
  }
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!ceo) return NextResponse.json({ ok: false, error: "Chưa có TELEGRAM_CHAT_ID (chat của CEO)" });

  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);

  let mode = (url.searchParams.get("mode") || "").toLowerCase();
  if (!["brief", "recap", "strategic"].includes(mode)) mode = new Date().getUTCHours() < 6 ? "brief" : "recap";
  const dry = url.searchParams.get("dry") === "1";

  const snapshot = await buildDeepSnapshot(month);
  const learn = await getLearnings();
  const lastRaw = await getCfg(sb, "brain_brief_last");
  let last: any = {}; try { last = JSON.parse(lastRaw || "{}"); } catch {}

  const isBrief = mode === "brief";
  const task = mode === "strategic"
    ? `Đây là BẢN TIN CHIẾN LƯỢC TUẦN cho CEO (nhà sáng lập). ZOOM RA khỏi việc hằng ngày, nhìn TOÀN danh mục dự án + số liệu + kỹ năng còn thiếu bên dưới. Viết cho Telegram, súc tích:
1) "Sức khoẻ đế chế" — 2-3 câu: mảng nào đang lên, mảng nào đang đọng/bỏ bẵng, tiền đang kẹt ở đâu.
2) "Dứt điểm tuần này" — 3 dự án đang dở nên đẩy xong (ưu tiên thứ ra tiền / gần xong), mỗi cái kèm bước kế tiếp.
3) "Nên BUILD/ tạo AGENT mới" — 1-2 đề xuất đáng tiền nhất (thứ tự động hoá việc lặp tay, hoặc đóng gói thứ đã chạy tốt thành sản phẩm/khoá bán ra ngoài).
4) "Nên BỎ/hoãn" — 1 thứ đang ngốn sức mà chưa ra tiền.
5) "Thế giới đang làm gì" — 2-3 dòng: lấy nguyên lý trong khối GÓC NHÌN NGOÀI, soi vào đúng mảng đang yếu ở mục 1, kèm con số của ACME. Không có nguyên lý nào ăn khớp thì bỏ hẳn mục này.
Kết 1 câu truyền lửa. Thẳng thắn, tư duy như cổ đông.`
    : isBrief
    ? `Đây là BẢN TIN ĐIỀU HÀNH BUỔI SÁNG cho CEO. Viết cho Telegram, NGẮN, dễ đọc trên điện thoại. Cấu trúc đúng 3 phần:
1) "Tình hình" — mỗi mảng 1 dòng ngắn (doanh thu/nhịp, tiền đọng trong kho, khách nguy cơ rời, marketing) với CON SỐ THẬT.
2) "Cần thay đổi" — 2-3 điểm THẲNG THẮN đang rò rỉ tiền / bất thường / rủi ro nhất.
3) "Việc nên làm hôm nay" — đúng 3 việc CỤ THỂ, ưu tiên theo tiền, mỗi việc kèm trang xem (vd ${APP_HOST}/vong-lap-doanh-thu, /khach-360, /tai-san).
4) "Góc nhìn ngoài" — TỐI ĐA 2 DÒNG, và CHỈ viết mục này khi trong khối GÓC NHÌN NGOÀI có nguyên lý ăn khớp với đúng vấn đề vừa nêu ở mục 2. Viết theo khuôn: nguyên lý một dòng, rồi một dòng nối thẳng vào con số của ACME. Không khớp thì BỎ HẲN mục 4, đừng cố nhét.
Kết 1 câu tiếp lửa, lạc quan.`
    : `Đây là TỔNG KẾT CUỐI NGÀY cho CEO. So sánh kết quả hôm nay với đề xuất buổi sáng (nếu có bên dưới). Viết NGẮN cho Telegram:
1) "Kết quả hôm nay" — doanh thu/đơn thật, có nhích so với mục tiêu không.
2) "Việc sáng đề xuất — làm được tới đâu" (suy từ số liệu; nếu không rõ thì nói trung thực).
3) "Đào ưu tiên" — 2 việc.
Kết 1 câu động viên.`;

  const briefLast = last?.date && last?.brief ? `\n\n[ĐỀ XUẤT GẦN NHẤT ${last.date} — ${last.mode}]\n${last.brief}` : "";

  const prompt = `${task}

DỮ LIỆU TOÀN CẢNH:
${snapshot}${briefLast}

Sau khi viết bản tin xong, XUỐNG DÒNG rồi in đúng dòng phân cách "<<<META>>>" và một JSON:
{"learnings":["điều rút ra để lần sau làm tốt hơn / quy luật của công ty / điều về CEO — tối đa 3 câu ngắn"],"watch":["điều cần theo dõi ngày mai — tối đa 2"]}
Chỉ in JSON hợp lệ ở phần META, không thêm chữ nào khác sau nó.`;

  const hocNgoai = mode === "recap" ? "" : await getHocTheGioi(isBrief ? 3 : 5).catch(() => "");
  const system = ACME_IDENTITY + learn + hocNgoai;

  const ans = await askGemini(system, [], prompt, { maxOutputTokens: 8000 });
  if (!ans.ok) return NextResponse.json({ ok: false, error: ans.error, mode });

  let briefText = ans.text, meta: any = {};
  const idx = ans.text.indexOf("<<<META>>>");
  if (idx >= 0) {
    briefText = ans.text.slice(0, idx).trim();
    const metaStr = ans.text.slice(idx + 10).trim();
    const m = metaStr.match(/\{[\s\S]*\}/);
    if (m) { try { meta = JSON.parse(m[0]); } catch {} }
  }

  let learnedCount = 0;
  let learnErr: string | null = null;
  if (idx < 0) {
    learnErr = `AI không in được dấu <<<META>>> (bản tin dài ${briefText.length} ký tự — có thể bị cắt giữa chừng)`;
  } else if (!Array.isArray(meta.learnings) || !meta.learnings.length) {
    learnErr = "Có <<<META>>> nhưng không đọc được mảng learnings";
  } else {
    learnedCount = await saveLearnings(meta.learnings);
    if (!learnedCount) learnErr = "saveLearnings trả 0 — ghi config thất bại";
  }
  await setCfg(sb, "brain_learn_status", JSON.stringify({
    at: new Date().toISOString(), mode, ok: !learnErr, learnedCount,
    briefLen: briefText.length, error: learnErr,
  }));
  if (learnErr) console.error(`[brain-brief] VÒNG TỰ HỌC HỎNG: ${learnErr}`);

  await setCfg(sb, "brain_brief_last", JSON.stringify({ date: today, mode, brief: briefText, watch: meta.watch || [] }));

  const header = mode === "strategic" ? "\u{1F9ED} <b>BẢN TIN CHIẾN LƯỢC TUẦN</b>" : isBrief ? "\u{1F305} <b>BẢN TIN TỔNG GIÁM ĐỐC</b>" : "\u{1F319} <b>TỔNG KẾT CUỐI NGÀY</b>";

  const bodyRaw = briefText.length > 3600 ? briefText.slice(0, 3600) + "…" : briefText;

  let contentBlock = "";
  if (mode !== "strategic") { try { contentBlock = "\n\n" + (await contentDailyStatus()).block; } catch {} }

  let thieuMaBlock = "";
  let thieuMaNhomSale: string | undefined;
  if (isBrief) {
    const tm = await baoCaoDonThieuMa(sb);
    if (tm.loi) console.error(`[brain-brief] báo cáo đơn thiếu mã CTV hỏng: ${tm.loi}`);
    if (tm.text) {
      thieuMaBlock = "\n\n" + tm.text;
      if (!dry && (await dichCuaMay("don-thieu-ma-ctv"))) thieuMaNhomSale = tm.text;
    }
  }
  const out = `${header} — ${today}\n\n${tgFromMarkdown(bodyRaw)}${contentBlock}${thieuMaBlock}`;
  const send = dry ? { ok: true, dry: true } : await sendBrainTelegram(ceo, out);
  if (thieuMaNhomSale) await sendTelegramMay("don-thieu-ma-ctv", thieuMaNhomSale).catch(() => undefined);

  let coVan: { ok: boolean; text?: string; error?: string } = { ok: false };
  if (isBrief) {
    try {
      const text = await mucCoVanSang(dry);
      coVan = dry ? { ok: true, text } : { ...(await sendBrainTelegram(ceo, text)), text: undefined };
    } catch (e) {
      coVan = { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) };
      console.error(`[brain-brief] mục Cố vấn hỏng: ${coVan.error}`);
    }
  }

  if (!dry) {
    await ghiViecMay({
      agent: "brain-brief", agentTen: "Báo cáo",
      viec: mode === "strategic" ? "Bản tin chiến lược tuần" : isBrief ? "Bản tin tổng giám đốc sáng" : "Tổng kết cuối ngày",
      trangThai: (send as any).ok ? "xong" : "hong",
      soLuong: (send as any).ok ? 1 : 0, donVi: "bản tin",
      chiTiet: `${learnedCount} bài học mới · ${(meta.watch || []).length} mục cần theo`,
      link: "/giam-doc-ai", giay: (Date.now() - t0) / 1000,
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, mode, learnedCount, watch: meta.watch || [], sent: (send as any).ok, coVan: isBrief ? { ok: coVan.ok, error: coVan.error } : undefined, preview: dry ? out : undefined, previewCoVan: dry ? coVan.text : undefined });
}
