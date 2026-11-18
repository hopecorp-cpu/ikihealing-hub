import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { insertAndAssign, pickAssignee } from "@/lib/leads";
import { docNguonTuBody, themNhan } from "@/lib/nguon-lead";
import { chuanMa, ganMaCtvLeadCu, ghiChuCoCtv } from "@/lib/affiliate-don";
import { xetDonSo } from "@/lib/gia-v4";
import { giaVonQua } from "@/lib/gia-v4-von";
import { sendTelegramMay } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = req.headers.get("x-ops-secret") || "";
  if (!process.env.EXTERNAL_ORDER_SECRET || secret !== process.env.EXTERNAL_ORDER_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({} as any));

  const noiDungCk = String(b.content || "").toUpperCase();
  if (/\bNOVA\b/.test(noiDungCk)) {
    return NextResponse.json({ ok: true, boQua: "đơn cổng web example.com — ikihealing-hub tự xử lý (chống đếm đôi + tên hàng đúng)" });
  }

  const action = b.action === "paid" ? "paid" : b.action === "lead" ? "lead" : "create";
  const sb = getServiceClient();
  const channel: string = b.channel || "Sale Page";
  const page = pageSlug(b);
  const phone = chuanSdt(b.phone);

  try {

    if (action === "lead") {
      if (!phone) return NextResponse.json({ ok: false, error: "missing phone" }, { status: 400 });
      const r = await upsertLead(sb, { phone, name: b.name, email: b.email, page, channel, b, note: "Để lại SĐT trên sale page" + (b.combo ? " (đang xem: " + b.combo + ")" : ""), notify: true });
      return NextResponse.json({ ok: r.ok, lead: r.id || null, dedup: !!r.dedup, error: r.error });
    }

    const orderCode = String(b.orderCode || "").trim();
    if (!orderCode) return NextResponse.json({ ok: false, error: "missing orderCode" }, { status: 400 });
    const subChannel = b.combo || null;
    const amount = Number(b.payable || b.total || 0) || 0;
    const qty = Number(b.qty || 0) || null;

    if (action === "paid") {
      const { data: existing } = await sb.from("orders")
        .select("id, notes, customer_id, sub_channel, quantity, gross_revenue, channel, order_date")
        .eq("order_code", orderCode).maybeSingle();
      if (existing) {
        await sb.from("orders").update({
          status: "confirmed",
          notes: appendNote(existing.notes, "Đã thanh toán payOS " + (b.paidAt || ""))
        }).eq("id", existing.id);
        const cust = existing.customer_id
          ? (await sb.from("customers").select("full_name, phone, notes").eq("id", existing.customer_id).maybeSingle()).data
          : null;
        const sdt = chuanSdt(cust?.phone) || phone;

        const soDon = await ghiSoDon(sb, {
          orderCode, page: pageSlug({ page: b.page, channel: existing.channel || channel }), channel: existing.channel || channel, combo: existing.sub_channel || subChannel,
          qty: existing.quantity || qty, amount: Number(existing.gross_revenue) || amount,
          name: cust?.full_name || b.name, phone: sdt, address: diaChiTuNote(cust?.notes) || b.address,
          content: b.content, paidAt: b.paidAt,

          maCtv: (String(existing.notes || "").match(/(?:^|\| )CTV: ([A-Z0-9]+)/) || [])[1] || null,
        });
        if (sdt) await leadWon(sb, sdt, "Đã CK " + fmtVnd(Number(existing.gross_revenue) || amount) + " (" + (existing.sub_channel || subChannel || "") + ")");
        return NextResponse.json({ ok: true, updated: true, soDon });
      }

    }

    const { data: dup } = await sb.from("orders").select("id").eq("order_code", orderCode).maybeSingle();
    if (dup) return NextResponse.json({ ok: true, duplicate: true });

    if (action !== "paid") {
      const sanPhamDon = sanPhamTuCombo(channel, subChannel, qty, amount);
      const quaVon = giaVonQua(sanPhamDon.filter((d) => !(Number(d.thanh_tien) > 0)).map((d) => ({ ten: d.ten, sl: d.sl })));
      const xetSan = xetDonSo({ san_pham: sanPhamDon, khach_tra: amount, kenh: "le", quaGiaVon: quaVon.tong });
      if (xetSan.muc === "chan") {
        await sendTelegramMay("gia-duoi-san", ["CHẶN ĐƠN SALE PAGE DƯỚI SÀN v4 — " + xetSan.lyDo,
          "Trang: " + channel + " · gói " + (subChannel || "-") + " × " + (qty ?? "?") + " = " + amount.toLocaleString("vi-VN") + "đ · " + (laCodSom(b) ? "COD" : "chờ CK"),
          "Khách: " + (b.name || "-") + " · " + (phone ? "*******" + phone.slice(-3) : "-"),
          "Kiểm bảng combo của sale page: gói này đang bán dưới sàn công khai."].join("\n")).catch(() => { });
        return NextResponse.json({ ok: false, chanSan: true, error: "Giá gói thấp hơn mức giá công bố của sản phẩm. Vui lòng tải lại trang hoặc gọi hotline để được hỗ trợ." }, { status: 400 });
      }
    }

    let customerId: string | null = null;
    const email = String(b.email || "").trim();
    const custNote = b.address ? "ĐC: " + b.address : "";
    if (phone) {
      const { data: cust } = await sb.from("customers").select("id, email, notes").eq("phone", phone).maybeSingle();
      if (cust) {
        customerId = cust.id;

        const patch: Record<string, any> = {};
        if (email && !cust.email) patch.email = email;
        if (custNote && !(cust.notes || "").includes("ĐC:")) patch.notes = appendNote(cust.notes, custNote);
        if (Object.keys(patch).length) await sb.from("customers").update(patch).eq("id", cust.id);
      } else {
        const { data: newCust } = await sb.from("customers")
          .insert({ full_name: b.name || "Khách Sale Page", phone, email: email || null, source: "Sale Page", notes: custNote })
          .select("id").single();
        customerId = newCust?.id || null;
      }
    }

    const laCod = /cod/i.test(String(b.content || "")) || b.cod === true || String(b.method || "").toUpperCase() === "COD";
    let salesId: string | null = null;
    if (phone) {
      const r = await upsertLead(sb, {
        phone, name: b.name, email, page, channel, b, notify: false,
        note: (action === "paid" ? "Đã CK " : laCod ? "Đặt COD " : "Đặt hàng, CHỜ CK ") + (b.combo || "") + " " + fmtVnd(amount) + (laCod ? " — gọi xác nhận trước khi giao" : ""),
      });
      salesId = r.assignee_id || null;
      if (action === "paid") await leadWon(sb, phone, "Đã CK " + fmtVnd(amount));
    }

    if (customerId) {
      const { data: prev } = await sb.from("orders")
        .select("salesperson_id").eq("customer_id", customerId)
        .not("salesperson_id", "is", null).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (prev?.salesperson_id) salesId = prev.salesperson_id;
    }
    if (!salesId) salesId = await pickAssignee(sb, { source: "salepage" });

    const { error: ordErr } = await sb.from("orders").insert({
      order_code: orderCode,
      customer_id: customerId,
      salesperson_id: salesId,
      channel,
      sub_channel: subChannel,
      gross_revenue: amount,
      discount_value: 0,
      shipping_cost: 0,
      quantity: qty,
      status: action === "paid" ? "confirmed" : "pending",
      order_date: vnDateStr(),
      source_platform: "salepage",
      channel_code: "salepage",
      counts_for_bonus: true,
      notes: buildNote(b)
    });
    if (ordErr) return NextResponse.json({ ok: false, error: ordErr.message }, { status: 500 });

    let soDon: any = null;
    if (action === "paid") {
      soDon = await ghiSoDon(sb, { orderCode, page, channel, combo: subChannel, qty, amount, name: b.name, phone, address: b.address, content: b.content, paidAt: b.paidAt, maCtv: chuanMa(b.ma_ctv) || null });
    }
    return NextResponse.json({ ok: true, created: true, soDon });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

async function upsertLead(sb: any, o: {
  phone: string; name?: string; email?: string; page: string; channel: string; b: any; note: string; notify: boolean;
}) {
  const nguon = orderSource(o.b);

  let nhanDongY = "";
  try {
    const { docDongYTuBody, ghiDongY } = await import("@/lib/du-lieu-ca-nhan");
    const dongY = docDongYTuBody(o.b);
    if (dongY.co) await ghiDongY(sb, { phone: o.phone, email: o.email, ten: o.name, kenh: "salepage", nguon: ["salepage", o.page, nguon].filter(Boolean).join(":"), mucDich: dongY.mucDich, vanBan: dongY.vanBan, phienBan: dongY.phienBan });
    if (!(dongY.co && dongY.tinTuVan)) nhanDongY = "[CHƯA đồng ý nhận tin tư vấn/QC — chỉ làm đúng việc đơn hàng]";
  } catch {  }
  const r = await insertAndAssign(sb, {
    customer_name: o.name || null,
    phone: o.phone,

    source: themNhan(["salepage", o.page, nguon].filter(Boolean).join(":").slice(0, 120), nguonMay(o.b)),
    channel: "salepage",
    product: sanPhamCuaTrang(o.channel),
    external_id: "sp:" + o.phone,

    note: ghiChuCoCtv([o.note, o.email ? "Email: " + o.email : null, "Trang: " + o.channel, nhanDongY].filter(Boolean).join(" | ").slice(0, 300), o.b?.ma_ctv),
  }, { notify: o.notify });
  if (r.ok && r.dedup) await ganMaCtvLeadCu(sb, r.id, o.b?.ma_ctv);
  return r;
}

async function leadWon(sb: any, phone: string, ghiChu: string) {
  try {
    const { data: ex } = await sb.from("leads").select("id, status, note").eq("external_id", "sp:" + phone).maybeSingle();
    if (!ex || ex.status === "won") return;
    await sb.from("leads").update({ status: "won", note: appendNote(ex.note, ghiChu) }).eq("id", ex.id);
  } catch {  }
}

async function ghiSoDon(sb: any, o: {
  orderCode: string; page: string; channel: string; combo: string | null; qty: number | null; amount: number;
  name?: string | null; phone?: string | null; address?: string | null; content?: string | null; paidAt?: string | null;

  maCtv?: string | null;
}): Promise<{ ghi: boolean; lyDo?: string }> {
  try {
    if (!o.amount || o.amount < 1000) return { ghi: false, lyDo: "không có số tiền" };
    const chatId = "salepage:" + o.page;
    const messageId = Number(o.orderCode);
    if (!Number.isFinite(messageId)) return { ghi: false, lyDo: "orderCode không phải số" };
    const ngay = vnDateStr();
    const { data: da } = await sb.from("tg_orders").select("id").eq("chat_id", chatId).eq("message_id", messageId).maybeSingle();
    if (da) return { ghi: false, lyDo: "đã có" };
    if (o.phone) {
      const truoc = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
      const sau = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
      const { data: trung } = await sb.from("tg_orders").select("id, khach_tra, ma_ctv").eq("sdt", o.phone).gte("ngay", truoc).lte("ngay", sau).limit(20);
      const dong = (trung || []).find((r: any) => Math.abs(Number(r.khach_tra) - o.amount) < 1000);
      if (dong) {

        if (o.maCtv && !dong.ma_ctv) await sb.from("tg_orders").update({ ma_ctv: o.maCtv }).eq("id", dong.id);
        return { ghi: false, lyDo: "sổ nhóm đã có đơn này (cùng SĐT, cùng tiền)" };
      }
    }
    const sanPham = sanPhamTuCombo(o.channel, o.combo, o.qty, o.amount);

    const quaVon = giaVonQua(sanPham.filter((d) => !(Number(d.thanh_tien) > 0)).map((d) => ({ ten: d.ten, sl: d.sl })));
    const san = xetDonSo({ san_pham: sanPham, khach_tra: o.amount, kenh: "le", quaGiaVon: quaVon.tong });
    const { error } = await sb.from("tg_orders").insert({
      chat_id: chatId, message_id: messageId,
      sale: "Web",
      khach: o.name || null, sdt: o.phone || null, dia_chi: o.address || null, tinh: null,
      san_pham: sanPham,
      qua: [], gia_goc: o.amount, giam_gia: 0, khach_tra: o.amount,
      kieu_ship: "ck_truoc", phi_ship: 0,
      ghi_chu: [san.muc !== "ok" ? `[GIÁ ${san.muc === "chan" ? "DƯỚI SÀN" : "CẢNH BÁO"} v4: ${san.lyDo}]` : null,
        "Sale page " + o.channel.replace(/^Sale Page /i, ""), "mã " + o.orderCode, o.content ? "CK: " + o.content : null, "đã CK payOS " + (o.paidAt || "")].filter(Boolean).join(" · "),
      ngay, sent_at: new Date().toISOString(), nguoi_gui: "salepage", boc_at: new Date().toISOString(),
      ma_ctv: o.maCtv || null,
    });
    if (error) return { ghi: false, lyDo: error.message };
    return { ghi: true };
  } catch (e: any) { return { ghi: false, lyDo: String(e?.message || e) }; }
}

function laCodSom(b: any): boolean {
  return /cod/i.test(String(b?.content || "")) || b?.cod === true || String(b?.method || "").toUpperCase() === "COD";
}

function sanPhamTuCombo(channel: string, combo: string | null, qty: number | null, amount: number) {
  const tra = /Trà Mẫu B/i.test(channel) ? "Trà Mẫu B" : "Trà Mẫu A";
  const dam = "Đạm Thực Vật Mẫu";
  const c = String(combo || "");

  if (/trà\s*\+\s*đạm/i.test(c)) return [{ ten: tra, sl: 3, thanh_tien: 0 }, { ten: dam, sl: 1, thanh_tien: amount }];
  if (/đạm\s*\+\s*trà/i.test(c)) return [{ ten: dam, sl: 2, thanh_tien: amount }, { ten: tra, sl: 2, thanh_tien: 0 }];
  const ten = /Đạm Mẫu/i.test(channel) ? dam : tra;
  const sl = qty || Number((c.match(/(\d+)\s*hộp/i) || [])[1]) || 1;
  return [{ ten, sl, thanh_tien: amount }];
}

function pageSlug(b: any): string {
  const p = String(b.page || "").trim().toLowerCase();
  if (p) return p.replace(/[^a-z0-9-]/g, "-").slice(0, 40);
  const ch = String(b.channel || "");
  if (/Đạm Mẫu/i.test(ch)) return "sanphamaprotein";
  if (/Trà Mẫu B/i.test(ch)) return "san-pham-b";
  if (/Trà Mẫu A/i.test(ch)) return "san-pham-c";
  return "salepage";
}

function sanPhamCuaTrang(channel: string): string {
  if (/Đạm Mẫu/i.test(channel)) return "Đạm Mẫu Protein";
  if (/Trà Mẫu B/i.test(channel)) return "Trà Mẫu B";
  if (/Trà Mẫu A/i.test(channel)) return "Trà Mẫu A";
  return "Sale page";
}

function chuanSdt(raw: any): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : "";
}

function diaChiTuNote(notes: string | null | undefined): string {
  const m = String(notes || "").match(/ĐC:\s*([^|]+)/);
  return m ? m[1].trim() : "";
}

function fmtVnd(n: number): string {
  return n ? Math.round(n).toLocaleString("vi-VN") + "đ" : "";
}

function buildNote(b: any) {
  const parts = [
    b.combo ? "Combo: " + b.combo : null,
    b.gift ? "Quà: " + b.gift : null,
    b.address ? "ĐC: " + b.address : null,
    b.content ? "Nội dung CK: " + b.content : null,
    chuanMa(b.ma_ctv) ? "CTV: " + chuanMa(b.ma_ctv) : null,
    "Nguồn: " + orderSource(b)
  ].filter(Boolean);
  return parts.join(" | ");
}

function nguonMay(b: any) {
  const g = String(b?.gclid || "").trim();
  if (g && !b?.utm_source) return docNguonTuBody({ nguon: { s: "google", m: "cpc", c: b?.utm_campaign || "", lp: b?.page || "" } });
  return docNguonTuBody({ ...(b || {}), nguon: b?.nguon, lp: b?.page || "" });
}

function orderSource(b: any): string {
  const gclid = String(b.gclid || "").trim();
  if (gclid) return "Google Ads (click " + gclid.slice(0, 12) + "…)";
  const us = String(b.utm_source || "").trim();
  if (us) return [us, String(b.utm_medium || "").trim(), String(b.utm_campaign || "").trim()].filter(Boolean).join(" / ");
  const s = String(b.source || "").trim();
  if (s && s.toLowerCase() !== "sale page (payos)") return s;
  const ref = String(b.ref || "").trim();
  if (ref) { try { return "Giới thiệu: " + new URL(ref).host; } catch { return "Giới thiệu"; } }
  return "Trực tiếp / Tự tìm (Sale Page)";
}

function appendNote(old: string | null, add: string) {
  return old ? old + " | " + add : add;
}
