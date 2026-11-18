import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { getQuizSubmissions } from "@/lib/quiz-leads";
import { resendConfigured } from "@/lib/resend";
import { getServiceClient } from "@/lib/supabase-server";
import { activeUsers, CEO_NAME } from "@/lib/covan/delegation";

const KEY = "quiz_recheck";
export const QUIZ_URL = "https://example.com/quiz";

export const MOC_NGAY = [30, 90] as const;

export type RecheckItem = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profile: string;
  baseOverall: number;
  pkg?: string | null;
  dueAt: Record<string, string>;
  doneAt: Record<string, string>;
  createdAt: string;
};

async function load(): Promise<RecheckItem[]> {
  try { return JSON.parse((await getConfigValue(KEY)) || "[]"); } catch { return []; }
}
async function save(list: RecheckItem[]): Promise<void> {
  await setConfigValue(KEY, JSON.stringify(list.slice(-5000)), "Lịch hẹn khách đo lại quiz (30/90 ngày)");
}
const vnDay = (plusDays = 0) => new Date(Date.now() + 7 * 3600e3 + plusDays * 86400e3).toISOString().slice(0, 10);

export async function scheduleRecheck(input: {
  id: string; name: string; email: string; phone?: string; profile: string; overall: number; pkg?: string | null;
}): Promise<void> {
  const sub = { ...input };
  try {
    const list = await load();

    if (list.some((r) => String(r.id) === String(sub.id))) return;

    if (!sub.overall && sub.email) {
      const subs = await getQuizSubmissions().catch(() => []);
      const mine = subs.filter((s) => (s.email || "").toLowerCase() === sub.email.toLowerCase()).sort((a, b) => b.ts - a.ts)[0];
      if (mine) {
        sub.overall = mine.overall || 0;
        if (!sub.profile) sub.profile = mine.profile || "";
      }
    }
    const dueAt: Record<string, string> = {};
    for (const d of MOC_NGAY) dueAt[String(d)] = vnDay(d);
    list.push({
      id: sub.id, name: sub.name, email: sub.email, phone: sub.phone,
      profile: sub.profile, baseOverall: sub.overall, pkg: sub.pkg ?? null,
      dueAt, doneAt: {}, createdAt: vnDay(),
    });
    await save(list);
  } catch {  }
}

function mailHtml(name: string, days: number, baseOverall: number): string {
  const link = `${QUIZ_URL}?again=1`;
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1C2420">
    <p>Chào ${name || "bạn"},</p>
    <p>Đã ${days} ngày kể từ lần đầu bạn làm bài kiểm tra nếp sống cùng NOVA. Lần đó bạn ở mức <b>${baseOverall}/100</b>.</p>
    <p>Hôm nay là lúc hợp lý để làm lại bài kiểm tra — mất khoảng 2 phút, và bạn sẽ thấy rõ những thói quen nào đã đổi,
    thói quen nào còn dở dang.</p>
    <p style="margin:22px 0"><a href="${link}" style="background:#0F766E;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:600">Làm lại bài kiểm tra nếp sống</a></p>
    <p>Sau khi có kết quả mới, đội đồng hành của NOVA sẽ nhắn bạn vài gợi ý cho chặng tiếp theo.</p>
    <p style="color:#5C6B63;font-size:13px;margin-top:26px">Bài kiểm tra phản ánh nếp sinh hoạt bạn tự đánh giá, không phải chỉ số y tế và không thay thế thăm khám.<br/>
    NOVA — Công ty Cổ phần ACME.</p>
  </div>`;
}

export async function sweepRecheck(): Promise<{ due: number; mailed: number; tasked: number; chan?: number }> {
  const list = await load();
  const today = vnDay();
  const due = list.filter((r) => MOC_NGAY.some((d) => !r.doneAt[String(d)] && (r.dueAt[String(d)] || "9999") <= today));
  if (!due.length) return { due: 0, mailed: 0, tasked: 0 };

  let mailed = 0, chan = 0;
  const lines: string[] = [];
  for (const r of due.slice(0, 40)) {
    const moc = MOC_NGAY.find((d) => !r.doneAt[String(d)] && (r.dueAt[String(d)] || "9999") <= today)!;
    if (r.email && resendConfigured()) {

      const { guiEmailNuoi } = await import("@/lib/blog-nurture");

      const sent = await guiEmailNuoi(r.email, `Đã ${moc} ngày — làm lại bài kiểm tra nếp sống của bạn nhé`, mailHtml(r.name, moc, r.baseOverall) + `<p style="font-size:11px;color:#98a2b3">Không muốn nhận email từ NOVA nữa? <a href="{{LINK_HUY}}" style="color:#98a2b3">Bấm vào đây để ngừng nhận</a>.</p>`, { quangCao: false, nhip: { luong: "quiz-recheck", mau: `moc-${moc}`, neuSanPham: false } }).catch(() => ({ ok: false } as any));
      if (sent?.boQua && /^tran-|^thieu-nhat-ky/.test(String(sent.boQua))) { chan++; continue; }
      if (sent?.ok) mailed++;
    }
    r.doneAt[String(moc)] = today;
    lines.push(`- ${r.name}${r.phone ? ` (${r.phone})` : ""} — mốc ${moc} ngày, điểm lần đầu ${r.baseOverall}/100${r.pkg ? `, đã mua ${r.pkg}` : ""}`);
  }
  await save(list);

  let tasked = 0;
  try {
    const users = await activeUsers();
    const ceo = users.find((u) => u.full_name === CEO_NAME);
    const cskh = users.find((u) => /cskh|chăm sóc|trực page/i.test(u.position || "")) || ceo;
    if (cskh && lines.length) {
      const sb = getServiceClient();
      const { error } = await sb.from("tasks").insert({
        title: `[Đo lại nếp sống] Nhắn ${lines.length} khách làm lại bài kiểm tra`,
        description:
          "Khách đã mua gói qua quiz và tới mốc đo lại. Nhắn Zalo mời làm lại bài (link: " + QUIZ_URL + "?again=1).\n\n" +
          lines.join("\n") +
          "\n\nMẫu tin: \"Dạ đã " + "[số]" + " ngày từ lần anh/chị làm bài kiểm tra nếp sống rồi ạ. Anh/chị làm lại 2 phút để mình xem thói quen nào đã đổi nhé, em gửi link đây ạ.\"\n" +
          "LUẬT: chỉ nói về THÓI QUEN và nếp sinh hoạt, không nói sản phẩm làm khỏi bệnh hay giảm chỉ số nào.",
        assigner_id: ceo?.id || cskh.id,
        assignee_id: cskh.id,
        priority: "medium",
        status: "todo",
        due_date: vnDay(2),
        tags: ["do-lai-quiz"],
      });
      if (!error) tasked = lines.length;
    }
  } catch {  }

  return { due: due.length, mailed, tasked, chan };
}

export async function compareWithFirst(email: string, newOverall: number): Promise<{
  first: number; latestBefore: number; delta: number; days: number; times: number; profileChanged: boolean; prevProfile: string;
} | null> {
  const subs = await getQuizSubmissions();
  const mine = subs.filter((s) => (s.email || "").toLowerCase() === email.toLowerCase()).sort((a, b) => a.ts - b.ts);

  if (mine.length < 2) return null;
  const first = mine[0];
  const prev = mine[mine.length - 1];
  const days = Math.round((Date.now() - first.ts) / 86400e3);
  return {
    first: first.overall,
    latestBefore: prev.overall,
    delta: newOverall - first.overall,
    days,
    times: mine.length,
    profileChanged: !!prev.profile && !!first.profile && prev.profile !== first.profile,
    prevProfile: prev.profile || "",
  };
}
