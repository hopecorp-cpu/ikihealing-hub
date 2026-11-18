import { getConfigValue, setConfigValue } from "@/lib/app-config";

export type QuizSubmission = {
  id: string;
  ts: number;
  name: string;
  email: string;
  phone?: string;
  profile: string;
  profileName?: string;
  overall: number;
  dims: Record<string, number>;
  answers: number[];
  pkg?: string | null;
  vat?: { company?: string; taxCode?: string; email?: string } | null;
  source: string;
};

const KEY = "quiz_submissions";

export async function getQuizSubmissions(): Promise<QuizSubmission[]> {
  const raw = await getConfigValue(KEY);
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

export async function saveQuizSubmission(rec: Omit<QuizSubmission, "id" | "ts">): Promise<QuizSubmission> {
  const list = await getQuizSubmissions();
  const item: QuizSubmission = {
    ...rec,
    id: `q_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    ts: Date.now(),
  };
  list.push(item);

  await setConfigValue(KEY, JSON.stringify(list.slice(-10000)), "Hồ sơ khách từ quiz thể trạng NOVA");
  return item;
}

export function sdtQuiz(p?: string | null): string | null {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (!d.startsWith("0")) d = "0" + d;
  return /^0(3|5|7|8|9)\d{8}$/.test(d) ? d : null;
}

export async function dayQuizSangSale(
  sb: any,
  rec: Pick<QuizSubmission, "name" | "phone" | "email" | "profile" | "profileName" | "overall" | "dims" | "source" | "pkg">,
  opts?: { notify?: boolean;  tinTuVan?: boolean },
): Promise<{ ok: boolean; id?: string; dedup?: boolean; error?: string } | null> {
  const phone = sdtQuiz(rec.phone);
  if (!phone) return null;
  const { insertAndAssign } = await import("@/lib/leads");
  const yeu = Object.entries(rec.dims || {})
    .filter(([, v]) => Number(v) < 67)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}`);

  const note = [
    opts?.tinTuVan ? "" : "[CHƯA đồng ý nhận tin tư vấn/QC — chỉ gửi thực đơn đã hứa, KHÔNG chào hàng]",
    `Quiz thể trạng: ${rec.profileName || rec.profile || "?"} · ${rec.overall}/100`,
    yeu.length ? `${yeu.length} chỉ số cần ưu tiên (xem ở /quiz-leads)` : "",
    rec.pkg ? `đã chọn gói ${rec.pkg}` : "",
    rec.email ? `email ${rec.email}` : "",
  ].filter(Boolean).join(" · ").slice(0, 300);
  return insertAndAssign(sb, {
    customer_name: rec.name || null,
    phone,
    channel: "quiz",
    source: rec.source || "quiz",
    external_id: `quiz:${phone}`,
    note,
  }, opts);
}
