import { getServiceClient } from "@/lib/supabase-server";
import { loadLiveCampaign, addMemories } from "./state";
import { callClaude } from "./advisor";
import { covanSendDocumentCEO, covanSendCEO } from "./telegram";
import type { Measured } from "./learning";

export const isCampaignRec = (title: string) => title.startsWith("Đo chiến dịch:");

async function afterActionFacts(m: Measured): Promise<string> {
  const lines: string[] = [
    "# KẾT QUẢ ĐO",
    `- ${m.title}`,
    `- Phán quyết máy: ${m.verdict.toUpperCase()} — ${m.outcome}`,
    "- Lưu ý nguồn: doanh thu MISA trễ 3-5 ngày COD, số có thể còn lên.",
  ];
  const live = await loadLiveCampaign();
  if (live) {
    lines.push("", `# KẾ HOẠCH ĐÃ CHẠY: ${live.goal}`, `- Bắt đầu: ${live.started_at}`);
    const ai = live.items.filter((i) => i.kind === "ai");
    lines.push(`- Máy làm: ${ai.filter((i) => i.status === "xong").length}/${ai.length} xong, ${ai.filter((i) => i.status === "loi").length} lỗi`);

    const human = live.items.filter((i) => i.kind === "human");
    const ids = human.filter((i) => i.task_id).map((i) => i.task_id as string);
    const state = new Map<string, { status: string; acknowledged: boolean | null }>();
    if (ids.length) {
      try {
        const sb = getServiceClient();
        const { data } = await sb.from("tasks").select("id,status,acknowledged").in("id", ids);
        for (const t of data || []) state.set(String(t.id), { status: t.status || "todo", acknowledged: t.acknowledged });
      } catch {  }
    }
    lines.push("", "# VIỆC NGƯỜI THẬT (đối chiếu bảng tasks)");
    for (const h of human) {
      const t = h.task_id ? state.get(h.task_id) : undefined;
      const st = t ? (t.status === "done" ? "XONG" : t.acknowledged ? `đã nhận, đang ${t.status}` : "CHƯA NHẬN") : "không soi được";
      lines.push(`- ${h.title} — ${st}`);
    }
  } else {
    lines.push("", "# KẾ HOẠCH: bảng chiến dịch sống không còn (đã chạy chiến dịch khác đè lên?)");
  }
  return lines.join("\n");
}

export async function sendAfterActionReport(m: Measured): Promise<boolean> {
  try {
    const facts = await afterActionFacts(m);
    let body = facts;
    let lesson = `Chiến dịch đo ${m.verdict.toUpperCase()}: ${m.outcome}`;
    try {
      const out = await callClaude(
        [{ role: "user", content: facts }],
        "Bạn là cố vấn kinh doanh AI của ACME, xưng 'em', gọi CEO là 'anh'. " +
          "Từ dữ liệu sau trận dưới đây, viết BÁO CÁO SAU TRẬN dạng markdown gồn đúng 4 mục: " +
          "## Kết quả vs kế hoạch (số thật vs mục tiêu, việc xong/chưa), " +
          "## Lệch ở đâu (mắt xích nào hụt, việc người thật nào chưa nhận/chưa xong), " +
          "## Điều chỉnh ngay (tối đa 3 việc, giao đúng người), " +
          "## Bài học (1-2 dòng, dạng luật nhớ được cho trận sau). " +
          "TUYỆT ĐỐI không thêm con số ngoài dữ liệu. KHÔNG emoji. Tiếng Việt đủ dấu. " +
          "Dòng CUỐI CÙNG của bài viết đúng định dạng: BAI-HOC: <nội dung bài học 1 câu>",
        4000
      );
      if (out.trim()) {
        body = out.trim();
        const mm = body.match(/BAI-HOC:\s*(.+)\s*$/);
        if (mm) lesson = mm[1].trim();
      }
    } catch {  }

    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const doc = `# BÁO CÁO SAU TRẬN — ${day}\n\n${body}\n\n---\nNguồn: covan_recs #${m.id}, bảng chiến dịch sống, bảng tasks, P&L MISA.`;
    const sent = await covanSendDocumentCEO(`bao-cao-sau-tran-${day}.md`, doc);
    if (!sent.ok) await covanSendCEO(`BÁO CÁO SAU TRẬN (gửi file lỗi ${sent.error || ""}, bản rút gọn):\n\n${body.slice(0, 3000)}`);
    await addMemories([{ kind: "procedural", content: `[Bài học sau trận] ${lesson}` }]);
    return true;
  } catch {
    return false;
  }
}
