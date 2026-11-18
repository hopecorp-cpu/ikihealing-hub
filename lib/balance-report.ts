import { getConfigValue, getConfigNumber } from "@/lib/app-config";
import { getServiceClient } from "@/lib/supabase-server";
import { readBankCash } from "@/lib/asset-scoreboard";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { vnDateStr } from "@/lib/payroll";

const money = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const trM = (n: number) => (Math.round((n || 0) / 1e5) / 10).toLocaleString("vi-VN") + "tr";
const dmy = (iso?: string | null) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "?");
const LIGHT: Record<string, string> = { green: "🟢", yellow: "🟡", red: "🔴" };

const readJson = async (key: string): Promise<any> => { try { return JSON.parse((await getConfigValue(key)) || "null"); } catch { return null; } };

async function inventoryAtCost(): Promise<{ value: number | null; units: number; at: string | null; source: string }> {
  const raw = await readJson("misa_stock");
  const items = raw?.items || [];
  if (!items.length) return { value: null, units: 0, at: null, source: "none" };
  const hasVal = items.some((it: any) => (Number(it.closeValue) || 0) > 0);
  if (!hasVal) return { value: null, units: 0, at: raw?.generatedAt || null, source: "no_value" };
  let value = 0, units = 0;
  for (const it of items) {
    const qty = Math.max(0, Number(it.closing) || 0);
    if (!qty) continue;
    units += qty; value += Number(it.closeValue) || 0;
  }
  return { value, units, at: raw?.generatedAt || null, source: "misa" };
}

async function codReceivable(today: string): Promise<{ due: number; count: number }> {
  const sts = await readJson("jt_cod_statements");
  const arr = Array.isArray(sts) ? sts : [];
  const due = arr.filter((s: any) => s?.payDate && s.payDate >= today);
  return { due: due.reduce((a: number, s: any) => a + (s.net || 0), 0), count: due.length };
}

async function readLoanDebt(): Promise<{ total: number; count: number } | null> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb.from("loans").select("outstanding_principal,status").in("status", ["active", "overdue"]);
    if (error || !data) return null;
    return { total: data.reduce((s: number, l: any) => s + (Number(l.outstanding_principal) || 0), 0), count: data.length };
  } catch { return null; }
}

function latestBookDebt(bs: Record<string, any> | null): { payables: number; debt: number; receivables: number; month: string } | null {
  if (!bs || typeof bs !== "object") return null;
  const months = Object.keys(bs).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  for (let i = months.length - 1; i >= 0; i--) {
    const b = bs[months[i]] || {};
    if ((Number(b.payables) || 0) + (Number(b.debt) || 0) + (Number(b.receivables) || 0) > 0)
      return { payables: Number(b.payables) || 0, debt: Number(b.debt) || 0, receivables: Number(b.receivables) || 0, month: months[i] };
  }
  return null;
}

export async function buildDailyBalance(): Promise<{ ok: boolean; text: string; error?: string }> {
  const today = vnDateStr();
  const month = today.slice(0, 7);

  const [bank, inv, cod, bs, loan, loop] = await Promise.all([
    readBankCash().catch(() => ({ total: null, mb: null, tcb: null, at: null } as any)),
    inventoryAtCost().catch(() => ({ value: null, units: 0, at: null, source: "err" })),
    codReceivable(today).catch(() => ({ due: 0, count: 0 })),
    readJson("balance_sheet"),
    readLoanDebt(),
    computeRevenueLoop(month).catch(() => null),
  ]);

  const book = latestBookDebt(bs);

  const cash = bank.total;
  const invVal = inv.value;
  const assetKnown = (cash || 0) + cod.due + (invVal || 0);
  const assetLines = [
    `• Tiền ngân hàng: <b>${cash != null ? money(cash) : "chưa có sổ phụ"}</b>${cash != null && bank.at ? ` <i>(tới ${dmy(bank.at)})</i>` : ""}`,
    `• Phải thu COD (J&T chờ về): <b>${money(cod.due)}</b>${cod.count ? ` <i>(${cod.count} bảng kê)</i>` : ""}`,
    `• Tồn kho (giá vốn): <b>${invVal != null ? money(invVal) : "chưa có giá trị MISA"}</b>${invVal != null ? ` <i>(${inv.units.toLocaleString("vi-VN")} sp)</i>` : ""}`,
  ];

  const loanDebt = loan ? loan.total : null;
  const payables = book?.payables || 0;
  const debtTotal = (loanDebt || 0) + payables;
  const debtLines: string[] = [];
  if (loanDebt != null)
    debtLines.push(`• Nợ vay: <b>${money(loanDebt)}</b> <i>(${loan!.count ? `${loan!.count} hợp đồng đang vay` : "không có khoản vay"})</i>`);
  else
    debtLines.push(`• <i>Nợ vay: chưa có dữ liệu (bảng loans chưa tạo — chạy migration 015).</i>`);
  if (payables > 0) debtLines.push(`• Phải trả NCC: <b>${money(payables)}</b>`);

  const net = assetKnown - debtTotal;

  let pulse = "";
  if (loop) {
    const gp = Math.round(loop.monthActual * (loop.assumptions?.grossMargin || 0));
    pulse =
      `\n\n<b>NHỊP THÁNG ${month.slice(5)}</b>\n` +
      `• Doanh thu: <b>${trM(loop.monthActual)}</b>/${trM(loop.monthTarget)} ${LIGHT[loop.finLight] || ""} <i>(nhịp ${loop.pacePct}% · kỳ vọng ${loop.expectedPct}%)</i>\n` +
      `• Ước lãi gộp (~${Math.round((loop.assumptions?.grossMargin || 0) * 100)}%): <b>${trM(gp)}</b>\n` +
      `• Chi quảng cáo: <b>${money(loop.mktSpend)}</b>${loop.mktPct != null ? ` <i>(${loop.mktPct}% doanh thu)</i>` : ""}`;
  }

  const fixedCost = await getConfigNumber("monthly_fixed_cost", 190_000_000).catch(() => 190_000_000);
  const bufferMonths = cash != null && fixedCost > 0 ? Math.round(((cash + cod.due) / fixedCost) * 10) / 10 : null;
  let bufferLine = "";
  if (cash != null) {
    if (fixedCost > 0) {
      const liquid = cash + cod.due;
      const threshold = fixedCost * 3;
      bufferLine =
        `\n\n<b>ĐỆM KÉT</b>: <b>${bufferMonths} tháng</b> chi phí cố định <i>(tiền nhanh ${money(liquid)} / ${trM(fixedCost)}/tháng)</i>`;
      if (liquid < threshold) {
        bufferLine +=
          `\n🔴 <b>DƯỚI NGƯỠNG AN TOÀN 3 THÁNG (${money(threshold)})</b> — ` +
          `ưu tiên thu COD về nhanh, xả tồn đọng thành quà, hoãn chi lớn chưa gấp.`;
      }
    }
  }

  let cccBlock = "";
  let lightsBlock = "";
  if (loop && loop.monthActual > 0) {
    const dayNum = Number(today.slice(8, 10)) || 1;
    const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
    const gm = loop.assumptions?.grossMargin || 0.66;
    const revPerDay = loop.monthActual / dayNum;
    const cogsPerDay = revPerDay * (1 - gm);
    const dso = Math.round(cod.due / revPerDay);
    const dio = invVal != null && cogsPerDay > 0 ? Math.round(invVal / cogsPerDay) : null;
    const dpo = cogsPerDay > 0 ? Math.round(payables / cogsPerDay) : 0;
    const ccc = dio != null ? dso + dio - dpo : null;
    const bep = gm > 0 && fixedCost > 0 ? Math.round(fixedCost / gm) : null;
    const projected = Math.round(revPerDay * daysInMonth);
    const safety = bep != null && projected > 0 ? Math.round(((projected - bep) / projected) * 100) : null;

    cccBlock =
      `\n\n<b>CHU KỲ TIỀN MẶT & HÒA VỐN</b>\n` +
      `• Tiền bị giam (CCC): <b>${ccc != null ? ccc + " ngày" : "thiếu giá trị tồn kho"}</b> <i>(thu COD ${dso}ng + tồn kho ${dio != null ? dio + "ng" : "?"} − chiếm dụng NCC ${dpo}ng)</i>` +
      (bep != null
        ? `\n• Hòa vốn tháng (BEP): <b>${trM(bep)}</b> — dự phóng tháng này <b>${trM(projected)}</b>${safety != null ? ` <i>(biên an toàn ${safety}%)</i>` : ""}`
        : "") +
      `\n<i>Ước theo biên gộp giả định ${Math.round(gm * 100)}% + chi phí cố định ${trM(fixedCost)}/tháng.</i>`;

    const lights: string[] = [];
    const lamp = (st: "green" | "yellow" | "red", label: string, detail: string) =>
      lights.push(`${LIGHT[st]} <b>${label}</b> — ${detail}`);
    if (bufferMonths != null)
      lamp(bufferMonths >= 3 ? "green" : bufferMonths >= 1.5 ? "yellow" : "red",
        "Đệm két", `${bufferMonths} tháng chi phí cố định (chuẩn ≥ 3)`);
    lamp(loop.finLight, "Nhịp doanh thu", `${loop.pacePct}% mục tiêu vs kỳ vọng ${loop.expectedPct}%`);
    if (bep != null)
      lamp(projected >= bep * 1.1 ? "green" : projected >= bep ? "yellow" : "red",
        "Doanh thu vs hòa vốn", `dự phóng ${trM(projected)} vs BEP ${trM(bep)}`);
    if (ccc != null)
      lamp(ccc <= 60 ? "green" : ccc <= 90 ? "yellow" : "red",
        "Chu kỳ tiền mặt", `${ccc} ngày (quá 90 = vốn bị chiếm dụng nặng)`);
    if (dio != null)
      lamp(dio <= 60 ? "green" : dio <= 90 ? "yellow" : "red",
        "Tồn kho", `đọng ~${dio} ngày bán (giá vốn ${invVal != null ? trM(invVal) : "?"})`);
    lamp(dso <= 10 ? "green" : dso <= 20 ? "yellow" : "red",
      "Phải thu COD", `~${dso} ngày doanh thu đang chờ về (chu kỳ COD bình thường 3-7 ngày)`);
    if (loop.mktPct != null)
      lamp(loop.mktLight, "Chi quảng cáo", `${loop.mktPct}% doanh thu (trần ${Math.round((loop.assumptions?.mktCostCapPct || 0.15) * 100)}%)`);
    lightsBlock = `\n\n<b>ĐÈN SỨC KHỎE DÒNG TIỀN</b>\n${lights.join("\n")}`;
  }

  const warns: string[] = [];
  const bankAge = bank.at ? Math.floor((Date.now() - new Date(bank.at + "T00:00:00").getTime()) / 864e5) : null;
  if (cash == null) warns.push("Chưa có số dư ngân hàng (sổ phụ chưa bóc được).");
  else if (bankAge != null && bankAge > 40) warns.push(`Số dư ngân hàng đã cũ ${bankAge} ngày — sổ phụ về hàng tháng, số thật hôm nay có thể lệch.`);
  if (invVal == null) warns.push("Tồn kho chưa có giá trị — kiểm tra cron misa_stock.");
  if (loanDebt == null) warns.push("Chưa lấy được nợ vay từ hệ thống (bảng loans) — tài sản ròng đang tính KHUYẾT phần nợ.");

  const header =
    `📊 <b>BẢNG CÂN ĐỐI NHANH — ${dmy(today)}</b>\n` +
    `<i>Ảnh chụp vị thế tài chính (tiền + hàng + nợ), ghép từ nguồn tươi nhất.</i>\n\n` +
    `<b>TÀI SẢN</b> (đã biết): <b>${money(assetKnown)}</b>\n${assetLines.join("\n")}\n\n` +
    `<b>NỢ PHẢI TRẢ</b>: <b>${money(debtTotal)}</b>\n${debtLines.join("\n")}\n\n` +
    `<b>➡️ TÀI SẢN RÒNG (tài sản − nợ): ${money(net)}</b>`;

  const props: string[] = [];
  if (bufferMonths != null && bufferMonths < 3) props.push(`Đệm két ${bufferMonths} tháng (dưới ngưỡng 3) → thu COD về nhanh, xả tồn chậm luân chuyển thành quà, hoãn chi lớn chưa gấp.`);
  if (invVal != null && cash != null && invVal > cash) props.push(`Tồn kho (${trM(invVal)}) lớn hơn tiền mặt (${trM(cash)}) → đẩy combo/quà xả hàng chậm để giải phóng vốn.`);
  if (cod.due > 0 && cash != null && cod.due > cash * 0.5) props.push(`COD chờ về ${trM(cod.due)} (${cod.count} bảng kê) chiếm tỉ trọng lớn → bám J&T thu đúng hạn, cân nhắc nhà vận chuyển thứ 2.`);
  if (loop && loop.mktPct != null && loop.mktLight === "red") props.push(`Chi quảng cáo ${loop.mktPct}% doanh thu vượt trần → rà từng chiến dịch, cắt chỗ không ra đơn.`);
  if (loop && (loop.finLight === "red" || loop.finLight === "yellow")) props.push(`Doanh thu ${loop.pacePct}% mục tiêu (chậm nhịp) → đẩy chăm sóc tệp chờ + chốt telesales.`);
  if (!props.length) props.push("Vị thế tài chính ổn — tiếp tục theo dõi, chưa cần hành động gấp.");
  const propBlock = `\n\n💡 <b>ĐỀ XUẤT</b> (chờ anh duyệt — nhắn em làm):\n` + props.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join("\n");

  const warnBlock = warns.length ? `\n\n⚠️ <i>Lưu ý độ tin cậy:</i>\n• ${warns.join("\n• ")}` : "";
  return { ok: true, text: header + bufferLine + pulse + cccBlock + lightsBlock + propBlock + warnBlock };
}
