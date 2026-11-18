import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { payosConfigured, createPayosPayment, saveQuizOrder, QuizOrder } from "@/lib/payos";
import { chuanMa } from "@/lib/affiliate-don";
import { sendTelegram, sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { getServiceClient } from "@/lib/supabase-server";
import { insertAndAssign } from "@/lib/leads";
import { kenhBaoDon, nhanSanPham } from "@/lib/don-web";
import { giaMayChu } from "@/lib/cua-hang";
import { maSanPhamTuTen, xetGiaDon } from "@/lib/gia-v4";
import { giaVonQua } from "@/lib/gia-v4-von";

export const dynamic = "force-dynamic";

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://example.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors() }); }

function chuanSdt(raw: any): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : "";
}

async function ghiLead(o: QuizOrder, body: any, datTruoc = false): Promise<string> {
  const phone = chuanSdt(o.phone);
  if (!phone) return "SĐT không hợp lệ";
  try {
    const sb = getServiceClient();

    const ghiChu = String(body?.ghiChuDon || "").trim() || [
      "ĐƠN " + (o.source === "shop" ? "/shop" : "/quiz") + ": " + (o.product || o.pkg || "-"),
      o.qty && o.qty > 1 ? "SL " + o.qty : null,
      o.amount ? o.amount.toLocaleString("vi-VN") + "đ" : null,
      o.status === "cod" ? "COD" : "CK trước",
      o.address ? "ĐC: " + o.address : "CHƯA CÓ ĐỊA CHỈ — phải gọi khách xin",
      o.note ? "Ghi chú: " + o.note : null,
    ].filter(Boolean).join(" · ");
    const r = await insertAndAssign(sb, {
      customer_name: o.name || null,
      phone,
      channel: "website",
      source: (datTruoc ? "shop-dat-truoc" : (o.source === "shop" ? "shop-order" : "quiz-order") + (o.status === "cod" ? "-cod" : "-ck"))
        + (String(body?.nguon || "").trim() ? ":" + String(body.nguon).trim() : ""),
      product: o.product || o.pkg || null,
      external_id: "web:" + o.orderCode,
      note: ghiChu.slice(0, 300),
    });
    return r.ok ? "" : (r.error || "không chèn được lead");
  } catch (e: any) {
    return String(e?.message || e);
  }
}

async function baoDon(o: QuizOrder, tieuDe: string, loiLead: string, canhBaoGia = "", datTruoc = false) {
  if (!telegramConfigured()) return;
  const text = [
    tieuDe,
    canhBaoGia ? "GIÁ: " + canhBaoGia : null,
    "Mã: " + o.orderCode,
    "Khách: " + tgEscape(o.name || "-") + " · " + tgEscape(o.phone || "-"),
    "Hàng: " + tgEscape(o.product || o.pkg || "-") + (o.qty && o.qty > 1 ? " × " + o.qty : ""),
    "Tiền: " + Number(o.amount || 0).toLocaleString("vi-VN") + "đ · " + (datTruoc ? "ĐẶT TRƯỚC — chưa thu tiền" : o.status === "cod" ? "COD (thu khi giao)" : "CK trước"),
    "Địa chỉ: " + (o.address ? tgEscape(o.address) : "CHƯA CÓ — gọi khách xin trước khi đóng hàng"),
    o.note ? "Ghi chú: " + tgEscape(o.note) : null,
    loiLead ? "Lưu ý máy: chưa tạo được lead (" + loiLead + ") — sale nhận đơn tay." : null,
  ].filter(Boolean).join("\n");
  const kenh = await kenhBaoDon(o.product || o.pkg || "");
  await sendTelegramMay(kenh, text).catch(() => { });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {  }

  if (String(b._honey || b._hp || "").trim()) return NextResponse.json({ ok: true, skipped: "honeypot" }, { headers: cors() });

  const amountWeb = parseInt(String(b.amount || 0).replace(/[^\d]/g, ""), 10) || 0;

  const name = String(b.name || "").trim();
  const phone = String(b.phone || "").trim();
  const email = String(b.email || "").trim();
  const address = String(b.address || b.diaChi || "").trim();
  const note = String(b.note || "").trim();
  const source = /shop/i.test(String(b.source || "")) ? "shop" : (String(b.source || "").trim() || "quiz");
  const qty = Math.max(1, parseInt(String(b.qty || 1).replace(/[^\d]/g, ""), 10) || 1);
  const pkg = String(b.pkg || "").trim();
  const product = String(b.product || "").trim() || nhanSanPham(pkg);
  const cod = !!b.cod || String(b.method || "").toUpperCase() === "COD";
  if (qty > 50) return NextResponse.json({ ok: false, error: "Số lượng lớn, vui lòng gọi hotline để được báo giá sỉ" }, { status: 400, headers: cors() });
  if (await vuotGioiHan(req, "quiz-pay-create", { moiIpMoiGio: 5, tongMoiNgay: 150 })) return NextResponse.json({ ok: false, error: "Bạn đặt nhiều đơn quá, gọi hotline giúp NOVA nhé." }, { status: 429, headers: cors() });

  const gia = await giaMayChu({ source, product, pkg, qty });

  if (source === "shop" && gia.hetHang) {
    return NextResponse.json({ ok: false, error: "Sản phẩm đang hết hàng. Trang vẫn mở để xem giá và quà; bạn có thể để lại số để được tư vấn khi có hàng." }, { status: 400, headers: cors() });
  }

  if (source === "shop" && gia.trangThai === "ngung-ban") {
    return NextResponse.json({ ok: false, error: "Sản phẩm này đã ngừng bán. Bạn có thể để lại số để được tư vấn sản phẩm thay thế." }, { status: 400, headers: cors() });
  }
  const fmtd = (n: number) => n.toLocaleString("vi-VN") + "đ";
  const amount = gia.amount ?? amountWeb;
  const daKiemGia = gia.amount != null;
  let canhBaoGia = !daKiemGia
    ? "CHƯA ĐỐI CHIẾU ĐƯỢC GIÁ (" + gia.cach + ") — sale gọi khách xác nhận giá trước khi thu"
    : gia.amount !== amountWeb
      ? "web gửi " + fmtd(amountWeb) + " nhưng bảng giá là " + fmtd(gia.amount!) + " (" + gia.cach + ") — thu theo " + fmtd(gia.amount!)
      : "";
  if (!amount || amount < 1000) {
    return NextResponse.json({ ok: false, error: "Số tiền không hợp lệ" }, { status: 400, headers: cors() });
  }

  const quaVon = giaVonQua(gia.qua || "");
  const xetSan = xetGiaDon({ ma: maSanPhamTuTen(product || pkg), donGia: amount > 0 ? Math.round(amount / qty) : null, sl: qty, quaGiaVon: quaVon.tong * qty });
  if (xetSan.muc === "chan") {
    await sendTelegramMay("gia-duoi-san", ["CHẶN ĐƠN WEB DƯỚI SÀN v4 — " + xetSan.lyDo,
      "Khách: " + (name || "-") + " · " + (phone || "-") + " · " + (product || pkg || "-") + " × " + qty + " = " + fmtd(amount),
      "Kiểm bảng giá /admin/cua-hang: món này đang bán dưới sàn công khai."].join("\n")).catch(() => { });
    return NextResponse.json({ ok: false, error: "Giá đơn thấp hơn mức giá công bố của sản phẩm. Vui lòng tải lại trang hoặc liên hệ hotline để được hỗ trợ." }, { status: 400, headers: cors() });
  }
  if (xetSan.muc === "canh_bao") canhBaoGia = [canhBaoGia, "SÀN v4: " + xetSan.lyDo].filter(Boolean).join(" · ");
  if (canhBaoGia) b.ghiChuDon = ("GIÁ: " + canhBaoGia + " · " + String(b.ghiChuDon || "")).slice(0, 300);

  const orderCode = Date.now();
  const don: QuizOrder = {
    orderCode, name, phone, email,
    pkg: pkg || undefined, profile: b.profile || undefined,
    amount, vat: b.vat || null,
    status: cod ? "cod" : "pending",
    createdAt: Date.now(),
    address: address || undefined, note: note || undefined,
    source, product: product || undefined, qty,
    maCtv: chuanMa(b.ma_ctv) || undefined,
  };

  if (source === "shop" && gia.trangThai === "sap-ra-mat") {
    b.ghiChuDon = ("ĐẶT TRƯỚC — CHƯA THU TIỀN, hàng dự kiến về " + (gia.ngayVe || "?") + " · " + String(b.ghiChuDon || "")).slice(0, 300);
    const loiLead = await ghiLead(don, b, true);
    await baoDon(don, "ĐẶT TRƯỚC (chưa thu tiền) — web example.com", loiLead, canhBaoGia, true);
    return NextResponse.json({ ok: true, datTruoc: true, ngayVe: gia.ngayVe || null, orderCode, amount }, { headers: cors() });
  }

  if (cod) {
    await saveQuizOrder(don);
    const loiLead = await ghiLead(don, b);
    await baoDon(don, "\u{1F4E6} ĐƠN MỚI (COD) — web example.com · GỌI KHÁCH XÁC NHẬN trước khi gửi hàng", loiLead, canhBaoGia);
    return NextResponse.json({ ok: true, cod: true, orderCode, amount }, { headers: cors() });
  }

  if (!daKiemGia) {
    await saveQuizOrder(don);
    const loiLead = await ghiLead(don, b);
    await baoDon(don, "ĐƠN CHỜ XÁC NHẬN GIÁ — web example.com", loiLead, canhBaoGia);
    return NextResponse.json({ configured: true, ok: true, orderCode, amount, canXacNhanGia: true }, { headers: cors() });
  }

  if (!payosConfigured()) return NextResponse.json({ configured: false }, { headers: cors() });

  const phoneDigits = phone.replace(/[^\d]/g, "");
  const description = ("NOVA " + (phoneDigits || orderCode)).slice(0, 25);
  const returnUrl = "https://example.com/quiz/?paid=1";
  const cancelUrl = "https://example.com/quiz/?cancel=1";

  try {
    const d = await createPayosPayment({ orderCode, amount, description, returnUrl, cancelUrl, buyerName: name, buyerPhone: phone });

    await saveQuizOrder(don);

    const loiLead = await ghiLead(don, b);
    await baoDon(don, "\u{1F4DD} ĐƠN CHỜ CHUYỂN KHOẢN — web example.com", loiLead, canhBaoGia);

    return NextResponse.json({
      configured: true, ok: true, orderCode,
      qrCode: d.qrCode, checkoutUrl: d.checkoutUrl,
      accountNumber: d.accountNumber, accountName: d.accountName, bin: d.bin,
      amount: d.amount, description: d.description,
    }, { headers: cors() });
  } catch (err: any) {

    await saveQuizOrder(don).catch(() => { });
    const loiLead = await ghiLead(don, b);
    await sendTelegram("Cổng thanh toán web lỗi — đơn " + orderCode + " của " + (name || "-") + " · " + (phone || "-") +
      " (" + amount.toLocaleString("vi-VN") + "đ) chưa tạo được QR. Sale gọi lại gửi thông tin CK." +
      (loiLead ? "\nLead cũng chưa ghi được: " + loiLead : "")).catch(() => { });
    return NextResponse.json({ configured: true, ok: false, error: String(err?.message || err) }, { status: 502, headers: cors() });
  }
}
