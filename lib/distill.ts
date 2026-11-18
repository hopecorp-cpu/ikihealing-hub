import { getConfigValue } from "@/lib/app-config";
import { getAgentLearnings } from "@/lib/agent-learning";
import { getFails } from "@/lib/campaign-memory";

export type DistillProposal = {
  id: string;
  category: string;
  title: string;
  body: string;
  sourceLabel: string;
  count: number;
  access: "all" | "manager" | "ceo";
};

function hid(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "dz" + h.toString(36);
}

const AGENTS: { key: string; label: string; dept: string }[] = [
  { key: "content", label: "Nội dung (Nhà máy Content)", dept: "MKT" },
  { key: "research", label: "Nghiên cứu thị trường", dept: "MKT" },
  { key: "dispatch", label: "Điều phối chiến dịch", dept: "MKT" },
  { key: "performance", label: "Quảng cáo (Performance)", dept: "MKT" },
  { key: "sale", label: "Tư vấn bán hàng", dept: "Sale" },
];

const MIN_ITEMS = 3;

export async function buildDistillProposals(): Promise<DistillProposal[]> {
  const out: DistillProposal[] = [];

  try {
    const fails = await getFails();
    if (fails.length >= MIN_ITEMS) {

      const tally = new Map<string, number>();
      for (const f of fails) {
        const reason = (f.reason || "").split(":")[0].trim().toLowerCase();
        if (!reason) continue;
        tally.set(reason, (tally.get(reason) || 0) + 1);
      }
      const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (top.length) {
        const title = "Quy định nội dung MKT — các lỗi khiến bài bị loại";
        const body = [
          "**Nguồn:** đúc kết tự động từ Campaign Memory (các bài đã bị người duyệt bỏ hoặc dính từ cấm).",
          "",
          "Khi viết bài, TRÁNH các lỗi lặp lại nhiều nhất dưới đây:",
          ...top.map(([r, n], i) => `${i + 1}. ${r} — đã gặp ${n} lần`),
          "",
          "_Bản nháp do hệ tự soạn. Trưởng MKT rà soát, chuẩn hoá câu chữ trước khi ban hành._",
        ].join("\n");
        out.push({ id: hid(title), category: "Chính sách & Quy chế", title, body, sourceLabel: "Campaign Memory", count: fails.length, access: "manager" });
      }
    }
  } catch {  }

  for (const a of AGENTS) {
    try {
      const items = await getAgentLearnings(a.key);
      if (items.length < MIN_ITEMS) continue;
      const wins = items.filter((x) => x.kind === "win").map((x) => x.lesson);
      const ins = items.filter((x) => x.kind === "insight").map((x) => x.lesson);
      const fails = items.filter((x) => x.kind === "fail").map((x) => x.lesson);
      const title = `Chuẩn thực chiến — ${a.label}`;
      const body = [
        `**Phòng:** ${a.dept}. **Nguồn:** đúc kết tự động từ bài học agent "${a.key}" (rút từ kết quả thật).`,
        wins.length ? "\n**NÊN (đã chứng minh hiệu quả):**\n" + wins.map((l) => `- ${l}`).join("\n") : "",
        ins.length ? "\n**GHI NHẬN:**\n" + ins.map((l) => `- ${l}`).join("\n") : "",
        fails.length ? "\n**TRÁNH (đã thất bại):**\n" + fails.map((l) => `- ${l}`).join("\n") : "",
        "\n_Bản nháp do hệ tự soạn. Trưởng phòng rà soát trước khi ban hành._",
      ].filter(Boolean).join("\n");
      out.push({ id: hid(title), category: "Quy trình (SOP)", title, body, sourceLabel: `Bài học agent · ${a.key}`, count: items.length, access: "manager" });
    } catch {  }
  }

  try {
    const raw = await getConfigValue("brain_learnings");
    if (raw) {
      const o = JSON.parse(raw);
      const items: any[] = Array.isArray(o?.items) ? o.items : [];
      if (items.length >= MIN_ITEMS) {
        const title = "Sổ ghi nhớ điều hành — Giám đốc AI";
        const body = [
          "**Nguồn:** đúc kết tự động từ trí nhớ Giám đốc Kinh doanh AI (những điều đã học về cách điều hành ACME).",
          "",
          ...items.slice(0, 20).map((x: any, i: number) => `${i + 1}. ${typeof x === "string" ? x : (x.lesson || x.text || JSON.stringify(x))}`),
          "",
          "_Chỉ BOD xem. Bản nháp do hệ tự soạn._",
        ].join("\n");
        out.push({ id: hid(title), category: "Khác", title, body, sourceLabel: "Giám đốc AI", count: items.length, access: "ceo" });
      }
    }
  } catch {  }

  return out;
}
