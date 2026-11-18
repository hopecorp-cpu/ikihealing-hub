import { NextResponse } from "next/server";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { computeStrategyMap } from "@/lib/strategy-map";
import { leadStats } from "@/lib/leads";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { getBankBalances } from "@/lib/bank-balance";
import { vnDateStr } from "@/lib/payroll";
import { findBanned, sanitizeContent } from "@/lib/banned-words";
import { toSignals, prioritizedDigest, heuristicAnalysis } from "@/lib/ai-director/signals";

export const dynamic = "force-dynamic";

const tr = (n: number) => Math.round((Number(n) || 0) / 1e6) + "tr";

export async function buildSnapshot(month: string) {
  const loop: any = await computeRevenueLoop(month);
  const sb = getServiceClient();

  let low: string[] = [], out: string[] = [], neg: string[] = [], stockAt = "";
  try {
    const raw = await getConfigValue("misa_stock");
    if (raw) { const p = JSON.parse(raw); stockAt = p.generatedAt || "";
      for (const it of (p.items || [])) {
        if (it.closing > 0 && it.closing <= 10) low.push(`${it.name} (${it.closing})`);
        else if (it.closing === 0) out.push(it.name);
        else if (it.closing < 0) neg.push(`${it.name} (${it.closing})`);
      }
    }
  } catch { }

  let loans: string[] = [];
  try {
    const { data } = await sb.from("loan_payments").select("*, loans(lender)").eq("status", "pending").order("due_date");
    const today = new Date(vnDateStr());
    for (const p of data || []) {
      if (!p.due_date) continue;
      const days = Math.round((new Date(p.due_date).getTime() - today.getTime()) / 864e5);
      if (days <= 30) loans.push(`${p.due_date}: ${p.payment_type} ${tr(p.net_amount || p.amount)} (${days < 0 ? "QUÁ HẠN" : days + " ngày nữa"})`);
    }
  } catch { }

  let cash = 0; try { const { total } = await getBankBalances(); cash = total; } catch { }
  let needCare = 0; try { needCare = JSON.parse((await getConfigValue("care_summary")) || "{}").needCare || 0; } catch { }

  let ads: any[] = []; try { const raw = await getConfigValue("ads_campaigns"); if (raw) ads = JSON.parse(raw).campaigns || []; } catch { }

  let posts: any[] = []; try { const raw = await getConfigValue("mkt_top_posts"); if (raw) posts = JSON.parse(raw).posts || []; } catch { }

  let strategy: any = null; try { const sm = await computeStrategyMap(month); strategy = { scorePct: sm.overall.scorePct, red: sm.perspectives.flatMap((p: any) => p.objectives.filter((o: any) => o.light === "red").map((o: any) => `${o.title} (${o.current ?? "?"}/${o.target}${o.unit})`)), perspectives: sm.perspectives.map((p: any) => `${p.title} ${p.score}%`) }; } catch { }

  let leadsSla: any = null; try { const ls = await leadStats(sb, month); leadsSla = { total: ls.totalLeads, overSla: ls.overSla, reassigned: ls.reassignedLeads, sla: ls.slaMinutes, slow: ls.perSale.filter((s: any) => s.contacted >= 3 && s.onTimePct < 50).map((s: any) => `${s.name} ${s.onTimePct}% gọi sớm`) }; } catch { }

  let offerBlock = ""; try { const { buildOfferBlock } = await import("@/lib/offer-architecture"); offerBlock = await buildOfferBlock(); } catch { }

  return { loop, stock: { low, out, neg, stockAt }, loans, cash, needCare, ads, posts, strategy, leadsSla, offerBlock };
}

function snapshotText(s: any) {
  const l = s.loop;
  const behind = (l.sales || []).filter((x: any) => x.behind).map((x: any) => `${x.name} ${x.pct ?? "?"}%`);
  const chan = (l.channels || []).slice(0, 5).map((c: any) => `${c.channel} ${c.pctRev}%${c.leads ? ` (${c.leads} lead→${c.orders}đơn ${c.convRate}%)` : ""}`).join(", ");
  const top = (l.reco?.topMargin || []).slice(0, 5).map((p: any) => `${p.name} (biên ${Math.round((p.margin || 0) * 100)}%)`).join("; ");
  return `THÁNG ${l.month}. Đã qua ${l.expectedPct}% tháng (nhịp).
DOANH THU: ${tr(l.monthActual)}/${tr(l.monthTarget)} = ${l.pacePct}% KPI (${l.pacePct >= l.expectedPct ? "bám kịp nhịp" : "CHẬM nhịp"}). Còn thiếu ${tr(l.needGap)}, cần ~${l.needOrders} đơn / ~${l.needLeads} lead.
AOV team ${Math.round((l.teamAov || 0) / 1e3)}k. Đơn ${l.totalOrders} · khách ${l.totalCustomers}.
SALE TỤT NHỊP (${behind.length}): ${behind.join(", ") || "không có"}.
%CHI PHÍ MKT: ${l.mktPct ?? "?"}% doanh thu (chi ${tr(l.mktSpend)}, trần ${Math.round((l.mktCapAmount || 0) / 1e6)}tr) — đèn ${l.mktLight}${l.mktOverBudgetWarn ? " VƯỢT TRẦN" : ""}.
KÊNH DT: ${chan || "?"}. Điểm chat ${l.chatAvg ?? "?"}/10. Tỉ lệ chốt gọi thật ${l.callCloseReal != null ? Math.round(l.callCloseReal * 100) + "%" : "?"}.
SP BIÊN CAO: ${top || "?"}.
TỒN KHO sắp hết: ${s.stock.low.slice(0, 12).join(", ") || "không"}. Hết(0): ${s.stock.out.slice(0, 10).join(", ") || "không"}. (Âm=combo chưa nhập linh kiện: ${s.stock.neg.length} mã — bỏ qua.)
LÃI VAY sắp tới: ${s.loans.join(" | ") || "không có kỳ nào trong 30 ngày"}.
TIỀN MẶT (tổng số dư ngân hàng): ${tr(s.cash)}.
KHÁCH CẦN CHĂM (mua 45-90 ngày trước, tới chu kỳ tái mua): ${s.needCare}.
ADS TỪNG CHIẾN DỊCH (CPO hoà vốn trần ~${Math.round((l.ceil?.cpoCeiling || 0) / 1e3)}k/đơn): ${(s.ads || []).map((c: any) => `"${c.name}" chi ${Math.round(c.spend / 1e3)}k→${c.results} ${c.rtype}${c.cpo ? ` (CPO ${Math.round(c.cpo / 1e3)}k)` : ""} [${c.status}]`).join(" | ") || "chưa có dữ liệu chiến dịch"}. (Chiến dịch chi nhiều mà 0 đơn/lead = cân nhắc đổi mục tiêu hoặc tắt; CPO > trần = lỗ.)
LEAD ĐẦU PHỄU THẬT: ${l.leadsTotal > 0 ? `${l.leadsTotal} lead (${l.leadsSource || "webhook"}) → chuyển đổi theo kênh là số ĐO THẬT ở dòng KÊNH DT trên.` : "chưa bắt được lead (chuyển đổi kênh còn ước lượng) — nên cắm webhook Zalo/Pancake."}
BÀI ĐĂNG MKT HIỆU QUẢ (organic, 30 ngày): ${(s.posts || []).map((p: any) => `"${p.msg}" reach ${Math.round((p.reach || 0) / 1e3)}k · tương tác ${p.engaged} (${p.engRate}%)`).join(" | ") || "chưa có dữ liệu bài đăng"}. (Bài engRate cao + reach tốt = ứng viên BƠM TIỀN quảng cáo; bài kém = bỏ.)
BẢN ĐỒ CHIẾN LƯỢC (BSC bước ②): sức khoẻ ${s.strategy?.scorePct ?? "?"}% [${(s.strategy?.perspectives || []).join(" · ")}]. Mục tiêu CHƯA ĐẠT: ${(s.strategy?.red || []).join("; ") || "không có ô đỏ"}.
CHIA LEAD & GỌI SỚM: ${s.leadsSla ? `${s.leadsSla.total} lead/tháng, ${s.leadsSla.overSla} lead quá ${s.leadsSla.sla}' chưa liên hệ, ${s.leadsSla.reassigned} lead bị chia lại. Sale chậm chăm: ${(s.leadsSla.slow || []).join(", ") || "không"}.` : "chưa bật pool chia lead"}. (Nhiều lead bị chia lại / % gọi sớm thấp = sale phản hồi chậm, mất khách vào tay đối thủ — nhắc/đào tạo.)
${s.offerBlock ? `\n${s.offerBlock}\n(Đề xuất bán hàng phải bám các offer trên — offer DRAFT thì đề xuất "chốt kết cấu" trước, không tung ra thị trường.)` : ""}`;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !(user.role === "admin" || user.role === "ceo" || user.role === "manager"))
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const month = body.month || vnDateStr().slice(0, 7);
    const snap = await buildSnapshot(month);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const out = heuristicAnalysis(month, snap);
      try { await setConfigValue(`ai_director_${month}`, JSON.stringify(out)); } catch { }
      return NextResponse.json({ ok: true, analysis: out, fallback: true, reason: "no_api_key" });
    }

    const system = `Bạn là GIÁM ĐỐC KINH DOANH (COO) của ACME Corp — thực phẩm bổ sung (Đạm Mẫu, NOVA) + trà thảo mộc (Trà Mẫu A, Trà Mẫu B — KHÔNG phải thực phẩm bổ sung) + Học Viện NOVA. Bạn quản lý XUYÊN SUỐT: doanh thu → sale → combo/sản phẩm → marketing → kho → dòng tiền.
TUÂN THỦ: SP là "thực phẩm bổ sung", KHÔNG gọi TPCN/chức năng, KHÔNG chữa/trị/thải độc/giảm cân, KHÔNG từ tuyệt đối. Bán: KHÔNG chiết khấu tiền mặt — TẶNG QUÀ giá vốn thấp, ưu tiên SP biên cao.
Phong cách: sắc bén, thực chiến, đi thẳng con số, nói tiếng Việt. Ưu tiên hành động tạo tiền NGAY.
Chỉ trả JSON hợp lệ, KHÔNG markdown, KHÔNG giải thích ngoài JSON.`;

    const signals = toSignals(snap);
    const prompt = `Dưới đây là số liệu kinh doanh ACME:
${snapshotText(snap)}

TÍN HIỆU ƯU TIÊN (đã chấm tác động + rủi ro bằng luật số — tập trung xử lý theo thứ tự này):
${prioritizedDigest(signals)}

Phân tích như một COO và trả về ĐÚNG JSON schema:
{
 "health": "green"|"yellow"|"red",           // sức khoẻ kinh doanh tổng thể tháng này
 "summary": "1-2 câu chốt tình hình",
 "risks": [{"area":"Sale|MKT|Kho|Tài chính|Doanh thu","issue":"...","severity":"cao|vừa|thấp"}],   // 2-4 rủi ro lớn nhất
 "actions": [{"area":"Sale|MKT|Kho|Tài chính","who":"ai làm","task":"việc cụ thể hôm nay","impact":"tác động"}],  // 3-5 việc ưu tiên
 "opportunities": ["1-3 cơ hội tăng doanh thu (combo/upsell/quà mùa vụ), bám SP biên cao, đúng tuân thủ"]
}`;

    const model = await layModel("thuong");
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, thinking: { type: "between_tools" }, max_tokens: 2600, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      ghiNhatKyAI({ noi: "api/giam-doc-ai", model, ms: Date.now() - t0, ok: false });
      const out = heuristicAnalysis(month, snap);
      try { await setConfigValue(`ai_director_${month}`, JSON.stringify(out)); } catch { }
      return NextResponse.json({ ok: true, analysis: out, fallback: true, reason: "api_error", status: res.status });
    }
    const data = await res.json();
    ghiNhatKyAI({ noi: "api/giam-doc-ai", model, inTok: data?.usage?.input_tokens, outTok: data?.usage?.output_tokens, ms: Date.now() - t0, ok: true });
    let text = (data.content?.find((b: { type?: string }) => b.type === "text")?.text || "{}").replace(/```json/gi, "").replace(/```/g, "").trim();
    const s0 = text.indexOf("{"), e0 = text.lastIndexOf("}");
    if (s0 >= 0 && e0 > s0) text = text.slice(s0, e0 + 1);
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { health: "yellow", summary: text.slice(0, 300), risks: [], actions: [], opportunities: [] }; }

    const clean = (v: any): any => typeof v === "string" ? (findBanned(v).length ? sanitizeContent(v) : v) : Array.isArray(v) ? v.map(clean) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v;
    parsed = clean(parsed);
    const out = { ...parsed, signals, generatedAt: new Date().toISOString(), month };
    try { await setConfigValue(`ai_director_${month}`, JSON.stringify(out)); } catch { }
    return NextResponse.json({ ok: true, analysis: out });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: err.message });
  }
}
