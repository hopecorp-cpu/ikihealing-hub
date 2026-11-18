import { getServiceClient } from "@/lib/supabase-server";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { leadStats } from "@/lib/leads";
import { vnDateStr } from "@/lib/payroll";

export type Light = "green" | "yellow" | "red" | "gray";
export type DeptMetric = { label: string; value: string };
export type DeptCard = { key: string; name: string; light: Light; metrics: DeptMetric[]; note: string; link: string };

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const cfg = async (sb: any, k: string): Promise<any> => {
  try { const v = (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value; return v ? JSON.parse(v) : null; } catch { return null; }
};
const countRows = async (q: any): Promise<number> => {
  try { const { count } = await q; return count || 0; } catch { return 0; }
};

export async function buildScoreboard(): Promise<{ month: string; cards: DeptCard[] }> {
  const sb = getServiceClient();
  const month = vnDateStr().slice(0, 7);
  const [loop, leads, fbU, saleU, bank, stock, careDue, contentN] = await Promise.all([
    computeRevenueLoop(month).catch(() => null as any),
    leadStats(sb, month).catch(() => null as any),
    cfg(sb, "fb_unreplied"),
    cfg(sb, "sale_unreplied"),
    cfg(sb, "bank_loop_status"),
    cfg(sb, "misa_stock"),
    countRows(sb.from("customer_care_log").select("*", { count: "exact", head: true }).lte("next_due", vnDateStr()).neq("status", "done")),
    countRows(sb.from("content_items").select("*", { count: "exact", head: true }).gte("publish_date", month + "-01")),
  ]);

  const cards: DeptCard[] = [];

  if (loop) {
    cards.push({
      key: "mkt", name: "Marketing", light: loop.finLight,
      metrics: [
        { label: "Nhịp doanh thu", value: `${loop.pacePct}% (kỳ vọng ${loop.expectedPct}%)` },
        { label: "%Chi phí MKT", value: loop.mktPct == null ? "chưa có" : `${loop.mktPct}%` },
        { label: "Bài tháng này", value: `${contentN}` },
      ],
      note: loop.finLight === "red" ? "Chậm nhịp — cần đẩy chiến dịch chốt." : "Bám nhịp mục tiêu.",
      link: "/he-dieu-hanh-ai",
    });
  } else cards.push({ key: "mkt", name: "Marketing", light: "gray", metrics: [], note: "Chưa tính được vòng lặp.", link: "/he-dieu-hanh-ai" });

  if (leads) {
    const fast = leads.fast5Pct ?? 0;
    const light: Light = loop ? loop.finLight : (fast >= 60 ? "green" : fast >= 40 ? "yellow" : "red");
    cards.push({
      key: "sale", name: "Sale", light,
      metrics: [
        { label: "Doanh thu tháng", value: loop ? vnd(loop.monthActual) : "—" },
        { label: "Chạm ≤5 phút", value: `${fast}%` },
        { label: "Lead đã liên hệ", value: `${leads.contacted}/${leads.totalLeads}` },
      ],
      note: fast < 40 ? "Tốc độ chạm lead chậm — mất đơn nóng." : "Tốc độ chạm lead ổn.",
      link: "/leads",
    });
  }

  {
    const fb = fbU?.total || 0, sz = saleU?.total || 0, backlog = fb + sz;
    const light: Light = backlog > 100 ? "red" : backlog > 0 ? "yellow" : "green";
    cards.push({
      key: "cskh", name: "Chăm sóc KH", light,
      metrics: [
        { label: "FB chưa trả lời", value: `${fb}` },
        { label: "Zalo chờ sale", value: `${sz}` },
        { label: "Khách tới hạn chăm", value: `${careDue}` },
      ],
      note: backlog > 100 ? "Tồn đọng lớn — dễ mất khách." : backlog > 0 ? "Còn khách chờ, xử sớm." : "Không tồn đọng.",
      link: "/hieu-qua-cham-soc",
    });
  }

  if (bank) {
    const cash = bank.closing ?? bank.banks?.mb ?? null;
    const stale = bank.staleDays ?? null;
    const light: Light = stale != null && stale > 7 ? "yellow" : (bank.ok ? "green" : "red");
    cards.push({
      key: "finance", name: "Tài chính", light,
      metrics: [
        { label: "Số dư ngân hàng", value: cash != null ? vnd(cash) : "chưa có" },
        { label: "Độ mới dữ liệu", value: stale != null ? `${stale} ngày` : "—" },
      ],
      note: stale != null && stale > 7 ? "Số dư trễ — cào lại sổ phụ." : "Dòng tiền cập nhật.",
      link: "/tai-chinh",
    });
  }

  {
    const items = stock?.items || [];
    const out = items.filter((it: any) => it.closing === 0).length;
    const neg = items.filter((it: any) => typeof it.closing === "number" && it.closing < 0).length;
    const light: Light = items.length === 0 ? "gray" : (neg > 0 || out > 3 ? "red" : out > 0 ? "yellow" : "green");
    cards.push({
      key: "kho", name: "Kho vận", light,
      metrics: [
        { label: "SKU hết hàng", value: `${out}` },
        { label: "Dòng âm (combo chưa nhập)", value: `${neg}` },
        { label: "Tổng SKU", value: `${items.length}` },
      ],
      note: items.length === 0 ? "Chưa có dữ liệu tồn kho." : out > 0 ? "Có mặt hàng hết — nhập bổ sung." : "Tồn kho đủ.",
      link: "/kho",
    });
  }

  return { month, cards };
}
