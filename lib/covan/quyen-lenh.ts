import type { LopChat } from "./chat-allow";

export function laLenhGhi(text: string): boolean {
  const low = (text || "").trim().toLowerCase();
  return /^\/(duyet|doluong|canhbao|giaoviec|chiendich)/.test(low) || /^\/(ok|huy)(?![a-z0-9_])/.test(low);
}

export function laNguoiGoCeo(lop: LopChat | null, fromId: string | number | null | undefined, ceoChatId: string): boolean {
  if (lop === "ceo") return true;
  const ceo = (ceoChatId || "").trim();
  const from = fromId === null || fromId === undefined ? "" : String(fromId).trim();
  return !!ceo && !!from && from === ceo;
}

export const TU_CHOI_LENH_GHI =
  "Lệnh này chỉ CEO dùng được (giao việc, duyệt đề xuất, chạy chiến dịch). " +
  "Anh/chị cần gì cứ nhắn câu hỏi, em vẫn trả lời bình thường.";
