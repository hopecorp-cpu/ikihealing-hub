const sach = (s: unknown) => String(s ?? "").trim();

export function tachCsv(v: unknown): string[] {
  return sach(v).split(",").map((s) => s.trim()).filter(Boolean);
}

export function laCeo(fromId: unknown, ceoId: unknown): boolean {
  const c = sach(ceoId);
  return !!c && sach(fromId) === c;
}

export type QuyetDinhNhom = "tra_loi" | "cam" | "chua_cap";

export function quyetDinhNhom(o: {
  isGroup: boolean; chatId: string; allow: Set<string>; nhomCam: string[]; fromId: unknown; ceoId: unknown; text: string;
}): QuyetDinhNhom {
  if (!o.isGroup) return "tra_loi";
  if (o.nhomCam.includes(o.chatId)) return "cam";
  if (o.allow.has(o.chatId)) return "tra_loi";

  if (laCeo(o.fromId, o.ceoId) && /^\/capquyen\s+-?\d+/i.test(o.text.trim())) return "tra_loi";
  return "chua_cap";
}

export type SuKienThemBot = { chatId: string; tenNhom: string; tuId: string; tenNguoiThem: string };

export function suKienThemBot(update: any, botId: string): SuKienThemBot | null {
  const bot = sach(botId);
  if (!bot) return null;
  const laNhom = (t: unknown) => t === "group" || t === "supergroup";

  const m = update?.message;
  if (m && laNhom(m?.chat?.type) && Array.isArray(m.new_chat_members)
      && m.new_chat_members.some((u: any) => sach(u?.id) === bot)) {
    return {
      chatId: sach(m.chat.id), tenNhom: sach(m.chat.title), tuId: sach(m?.from?.id),
      tenNguoiThem: `${m?.from?.first_name || ""} ${m?.from?.last_name || ""}`.trim(),
    };
  }

  const cm = update?.my_chat_member;
  if (cm && laNhom(cm?.chat?.type) && sach(cm?.new_chat_member?.user?.id) === bot) {
    const moi = sach(cm?.new_chat_member?.status);
    const cu = sach(cm?.old_chat_member?.status);
    if ((moi === "member" || moi === "administrator") && (cu === "left" || cu === "kicked" || !cu)) {
      return {
        chatId: sach(cm.chat.id), tenNhom: sach(cm.chat.title), tuId: sach(cm?.from?.id),
        tenNguoiThem: `${cm?.from?.first_name || ""} ${cm?.from?.last_name || ""}`.trim(),
      };
    }
  }
  return null;
}

export function duocDungNho(fromId: unknown, ceoId: unknown): boolean {
  return laCeo(fromId, ceoId);
}

export function duocDungDadang(fromId: unknown, ceoId: unknown, nguoiDang: string[]): boolean {
  if (laCeo(fromId, ceoId)) return true;
  const f = sach(fromId);
  return !!f && nguoiDang.includes(f);
}

export function khoiNguoiHoi(ten: string, laAnhHung: boolean): string {
  if (laAnhHung) return "";
  const t = sach(ten) || "một thành viên trong nhóm";
  return `\n\n===== NGƯỜI ĐANG HỎI EM LÀ: ${t} — KHÔNG PHẢI CEO =====\n` +
    `Gọi đúng người này (anh/chị + tên), KHÔNG gọi "CEO". Các luật viết cho "anh" ở trên áp dụng cho người này trong phạm vi kỹ năng được phép. ` +
    `Việc cần quyết định tiền hay hướng đi lớn thì nói rõ là sẽ cần CEO chốt.`;
}

export function cauKemTen(text: string, ten: string, isGroup: boolean): string {
  return isGroup && sach(ten) ? `${sach(ten)}: ${text}` : text;
}

export const NGUOI_TU_GIAO_MAC_DINH = ["283386091", "0000000000"];

export function laNguoiTuGiao(fromId: unknown, ceoId: unknown, themTuConfig: string[] = []): boolean {
  if (laCeo(fromId, ceoId)) return true;
  const f = sach(fromId);
  return !!f && (NGUOI_TU_GIAO_MAC_DINH.includes(f) || themTuConfig.includes(f));
}

export function khoiNguoiTuGiao(ten: string): string {
  const t = sach(ten) || "người này";
  return `\n\n===== ${t} ĐƯỢC CEO UỶ QUYỀN GIAO VIỆC THẲNG =====\n` +
    `Yêu cầu nào của ${t} là MỘT VIỆC cần làm (nghiên cứu, viết, dựng, sửa, lập kế hoạch, tạo file, email...) thì PHẢI gọi ` +
    `"giao_claude_code" ngay (chép đủ ý, không bỏ sót), KHÔNG trả lời suông rồi thôi, KHÔNG nói "đã lưu" khi chưa gọi kỹ năng. ` +
    `Việc chạy luôn, không chờ CEO duyệt. Chỉ câu hỏi thông tin thuần thì mới trả lời trực tiếp.`;
}
