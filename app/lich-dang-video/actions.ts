"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { addToQueue, setQueueStatus, PAGES, type VideoStatus } from "@/lib/video-queue";
import { callClaude, MODEL_FAST } from "@/lib/covan/advisor";
import { findBanned } from "@/lib/banned-words";
import { revalidatePath } from "next/cache";

async function guard(): Promise<{ ok: boolean; error?: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role, position").eq("id", user.id).maybeSingle();
  if (!me || (!isManagerOrAbove((me as any).role) && !isMktPosition((me as any).position))) {
    return { ok: false, error: "Chỉ quản lý hoặc phòng Marketing dùng được" };
  }
  return { ok: true };
}

export async function addAction(input: { file: string; title: string; caption: string; pageId: string; publishAt: string }) {
  const g = await guard(); if (!g.ok) return g;
  const r = await addToQueue(input);
  if (r.ok) revalidatePath("/lich-dang-video");
  return r;
}

export async function statusAction(id: string, status: VideoStatus) {
  const g = await guard(); if (!g.ok) return g;
  const r = await setQueueStatus(id, status);
  if (r.ok) revalidatePath("/lich-dang-video");
  return r;
}

export async function captionAction(fileName: string, pageId: string): Promise<{ ok: boolean; title?: string; caption?: string; error?: string }> {
  const g = await guard(); if (!g.ok) return { ok: false, error: g.error };
  const page = PAGES.find((p) => p.id === pageId);
  try {
    const out = await callClaude(
      [{ role: "user", content: `Tên file video: ${fileName}\nFanpage sẽ đăng: ${page?.name || ""}` }],
      "Bạn viết nội dung cho fanpage của ACME (đạm thực vật là thực phẩm bổ sung; hai loại trà là trà thảo mộc, KHÔNG phải thực phẩm bổ sung). " +
        "Nhận tên file video, đoán chủ đề rồi viết: dòng 1 là TIÊU ĐỀ ngắn dưới 60 ký tự, các dòng sau là CAPTION 3-5 câu. " +
        "Hook ở câu đầu chạm nỗi đau lối sống thật, thân bài cho giá trị, kết bằng lời mời nhẹ nhàng. " +
        "LUẬT BẮT BUỘC: không dùng từ chữa, trị, điều trị, khỏi bệnh, thải độc; không hứa hiệu quả sau bao nhiêu ngày; " +
        "khuyến mãi nếu có thì nói TẶNG QUÀ, không giảm phần trăm; KHÔNG emoji; tiếng Việt đủ dấu. " +
        "Chỉ trả về tiêu đề và caption, không giải thích gì thêm.",
      1200, undefined, MODEL_FAST
    );
    const lines = out.trim().split("\n").filter((l) => l.trim());
    if (!lines.length) return { ok: false, error: "AI không trả về nội dung" };
    const title = lines[0].replace(/^(tiêu đề|title)\s*:?\s*/i, "").trim().slice(0, 90);
    const caption = lines.slice(1).join("\n").replace(/^(caption|mô tả)\s*:?\s*/i, "").trim();
    const banned = findBanned(`${title}\n${caption}`);
    if (banned.length) return { ok: false, error: `AI viết dính từ cấm (${banned.join(", ")}) — bấm viết lại giúp em.` };
    return { ok: true, title, caption };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 150) };
  }
}
