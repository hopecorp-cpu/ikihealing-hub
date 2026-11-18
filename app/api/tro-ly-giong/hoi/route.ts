import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { askGemini } from "@/lib/gemini";
import { layModel } from "@/lib/ai-model";
import { ACME_IDENTITY, buildLiveContext } from "@/lib/acme-brain";
import { SKILL_DECLS, runSkill } from "@/lib/brain-skills";
import { LUAT_GIONG } from "@/lib/tro-ly-giong";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Turn = { role: "user" | "model"; text: string };

let soLieu: { luc: number; text: string } | null = null;
async function laySoLieu(): Promise<string> {
  if (soLieu && Date.now() - soLieu.luc < 60_000) return soLieu.text;
  const text = await buildLiveContext().catch(() => "");
  soLieu = { luc: Date.now(), text };
  return text;
}

const choPhep = (role?: string) => role === "ceo" || role === "admin";

const TOOLS = SKILL_DECLS.map((d) => ({ name: d.name, description: d.description || "", input_schema: d.parameters || { type: "object", properties: {} } }));

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !choPhep(user.role)) return NextResponse.json({ error: "Chỉ CEO dùng được" }, { status: 403 });
  await laySoLieu();
  return NextResponse.json({ ok: true });
}

type KhoiTra = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: any };

async function claudeStream(
  body: Record<string, unknown>, day: (chu: string) => void, signal: AbortSignal,
): Promise<{ ok: boolean; khoi: KhoiTra[]; dung: string }> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) return { ok: false, khoi: [], dung: "missing_key" };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ ...body, stream: true }), cache: "no-store", signal,
  }).catch(() => null);
  if (!res || !res.ok || !res.body) return { ok: false, khoi: [], dung: `http_${res?.status || 0}` };

  const khoi: KhoiTra[] = [];
  const jsonDo: Record<number, string> = {};
  let dung = "";
  const doc = res.body.getReader();
  const giai = new TextDecoder();
  let dem = "";
  for (;;) {
    const { value, done } = await doc.read();
    if (done) break;
    dem += giai.decode(value, { stream: true });
    let i: number;
    while ((i = dem.indexOf("\n\n")) >= 0) {
      const su = dem.slice(0, i); dem = dem.slice(i + 2);
      const dong = su.split("\n").find((l) => l.startsWith("data:"));
      if (!dong) continue;
      let e: any; try { e = JSON.parse(dong.slice(5)); } catch { continue; }
      if (e.type === "content_block_start") {
        const b = e.content_block;
        if (b?.type === "text") khoi[e.index] = { type: "text", text: "" };
        else if (b?.type === "tool_use") { khoi[e.index] = { type: "tool_use", id: b.id, name: b.name, input: {} }; jsonDo[e.index] = ""; }
      } else if (e.type === "content_block_delta") {
        const k = khoi[e.index];
        if (e.delta?.type === "text_delta" && k?.type === "text") { k.text += e.delta.text; day(e.delta.text); }
        else if (e.delta?.type === "input_json_delta") jsonDo[e.index] = (jsonDo[e.index] || "") + e.delta.partial_json;
      } else if (e.type === "content_block_stop") {
        const k = khoi[e.index];
        if (k?.type === "tool_use") { try { k.input = JSON.parse(jsonDo[e.index] || "{}"); } catch { k.input = {}; } }
      } else if (e.type === "message_delta") {
        dung = e.delta?.stop_reason || dung;
      } else if (e.type === "error") {
        return { ok: false, khoi, dung: e.error?.type || "error" };
      }
    }
  }
  return { ok: true, khoi: khoi.filter(Boolean), dung };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !choPhep(user.role)) return NextResponse.json({ error: "Chỉ CEO dùng được" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const text = String(b.text || "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "Chưa nghe thấy gì" }, { status: 400 });
  const history: Turn[] = (Array.isArray(b.history) ? b.history : [])
    .filter((t: any) => (t?.role === "user" || t?.role === "model") && typeof t?.text === "string")
    .slice(-16)
    .map((t: any) => ({ role: t.role, text: String(t.text).slice(0, 2000) }));

  const t0 = Date.now();
  const system = ACME_IDENTITY + (await laySoLieu()) + LUAT_GIONG;
  const model = await layModel("thuong");

  const msgs: Array<{ role: "user" | "assistant"; content: any }> = [];
  for (const t of history) {
    const role = t.role === "model" ? "assistant" : "user";
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content += "\n\n" + t.text; else msgs.push({ role, content: t.text });
  }
  if (msgs.length && msgs[0].role === "assistant") msgs.shift();
  if (msgs.length && msgs[msgs.length - 1].role === "user") msgs[msgs.length - 1].content += "\n\n" + text;
  else msgs.push({ role: "user", content: text });

  const goc: Record<string, unknown> = { model, max_tokens: 1200, system, tools: TOOLS, output_config: { effort: "low" } };

  if (/^claude-sonnet-5-5/.test(model)) goc.thinking = { type: "between_tools" };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const gui = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const day = (v: string) => gui({ t: "chu", v });
      const huy = new AbortController();
      const hen = setTimeout(() => huy.abort(), 50_000);
      let nao = "claude";
      try {
        let r = await claudeStream({ ...goc, messages: msgs }, day, huy.signal);
        const goi = r.khoi.find((k) => k.type === "tool_use") as Extract<KhoiTra, { type: "tool_use" }> | undefined;
        if (r.ok && goi) {
          gui({ t: "viec", v: goi.name });
          const ketQua = await runSkill({ name: goi.name, args: goi.input || {} }, { name: user.full_name || "CEO", userId: user.id, laCeo: true });
          r = await claudeStream({
            ...goc,
            messages: [...msgs,
              { role: "assistant", content: r.khoi },
              { role: "user", content: [{ type: "tool_result", tool_use_id: goi.id, content: ketQua.slice(0, 6000) }] }],
          }, day, huy.signal);
          if (!r.ok) day(ketQua.slice(0, 600));
        } else if (!r.ok) {
          const g = await askGemini(system, history, text, { maxOutputTokens: 1500 });
          nao = "gemini";
          if (g.ok && g.text) day(g.text); else gui({ t: "loi", v: "Bộ não đang lỗi, anh hỏi lại giúp em" });
        }
        gui({ t: "xong", nao, ms: Date.now() - t0 });
      } catch {
        gui({ t: "loi", v: "Mất kết nối giữa chừng, anh hỏi lại giúp em" });
      } finally {
        clearTimeout(hen);
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
