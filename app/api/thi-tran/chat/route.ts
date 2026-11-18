import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { layThiTran, moTaPhongChoAI } from "@/lib/thi-tran-server";
import { DAU_GIAO_VIEC, tachGiaoViec, timPhong, type MaPhong } from "@/lib/thi-tran";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isManagerOrAbove(user.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const pid = String(body?.phong ?? "") as MaPhong;
  const phong = timPhong(pid);
  const tin = String(body?.tin ?? "").trim().slice(0, 800);
  if (!phong || !tin) return NextResponse.json({ ok: false, error: "Thiếu phòng hoặc câu hỏi" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "Máy chủ chưa có ANTHROPIC_API_KEY" }, { status: 503 });

  const lichSu = (Array.isArray(body?.lichSu) ? body.lichSu : []).slice(-8)
    .map((m: any) => ({ role: m?.ai === "phong" ? "assistant" : "user", content: String(m?.chu ?? "").slice(0, 1200) }))
    .filter((m: any) => m.content);

  const msgs: { role: string; content: string }[] = [];
  for (const m of [...lichSu, { role: "user", content: tin }]) {
    const cuoi = msgs[msgs.length - 1];
    if (cuoi && cuoi.role === m.role) cuoi.content += "\n" + m.content;
    else msgs.push({ ...m });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();

  const duLieu = await layThiTran().catch(() => null);
  const khoi = duLieu ? moTaPhongChoAI(duLieu, phong.id) : "Không đọc được số liệu sống lúc này.";

  const system = `Bạn là phòng "${phong.ten}" trong hệ thống vận hành của ACME Corp (thương hiệu NOVA). MausBot chia việc xuống các phòng; CEO là CEO, đang hỏi trên trang Thị trấn máy.
Xưng "em", gọi "anh". Tiếng Việt, ngắn gọn (tối đa 120 từ), câu rõ ràng, không dùng bảng, không dùng ký hiệu markdown đậm/tiêu đề, không emoji.

CHỈ dựa vào số liệu sống dưới đây. Không có số thì nói thẳng "phòng chưa đo được cái này", không đoán, không bịa.
Máy nào đứt thì nói rõ tên máy, vì sao và cách sửa (lấy từ số liệu). Kết thúc bằng một đề xuất cụ thể.

Em KHÔNG tự làm việc và KHÔNG được nói là đã làm xong. Nếu anh đang giao việc hoặc yêu cầu làm/sửa/chạy/viết/kiểm tra điều gì, hãy thêm MỘT dòng cuối cùng đúng dạng:
${DAU_GIAO_VIEC} <việc gọn, nói rõ cần làm gì và ra kết quả gì, tối đa 200 ký tự>
Giao diện sẽ hiện nút để anh gửi việc vào hàng việc Claude Code (chờ anh /duyet trên Telegram). Câu chỉ hỏi thông tin thì không thêm dòng đó.

Rào pháp lý: sản phẩm là thực phẩm bổ sung; không nói chữa, trị, điều trị, khỏi bệnh, thải độc theo nghĩa y học. Không nêu giá vốn.

SỐ LIỆU SỐNG CỦA PHÒNG (đọc lúc ${new Date().toISOString()}):
${khoi}`;

  const model = await layModel("thuong");
  const t0 = Date.now();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, thinking: { type: "disabled" }, max_tokens: 700, system, messages: msgs }),
    });
    const data: any = await r.json().catch(() => null);
    if (!r.ok) {
      ghiNhatKyAI({ noi: "api/thi-tran/chat", model, ms: Date.now() - t0, ok: false });
      return NextResponse.json({ ok: false, error: `Gọi AI hỏng (${r.status})` }, { status: 502 });
    }
    ghiNhatKyAI({ noi: "api/thi-tran/chat", model, inTok: data?.usage?.input_tokens, outTok: data?.usage?.output_tokens, ms: Date.now() - t0, ok: true });
    const text = (data?.content ?? []).filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n").trim();
    if (!text) return NextResponse.json({ ok: false, error: "AI trả về rỗng" }, { status: 502 });
    const { chu, viec } = tachGiaoViec(text);
    return NextResponse.json({ ok: true, chu, viec });
  } catch (e: any) {
    ghiNhatKyAI({ noi: "api/thi-tran/chat", model, ms: Date.now() - t0, ok: false });
    return NextResponse.json({ ok: false, error: `Gọi AI hỏng: ${String(e?.message || e).slice(0, 120)}` }, { status: 502 });
  }
}
