import { askGemini } from "@/lib/gemini";
import { findBanned, sanitizeContent } from "@/lib/banned-words";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { HO_SO_SAN_PHAM } from "@/lib/covan/knowledge_sanpham";
import { ttsConfig } from "./config";
import { bocNoiDungTin, getMessages, sendMessage, type TtsMessage } from "./api";
import { guiNhomTts, tgEscape } from "./telegram";
import { lyDoDung } from "@/lib/dung-khan-cap";
import { chotKiemTraLoi } from "@/lib/chot-kiem-tra-loi";

export type MucRuiRo = "thap" | "cao";
export type PhanLoai = { muc: MucRuiRo; lyDo: string[] };

const LUAT_RUI_RO: Array<{ re: RegExp; ten: string }> = [
  { re: /khiếu nại|phàn nàn|hỏng|vỡ|bể|móp|thiếu hàng|sai hàng|giao sai|không đúng|tệ|lừa|lừa đảo|rởm|giả|kém chất lượng|mốc|hết hạn|bị ôi|mùi lạ/i, ten: "khiếu nại chất lượng/giao hàng" },
  { re: /hoàn tiền|trả hàng|đổi hàng|đổi trả|refund|huỷ đơn|hủy đơn|hủy giúp|huỷ giúp|không nhận|bồi thường|đền/i, ten: "hoàn/huỷ/đổi trả" },
  { re: /bệnh|thuốc|bác sĩ|bệnh viện|mang thai|có bầu|cho con bú|trẻ em|em bé|bé \d|tuổi|liều|uống bao nhiêu|dùng bao nhiêu|ngày mấy|mấy lần|tiểu đường|huyết áp|ung thư|gan|thận|dạ dày|tim mạch|dị ứng|tác dụng phụ|phản ứng|mụn|giảm cân|tăng cân|chữa|trị|khỏi|đau|mệt|chóng mặt|tiêu chảy|táo bón/i, ten: "câu hỏi sức khoẻ/liều dùng" },
  { re: /!{3,}|\?{3,}|vcl|vl\b|đmm|dcm|chó|ngu|cút|mất dạy|vô trách nhiệm|tố cáo|báo công an|bóc phốt|đánh giá 1 sao/i, ten: "giọng giận/đe doạ" },
  { re: /giảm giá|bớt|chiết khấu|mã giảm|voucher|rẻ hơn|giá sỉ|đại lý|cộng tác viên|hoa hồng/i, ten: "hỏi giá/ưu đãi — máy không được đặt giá" },
];

export function phanLoaiRuiRo(text: string): PhanLoai {
  const lyDo = LUAT_RUI_RO.filter((l) => l.re.test(text || "")).map((l) => l.ten);
  if ((text || "").trim().length < 2) lyDo.push("tin quá ngắn/không có chữ (ảnh, sticker)");
  return { muc: lyDo.length ? "cao" : "thap", lyDo };
}

const RAO = `Bạn là nhân viên chăm sóc khách của gian hàng NOVA Beauty & Wellness (ACME Corp) trên TikTok Shop, trả lời tin nhắn khách bằng tiếng Việt, xưng "shop" hoặc "em", gọi khách là "anh/chị". Tối đa 3 câu, ấm, không sáo rỗng, không emoji.
LUẬT CỨNG, vi phạm là hỏng:
- Sản phẩm là THỰC PHẨM BỔ SUNG. CẤM nói chữa, trị, điều trị, khỏi bệnh, thải độc, giải độc, thanh lọc, giảm cân, liệu trình, cam kết kết quả, "hiệu quả sau X ngày", kể kết quả của khách khác. Chỉ được nói "hỗ trợ", và chỉ nói điều có trong hồ sơ dưới đây.
- Hỏi về bệnh, thuốc đang dùng, mang thai, cho con bú, trẻ em, liều dùng cho tình trạng riêng: KHÔNG tự trả lời — đặt rui_ro = "cao" và nói shop sẽ nhờ người phụ trách trả lời.
- Hoàn tiền, đổi trả, huỷ đơn, khiếu nại: KHÔNG hứa gì — rui_ro = "cao".
- Không đặt giá, không tạo ưu đãi, không hứa quà. Giá hiển thị trên gian hàng là giá đúng.
- Không bịa số, không bịa xuất xứ; không có trong hồ sơ thì nói "shop kiểm lại rồi báo anh/chị".
Chỉ trả lời JSON: {"rui_ro":"thap"|"cao","ly_do":"...","tra_loi":"..."}. Không chắc thì "cao".

HỒ SƠ SẢN PHẨM (trích, chỉ dùng số có ở đây):
`;

function hoSoRutGon(): string {
  return HO_SO_SAN_PHAM.slice(0, 24_000);
}

export type NhapTraLoi = { muc: MucRuiRo; lyDo: string[]; nhap: string; tuCam: string[] };

export async function soanNhap(tinKhach: string, lichSu: string[]): Promise<NhapTraLoi> {
  const luat = phanLoaiRuiRo(tinKhach);
  const r = await askGemini(RAO + hoSoRutGon(), [], `Lịch sử gần đây (cũ -> mới):\n${lichSu.slice(-6).join("\n") || "(không có)"}\n\nTIN KHÁCH MỚI NHẤT: ${tinKhach}`, { json: true, maxOutputTokens: 600, temperature: 0.3 });
  if (!r.ok) return { muc: "cao", lyDo: [...luat.lyDo, `model lỗi: ${r.error}`], nhap: "", tuCam: [] };
  let j: any = null;
  try { j = JSON.parse(r.text); } catch { return { muc: "cao", lyDo: [...luat.lyDo, "model trả JSON hỏng"], nhap: r.text.slice(0, 500), tuCam: [] }; }
  const nhapTho = String(j?.tra_loi || "").trim();
  const nhap = sanitizeContent(nhapTho).trim();
  const tuCam = findBanned(nhapTho);
  const lyDo = [...luat.lyDo];
  if (String(j?.rui_ro || "cao").toLowerCase() !== "thap") lyDo.push(`model: ${String(j?.ly_do || "không chắc").slice(0, 120)}`);
  if (tuCam.length) lyDo.push(`nháp còn từ cấm: ${tuCam.join(", ")}`);
  if (!nhap || nhap.length > 600) lyDo.push("nháp rỗng hoặc quá dài");

  const chot = chotKiemTraLoi(nhap, [RAO, hoSoRutGon(), ...lichSu, tinKhach].join("\n"));
  if (!chot.ok) lyDo.push(...chot.loi);
  return { muc: lyDo.length ? "cao" : "thap", lyDo, nhap, tuCam };
}

const KHOA_DA_XU_LY = "tts_cs_da_xu_ly";
async function daXuLy(): Promise<string[]> { try { return JSON.parse((await getConfigValue(KHOA_DA_XU_LY)) || "[]"); } catch { return []; } }
async function ghiDaXuLy(ids: string[]) { await setConfigValue(KHOA_DA_XU_LY, JSON.stringify(ids.slice(-300)), "Mã tin khách TikTok Shop máy CS đã soạn (300 gần nhất, chống soạn trùng)"); }

export async function xuLyTinKhach(d: any, ev: { id: number }): Promise<string> {
  const c = ttsConfig();
  if (!c.csEnabled) return "đã lưu (TTS_CS_ENABLED tắt)";
  const convId = String(d?.conversation_id || d?.conversation?.id || "");
  if (!convId) return "không có conversation_id";
  const sender = String(d?.sender?.role || d?.sender_role || d?.message?.sender?.role || "").toUpperCase();
  if (sender === "SELLER") return "tin của shop, bỏ qua";

  const msgs = (await getMessages(convId, { pageSize: 20 }))?.messages || [];

  const theoThoiGian = [...msgs].sort((a, b) => Number(a.create_time || 0) - Number(b.create_time || 0));
  const cuoi = theoThoiGian[theoThoiGian.length - 1];
  if (!cuoi || String(cuoi.sender?.role || "").toUpperCase() !== "BUYER") return "tin cuối không phải của khách (đã có người trả lời)";
  const handled = await daXuLy();
  if (handled.includes(cuoi.id)) return "đã soạn cho tin này rồi";

  const tinKhach: string[] = [];
  for (let i = theoThoiGian.length - 1; i >= 0 && String(theoThoiGian[i].sender?.role || "").toUpperCase() === "BUYER"; i--) tinKhach.unshift(bocNoiDungTin(theoThoiGian[i].content));
  const lichSu = theoThoiGian.slice(0, Math.max(0, theoThoiGian.length - tinKhach.length)).map((m: TtsMessage) => `${String(m.sender?.role || "?")}: ${bocNoiDungTin(m.content).slice(0, 200)}`);
  const cauHoi = tinKhach.join("\n").trim();

  const kq = await soanNhap(cauHoi, lichSu);
  handled.push(cuoi.id); await ghiDaXuLy(handled);

  const dauTin = `<b>TIN KHÁCH TIKTOK SHOP</b> · hội thoại <code>${tgEscape(convId)}</code>\nKhách: ${tgEscape(cauHoi.slice(0, 400))}`;
  if (kq.muc === "thap" && c.csAutoSend && kq.nhap && !(await lyDoDung("nhan_khach"))) {

    if (findBanned(kq.nhap).length) { await guiNhomTts(`${dauTin}\n<b>KHÔNG gửi</b> — nháp còn từ cấm sau khi lọc: ${tgEscape(findBanned(kq.nhap).join(", "))}\nNháp: ${tgEscape(kq.nhap)}`); return "chặn: từ cấm"; }
    await sendMessage(convId, kq.nhap);
    await guiNhomTts(`${dauTin}\n<b>Máy đã trả lời</b>: ${tgEscape(kq.nhap)}`);
    return "đã tự gửi (rủi ro thấp)";
  }
  await guiNhomTts(`${dauTin}\n<b>${kq.muc === "cao" ? "CẦN NGƯỜI TRẢ LỜI" : "Nháp chờ duyệt"}</b>${kq.lyDo.length ? " — " + tgEscape(kq.lyDo.join("; ")) : ""}\nNháp gợi ý: ${tgEscape(kq.nhap || "(không có — người tự soạn)")}\nTrả lời trên Seller Center > Tin nhắn.`);
  return kq.muc === "cao" ? `bàn giao người (${kq.lyDo.join("; ").slice(0, 120)})` : "nháp chờ duyệt (TTS_CS_AUTO_SEND tắt)";
}
