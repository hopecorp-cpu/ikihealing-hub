import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { findBanned } from "@/lib/banned-words";

export const QUEUE_KEY = "video_queue";
export const LIBRARY_KEY = "video_library";

export type VideoStatus = "nhap" | "duyet" | "da_len_lich" | "loi" | "huy";

export type VideoItem = {
  id: string;
  file: string;
  title: string;
  caption: string;
  pageId: string;
  pageName: string;
  publishAt: string;
  status: VideoStatus;
  fbVideoId?: string;
  error?: string;
  createdAt: string;
  scheduledAt?: string;
};

export type LibraryFile = { file: string; name: string; sizeMb: number; folder: string };

export const PAGES: Array<{ id: string; name: string }> = [
  { id: "0000000000000000", name: "NOVA Detox" },
  { id: "0000000000000000", name: "NOVA Lifestyle" },
  { id: "0000000000000000", name: "NOVA Nutrition HUB" },
  { id: "0000000000000000", name: "Bếp Lành NOVA" },
  { id: "000000000000000", name: "Flora Enzyme" },

  { id: "000000000000000", name: "NOVA Beauty & Wellness" },
  { id: "000000000000000", name: "Lan Sống Khoẻ Mỗi Ngày" },
  { id: "000000000000000", name: "Thực Phẩm Bổ Sung Đạm Mẫu Protein" },
];

export async function loadQueue(): Promise<VideoItem[]> {
  try { return JSON.parse((await getConfigValue(QUEUE_KEY)) || "[]"); } catch { return []; }
}
export async function saveQueue(q: VideoItem[]): Promise<void> {
  await setConfigValue(QUEUE_KEY, JSON.stringify(q.slice(-500)), "Hàng đợi video chờ lên lịch đăng fanpage");
}
export async function loadLibrary(): Promise<LibraryFile[]> {
  try { return JSON.parse((await getConfigValue(LIBRARY_KEY)) || "[]"); } catch { return []; }
}

const vnNow = () => new Date(Date.now() + 7 * 3600e3);

export async function addToQueue(input: {
  file: string; title: string; caption: string; pageId: string; publishAt: string;
}): Promise<{ ok: boolean; error?: string; banned?: string[] }> {
  const banned = findBanned(`${input.title}\n${input.caption}`);
  if (banned.length) {
    return { ok: false, error: `Caption còn từ vi phạm: ${banned.join(", ")}. Sửa rồi thêm lại.`, banned };
  }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input.publishAt)) {
    return { ok: false, error: "Giờ đăng phải dạng 2026-08-01 19:30" };
  }

  const when = new Date(`${input.publishAt.replace(" ", "T")}:00+07:00`).getTime();
  if (when < Date.now() + 12 * 60e3) return { ok: false, error: "Giờ đăng phải cách hiện tại ít nhất 15 phút" };
  if (when > Date.now() + 180 * 86400e3) return { ok: false, error: "Facebook chỉ cho hẹn trước tối đa 6 tháng" };

  const page = PAGES.find((p) => p.id === input.pageId);
  if (!page) return { ok: false, error: "Chưa chọn fanpage hợp lệ" };

  const q = await loadQueue();

  if (q.some((v) => v.file === input.file && v.pageId === input.pageId && v.status !== "huy" && v.status !== "loi")) {
    return { ok: false, error: "Video này đã có trong hàng đợi của trang đó rồi" };
  }
  q.push({
    id: `v_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    file: input.file,
    title: input.title.trim(),
    caption: input.caption.trim(),
    pageId: page.id,
    pageName: page.name,
    publishAt: input.publishAt,
    status: "nhap",
    createdAt: vnNow().toISOString().slice(0, 16).replace("T", " "),
  });
  await saveQueue(q);
  return { ok: true };
}

export async function setQueueStatus(id: string, status: VideoStatus): Promise<{ ok: boolean; error?: string }> {
  const q = await loadQueue();
  const item = q.find((v) => v.id === id);
  if (!item) return { ok: false, error: "Không tìm thấy mục này" };
  if (status === "duyet") {
    const banned = findBanned(`${item.title}\n${item.caption}`);
    if (banned.length) return { ok: false, error: `Không duyệt được, còn từ vi phạm: ${banned.join(", ")}` };
  }
  item.status = status;
  await saveQueue(q);
  return { ok: true };
}

export async function queueSummary(): Promise<{
  waiting: number; approved: number; scheduled: number; failed: number;
  nextDays: Array<{ date: string; count: number }>; gapWarning: string | null;
}> {
  const q = await loadQueue();
  const days: Array<{ date: string; count: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + 7 * 3600e3 + i * 86400e3).toISOString().slice(0, 10);
    days.push({ date: d, count: q.filter((v) => v.publishAt.slice(0, 10) === d && (v.status === "da_len_lich" || v.status === "duyet")).length });
  }
  const emptyNext3 = days.slice(0, 3).every((d) => d.count === 0);
  return {
    waiting: q.filter((v) => v.status === "nhap").length,
    approved: q.filter((v) => v.status === "duyet").length,
    scheduled: q.filter((v) => v.status === "da_len_lich").length,
    failed: q.filter((v) => v.status === "loi").length,
    nextDays: days,
    gapWarning: emptyNext3 ? "Ba ngày tới chưa có video nào lên lịch — fanpage sẽ im ắng." : null,
  };
}
