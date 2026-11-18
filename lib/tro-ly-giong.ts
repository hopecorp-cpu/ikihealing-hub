export const CHO_THUONG = 1200;
const CHO_DO_DANG = 2200;
const CHO_KHOAN = 4000;

const bo = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export function thoiGianCho(text: string): number {
  const t = bo(text).trim();
  if (!t) return Infinity;
  if (/\b(khoan|doi (chut|xiu|ti|da)|cho (chut|xiu|ti|da))\b/.test(t.split(/\s+/).slice(-4).join(" "))) return CHO_KHOAN;
  if (/(,|\b(va|nhung|thi|ma|la|hoac|voi|cua|de|rang|neu|vi))$/.test(t)) return CHO_DO_DANG;
  return CHO_THUONG;
}

export function tachCau(text: string): string[] {
  const manh = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+(?=\S)/);
  const out: string[] = [];
  for (const m of manh) {
    const prev = out[out.length - 1];
    if (prev && prev.length < 12) out[out.length - 1] = `${prev} ${m}`; else out.push(m);
  }
  return out.filter(Boolean);
}

export function lamSachDeDoc(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

export function laTiengVong(nghe: string, dangDoc: string, nguong = 0.6): boolean {
  const tu = bo(nghe).split(/\s+/).filter(Boolean);
  if (!tu.length || !dangDoc.trim()) return false;
  const doc = new Set(bo(dangDoc).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean));
  return tu.filter((w) => doc.has(w)).length / tu.length >= nguong;
}

const LENH_DUNG = /(?<!\p{L})(dừng|khoan|thôi|stop|nhã ơi|tiểu nhã|chờ đã|đợi đã)(?!\p{L})/u;
export function laLenhDung(nghe: string): boolean {
  return LENH_DUNG.test(nghe.normalize("NFC").toLowerCase());
}

export function nenNgat(nghe: string, dangDoc: string): boolean {
  if (laLenhDung(nghe)) return true;
  const tu = bo(nghe).split(/\s+/).filter(Boolean);
  return tu.length >= 6 && !laTiengVong(nghe, dangDoc, 0.3);
}

export function catCauXong(dem: string): { xong: string[]; con: string } {
  const xong: string[] = [];
  let con = dem;
  const re = /[.!?…](?=\s)|\n/g;
  let m: RegExpExecArray | null;
  let dau = 0;
  while ((m = re.exec(dem))) {
    const cau = dem.slice(dau, m.index + 1).trim();
    if (cau.length >= 12) { xong.push(cau); dau = m.index + 1; }
  }
  con = dem.slice(dau);
  return { xong, con };
}

export const GIONG: ReadonlyArray<{ id: string; ten: string; mota: string }> = [
  { id: "qByVAGjXwGlkcRDJoiHg", ten: "Đặng Thị Hoa", mota: "tự tin" },
  { id: "jdlxsPOZOHdGEfcItXVu", ten: "Hiền", mota: "miền Bắc, phát thanh viên" },
  { id: "DvG3I1kDzdBY3u4EzYh6", ten: "Ngân Nguyễn", mota: "điềm tĩnh" },
];

export const giongHopLe = (id: string) => GIONG.some((g) => g.id === id);

export const LUAT_GIONG = `

CHẾ ĐỘ NÓI CHUYỆN BẰNG GIỌNG (1-1 với CEO, chữ bạn viết sẽ được ĐỌC THÀNH TIẾNG):
- Trả lời như đang nói: 1-4 câu ngắn, câu quan trọng nhất trước. Không markdown, không gạch đầu dòng, không bảng, không emoji, không link.
- Số tiền nói kiểu người Việt: "12 triệu 5", "1 tỷ 2"; phần trăm làm tròn.
- Câu cần trả lời dài thì nói ý chính rồi hỏi anh có muốn nghe chi tiết không.
- Chỉ dùng số trong khối số liệu sống; không có thì nói thẳng là chưa có số, không đoán.
- Bạn LÀM ĐƯỢC việc qua công cụ (giao việc cho nhân viên, cập nhật dự án, soát máy, tra web, soạn tin chăm sóc, lên chiến dịch nháp, giao Claude Code). Anh giao là làm ngay rồi nói lại NGẮN đã làm gì, giao cho ai, hạn ngày nào.
- Máy nghe giọng có thể nghe sai TÊN NGƯỜI và số: tên người nghe không rõ thì hỏi lại một câu trước khi giao. Việc không có công cụ (gửi tin cho khách, đổi tiền quảng cáo) thì nói rõ là chưa làm được bằng giọng.
- Nghe nhầm chữ (máy nghe giọng có thể sai) thì đoán theo ngữ cảnh ACME; mơ hồ thì hỏi lại một câu ngắn.`;
