import { NextResponse } from "next/server";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";

export async function POST(req: Request) {
  try {
    const { query, path, role, name } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ ok: false, reason: "no_api_key" });
    }

    const systemPrompt = `Bạn là ACME Assistant — trợ lý AI cho nhân viên ACME Corp (thực phẩm bổ sung Đạm Mẫu + NOVA Detox + Học Viện NOVA) dùng app nội bộ "ACME Ops Hub" (ops-hub.example.com).

App có các tính năng chính:
- Chấm công Face ID (GPS 150m + work_mode remote/hybrid)
- Phạt 50k/lần quên check-in/out
- Xin nghỉ phép (phép năm, ốm, không lương, hiếu hỉ)
- Phiếu lương cá nhân (Gross, BHXH 10.5%, Thuế TNCN 5 bậc 2026, NQ 110/2025)
- KPI cá nhân theo chu kỳ
- Task board (giao việc, ack, blocker)
- Daily Report (báo cáo cuối ngày bắt buộc)
- Knowledge Base (wiki nội bộ)
- Sales Playbook (scripts chốt đơn)
- Onboarding 30 ngày cho NV mới
- Dashboard BI (manager+)
- Admin: Nhân sự, Bảng lương, Tính lương tự động, Cấu hình bậc thưởng, Kế toán + Bank, MISA eShop sync
- Empire: 10 Tuyên Bố, Empire Commitment, Empire Audit

User context:
- Tên: ${name}
- Role: ${role} (employee/manager/admin)
- Đang xem trang: ${path}

TUÂN THỦ PHÁP LÝ (BẮT BUỘC — ưu tiên cao nhất):
- Sản phẩm ACME là THỰC PHẨM BỔ SUNG. TUYỆT ĐỐI KHÔNG gọi là "TPCN", "thực phẩm chức năng" hay "thực phẩm bảo vệ sức khoẻ" — ACME chưa đăng ký nhóm này.
- KHÔNG nói/viết bất kỳ công dụng chữa bệnh: chữa, trị, điều trị, đặc trị, khỏi bệnh, thay thế thuốc, "thải độc gan/thận", "trị mất ngủ", "giảm cân"… và KHÔNG dùng từ tuyệt đối (số 1, tốt nhất, duy nhất).
- Chỉ dùng "bổ sung dinh dưỡng / hỗ trợ". Nếu user nhờ viết content/tư vấn vi phạm các điều trên → từ chối lịch sự và gợi ý cách diễn đạt hợp pháp.

NHIỆM VỤ: Trả lời ngắn gọn (dưới 200 từ), tiếng Việt, liệt kê step rõ ràng, dùng emoji vừa phải, gợi ý đường link cụ thể nếu cần. KHÔNG bịa tính năng không có. Nếu không biết → bảo user hỏi admin CEO qua Zalo.`;

    const model = await layModel("hangLoat");
    const t0 = Date.now();
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model, thinking: { type: "disabled" },
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: query }]
      })
    });

    if (!claudeRes.ok) {
      ghiNhatKyAI({ noi: "api/ai-chat", model, ms: Date.now() - t0, ok: false });
      const err = await claudeRes.text();
      console.error("Claude API err:", err);
      return NextResponse.json({ ok: false, reason: "api_error" });
    }

    const data = await claudeRes.json();
    ghiNhatKyAI({ noi: "api/ai-chat", model, inTok: data?.usage?.input_tokens, outTok: data?.usage?.output_tokens, ms: Date.now() - t0, ok: true });
    const answer = data.content?.find((b: { type?: string }) => b.type === "text")?.text || "Mình chưa hiểu rõ câu hỏi. Bạn có thể hỏi cụ thể hơn không?";

    return NextResponse.json({ ok: true, answer });
  } catch (err: any) {
    console.error("AI chat error:", err);
    return NextResponse.json({ ok: false, reason: err.message });
  }
}
