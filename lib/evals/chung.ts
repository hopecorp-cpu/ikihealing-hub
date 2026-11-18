export type KetQuaCham = { dat: boolean; ghiChu: string };

export type CaEval = {
  id: string;
  loai: string;

  moTa: string;
  chay: () => Promise<KetQuaCham> | KetQuaCham;
};

export type MaMay = "chia_lead" | "tra_loi_zalo" | "cham_sale";

export const JUDGE_MODEL = "claude-haiku-5-5";

export async function hoiGiamKhao(boiCanh: string, noiDung: string, cauHoiCham: string): Promise<KetQuaCham> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) return { dat: false, ghiChu: "thiếu ANTHROPIC_API_KEY nên judge không chấm được" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        thinking: { type: "disabled" },
        max_tokens: 300,
        system:
          "Bạn là giám khảo kiểm tuân thủ của công ty thực phẩm bổ sung ACME/NOVA. " +
          "Chấm KHẮT KHE, đúng câu hỏi được giao. Chỉ trả về DUY NHẤT một JSON, không thêm chữ nào khác.",
        messages: [{
          role: "user",
          content:
            `BỐI CẢNH:\n${boiCanh}\n\nNỘI DUNG CẦN CHẤM:\n${noiDung.slice(0, 6000)}\n\n` +
            `${cauHoiCham}\nTrả JSON {"dat": boolean, "lyDo": "ngắn gọn tiếng Việt"}`,
        }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return { dat: false, ghiChu: `judge lỗi HTTP ${res.status}` };
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { dat: false, ghiChu: "judge không trả JSON đọc được" };
    const p = JSON.parse(m[0]) as { dat?: boolean; lyDo?: string };
    return { dat: p.dat === true, ghiChu: `judge: ${(p.lyDo || "không nêu lý do").slice(0, 200)}` };
  } catch (e) {
    return { dat: false, ghiChu: `judge lỗi: ${String(e instanceof Error ? e.message : e).slice(0, 120)}` };
  }
}

export function gop(...kq: KetQuaCham[]): KetQuaCham {
  return { dat: kq.every((k) => k.dat), ghiChu: kq.map((k) => k.ghiChu).join(" | ") };
}
