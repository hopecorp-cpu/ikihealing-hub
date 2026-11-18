import { findBanned, sanitizeContent } from "@/lib/banned-words";
import { lyDoDung } from "@/lib/dung-khan-cap";

const G = "https://graph.facebook.com/v21.0";

export type PublishResult = { ok: boolean; postId?: string; url?: string; error?: string; banned?: string[] };

function userToken() {
  return (process.env.FB_ADS_TOKEN || process.env.FB_USER_TOKEN || "").trim();
}

export async function getPageToken(pageId?: string): Promise<{ id: string; name: string; token: string } | null> {
  const ut = userToken();
  if (!ut) return null;
  const pid = (pageId || process.env.FB_PAGE_ID || "").trim();
  try {
    const j: any = await (await fetch(`${G}/me/accounts?fields=name,access_token&limit=25&access_token=${encodeURIComponent(ut)}`, { cache: "no-store" })).json();
    const pages = j.data || [];
    if (!pages.length) return null;
    const p = pid ? pages.find((x: any) => x.id === pid) : pages[0];
    if (!p) return null;
    return { id: p.id, name: p.name, token: p.access_token || ut };
  } catch { return null; }
}

/**
 * Đăng 1 bài chữ (kèm ảnh nếu có link ảnh công khai).
 * @param message nội dung NGƯỜI ĐÃ DUYỆT — không tự sửa
 * @param imageUrl link ảnh công khai (tuỳ chọn). Có ảnh -> đăng dạng photo, bài mới lên tương tác tốt hơn.
 */
export async function publishToPage(message: string, imageUrl?: string, pageId?: string): Promise<PublishResult> {
  const text = String(message || "").trim();
  if (!text) return { ok: false, error: "Nội dung rỗng" };
  const dung = await lyDoDung("dang_bai");
  if (dung) return { ok: false, error: dung };

  const banned = findBanned(text);
  if (banned.length) {
    return { ok: false, error: `Bài còn từ vi phạm quy định thực phẩm bổ sung: ${banned.join(", ")}. Sửa rồi đăng lại.`, banned };
  }

  const page = await getPageToken(pageId);
  if (!page) return { ok: false, error: "Không lấy được quyền trang (kiểm FB_USER_TOKEN / FB_PAGE_ID)" };

  try {

    const body: Record<string, string> = { message: text, access_token: page.token };
    if (imageUrl) {
      const up: any = await (await fetch(`${G}/${page.id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: imageUrl, published: "false", access_token: page.token }),
        cache: "no-store",
      })).json().catch(() => ({}));
      if (up.error || !up.id) return { ok: false, error: `Facebook từ chối ảnh: ${up.error?.message || "không trả mã ảnh"}` };
      body["attached_media[0]"] = JSON.stringify({ media_fbid: up.id });
    }

    const res = await fetch(`${G}/${page.id}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    if (j.error) return { ok: false, error: `Facebook từ chối: ${j.error.message}` };

    const postId = j.post_id || j.id;
    if (!postId) return { ok: false, error: "Facebook không trả về mã bài — coi như CHƯA đăng." };
    return { ok: true, postId, url: `https://www.facebook.com/${String(postId).replace("_", "/posts/")}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function commentOnPost(postId: string, message: string, pageId?: string): Promise<{ ok: boolean; error?: string }> {
  const text = String(message || "").trim();
  if (!text || !postId) return { ok: false, error: "thiếu nội dung hoặc mã bài" };
  const banned = findBanned(text);
  if (banned.length) return { ok: false, error: `bình luận còn từ cấm: ${banned.join(", ")}` };
  const page = await getPageToken(pageId);
  if (!page) return { ok: false, error: "không lấy được quyền trang" };
  try {
    const j: any = await (await fetch(`${G}/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message: text, access_token: page.token }),
      cache: "no-store",
    })).json().catch(() => ({}));
    if (j.error || !j.id) return { ok: false, error: j.error?.message || "không trả mã bình luận" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
