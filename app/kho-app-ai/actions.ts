"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { loadApps, logAppUse, LUAT_CHUNG } from "@/lib/ai-apps";
import { callClaude, MODEL_FAST } from "@/lib/covan/advisor";

type Turn = { role: "user" | "assistant"; content: string };

export async function chatAction(appCode: string, turns: Turn[]): Promise<{ ok: boolean; reply?: string; error?: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };

  const apps = await loadApps();
  const app = apps.find((a) => a.code === appCode);
  if (!app) return { ok: false, error: "Không tìm thấy app này" };
  if (!turns.length) return { ok: false, error: "Chưa có nội dung" };

  const system = `${app.system}\n\n${LUAT_CHUNG}`;
  try {
    const reply = await callClaude(turns.slice(-12), system, 4000, undefined, MODEL_FAST);
    if (!reply.trim()) return { ok: false, error: "AI không trả về nội dung, anh chị thử lại giúp em" };

    const sb = getServiceClient();
    const { data: me } = await sb.from("users").select("full_name").eq("id", user.id).maybeSingle();
    await logAppUse({
      at: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " "),
      app: app.ten,
      user: (me as any)?.full_name || "",
      q: turns[turns.length - 1].content.slice(0, 300),
      a: reply.slice(0, 400),
    });
    return { ok: true, reply };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) };
  }
}
