import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { askClaudeTools, claudeBrainConfigured } from "@/lib/claude-brain";
import { ACME_IDENTITY, buildLiveContext } from "@/lib/acme-brain";
import { SKILL_DECLS, runSkill } from "@/lib/brain-skills";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEN_HOP_LE = new Set([...SKILL_DECLS.map((d) => d.name), "hoi_claude"]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ceo" && user.role !== "admin")) return NextResponse.json({ error: "Chỉ CEO dùng được" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "");
  const args = b.args && typeof b.args === "object" ? b.args : {};
  if (!TEN_HOP_LE.has(name)) return NextResponse.json({ result: `Không có công cụ "${name}".` });

  if (name === "hoi_claude") {
    if (!claudeBrainConfigured()) return NextResponse.json({ result: "Bộ não Claude chưa sẵn sàng." });
    const live = await buildLiveContext().catch(() => "");
    const r = await askClaudeTools(
      ACME_IDENTITY + live + "\n\nTrả lời để được ĐỌC THÀNH TIẾNG: không markdown, tối đa 8 câu, ý chính trước.",
      [], String(args.cau_hoi || "").slice(0, 2000), [], { maxTokens: 3000, thinkingBudget: 2048, timeoutMs: 50_000 },
    );
    return NextResponse.json({ result: r.ok && r.text ? r.text : "Bộ não chiến lược đang lỗi, anh hỏi lại sau giúp em." });
  }
  const result = await runSkill({ name, args }, { name: user.full_name || "CEO", userId: user.id, laCeo: true });
  return NextResponse.json({ result: result.slice(0, 6000) });
}
