import { getServiceClient } from "@/lib/supabase-server";
import { askGemini, geminiConfigured } from "@/lib/gemini";
import { findBanned } from "@/lib/banned-words";
import { DISCLAIMER } from "@/lib/coach-persona";
import { vnDateStr } from "@/lib/payroll";
import { anhSanPhamCho } from "@/lib/anh-san-pham";
import { buildFactoryContext, clean, hashtagCam, sanPhamNgungBan } from "@/lib/content-factory";
import {
  KENH_DOI_TAC, LOAI_BAI, CHO_LINK, CHO_TEN, KET_TPBS, MOC_BINH_LUAN,
  loiTra, loiLink, khauKetTpbs, loaiTuType, tachBinhLuan, caNhanHoa, banChu, type LoaiBai, type BaiGuiCtv,
} from "@/lib/bo-bai-doi-tac";

const XOAY_SAN_PHAM = [
  "bột đạm thực vật Đạm Mẫu Protein Pro",
  "trà thảo mộc Trà Mẫu B",
  "trà Trà Mẫu A",
];

const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      loai: { type: "string", enum: ["fb", "zalo", "video"] },
      tieuDe: { type: "string" },
      noiDung: { type: "string" },
      binhLuanDau: { type: "string" },
    },
    required: ["loai", "tieuDe", "noiDung"],
  },
};

export type BaiNhap = {
  id: string; ngay: string | null; loai: LoaiBai; tieuDe: string; noiDung: string; binhLuanDau?: string;
  status: string; loi: string[]; anh: string | null; sanPham: string | null; taoLuc: string;
};

function loiCua(chu: string): string[] {
  return [...findBanned(chu), ...hashtagCam(chu), ...sanPhamNgungBan(chu), ...loiTra(chu), ...loiLink(chu)];
}

export async function soanBoBai(opts?: { sanPham?: string }): Promise<{ ok: boolean; luu: number; loi?: string; coLoi: number }> {
  if (!geminiConfigured()) return { ok: false, luu: 0, coLoi: 0, loi: "chưa có GEMINI_API_KEY_BRAIN" };
  const thu = new Date(Date.now() + 7 * 3600e3).getUTCDay();
  const sanPham = opts?.sanPham || XOAY_SAN_PHAM[thu % XOAY_SAN_PHAM.length];
  const ctx = await buildFactoryContext();
  const laTra = /trà/i.test(sanPham);

  const system = `Bạn soạn BỘ BÀI MẪU cho người bán hàng của NOVA (cộng tác viên, đại lý, người mới khởi nghiệp).
Họ sẽ CHÉP NGUYÊN bài của bạn rồi đăng lên Facebook CÁ NHÂN hoặc gửi Zalo cho khách quen. Vì vậy bài phải
nghe như một người thật đang dùng và giới thiệu sản phẩm cho bạn bè — KHÔNG phải giọng fanpage thương hiệu.

BỐI CẢNH CÔNG TY (luật pháp lý, sản phẩm, chiến lược — tuân thủ tuyệt đối):
${ctx}

SẢN PHẨM CHÍNH HÔM NAY: ${sanPham}.

LUẬT TRUYỀN THÔNG CỦA HỆ THỐNG (điều kiện hợp tác, vi phạm là gỡ bài + mất thưởng):
- Bột đạm Đạm Mẫu là THỰC PHẨM BỔ SUNG: chỉ nói thành phần, cách dùng, thói quen bữa sáng/bữa phụ, cảm nhận
  vị. Cấm gắn cân nặng, cấm "hiệu quả sau X ngày", cấm nói chữa/trị/khỏi bệnh/thải độc/giảm cân.
- Trà Mẫu B và Trà Mẫu A là TRÀ THẢO MỘC, KHÔNG phải thực phẩm bổ sung: KHÔNG nói BẤT KỲ công dụng
  nào — kể cả "mát gan", "an thần", "dễ ngủ", "ngủ ngon", "thanh lọc", "giải nhiệt", "không caffeine".
  Chỉ được nói: thành phần, hương vị, màu nước, cách pha, khoảnh khắc thưởng trà, thói quen.
  Cũng CẤM công dụng NGẦM: không kể cảnh mệt, uể oải, buồn ngủ, căng thẳng rồi đưa trà ra như lời giải;
  không viết "lấy lại năng lượng", "tỉnh táo", "thư giãn đầu óc". Trà là thú vui thưởng thức, không phải giải pháp.
- Cấm lời chứng thực sức khoẻ (kể cả "khách mình dùng thấy..."), cấm gán bệnh cho người đọc, cấm so với thuốc.
- Cấm bịa người cụ thể (tên khách, lời trích trong ngoặc kép). Kể theo trải nghiệm của chính người đăng ("mình").
- Khuyến mãi chỉ là QUÀ TẶNG theo chương trình công ty, không giảm %, không tự đặt giá.
- KHÔNG nhắc TS. Trần Văn Bình / Lương y / bác sĩ để bảo chứng.
- KHÔNG dán đường link thật. Chỗ cần link thì viết đúng chữ ${CHO_LINK} — máy sẽ thay bằng link riêng của
  từng người bán. Muốn xưng tên người bán thì viết ${CHO_TEN}.

VIẾT ĐÚNG 3 BÀI, mỗi loại một bài:
1. loai "fb" — bài Facebook cá nhân 80-160 chữ: mở bằng một khoảnh khắc đời thường có thật của người đăng,
   kể tự nhiên, 2-4 emoji tiết chế, KHÔNG để link trong bài. "binhLuanDau" = câu thả ở bình luận đầu, có ${CHO_LINK}
   (vd "Ai muốn xem kỹ sản phẩm thì vào đây nha: ${CHO_LINK}").
2. loai "zalo" — tin nhắn Zalo gửi khách quen/khách đã mua 40-90 chữ: hỏi thăm trước, giới thiệu nhẹ, kết bằng
   lời mời trả lời tin hoặc xem ${CHO_LINK}. Không emoji quá 2 cái. Không gửi kiểu quảng cáo hàng loạt.
3. loai "video" — kịch bản video dọc 20-30 giây người bán TỰ QUAY bằng điện thoại: ghi rõ CÂU MỞ 3 GIÂY ĐẦU,
   3 cảnh (mỗi cảnh: quay gì + câu nói), câu kết, rồi dòng "Caption:" kèm 3-5 hashtag (luôn có #NOVA) và một câu
   có ${CHO_LINK}. Cảnh phải quay được tại nhà/văn phòng với sản phẩm thật.
${laTra ? "" : `Bài fb và video nhắc bột đạm thì kết bằng đúng câu: "${KET_TPBS}"\n`}Bài chia sẻ kiến thức sức khoẻ chung thì kết bằng: "${DISCLAIMER}"
Xưng "mình", gọi người đọc là "mọi người"/"bạn bè mình"/"chị em mình", không dùng "quý khách".

CHỈ trả JSON array 3 phần tử: [{"loai":"fb","tieuDe":"tiêu đề ngắn để quản lý","noiDung":"...","binhLuanDau":"..."}, ...]`;

  let arr: any[] = [];
  let loi = "";
  for (let lan = 0; lan < 2 && !arr.length; lan++) {
    const r = await askGemini(system, [], `Soạn bộ 3 bài cho ngày ${vnDateStr()}.`, {
      maxOutputTokens: lan ? 9000 : 7000, temperature: lan ? 0.5 : 0.85, thinkingBudget: lan ? 0 : 512,
      json: true, schema: SCHEMA,
    });
    if (!r.ok) { loi = (r as any).error || "AI lỗi"; continue; }
    try { const j = JSON.parse(r.text); arr = Array.isArray(j) ? j : []; } catch { loi = `AI trả sai khung (${r.text.length} ký tự)`; }
  }
  if (!arr.length) return { ok: false, luu: 0, coLoi: 0, loi: loi || "AI không trả bài nào" };

  const sb = getServiceClient();
  let luu = 0, coLoi = 0;
  for (const b of arr) {
    const loai: LoaiBai = (["fb", "zalo", "video"] as const).includes(b?.loai) ? b.loai : "fb";
    const noiDung = khauKetTpbs(clean(String(b?.noiDung || "")));
    if (!noiDung) continue;
    const binhLuan = b?.binhLuanDau ? clean(String(b.binhLuanDau)) : "";
    const tieuDe = clean(String(b?.tieuDe || LOAI_BAI[loai].ten)).slice(0, 160);
    const bad = loiCua(`${tieuDe}\n${noiDung}\n${binhLuan}`);
    if (bad.length) coLoi++;
    const { error } = await sb.from("content_items").insert({
      title: tieuDe, channel: KENH_DOI_TAC, type: LOAI_BAI[loai].type,
      content_brief: binhLuan && loai === "fb" ? `${noiDung}${MOC_BINH_LUAN}${binhLuan}` : noiDung,
      status: "draft", publish_date: vnDateStr(), related_product: sanPham,
      tags: ["doi-tac", "AI", loai],
      notes: `Bộ bài đối tác ${vnDateStr()}${bad.length ? ` — TỪ CẤM: ${bad.join(", ")}` : ""}`,
    });
    if (!error) luu++;
  }
  return { ok: luu > 0, luu, coLoi, loi: luu ? undefined : "không lưu được bài nào" };
}

async function dongThanhBai(r: any): Promise<BaiNhap> {
  const { noiDung, binhLuanDau } = tachBinhLuan(r.content_brief || "");
  const anh = await anhSanPhamCho(`${r.related_product || ""} ${r.title} ${noiDung}`, r.id).catch(() => null);
  return {
    id: r.id, ngay: r.publish_date ? String(r.publish_date).slice(0, 10) : null, loai: loaiTuType(r.type),

    tieuDe: r.title, noiDung, binhLuanDau, status: r.status, loi: loiCua(`${r.title}\n${noiDung}\n${binhLuanDau || ""}`),
    anh: anh?.url || null, sanPham: anh?.sanPham || r.related_product || null, taoLuc: r.created_at,
  };
}

export async function dsBoBai(ngay = 14): Promise<BaiNhap[]> {
  const sb = getServiceClient();
  const tu = new Date(Date.now() - ngay * 864e5).toISOString();
  const { data, error } = await sb.from("content_items")
    .select("id,title,type,content_brief,status,publish_date,related_product,created_at")
    .eq("channel", KENH_DOI_TAC).neq("status", "archived").gte("created_at", tu)
    .order("created_at", { ascending: false }).limit(120);
  if (error) throw new Error(error.message);
  return Promise.all((data || []).map(dongThanhBai));
}

export async function duyetBai(id: string, sua?: { noiDung?: string; binhLuanDau?: string; tieuDe?: string }): Promise<{ ok: boolean; loi?: string[] }> {
  const sb = getServiceClient();
  const { data: r } = await sb.from("content_items").select("id,title,type,content_brief,notes,channel").eq("id", id).maybeSingle();
  if (!r || r.channel !== KENH_DOI_TAC) return { ok: false, loi: ["không tìm thấy bài"] };
  const cu = tachBinhLuan(r.content_brief || "");
  const noiDung = khauKetTpbs((sua?.noiDung ?? cu.noiDung).trim());
  const binhLuan = (sua?.binhLuanDau ?? cu.binhLuanDau ?? "").trim();
  const tieuDe = (sua?.tieuDe ?? r.title).trim().slice(0, 160);
  const bad = loiCua(`${tieuDe}\n${noiDung}\n${binhLuan}`);
  if (bad.length) return { ok: false, loi: bad };
  const loai = loaiTuType(r.type);
  const { error } = await sb.from("content_items").update({
    title: tieuDe,
    content_brief: binhLuan && loai === "fb" ? `${noiDung}${MOC_BINH_LUAN}${binhLuan}` : noiDung,
    status: "scheduled",
    notes: `Bộ bài đối tác — đã duyệt ${new Date().toISOString()}`,
  }).eq("id", id);
  return error ? { ok: false, loi: [error.message] } : { ok: true };
}

export async function boBai(id: string): Promise<boolean> {
  const sb = getServiceClient();
  const { error } = await sb.from("content_items").update({ status: "archived", notes: `Bộ bài đối tác — bỏ ${new Date().toISOString()}` })
    .eq("id", id).eq("channel", KENH_DOI_TAC);
  return !error;
}

export const KHOA_VIDEO = "bo_bai_doi_tac_video";

export const KHOA_CHO_VIDEO = "bo_bai_doi_tac_cho_video";

export async function baiDaDuyet(ngay = 21): Promise<BaiGuiCtv[]> {
  const ds = (await dsBoBai(ngay)).filter((b) => b.status === "scheduled" && !b.loi.length);
  const { data } = await getServiceClient().from("config").select("value").eq("key", KHOA_VIDEO).maybeSingle();
  let kho: Record<string, { url?: string; ban?: string }> = {};
  try { kho = JSON.parse(data?.value || "{}") || {}; } catch { }
  return ds.map((b) => {
    const v = kho[b.id];
    return {
      id: b.id, ngay: b.ngay || vnDateStr(), loai: b.loai, tieuDe: b.tieuDe, noiDung: b.noiDung,
      binhLuanDau: b.binhLuanDau, anh: b.anh, sanPham: b.sanPham,

      video: v?.url && v.ban === banChu(b.noiDung) ? v.url : null,
    };
  });
}

async function ghiHangChoVideo(bai: BaiGuiCtv[]): Promise<void> {
  const cho = bai.filter((b) => b.loai === "fb" && !b.video).map((b) => ({
    id: b.id, ban: banChu(b.noiDung), tieuDe: b.tieuDe, chu: caNhanHoa(b.noiDung, {}), anh: b.anh || null, sanPham: b.sanPham || null,
  }));
  await getServiceClient().from("config").upsert({
    key: KHOA_CHO_VIDEO, value: JSON.stringify({ at: new Date().toISOString(), cho }),
    description: "Bài đối tác chờ máy Mac dựng video (scripts/video-doi-tac.mjs đọc)",
  }, { onConflict: "key" });
}

export async function dayBaiSangCtv(): Promise<{ ok: boolean; bai: number; loi?: string }> {
  const url = process.env.AFF_APP_URL, push = process.env.AFF_PUSH_SECRET;
  if (!url || !push) return { ok: false, bai: 0, loi: "thiếu AFF_APP_URL / AFF_PUSH_SECRET" };
  const bai = await baiDaDuyet();
  await ghiHangChoVideo(bai).catch(() => { });
  const r = await fetch(url.replace(/\/$/, "") + "/api/nhap-bai", {
    method: "POST", headers: { "content-type": "application/json", "x-aff-secret": push },
    body: JSON.stringify({ bai }), cache: "no-store",
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) } as any));
  if (!r.ok) return { ok: false, bai: bai.length, loi: `app CTV trả ${r.status}: ${(await r.text()).slice(0, 160)}` };
  return { ok: true, bai: bai.length };
}
