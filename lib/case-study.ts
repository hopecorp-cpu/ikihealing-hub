import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { activeUsers, CEO_NAME } from "@/lib/covan/delegation";

const KEY_ASKED = "case_study_asked";
const KEY_STORIES = "customer_stories";
const REASK_DAYS = 90;
const MAX_ASK_PER_RUN = 5;

const MAX_OPEN_PER_SALE = 3;
const HUY_SAU_NGAY_QUA_HAN = 10;
const TAG = "case-study";

export type CustomerStory = {
  task_id: string;
  sale: string;
  customer: string;
  story: string;
  at: string;
};

const todayVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try { return JSON.parse((await getConfigValue(key)) || "") as T; } catch { return fallback; }
}

async function findFreshRepeatCustomers(): Promise<Array<{ name: string; phone: string; saleName: string; products: string; orders: number }>> {
  const sb = getServiceClient();
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);

  const rows: any[] = (await layDoanhThuNhieuThang(sb, since, new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))).rows;
  const byPhone = new Map<string, { name: string; saleName: string; products: Set<string>; orders: Map<string, string> }>();
  for (const r of rows) {
    const phone = (r.customer_phone || "").trim();
    if (!phone) continue;
    const c = byPhone.get(phone) || { name: r.customer_name || "", saleName: r.sale_name || "", products: new Set<string>(), orders: new Map<string, string>() };
    if (r.order_code) c.orders.set(r.order_code, r.order_date || "");
    if (r.product_name) c.products.add(r.product_name);
    if (r.sale_name) c.saleName = r.sale_name;
    if (r.customer_name) c.name = r.customer_name;
    byPhone.set(phone, c);
  }
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const out: Array<{ name: string; phone: string; saleName: string; products: string; orders: number }> = [];
  for (const [phone, c] of byPhone) {
    if (c.orders.size < 2) continue;
    const latest = [...c.orders.values()].sort().pop() || "";
    if (latest < weekAgo) continue;
    out.push({ name: c.name || "Khách", phone, saleName: c.saleName, products: [...c.products].slice(0, 3).join(", "), orders: c.orders.size });
  }
  return out.sort((a, b) => b.orders - a.orders);
}

export async function harvestAsk(): Promise<{ due: number; tasked: number }> {
  const all = await findFreshRepeatCustomers();
  const asked = await loadJson<Record<string, string>>(KEY_ASKED, {});
  const today = todayVN();
  const fresh = all
    .filter((c) => !asked[c.phone] || (Date.parse(today) - Date.parse(asked[c.phone])) / 86400e3 >= REASK_DAYS)
    .slice(0, MAX_ASK_PER_RUN);
  if (!fresh.length) return { due: all.length, tasked: 0 };

  const users = await activeUsers();
  const ceo = users.find((u) => u.full_name === CEO_NAME);
  const matchUser = (saleName: string) => {
    const s = (saleName || "").toLowerCase().trim();
    if (!s) return null;
    return (
      users.find((u) => u.full_name.toLowerCase() === s) ||
      users.find((u) => s.includes(u.full_name.toLowerCase()) || u.full_name.toLowerCase().includes(s)) ||
      null
    );
  };

  const sb = getServiceClient();
  const dueDate = new Date(Date.now() + 7 * 3600e3 + 3 * 86400e3).toISOString().slice(0, 10);
  const { data: dangMo, error: loiDoc } = await sb.from("tasks")
    .select("id,assignee_id,due_date,description").contains("tags", [TAG]).in("status", ["todo", "doing"]).limit(500);
  if (loiDoc) return { due: all.length, tasked: 0 };
  const hanHuy = new Date(Date.now() + 7 * 3600e3 - HUY_SAU_NGAY_QUA_HAN * 86400e3).toISOString().slice(0, 10);
  const soMo = new Map<string, number>();
  for (const t of dangMo || []) {
    if (t.due_date && t.due_date < hanHuy) {
      await sb.from("tasks").update({
        status: "cancelled",
        description: `${t.description || ""}\n\n[Máy tự huỷ ${today}] Quá hạn ${HUY_SAU_NGAY_QUA_HAN} ngày, khách đã nguội.`.slice(0, 4000),
      }).eq("id", t.id);
      continue;
    }
    soMo.set(t.assignee_id, (soMo.get(t.assignee_id) || 0) + 1);
  }
  let tasked = 0;
  for (const c of fresh) {
    const assignee = matchUser(c.saleName) || ceo;
    if (!assignee) continue;
    if ((soMo.get(assignee.id) || 0) >= MAX_OPEN_PER_SALE) continue;
    const { error } = await sb.from("tasks").insert({
      title: `[Case study] Xin cảm nhận của ${c.name} (đã mua ${c.orders} lần)`,
      description:
        `Khách ${c.name} (${c.phone}) vừa quay lại mua lần ${c.orders} (${c.products}) — khách quay lại là khách hài lòng thật, xin câu chuyện ngay lúc này là dễ nhất.\n\n` +
        `HỎI THEO MẪU (chọn 3-4 câu, hỏi qua Zalo như trò chuyện, xin phép khách cho chia sẻ lại):\n` +
        `1. Trước khi dùng, nếp sinh hoạt/ăn uống của anh chị thế nào?\n` +
        `2. Điều gì làm anh chị quyết định thử, và điều gì giữ anh chị quay lại?\n` +
        `3. Thói quen hằng ngày của anh chị thay đổi ra sao từ khi dùng (giờ giấc, bữa ăn, thói quen uống)?\n` +
        `4. Anh chị thấy dịch vụ tư vấn/giao hàng của ACME thế nào?\n\n` +
        `LUẬT (bắt buộc): KHÔNG hỏi và KHÔNG ghi kết quả bệnh lý/cân nặng/chỉ số sức khỏe. Chỉ ghi thói quen + cảm nhận dịch vụ. Khách đồng ý chia sẻ mới dùng.\n\n` +
        `LÀM XONG: dán nguyên văn câu trả lời của khách vào Ô BÌNH LUẬN của việc này rồi bấm hoàn thành — máy sẽ tự chuyển cho Nhà máy Content viết bài.`,
      assigner_id: ceo?.id || assignee.id,
      assignee_id: assignee.id,
      priority: "medium",
      status: "todo",
      due_date: dueDate,
      tags: [TAG],
    });
    if (!error) {
      tasked++;
      soMo.set(assignee.id, (soMo.get(assignee.id) || 0) + 1);
      asked[c.phone] = today;
    }
  }
  const entries = Object.entries(asked).sort((a, b) => (a[1] < b[1] ? -1 : 1));
  await setConfigValue(KEY_ASKED, JSON.stringify(Object.fromEntries(entries.slice(-1000))), "Sổ khách đã xin case study (90 ngày hỏi lại)");
  return { due: all.length, tasked };
}

export async function ingestStories(): Promise<{ ingested: number; total: number }> {
  const sb = getServiceClient();
  const stories = await loadJson<CustomerStory[]>(KEY_STORIES, []);
  const have = new Set(stories.map((s) => s.task_id));

  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: tasks } = await sb
    .from("tasks")
    .select("id,title,assignee_id,status,completed_at,tags")
    .contains("tags", [TAG])
    .eq("status", "done")
    .gte("completed_at", since);

  let ingested = 0;
  const users = await activeUsers();
  for (const t of tasks || []) {
    const id = String(t.id);
    if (have.has(id)) continue;
    const { data: comments } = await sb
      .from("task_comments")
      .select("content,created_at,user_id")
      .eq("task_id", t.id)
      .order("created_at", { ascending: false });

    const best = (comments || []).map((c) => c.content || "").sort((a, b) => b.length - a.length)[0] || "";
    if (best.length < 120) continue;
    const sale = users.find((u) => u.id === t.assignee_id)?.full_name || "";
    const customer = (String(t.title).match(/Xin cảm nhận của (.+?) \(/) || [])[1] || "Khách hàng";
    stories.push({ task_id: id, sale, customer, story: best.slice(0, 2000), at: todayVN() });
    have.add(id);
    ingested++;
  }
  const pruned = stories.slice(-30);
  if (ingested) await setConfigValue(KEY_STORIES, JSON.stringify(pruned), "Kho câu chuyện khách (case study) — nguyên liệu Nhà máy Content");
  return { ingested, total: pruned.length };
}

export async function buildStoriesBlock(): Promise<string | null> {
  const stories = await loadJson<CustomerStory[]>(KEY_STORIES, []);
  if (!stories.length) return null;
  const pick = stories.slice(-5).reverse();
  return (
    "KHO CÂU CHUYỆN KHÁCH THẬT (đã xin phép — dùng cho trụ \"Câu chuyện khách hàng\"):\n" +
    pick.map((s) => `- [${s.at}] ${s.customer} (sale ${s.sale}): ${s.story.slice(0, 400)}`).join("\n") +
    "\nKhi dùng: kể lại theo hành trình THÓI QUEN + cảm nhận dịch vụ, đổi tên khách thành tên viết tắt, TUYỆT ĐỐI không thêm kết quả sức khỏe."
  );
}
