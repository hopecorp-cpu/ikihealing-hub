import { callClaude, MODEL_FAST } from "@/lib/covan/advisor";

export type CauHoi = { id?: string; question: string; choices: string[]; correct_idx: number; explanation?: string; sort_order?: number };

export function chamBai(cauHoi: CauHoi[], traLoi: number[]): { scorePct: number; dung: boolean[] } {
  if (!cauHoi.length) return { scorePct: 0, dung: [] };
  const dung = cauHoi.map((c, i) => Number(traLoi[i]) === Number(c.correct_idx));
  const so = dung.filter(Boolean).length;
  return { scorePct: Math.round((so / cauHoi.length) * 100), dung };
}

export function cauHopLe(c: any): c is CauHoi {
  return c && typeof c.question === "string" && c.question.trim().length >= 10
    && Array.isArray(c.choices) && c.choices.length >= 2 && c.choices.length <= 6
    && c.choices.every((x: any) => typeof x === "string" && x.trim())
    && Number.isInteger(c.correct_idx) && c.correct_idx >= 0 && c.correct_idx < c.choices.length;
}

export async function maySoanDe(tieuDe: string, noiDung: string, soCau = 5): Promise<CauHoi[]> {
  const system = `Bạn soạn câu hỏi trắc nghiệm KIỂM TRA HIỂU BÀI cho nhân viên mới, tiếng Việt.

LUẬT:
- Chỉ hỏi những gì CÓ TRONG BÀI. Không hỏi kiến thức bên ngoài, không hỏi mẹo, không hỏi số liệu vụn vặt.
- Mỗi câu 4 lựa chọn, đúng MỘT đáp án. Các đáp án sai phải nghe hợp lý (không sai lộ liễu), nhưng phải sai RÕ theo nội dung bài.
- Ưu tiên câu "trong tình huống X thì làm gì" hơn câu "định nghĩa Y là gì" — nhân viên cần biết LÀM, không cần thuộc lòng.
- Mỗi câu kèm giải thích 1-2 câu vì sao đáp án đó đúng, dẫn lại ý trong bài. Giải thích là chỗ dạy.
- Trả về ĐÚNG một mảng JSON, không rào, không lời dẫn:
[{"question":"...","choices":["...","...","...","..."],"correct_idx":0,"explanation":"..."}]`;
  const user = `Soạn ${soCau} câu cho bài sau.\n\nTIÊU ĐỀ: ${tieuDe}\n\nNỘI DUNG:\n${noiDung.slice(0, 14000)}`;
  const raw = await callClaude([{ role: "user", content: user }], system, 4000, undefined, MODEL_FAST);
  const txt = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let arr: any[] = [];
  try { const j = JSON.parse(txt); arr = Array.isArray(j) ? j : j.questions || j.cau_hoi || []; }
  catch {

    const m = /\[[\s\S]*\]/.exec(txt);
    if (m) { try { arr = JSON.parse(m[0]); } catch { arr = []; } }
  }
  return arr.filter(cauHopLe).map((c, i) => ({ ...c, sort_order: i }));
}

export type TinhTrangHoc = { userId: string; ten: string; lanLam: number; diemCaoNhat: number; daDat: boolean; lanCuoi: string | null };

export async function tinhTrangTheoNguoi(sb: any, quizId: string): Promise<TinhTrangHoc[]> {
  const { data } = await sb.from("kb_quiz_attempts").select("user_id, score_pct, passed, created_at, users:user_id(full_name)")
    .eq("quiz_id", quizId).order("created_at", { ascending: false }).limit(2000);
  const m = new Map<string, TinhTrangHoc>();
  for (const a of (data || []) as any[]) {
    const cu = m.get(a.user_id) || { userId: a.user_id, ten: a.users?.full_name || a.user_id, lanLam: 0, diemCaoNhat: 0, daDat: false, lanCuoi: null };
    cu.lanLam++;
    cu.diemCaoNhat = Math.max(cu.diemCaoNhat, a.score_pct || 0);
    cu.daDat = cu.daDat || !!a.passed;
    cu.lanCuoi = cu.lanCuoi || a.created_at;
    m.set(a.user_id, cu);
  }
  return [...m.values()].sort((a, b) => Number(a.daDat) - Number(b.daDat) || b.lanLam - a.lanLam);
}
