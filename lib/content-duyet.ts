import { laCeo, tachCsv } from "@/lib/brain-quyen";

export const TRANG_NOVA = "000000000000000";

export function quyenDuyetBai(fromId: unknown, ceoId: unknown, dsDuyet: unknown): boolean {
  if (laCeo(fromId, ceoId)) return true;
  const f = String(fromId ?? "").trim();
  return !!f && tachCsv(dsDuyet).includes(f);
}

export function idBaiTuNut(replyMarkup: any): string | null {
  const rows: any[] = replyMarkup?.inline_keyboard || [];
  for (const row of rows) for (const b of row || []) {
    const m = /^(?:csua|cpub|cdrop):([0-9a-f-]{8,})$/i.exec(String(b?.callback_data || ""));
    if (m) return m[1];
  }
  return null;
}

export function loiDanVietLai(tieuDe: string, baiCu: string, gopY: string): string {
  return `Bạn là người viết bài fanpage NOVA (thực phẩm bổ sung, sức khoẻ chủ động). Viết LẠI bài dưới đây theo đúng góp ý của người duyệt.

LUẬT BẮT BUỘC: không dùng chữa/trị/điều trị/khỏi bệnh/thải độc, không hứa hiệu quả sau X ngày, không khoe kết quả sức khoẻ, không gọi là thực phẩm chức năng, khuyến mãi chỉ là tặng quà (không giảm %), KHÔNG để link trong bài. Giữ giọng gần gũi, tự nhiên.

TIÊU ĐỀ CŨ: ${tieuDe}

BÀI CŨ:
${baiCu}

GÓP Ý CỦA NGƯỜI DUYỆT:
${gopY}

Chỉ trả về JSON {"title": "...", "body": "..."} — body là toàn bộ bài đăng mới.`;
}
