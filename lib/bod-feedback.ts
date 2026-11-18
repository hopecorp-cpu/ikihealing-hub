import { getConfigValue, setConfigValue } from "@/lib/app-config";

export type FeedbackKind = "khen" | "sua" | "hoi" | "rui-ro";
export type FeedbackStatus = "moi" | "dang-lam" | "xong";
export type BodFeedback = {
  id: string;
  reportKey: string;
  author: string;
  kind: FeedbackKind;
  text: string;
  at: string;
  status: FeedbackStatus;
  claudeNote?: string;
  updatedAt?: string;
};

export const REPORTS: { key: string; title: string; file: string; group: "chinh" | "phu-luc" }[] = [
  { key: "di-san", title: "Di sản Cơ chế Vận hành ACME", file: "/bao-cao-bod/01-di-san-co-che-van-hanh.html", group: "chinh" },
  { key: "he-sinh-thai", title: "Bản đồ Hệ sinh thái — Toàn cảnh", file: "/bao-cao-bod/02-ban-do-he-sinh-thai.html", group: "chinh" },
  { key: "doanh-thu", title: "Chiến lược Doanh thu", file: "/bao-cao-bod/03-chien-luoc-doanh-thu.html", group: "chinh" },
  { key: "luong-thuong", title: "Cơ chế Lương–Thưởng & Nhân sự", file: "/bao-cao-bod/04-co-che-luong-thuong-nhan-su.html", group: "chinh" },
  { key: "con-nguoi", title: "Quy chế Con người", file: "/bao-cao-bod/05-quy-che-con-nguoi.html", group: "chinh" },
  { key: "phap-ly", title: "Bộ Tài liệu Pháp lý", file: "/bao-cao-bod/06-bo-tai-lieu-phap-ly.html", group: "chinh" },
  { key: "thiet-ke-ai", title: "Thiết kế Hệ điều hành AI", file: "/bao-cao-bod/07-thiet-ke-he-dieu-hanh-ai.html", group: "phu-luc" },
  { key: "kiem-toan-ai", title: "Kiểm toán Hệ điều hành AI", file: "/bao-cao-bod/08-kiem-toan-he-dieu-hanh-ai.html", group: "phu-luc" },
  { key: "ban-do-cl", title: "Bản đồ Chiến lược ACME + NOVA", file: "/bao-cao-bod/09-ban-do-chien-luoc.html", group: "phu-luc" },
  { key: "tang-truong", title: "Hệ thống Vận hành Tăng trưởng", file: "/bao-cao-bod/10-he-thong-tang-truong.html", group: "phu-luc" },
  { key: "hai-chia-khoa", title: "Hai chìa khoá còn thiếu", file: "/bao-cao-bod/11-hai-chia-khoa-con-thieu.html", group: "phu-luc" },
];

export const KIND_LABEL: Record<FeedbackKind, string> = { khen: "Điểm hay", sua: "Cần sửa", hoi: "Câu hỏi", "rui-ro": "Rủi ro" };
export const STATUS_LABEL: Record<FeedbackStatus, string> = { moi: "Mới", "dang-lam": "Đang làm", xong: "Đã xong" };

const KEY = "bod_feedback";
const MAX = 500;

export async function getBodFeedback(): Promise<BodFeedback[]> {
  try { const raw = await getConfigValue(KEY); if (raw) { const o = JSON.parse(raw); if (Array.isArray(o?.items)) return o.items; } } catch { }
  return [];
}

async function saveAll(items: BodFeedback[]): Promise<void> {
  await setConfigValue(KEY, JSON.stringify({ items: items.slice(0, MAX), updatedAt: new Date().toISOString() }), "Góp ý BOD");
}

export async function addBodFeedback(input: { reportKey: string; author: string; kind: FeedbackKind; text: string }): Promise<BodFeedback> {
  const items = await getBodFeedback();
  const item: BodFeedback = {
    id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `fb_${items.length}_${Date.now()}`,
    reportKey: input.reportKey, author: input.author || "?",
    kind: input.kind, text: String(input.text || "").slice(0, 2000).trim(),
    at: new Date().toISOString(), status: "moi",
  };
  items.unshift(item);
  await saveAll(items);
  return item;
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus, claudeNote?: string): Promise<void> {
  const items = await getBodFeedback();
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return;
  items[i] = { ...items[i], status, claudeNote: claudeNote ?? items[i].claudeNote, updatedAt: new Date().toISOString() };
  await saveAll(items);
}

export async function deleteFeedback(id: string): Promise<void> {
  const items = (await getBodFeedback()).filter((x) => x.id !== id);
  await saveAll(items);
}
