import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { getConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { callClaude } from "./advisor";

const trm = (n: number) => `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}tr`;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400e3).toISOString();
}

export async function buildChainFacts(): Promise<string> {
  const sb = getServiceClient();
  const since = isoDaysAgo(7);
  const sinceDate = since.slice(0, 10);
  const month = vnDateStr().slice(0, 7);
  const lines: string[] = [`# CHUỖI MẮT XÍCH 7 NGÀY QUA (${sinceDate} -> ${vnDateStr()})`];

  try {
    const [made, pub] = await Promise.all([
      sb.from("content_items").select("id", { count: "exact", head: true }).gte("created_at", since),
      sb.from("content_items").select("id", { count: "exact", head: true }).eq("status", "published").gte("publish_date", sinceDate),
    ]);
    lines.push(`- CONTENT: ${made.count ?? 0} bài tạo, ${pub.count ?? 0} bài đã đăng trong tuần`);
  } catch {
    lines.push("- CONTENT: chưa đo được (lỗi đọc content_items)");
  }

  let loopNote = "";
  try {
    const loop = await computeRevenueLoop(month);
    const cpl = loop.leadsTotal > 0 && loop.mktSpend > 0 ? Math.round(loop.mktSpend / loop.leadsTotal) : null;
    lines.push(
      `- ADS (lũy kế tháng ${month}): chi ${trm(loop.mktSpend)}` +
        (cpl !== null ? `, CPL ~${Math.round(cpl / 1000)}k (trần chiến dịch 150k)` : ", CPL chưa đo được (thiếu lead hoặc chi)")
    );
    loopNote = `- DOANH THU (lũy kế tháng): ${trm(loop.monthActual)} / mục tiêu ${trm(loop.monthTarget)} (${loop.pacePct}% nhịp cần)`;
  } catch {
    lines.push("- ADS: chưa đo được (lỗi vòng lặp doanh thu)");
  }

  try {
    const [neu, touched] = await Promise.all([
      sb.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since),
      sb.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since).not("first_contact_at", "is", null),
    ]);
    const n = neu.count ?? 0, t = touched.count ?? 0;
    lines.push(`- LEAD: ${n} lead mới trong tuần, ${t} đã được sale chạm (${n > 0 ? Math.round((t / n) * 100) : 0}%)`);
  } catch {
    lines.push("- LEAD: chưa đo được (lỗi đọc bảng leads)");
  }

  try {
    const cl = JSON.parse((await getConfigValue("call_log")) || "{}");
    let calls = 0, chot = 0;
    for (const [d, bysale] of Object.entries(cl)) {
      if (d < sinceDate) continue;
      for (const v of Object.values(bysale as Record<string, unknown>)) {
        calls += typeof v === "number" ? v : Number((v as any)?.n) || 0;
        chot += typeof v === "number" ? 0 : Number((v as any)?.chot) || 0;
      }
    }
    lines.push(
      calls > 0
        ? `- SALE: ${calls} cuộc gọi, ${chot} chốt (tỉ lệ ${Math.round((chot / calls) * 100)}%)`
        : "- SALE: chưa có nhật ký gọi tuần này (call_log trống)"
    );
  } catch {
    lines.push("- SALE: chưa đo được (lỗi đọc call_log)");
  }

  try {
    let rev = 0;
    const orders = new Set<string>();

    const { rows } = await layDoanhThuNhieuThang(sb, sinceDate, new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
    for (const r of rows) { rev += r.net_amount || 0; if (r.order_code) orders.add(r.order_code); }
    lines.push(`- DOANH THU TUẦN: ${trm(rev)} từ ${orders.size} đơn (sổ đơn Telegram, net)`);
  } catch {
    lines.push("- DOANH THU TUẦN: chưa đo được (lỗi đọc sổ đơn)");
  }
  if (loopNote) lines.push(loopNote);

  return lines.join("\n");
}

export async function buildChainReview(): Promise<{ text: string; facts: string }> {
  const facts = await buildChainFacts();
  let text = facts;
  try {
    const out = await callClaude(
      [{ role: "user", content: facts }],
      "Bạn là cố vấn kinh doanh AI của ACME, xưng 'em', gọi CEO là 'anh'. " +
        "Dưới đây là số liệu chuỗi mắt xích tuần trước (Content -> Ads -> Lead -> Sale -> Doanh thu). " +
        "Viết BẢN RÀ CHUỖI MẮT XÍCH tối đa 12 dòng: (1) nhắc lại 1 dòng/mắt xích với con số, " +
        "(2) chỉ ra MẮT XÍCH YẾU NHẤT tuần này và vì sao, (3) đúng 1 việc sửa cho tuần này, giao đúng người " +
        "(sale chính: Sơn và Cúc — Đào nghỉ từ 03/08/2026; content: Thu Ngân chỉ đăng bài nhẹ; ads: anh CEO tự cầm). " +
        "Mắt xích nào 'chưa đo được' thì nói thẳng là mù số và đề nghị cách đo, không bịa. " +
        "TUYỆT ĐỐI không thêm con số ngoài dữ liệu. KHÔNG emoji, KHÔNG markdown. Tiếng Việt đủ dấu.",
      2500
    );
    if (out.trim()) text = `RÀ CHUỖI MẮT XÍCH TUẦN\n\n${out.trim()}`;
  } catch {
    text = `RÀ CHUỖI MẮT XÍCH TUẦN (bản thô — LLM lỗi)\n\n${facts}`;
  }
  return { text, facts };
}
