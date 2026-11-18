import { QuizOrder, markQuizOrderPaid, claimQuizFulfillment } from "@/lib/payos";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { sendResend, resendConfigured } from "@/lib/resend";
import { getConfigValue } from "@/lib/app-config";
import mealPlans from "@/data/quiz-meal-plans.json";

type MealDay = { d: number; sang: string; trua: string; toi: string; phu?: string };
type MealPlan = { ten: string; nguyenTac?: string; luuY?: string | string[]; ngay: MealDay[] };
function luuYText(v?: string | string[]) { return Array.isArray(v) ? v.join(" ") : (v || ""); }

function esc(s: string) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mealHtml(name: string, mp: MealPlan): string {
  const days = (mp.ngay || []).map((x) => `
    <tr><td style="padding:10px 12px;border-bottom:1px solid #eef2f0;vertical-align:top">
      <div style="font-weight:700;color:#173a2c;margin-bottom:4px">Ngày ${x.d}</div>
      <div style="color:#374151;font-size:14px;line-height:1.6">
        <b>Sáng:</b> ${esc(x.sang)}<br/>
        <b>Trưa:</b> ${esc(x.trua)}<br/>
        <b>Tối:</b> ${esc(x.toi)}${x.phu ? `<br/><span style="color:#6b7280"><b>Phụ:</b> ${esc(x.phu)}</span>` : ""}
      </div>
    </td></tr>`).join("");
  return `
  <div style="max-width:640px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
    <h2 style="color:#0f766e;margin:0 0 6px">Thực đơn 14 ngày cá nhân hoá</h2>
    <div style="color:#374151;font-size:15px;margin:0 0 4px">${esc(mp.ten)}</div>
    ${name ? `<div style="color:#6b7280;font-size:14px;margin:0 0 12px">Gửi ${esc(name)}</div>` : ""}
    ${mp.nguyenTac ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px;font-size:14px;color:#065f46;margin:0 0 14px"><b>Nguyên tắc:</b> ${esc(mp.nguyenTac)}</div>` : ""}
    <table style="width:100%;border-collapse:collapse;border:1px solid #eef2f0;border-radius:12px;overflow:hidden">${days}</table>
    ${luuYText(mp.luuY) ? `<div style="color:#92400e;font-size:13px;margin:14px 0 0"><b>Lưu ý:</b> ${esc(luuYText(mp.luuY))}</div>` : ""}
    <div style="color:#9ca3af;font-size:12px;margin:18px 0 0;line-height:1.6">
      Thực phẩm bổ sung, không phải là thuốc và không thay thế bữa ăn hay thuốc chữa bệnh.
      Thực đơn mang tính tham khảo theo lối sống, không nhằm chẩn đoán hay điều trị bệnh.<br/>
      NOVA — Công ty Cổ phần ACME.
    </div>
  </div>`;
}

/**
 * Gọi khi phát hiện đơn PAID (từ webhook hoặc polling). Idempotent: chỉ chạy side-effect lần đầu.
 * @param paidInfo amount/paidAt/reference lấy từ PayOS (nếu có).
 */
export async function fulfillQuizPaid(
  order: QuizOrder | null,
  paidInfo?: { amount?: number; paidAt?: number; reference?: string }
): Promise<{ ok: boolean; alreadyDone?: boolean; mealSent?: boolean }> {
  if (!order) return { ok: false };

  if (order.status !== "paid") {
    await markQuizOrderPaid(order.orderCode, paidInfo?.paidAt, paidInfo?.reference);
  }

  const mine = await claimQuizFulfillment(order.orderCode);
  if (!mine) return { ok: true, alreadyDone: true };

  const amount = Number(paidInfo?.amount || order.amount || 0);
  let mealSent = false;

  let soDon = "";
  try {
    const { getServiceClient } = await import("@/lib/supabase-server");
    const { ghiSoDonWeb } = await import("@/lib/don-web");
    const r = await ghiSoDonWeb(getServiceClient(), {
      orderCode: order.orderCode, name: order.name, phone: order.phone,
      address: (order as any).address, product: (order as any).product, pkg: order.pkg,
      qty: (order as any).qty, amount,
      content: paidInfo?.reference || "", paidAt: new Date(paidInfo?.paidAt || Date.now()).toISOString(),
      maCtv: order.maCtv,
    });
    if (!r.ghi && r.lyDo && r.lyDo !== "đã có" && !r.lyDo.startsWith("sổ nhóm")) soDon = r.lyDo;
  } catch (e: any) { soDon = String(e?.message || e); }

  if (telegramConfigured()) {
    const diaChi = (order as any).address as string | undefined;
    const text = [
      "\u{1F4B0} ĐƠN WEB ĐÃ THANH TOÁN",
      "Mã: " + order.orderCode,
      "Khách: " + (order.name || "-") + " · " + (order.phone || "-"),
      "Hàng: " + ((order as any).product || order.pkg || "-") + ((order as any).qty > 1 ? " × " + (order as any).qty : ""),
      "Tiền: " + amount.toLocaleString("vi-VN") + "đ · đã CK trước",
      "Địa chỉ: " + (diaChi || "CHƯA CÓ — gọi khách xin trước khi đóng hàng"),
      order.profile ? "Thể trạng: " + order.profile : null,
      soDon ? "Lưu ý máy: chưa ghi được vào sổ doanh thu (" + soDon + ")" : null,
      "→ Sale gọi xác nhận và cho lên đơn giao.",
    ].filter(Boolean).join("\n");
    const { sendTelegramMay } = await import("@/lib/telegram");
    const { kenhBaoDon } = await import("@/lib/don-web");
    const kenh = await kenhBaoDon((order as any).product || order.pkg || "");
    await sendTelegramMay(kenh, text).catch(() => {});
  }

  if (order.vat && order.vat.taxCode && telegramConfigured()) {
    const v = order.vat;
    const acctChat = (await getConfigValue("accounting_tg_chat").catch(() => "")) || "";
    await sendTelegram(
      "Cần XUẤT HOÁ ĐƠN VAT — đơn quiz " + order.orderCode +
      "\nCông ty: " + (v.company || "-") +
      "\nMST: " + v.taxCode +
      "\nEmail nhận HĐ: " + (v.email || "-") +
      "\nSố tiền: " + amount.toLocaleString("vi-VN") + "đ" +
      "\n→ Kế toán xuất hoá đơn cho khách.",
      acctChat.trim() || undefined
    ).catch(() => {});
  }

  const mp = (mealPlans as unknown as Record<string, MealPlan>)[order.profile || ""];
  if (mp && order.email && resendConfigured()) {
    const r = await sendResend(
      order.email,
      `Thực đơn 14 ngày cá nhân hoá của bạn — ${mp.ten}`,
      mealHtml(order.name || "", mp)
    ).catch(() => ({ ok: false } as any));
    mealSent = !!r?.ok;
  }

  try {
    const { scheduleRecheck } = await import("@/lib/quiz-recheck");
    await scheduleRecheck({
      id: String(order.orderCode),
      name: order.name || "",
      email: order.email || "",
      phone: order.phone || undefined,
      profile: order.profile || "",
      overall: Number((order as any).overall) || 0,
      pkg: order.pkg || null,
    });
  } catch {  }

  return { ok: true, mealSent };
}
