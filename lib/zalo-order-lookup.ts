import "server-only";
import { getServiceClient } from "@/lib/supabase-server";
import { layDonTheoSdt } from "@/lib/doanh-thu";
import { normalizePhone } from "@/lib/zalo";
import { PHONE_IN_TEXT, ORDER_CODE_IN_TEXT, duocTraDon, type NguCanhTraDon } from "@/lib/tra-don-kenh";

const HOI_DON_RE = /(?<!\p{L})(đơn|giao hàng|vận đơn|ship)(?!\p{L})/iu;

const TRANG_THAI_DA_GAN = ["contacted", "caring", "won"];

async function sdtGanVoiNguoiNhanOa(senderId: string): Promise<string | null> {
  const { data } = await getServiceClient().from("leads").select("phone")
    .eq("external_id", `zalooa:${senderId}`).in("status", TRANG_THAI_DA_GAN)
    .not("phone", "is", null).limit(1).maybeSingle();
  const p = String((data as any)?.phone || "").trim();
  return p || null;
}

const SAFE_COLS = "order_code,order_date,product_name,status,quantity";

type Row = { order_code: string; order_date: string | null; product_name: string | null; status: string | null; quantity: number | null };

export async function lookupOrderContext(text: string, nc?: NguCanhTraDon): Promise<string | null> {
  if (!duocTraDon(nc)) return null;
  const t = (text || "").trim();
  if (!PHONE_IN_TEXT.test(t) && !ORDER_CODE_IN_TEXT.test(t) && !HOI_DON_RE.test(t)) return null;

  let sdt: string | null = null;
  try { sdt = await sdtGanVoiNguoiNhanOa(nc.senderId.trim()); } catch { sdt = null; }
  if (!sdt) {
    return [
      "KẾT QUẢ TRA ĐƠN: hệ thống CHƯA xác định được tài khoản Zalo này gắn với số điện thoại đặt hàng nào, nên KHÔNG tra đơn.",
      "KHÔNG đọc, xác nhận hay đoán đơn theo số điện thoại / mã đơn khách gõ trong tin.",
      "Hãy nhờ khách để lại tên + SĐT đặt hàng để nhân viên bên em tra giúp và báo lại.",
      "TUYỆT ĐỐI KHÔNG bịa ra đơn hàng, trạng thái hay mã vận đơn.",
    ].join("\n");
  }
  return traDonTheoSdt(sdt);
}

export async function traDonTheoSdt(sdtDaGan: string): Promise<string | null> {
  const raw = String(sdtDaGan || "").trim();
  if (!raw) return null;
  const sb = getServiceClient();
  let rows: Row[] = [];
  try {
    const norm = normalizePhone(raw) || raw;
    const local = norm.startsWith("84") ? "0" + norm.slice(2) : raw;

    rows = (await layDonTheoSdt(sb, local, 30)).map((r) => ({ order_code: r.order_code, order_date: r.order_date, product_name: r.product_name, status: null, quantity: r.quantity }));
  } catch { return null; }

  const asked = `SĐT đã gắn với tài khoản Zalo này (đuôi ${raw.replace(/\D/g, "").slice(-3)})`;

  if (!rows.length) {
    return [
      `KẾT QUẢ TRA ĐƠN: KHÔNG tìm thấy đơn nào theo ${asked} trong hệ thống.`,
      "Hãy trả lời: em chưa tìm thấy đơn theo thông tin này, nhờ mình kiểm tra lại số điện thoại / mã đơn,",
      "hoặc để lại tên + SĐT đặt hàng để nhân viên bên em tra giúp và báo lại.",
      "TUYỆT ĐỐI KHÔNG bịa ra đơn hàng, trạng thái hay mã vận đơn.",
    ].join("\n");
  }

  const byOrder = new Map<string, { date: string | null; status: string | null; items: string[] }>();
  for (const r of rows) {
    if (!byOrder.has(r.order_code)) {
      if (byOrder.size >= 3) continue;
      byOrder.set(r.order_code, { date: r.order_date, status: r.status, items: [] });
    }
    const o = byOrder.get(r.order_code)!;
    if (r.product_name && o.items.length < 5) {
      o.items.push(`${r.product_name}${r.quantity ? ` x${r.quantity}` : ""}`);
    }
  }

  const lines = Array.from(byOrder.entries()).map(([code, o], i) =>
    `${i + 1}. Đơn ${code} — ngày ${o.date || "không rõ"} — trạng thái: ${o.status || "không rõ"}` +
    (o.items.length ? ` — gồm: ${o.items.join(", ")}` : ""));

  return [
    `KẾT QUẢ TRA ĐƠN theo ${asked} (dữ liệu THẬT từ hệ thống, ${byOrder.size} đơn gần nhất):`,
    ...lines,
    "CÁCH DÙNG:",
    "- Chỉ nói về các đơn ở trên (đơn của chính khách này). Không nhắc tới khách hay số điện thoại nào khác.",
    "- Không nói số tiền nếu dữ liệu trên không có. Không bàn về giá vốn hay lợi nhuận.",
    "- Nếu khách hỏi mã vận đơn / đơn đang ở đâu: hệ thống KHÔNG có dữ liệu vận đơn ở đây,",
    "  nói em sẽ nhờ nhân viên kiểm tra với đơn vị giao hàng rồi báo lại ngay. TUYỆT ĐỐI KHÔNG bịa mã vận đơn.",
  ].join("\n");
}
