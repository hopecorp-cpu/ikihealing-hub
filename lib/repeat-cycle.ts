import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { activeUsers, CEO_NAME } from "@/lib/covan/delegation";

const CYCLE_MIN = 30;
const CYCLE_MAX = 45;
const RENAG_DAYS = 14;
const KEY_NAGGED = "repeat_cycle_nagged";

type Row = {
  customer_name: string | null;
  customer_phone: string | null;
  order_date: string | null;
  product_name: string | null;
  sale_name: string | null;
  net_amount: number | null;
};

export type DueCustomer = {
  name: string;
  phone: string;
  lastDate: string;
  daysAgo: number;
  products: string;
  saleName: string;
  totalSpent: number;
};

function todayVN(): Date {
  return new Date(Date.now() + 7 * 3600e3);
}

async function loadRows(): Promise<Row[]> {
  const sb = getServiceClient();
  const since = new Date(todayVN().getTime() - 180 * 86400e3).toISOString().slice(0, 10);

  const { rows } = await layDoanhThuNhieuThang(sb, since, todayVN().toISOString().slice(0, 10));
  return rows as unknown as Row[];
}

export async function findDueCustomers(): Promise<DueCustomer[]> {
  const rows = await loadRows();
  const today = todayVN().toISOString().slice(0, 10);

  const byPhone = new Map<string, { name: string; lastDate: string; products: Set<string>; sale: string; total: number }>();
  for (const r of rows) {
    const phone = (r.customer_phone || "").replace(/\D/g, "");
    if (phone.length < 9 || !r.order_date) continue;
    const cur = byPhone.get(phone);
    if (!cur) {
      byPhone.set(phone, {
        name: r.customer_name || "Khách",
        lastDate: r.order_date,
        products: new Set(r.product_name ? [r.product_name] : []),
        sale: r.sale_name || "",
        total: r.net_amount || 0,
      });
    } else {
      cur.total += r.net_amount || 0;
      if (r.order_date > cur.lastDate) {
        cur.lastDate = r.order_date;
        cur.products = new Set(r.product_name ? [r.product_name] : []);
        cur.sale = r.sale_name || cur.sale;
        cur.name = r.customer_name || cur.name;
      } else if (r.order_date === cur.lastDate && r.product_name) {
        cur.products.add(r.product_name);
      }
    }
  }

  const due: DueCustomer[] = [];
  for (const [phone, c] of byPhone) {
    const daysAgo = Math.floor((Date.parse(today) - Date.parse(c.lastDate)) / 86400e3);
    if (daysAgo >= CYCLE_MIN && daysAgo <= CYCLE_MAX) {
      due.push({
        name: c.name,
        phone,
        lastDate: c.lastDate,
        daysAgo,
        products: [...c.products].slice(0, 3).join(", "),
        saleName: c.sale,
        totalSpent: Math.round(c.total),
      });
    }
  }

  due.sort((a, b) => b.totalSpent - a.totalSpent);
  return due;
}

type NagMap = Record<string, string>;

async function loadNagged(): Promise<NagMap> {
  try {
    const raw = await getConfigValue(KEY_NAGGED);
    const m = raw ? (JSON.parse(raw) as NagMap) : {};
    return m && typeof m === "object" ? m : {};
  } catch {
    return {};
  }
}

export async function runRepeatCycle(): Promise<{
  due: number;
  tasked: number;
  perSale: Record<string, number>;
  unmatched: number;
}> {
  const all = await findDueCustomers();
  const nagged = await loadNagged();
  const today = todayVN().toISOString().slice(0, 10);

  const fresh = all.filter((c) => {
    const last = nagged[c.phone];
    return !last || (Date.parse(today) - Date.parse(last)) / 86400e3 >= RENAG_DAYS;
  });
  if (!fresh.length) return { due: all.length, tasked: 0, perSale: {}, unmatched: 0 };

  const hanDon = new Date(Date.parse(today) - 3 * 86400e3).toISOString().slice(0, 10);
  const sb = getServiceClient();
  const { data: cu } = await sb
    .from("tasks")
    .select("id")
    .contains("tags", ["chu-ky-dat-lai"])
    .neq("status", "done")
    .eq("acknowledged", false)
    .lt("due_date", hanDon);
  if (cu?.length) {

    await sb.from("tasks").update({
      status: "cancelled",
      blocker_reason: `Máy tự đóng ${today}: việc "đến hạn hôm nay" đã quá ${hanDon} — danh sách khách cũ, lượt mới đã thay.`,
    }).in("id", cu.map((x) => x.id));
  }

  const users = await activeUsers();
  const ceo = users.find((u) => u.full_name === CEO_NAME);

  const matchUser = (saleName: string) => {
    const s = saleName.toLowerCase().trim();
    if (!s) return null;
    return (
      users.find((u) => u.full_name.toLowerCase() === s) ||
      users.find((u) => s.includes(u.full_name.toLowerCase()) || u.full_name.toLowerCase().includes(s)) ||
      null
    );
  };

  const bySale = new Map<string, { user: { id: string; full_name: string } | null; items: DueCustomer[] }>();
  for (const c of fresh.slice(0, 60)) {

    const u = matchUser(c.saleName);
    const key = u ? u.full_name : "__unmatched__";
    if (!bySale.has(key)) bySale.set(key, { user: u, items: [] });
    bySale.get(key)!.items.push(c);
  }

  const dueDate = new Date(todayVN().getTime() + 2 * 86400e3).toISOString().slice(0, 10);
  let tasked = 0;
  let unmatched = 0;
  const perSale: Record<string, number> = {};

  for (const [key, group] of bySale) {
    const lines = group.items.map(
      (c) =>
        `- ${c.name} (${c.phone}) — mua ${c.products} ngày ${c.lastDate} (${c.daysAgo} ngày trước), tổng đã chi ${c.totalSpent.toLocaleString("vi-VN")}đ`
    );
    const assignee = group.user || ceo;
    if (!assignee) continue;
    if (key === "__unmatched__") unmatched = group.items.length;

    const { error } = await sb.from("tasks").insert({
      title: `[Chu kỳ đặt lại] Gọi ${group.items.length} khách đến hạn hôm nay`,
      description:
        "Khách mua sản phẩm tiêu hao 30-45 ngày trước, chưa quay lại — gọi hỏi thăm trải nghiệm " +
        "và mời đặt lại kèm QUÀ (không giảm giá %). Nhắc: không hứa hẹn công dụng chữa/trị.\n" +
        "LUẬT GỌI (NĐ 330/2026 Đ.37): đây là cuộc gọi mời mua lại = gọi QUẢNG CÁO → chỉ gọi 8h-17h, tối đa 1 cuộc/khách/24h, " +
        "mở đầu xưng tên + 'nhân viên NOVA, Công ty ACME', khách bảo không nhận nữa thì ghi 'Không có nhu cầu' ở /leads " +
        "(máy tự đưa vào danh sách không gọi). Khách đã nằm trong danh sách từ chối thì BỎ, không gọi.\n\n" +
        lines.join("\n") +
        (key === "__unmatched__" ? "\n\n(Nhóm này không khớp được sale phụ trách từ MISA — anh phân công giúp)" : ""),
      assigner_id: ceo?.id || assignee.id,
      assignee_id: assignee.id,
      priority: "high",
      status: "todo",
      due_date: dueDate,
      tags: ["chu-ky-dat-lai"],
    });
    if (!error) {
      tasked += group.items.length;
      perSale[assignee.full_name] = group.items.length;
      for (const c of group.items) nagged[c.phone] = today;
    }
  }

  const entries = Object.entries(nagged).sort((a, b) => (a[1] < b[1] ? -1 : 1));
  const pruned = Object.fromEntries(entries.slice(-2000));
  await setConfigValue(KEY_NAGGED, JSON.stringify(pruned), "Sổ khách đã nhắc chu kỳ đặt lại (chống nhắc trùng 14 ngày)");

  return { due: all.length, tasked, perSale, unmatched };
}
