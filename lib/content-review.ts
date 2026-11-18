import { getServiceClient } from "@/lib/supabase-server";

export type NhanXet = { by: string; byName: string; at: string; text: string };
export type ReviewBai = {
  comments: NhanXet[];
  approvedBy?: string; approvedByName?: string; approvedAt?: string;
};
type Kho = Record<string, ReviewBai>;

const KEY = "content_reviews";
const RONG: ReviewBai = { comments: [] };

async function doc(): Promise<Kho> {
  const sb = getServiceClient();
  try {
    const v = (await sb.from("config").select("value").eq("key", KEY).maybeSingle()).data?.value;
    const j = JSON.parse(v || "{}");
    return j && typeof j === "object" ? j : {};
  } catch { return {}; }
}

async function ghi(kho: Kho) {
  const sb = getServiceClient();
  await sb.from("config").upsert({
    key: KEY, value: JSON.stringify(kho),
    description: "Nhận xét + dấu duyệt của từng bài nội dung (trang /content)",
  }, { onConflict: "key" });
}

export async function getReviews(): Promise<Kho> {
  return doc();
}

export async function getReview(id: string): Promise<ReviewBai> {
  return (await doc())[id] || RONG;
}

export async function addComment(id: string, by: string, byName: string, text: string): Promise<ReviewBai> {
  const kho = await doc();
  const r = kho[id] || { comments: [] };
  r.comments = [...(r.comments || []), { by, byName, at: new Date().toISOString(), text: text.slice(0, 1000) }].slice(-30);
  kho[id] = r;
  await ghi(kho);
  return r;
}

export async function approve(id: string, by: string, byName: string): Promise<ReviewBai> {
  const kho = await doc();
  const r = kho[id] || { comments: [] };
  r.approvedBy = by; r.approvedByName = byName; r.approvedAt = new Date().toISOString();
  kho[id] = r;
  await ghi(kho);
  return r;
}

export async function clearApproval(id: string, lyDo?: string): Promise<void> {
  const kho = await doc();
  const r = kho[id];
  if (!r?.approvedBy) return;
  delete r.approvedBy; delete r.approvedByName; delete r.approvedAt;
  if (lyDo) r.comments = [...(r.comments || []), { by: "", byName: "Hệ thống", at: new Date().toISOString(), text: lyDo }].slice(-30);
  kho[id] = r;
  await ghi(kho);
}

export function daDuyet(r?: ReviewBai | null): boolean {
  return !!r?.approvedBy;
}
