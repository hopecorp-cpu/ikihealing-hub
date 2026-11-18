import { geminiKey } from "@/lib/gemini";

export const MODEL_LIVE = () => (process.env.GEMINI_LIVE_MODEL || "").trim() || "gemini-3.8-live";

export const GIONG_LIVE: ReadonlyArray<{ id: string; ten: string }> = [
  { id: "Achernar", ten: "Achernar (mềm, ngọt)" },
  { id: "Vindemiatrix", ten: "Vindemiatrix (dịu dàng)" },
  { id: "Despina", ten: "Despina (mượt)" },
  { id: "Autonoe", ten: "Autonoe (trong trẻo)" },
  { id: "Callirrhoe", ten: "Callirrhoe (nhẹ nhàng)" },
  { id: "Leda", ten: "Leda (trẻ trung)" },
];
export const giongLiveHopLe = (id: string) => GIONG_LIVE.some((g) => g.id === id);

export const LUAT_LIVE = `

CHẾ ĐỘ GỌI THOẠI (1-1 với CEO, bạn đang NÓI bằng giọng, không phải viết):
- Luôn nói tiếng Việt, xưng em gọi anh. Câu ngắn, tự nhiên như người trợ lý thật: 1-3 câu, ý quan trọng nhất trước.
- Số tiền nói kiểu người Việt: "12 triệu 5", "1 tỷ 2"; phần trăm làm tròn.
- Chỉ dùng số trong khối số liệu sống; không có thì nói thẳng là chưa có số, không đoán.
- Anh giao việc thì GỌI CÔNG CỤ ngay rồi nói lại ngắn: đã làm gì, giao cho ai, hạn ngày nào. Tên người nghe không rõ thì hỏi lại một câu trước khi giao.
- LUẬT CỨNG: CẤM nói "đã giao", "đã làm", "xong rồi" khi CHƯA gọi công cụ và CHƯA nhận kết quả. Kết quả công cụ báo lỗi thì nói thật là chưa làm được.
- Câu hỏi chiến lược, phân tích sâu, cần suy nghĩ lâu: gọi công cụ hoi_claude, chờ kết quả rồi tóm lại bằng lời.
- Việc không có công cụ (gửi tin cho khách, đổi tiền quảng cáo) thì nói rõ là chưa làm được bằng giọng.
- Anh nói chen thì dừng ngay, nghe anh.`;

export const HOI_CLAUDE_DECL = {
  name: "hoi_claude",
  description: "Hỏi bộ não chiến lược (Claude) cho câu khó: phân tích, chiến lược, so sánh phương án, kế hoạch. Trả về câu trả lời để bạn tóm lại bằng lời.",
  parameters: { type: "object", properties: { cau_hoi: { type: "string", description: "Câu hỏi đầy đủ, kèm bối cảnh anh vừa nói" } }, required: ["cau_hoi"] },
};

export async function taoTokenLive(setup: Record<string, unknown>): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const key = geminiKey();
  if (!key) return { ok: false, error: "missing_key" };
  const now = Date.now();
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(now + 60_000).toISOString(),

      bidiGenerateContentSetup: setup,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!r) return { ok: false, error: "network" };
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.name) return { ok: false, error: `token_${r.status}` };
  return { ok: true, token: String(j.name) };
}
