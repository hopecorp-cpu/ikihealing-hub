import { askGemini, geminiConfigured } from "@/lib/gemini";
import { BRAND_DNA_FULL, approvedOffersContext } from "@/lib/brand-dna";
import { findBanned } from "@/lib/banned-words";

export type BrandVerdict = {
  pass: boolean;
  diem: number;
  banned: string[];
  loi: string[];
  sua: string[];
  note: string;
};

const SYS_BASE = `Bạn là GIÁM ĐỐC THƯƠNG HIỆU của NOVA (ACME Corp). Việc của bạn là RÀ SOÁT một
bài nội dung TRƯỚC KHI nó ra công chúng, và bạn là người cuối cùng chặn bài lệch.

${BRAND_DNA_FULL}

Chấm bài theo 5 trục, mỗi trục tối đa 20 điểm:
1. PHÁP LÝ (20đ) — có câu nào chạm tới công dụng/chữa trị/thải độc/giảm cân/"hiệu quả sau X
   ngày"/khoe kết quả sức khoẻ làm bằng chứng? Có ngầm hứa kết quả cơ thể không? Đây là trục
   quan trọng nhất: dính là TRƯỢT bất kể các trục khác cao. Ba thứ TRƯỢT NGAY:
   - LỜI CHỨNG BỊA: bài đặt tên một khách ("chị Thảo", "anh Minh") rồi kể chuyện hoặc trích lời
     trong ngoặc kép. Máy viết bài KHÔNG có dữ liệu khách thật, nên mọi lời chứng có tên là bịa —
     đó là quảng cáo gian dối. Tình huống chung không gán cho ai thì được.
   - MƯỢN DANH NGHĨA Y TẾ: bác sĩ/dược sĩ/y sĩ/lương y nói tốt về sản phẩm (NĐ 15/2018 và 181/2013
     cấm thẳng). Gọi TS. Trần Văn Bình thành "Giáo sư"/"Lương y" cũng trượt — sai sự thật và biến
     ông thành bảo chứng chuyên môn.
   - DÒNG MIỄN TRỪ SAI CHỮ: phải đúng "không thay thế chẩn đoán hoặc điều trị y khoa". Nếu thành
     "hoặc hỗ trợ y khoa" thì lá chắn pháp lý đã hỏng, báo để sửa.
2. TÊN GỌI & SỐ (20đ) — gọi đúng "NOVA" ở lần nhắc đầu? "Học Viện NOVA"? "ACME Corp" viết đủ? Giá có khớp danh sách chào bán?
   - CHỮ "HỌC VIỆN": bài có dùng từ khiến ta trông như trường chính quy không (tuyển sinh,
     giảng viên, sinh viên, bằng, chứng chỉ, tốt nghiệp, chuẩn đầu ra, "được Bộ công nhận")?
     Có thì TRƯỢT — ta là chương trình huấn luyện, chỉ cấp giấy chứng nhận hoàn thành.
   Combo nhắc trong bài có nằm trong danh sách ĐÃ DUYỆT không? **Bài nhắc tới gói còn là
   NHÁP (draft) là TRƯỢT NGAY** — công ty cấm bán thứ chưa duyệt.
3. ĐỊNH VỊ (20đ) — bài có hạ ACME xuống thành "chỗ bán thực phẩm bổ sung" không? Ta là
   HUẤN LUYỆN VIÊN SỨC KHOẺ đồng hành, hệ sinh thái 4 mảng (app cá nhân hoá · cộng đồng ·
   sản phẩm · Học Viện NOVA). Bài bán hàng thuần mà không có chút nào tinh thần đồng hành thì trừ.
4. GIỌNG (20đ) — ấm, tôn trọng người đọc như người trưởng thành, điềm tĩnh. Trừ điểm nếu:
   giật gân, hù doạ sức khoẻ, sáo rỗng ("tuyệt vời", "kỳ diệu", "bí mật gây sốc"), nhiều dấu
   chấm than, hoặc giọng nài nỉ.
5. GIÁ TRỊ THẬT (20đ) — người đọc xong có mang về được điều gì làm được ngay không? Bài rỗng,
   nói chung chung, ai viết cũng được → trừ mạnh.

CHỈ trả JSON, không giải thích thêm:
{"diem": <0-100>, "pass": <true nếu diem>=70 VÀ không lỗi pháp lý>, "loi": ["..."],
 "sua": ["gợi ý sửa cụ thể, viết được luôn"], "note": "một câu ngắn cho CEO"}
Tối đa 4 mục trong "loi" và 4 mục trong "sua". Viết tiếng Việt.`;

async function buildSys(): Promise<string> {
  const offers = await approvedOffersContext();
  return offers ? `${SYS_BASE}\n\n${offers}` : SYS_BASE;
}

export async function reviewContent(title: string, body: string): Promise<BrandVerdict> {
  const banned = findBanned(`${title}\n${body}`);

  if (!geminiConfigured()) {
    return {
      pass: banned.length === 0, diem: banned.length ? 0 : 70, banned, loi: [], sua: [],
      note: banned.length ? `Dính từ cấm: ${banned.join(", ")}` : "Qua chốt từ cấm (chưa cắm AI để chấm sâu)",
    };
  }

  const r = await askGemini(await buildSys(), [], `Tiêu đề: ${title}\n\nNội dung:\n${String(body).slice(0, 3000)}`,
    { maxOutputTokens: 700, temperature: 0.2, json: true });

  if (!r.ok || !r.text) {
    return {
      pass: banned.length === 0, diem: banned.length ? 0 : 70, banned, loi: [], sua: [],
      note: banned.length ? `Dính từ cấm: ${banned.join(", ")}` : "AI chấm lỗi → tạm cho qua (đã qua chốt từ cấm)",
    };
  }

  let j: any = {};
  try { j = JSON.parse(String(r.text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")); } catch { }
  const diem = Number.isFinite(j.diem) ? Math.max(0, Math.min(100, Number(j.diem))) : 70;

  const pass = banned.length === 0 && j.pass !== false && diem >= 70;
  return {
    pass, diem: banned.length ? Math.min(diem, 40) : diem, banned,
    loi: Array.isArray(j.loi) ? j.loi.slice(0, 4).map(String) : [],
    sua: Array.isArray(j.sua) ? j.sua.slice(0, 4).map(String) : [],
    note: String(j.note || "").slice(0, 200),
  };
}

export function verdictBlock(v: BrandVerdict): string {
  const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dau = v.pass ? "\u{2713}" : "\u{26A0}";
  const lines = [`${dau} <b>GIÁM ĐỐC THƯƠNG HIỆU: ${v.diem}/100</b>${v.pass ? "" : " — CẦN SỬA"}`];
  if (v.banned.length) lines.push(`<b>TỪ CẤM:</b> ${esc(v.banned.join(", "))}`);
  if (v.loi.length) lines.push(...v.loi.map((x) => `\u{2022} ${esc(x)}`));
  if (v.sua.length) lines.push(`<i>Sửa: ${esc(v.sua.join(" | "))}</i>`);
  else if (v.note) lines.push(`<i>${esc(v.note)}</i>`);
  return lines.join("\n");
}
