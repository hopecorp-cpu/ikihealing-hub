import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { chuanHoaTinNhan, locDauRa, kiemOrigin } from "@/lib/zalo-lao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORIGINS = (process.env.ZALO_LAO_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
const corsCho = (req: Request) => {
  const o = kiemOrigin(req.headers.get("origin"), ORIGINS);
  return { o, CORS: { "Access-Control-Allow-Origin": o.allowOrigin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } };
};
export async function OPTIONS(req: Request) { return new NextResponse(null, { status: 204, headers: corsCho(req).CORS }); }

const SYSTEM = `Bạn là "Lão" — người bạn đồng hành dưỡng sinh của NOVA (thương hiệu sức khoẻ của ACME), theo tinh thần y học cổ truyền Việt + lối sống lành mạnh. Xưng "Lão", gọi người dùng thân mật là "bạn". Trả lời NGẮN GỌN (2-5 câu), ấm áp, thực tế, tập trung vào THÓI QUEN ăn - ngủ - vận động - hơi thở - tinh thần.

TUYỆT ĐỐI:
- KHÔNG chẩn đoán bệnh, KHÔNG kê thuốc/liều, KHÔNG hứa chữa/trị/khỏi/thải độc.
- KHÔNG dùng từ: chữa bệnh, điều trị, thải độc, đặc trị, cam kết khỏi.
- Sản phẩm ACME là THỰC PHẨM BỔ SUNG, không phải thuốc.
- Nếu người dùng mô tả dấu hiệu nghiêm trọng/cấp tính -> khuyên đi khám bác sĩ, không tự tư vấn.
Có thể gợi ý nhẹ nhàng: làm bài "Đo cơ địa" trong app, hoặc tham khảo sản phẩm dưỡng sinh của ACME (Đạm Mẫu, Trà Mẫu A, dầu dừa...) khi thật sự phù hợp — không chèn quảng cáo gượng ép.`;

export async function POST(req: Request) {
  const { o, CORS } = corsCho(req);
  if (!o.cho) return NextResponse.json({ ok: false, reply: "Lão đang bận chút, bạn thử lại sau nhé." }, { status: 403, headers: CORS });
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) return NextResponse.json({ ok: false, reply: "Lão chưa sẵn sàng (thiếu cấu hình AI)." }, { headers: CORS });
  let body: any = {};
  try { body = JSON.parse(await req.text()); } catch { }

  const messages = chuanHoaTinNhan(body.messages);
  if (!messages) return NextResponse.json({ ok: false, reply: "Bạn hỏi Lão điều gì nào?" }, { headers: CORS });
  if (await vuotGioiHan(req, "zalo-lao", { moiIpMoiGio: 20, tongMoiNgay: 500 })) return NextResponse.json({ ok: false, reply: "Lão nghỉ một lát, bạn quay lại sau nhé." }, { status: 429, headers: CORS });

  try {
    const model = await layModel("hangLoat");
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, thinking: { type: "disabled" }, max_tokens: 400, system: SYSTEM, messages }),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    ghiNhatKyAI({ noi: "api/zalo/lao", model, inTok: j?.usage?.input_tokens, outTok: j?.usage?.output_tokens, ms: Date.now() - t0, ok: res.ok });
    const raw = (j?.content?.find((b: { type?: string }) => b.type === "text")?.text || "").trim();
    const reply = raw ? locDauRa(raw) : "Lão chưa nghĩ ra, bạn hỏi lại giúp Lão nhé.";
    return NextResponse.json({ ok: true, reply }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false, reply: "Lão đang bận chút, bạn thử lại sau nhé." }, { headers: CORS });
  }
}
