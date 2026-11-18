import { getServiceClient } from "@/lib/supabase-server";
import { VAN_PHONG_VIET_KHACH } from "@/lib/van-phong-viet";
import { askGemini, geminiConfigured, geminiSearch, geminiImage } from "@/lib/gemini";
import { sanitizeContent, findBanned } from "@/lib/banned-words";
import { COACH_PERSONA, DISCLAIMER } from "@/lib/coach-persona";
import { BRAND_DNA_FULL } from "@/lib/brand-dna";
import { reviewContent, verdictBlock } from "@/lib/brand-review";
import { vnDateStr } from "@/lib/payroll";
import { sendTelegramWithButtons, sendTelegramPhoto, tgEscape } from "@/lib/telegram";
import sharp from "sharp";
import path from "path";
import { buildSlots, buildSlotsForFunnel, FUNNEL_LABEL, FUNNEL_GOAL, type Slot, type Funnel } from "@/lib/content-plan";
import { getContentPlan } from "@/lib/content-plan-server";
import { campaignMemoryContext, recordFail, getFails } from "@/lib/campaign-memory";
import { agentLearningBrief } from "@/lib/agent-learning";
import { SALEPAGE_PLAYBOOK } from "@/lib/skill-playbooks";
import { DISC_NOI_DUNG } from "@/lib/covan/knowledge_dockhach";
import { CONG_THUC_NEN } from "@/lib/covan/knowledge_congthuc";
import { getConfigValue } from "@/lib/app-config";
import { slotsForDate, markSlots } from "@/lib/campaign-calendar";
import { anhSanPhamCho } from "@/lib/anh-san-pham";

export type Draft = { title: string; channel: string; type: string; hook: string; body: string; cta: string; pillar: string; comments?: string[] };

export function clean(s: string): string {
  return sanitizeContent(String(s || ""))
    .replace(/(thay thế chẩn đoán hoặc )[^\n.]{0,24}?( y khoa)/gi, "$1điều trị$2");
}

function joinBody(d: { hook?: string; body?: string; cta?: string }): string {
  const hook = String(d.hook || "").trim();
  const body = String(d.body || "").trim();
  const head = hook.slice(0, 60);
  const trung = head.length > 20 && body.slice(0, hook.length + 20).includes(head);
  return [trung ? "" : hook, body, String(d.cta || "").trim()].filter(Boolean).join("\n\n").trim();
}

const HASHTAG_CAM = [
  "thaidoc", "giaidoc", "daothaidoc", "detox", "thanhloc", "giamcan", "giammo", "chuabenh",
  "chualanh", "chuakhoi", "dieutri", "trilieu", "khoibenh", "khangkhuan", "dietkhuan",
  "khangsinh", "thuocbo", "ungthu", "duonghuyet", "momau",
];
export function hashtagCam(text: string): string[] {
  const tags = String(text || "").match(/#[\p{L}\p{N}_]+/gu) || [];

  const boDau = (s: string) =>
    s.replace(/đ/g, "d").replace(/Đ/g, "D").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return tags.filter((t) => { const k = boDau(t); return HASHTAG_CAM.some((c) => k.includes(c)); });
}

const SP_NGUNG_BAN_RE =
  /nước\s+(uống\s+)?lên\s+men|nước\s+chữa\s+lành|master\s+tonic|công\s+thức\s+lên\s+men\s+thảo\s+mộc|giấm\s+táo\s+mèo|chai\s+lên\s+men/iu;
export function sanPhamNgungBan(text: string): string[] {
  const m = String(text || "").replace(/\s+/g, " ").match(SP_NGUNG_BAN_RE);
  return m ? [`SP NGỪNG BÁN (${m[0].trim()})`] : [];
}

const DRAFT_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" }, channel: { type: "string" }, type: { type: "string" },
      pillar: { type: "string" }, hook: { type: "string" }, body: { type: "string" }, cta: { type: "string" },
      comments: { type: "array", items: { type: "string" } },
    },
    required: ["title", "body", "hook", "cta"],
  },
};

function parseDraftArray(text: string): any[] {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { const v = JSON.parse(raw); if (Array.isArray(v)) return v; } catch { }
  const m = raw.match(/\[[\s\S]*\]/);
  if (m) { try { const v = JSON.parse(m[0]); if (Array.isArray(v)) return v; } catch { } }

  const out: any[] = [];
  const s = m ? m[0] : raw;
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") { depth--; if (depth === 0 && start >= 0) { try { out.push(JSON.parse(s.slice(start, i + 1))); } catch { } start = -1; } }
  }
  return out;
}

const CFG = async (key: string): Promise<any> => {
  const sb = getServiceClient();
  try { const v = (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value; return v ? JSON.parse(v) : null; } catch { return null; }
};
const setCFG = async (key: string, val: any) => {
  const sb = getServiceClient();
  await sb.from("config").upsert({ key, value: JSON.stringify(val) }, { onConflict: "key" });
};

export const BLOG_CTA = "Đọc thêm nhiều bài về sức khoẻ tự nhiên, ăn lành, dưỡng sinh tại: https://example.com/blog";

export const LINK_COMMENT = "Ai muốn biết thể trạng của mình hợp ăn uống, nghỉ ngơi thế nào thì thử bài kiểm tra 90 giây này nhé, có bản phân tích + cẩm nang miễn phí: https://example.com/quiz";

export function buildSeedingComments(raw?: string[]): string[] {
  const seeds = (Array.isArray(raw) ? raw : [])
    .map((c) => sanitizeContent(String(c || "")).trim())
    .filter((c) => c.length > 0)
    .slice(0, 3);
  return [...seeds, LINK_COMMENT];
}

export type ContentDailyStatus = {
  createdToday: number; publishedToday: number; failedToday: number;
  factoryRanToday: boolean; lastAt: string | null; lastN: number; block: string;
};
export async function contentDailyStatus(): Promise<ContentDailyStatus> {
  const sb = getServiceClient();
  const today = vnDateStr();
  const dayStart = `${today}T00:00:00+07:00`;
  const [createdR, publishedR, fails, last] = await Promise.all([
    sb.from("content_items").select("id", { count: "exact", head: true }).gte("created_at", dayStart),
    sb.from("content_items").select("id", { count: "exact", head: true }).eq("status", "published").gte("publish_date", dayStart),
    getFails().catch(() => []),
    CFG("content_factory_last"),
  ]);
  const createdToday = createdR.count || 0;
  const publishedToday = publishedR.count || 0;
  const failedToday = (fails || []).filter((f: any) => (f?.at || "").slice(0, 10) === today).length;
  const factoryRanToday = last?.date === today;
  const lastAt = last?.at || null;
  const lastN = last?.n || 0;

  const ageTxt = (iso: string | null) => {
    if (!iso) return "chưa từng chạy";
    const h = (Date.now() - new Date(iso).getTime()) / 3600e3;
    return h < 1 ? "vừa xong" : h < 24 ? `${Math.round(h)}h trước` : `${Math.round(h / 24)} ngày trước`;
  };
  const lines = [
    `\u{1F4DD} <b>Nhà máy Content hôm nay</b>`,
    `\u{2022} Tạo: ${createdToday} bài \u{2022} Đăng: ${publishedToday} \u{2022} Lỗi từ cấm: ${failedToday}`,
  ];
  if (!factoryRanToday) lines.push(`\u{26A0}\u{FE0F} Nhà máy CHƯA chạy hôm nay (lần cuối ${ageTxt(lastAt)}, ${lastN} bài). Gõ "tạo bài" hoặc mở /content.`);
  else if (createdToday === 0) lines.push(`\u{26A0}\u{FE0F} Hôm nay 0 bài mới — kiểm tra nhà máy ở /content.`);

  return { createdToday, publishedToday, failedToday, factoryRanToday, lastAt, lastN, block: lines.join("\n") };
}

export const getResearch = () => CFG("mkt_research");

export const saveResearch = async (d: any) => {
  const at = new Date().toISOString();
  await setCFG("mkt_research", { ...d, at });
  try {
    const hist = (await CFG("mkt_research_history")) || [];
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift({ summary: String(d.summary || "").slice(0, 4000), at });
    await setCFG("mkt_research_history", arr.slice(0, 12));
  } catch { }
};
export const getResearchHistory = async (): Promise<Array<{ summary: string; at: string }>> => {
  const h = await CFG("mkt_research_history");
  return Array.isArray(h) ? h : [];
};

const BRAND = `${COACH_PERSONA}

${BRAND_DNA_FULL}`;

export async function buildFactoryContext(): Promise<string> {
  const sb = getServiceClient();
  const parts: string[] = [BRAND];

  const strat = await CFG("mkt_strategy");
  if (strat && Object.keys(strat).length) {
    const NHAN = {
      thong_diep: "THÔNG ĐIỆP CỐT LÕI + LUẬT GIỌNG VĂN (bắt buộc tuân thủ từng chữ)",
      loi_the: "LỢI THẾ + CÔNG THỨC VIẾT ĐÃ CHỨNG MINH VIRAL TRÊN CHÍNH PAGE CỦA MÌNH",
      trien_khai: "NGUYÊN TẮC TRIỂN KHAI — LÀM GÌ / TUYỆT ĐỐI KHÔNG LÀM GÌ",
      kenh: "ĐỊNH HƯỚNG KÊNH + GIỜ VÀNG ĐĂNG BÀI",
      tang_truong: "HƯỚNG TĂNG TRƯỞNG (trụ nội dung, phễu 4 cấp)",
      boi_canh: "BỐI CẢNH (khách hàng, tài sản đang có)",
      muc_tieu: "MỤC TIÊU KINH DOANH",
    } as Record<string, string>;
    const blocks: string[] = [];
    for (const k of Object.keys(NHAN)) {
      const v = String((strat as any)[k] || "").trim();
      if (v) blocks.push(`### ${NHAN[k]}\n${v.slice(0, 3500)}`);
    }
    if (blocks.length) parts.push(`CHIẾN LƯỢC MKT CỦA CÔNG TY — BÁM SÁT, ĐÂY LÀ BẢN THIẾT KẾ:\n\n${blocks.join("\n\n").slice(0, 14000)}`);
  }

  try {
    const { buildKienThucBlock, buildStoryBankBlock, buildViralPlaybookBlock } = await import("@/lib/kien-thuc-nguon");

    const day = Math.floor((Date.now() + 7 * 3600e3) / 864e5);
    const kt = buildKienThucBlock(day);
    if (kt) parts.push(kt);
    const sb2 = buildStoryBankBlock(day);
    if (sb2) parts.push(sb2);
    const vp = buildViralPlaybookBlock();
    if (vp) parts.push(vp);
  } catch { }

  parts.push(DISC_NOI_DUNG);
  parts.push(CONG_THUC_NEN);

  const top = await CFG("mkt_top_posts");
  const posts = Array.isArray(top) ? top : top?.posts || [];
  if (posts.length) {
    const lines = posts.slice(0, 5).map((p: any, i: number) => {
      const eng = Number(p.engaged ?? (Number(p.reactions || 0) + Number(p.comments || 0) + Number(p.shares || 0)));
      const body = String(p.msg || p.message || "").replace(/\s+/g, " ").slice(0, 400);
      return `${i + 1}. [${eng} tương tác · ${Number(p.shares || 0)} chia sẻ] ${body}`;
    }).filter((l: string) => l.length > 30);

    if (lines.length) parts.push(`BÀI CHẠY TỐT NHẤT TRÊN FANPAGE 30 NGÀY QUA — học CÁCH MỞ BÀI và GIỌNG VĂN (bài nhiều CHIA SẺ nghĩa là chạm đúng). CẤM viết lại cùng chủ đề với các bài này — chủ đề đã dùng rồi, phải tìm góc MỚI:\n${lines.join("\n")}`);
  }

  try {
    const gd = await CFG("fb_bai_gan_day");
    const bai = (gd?.posts || []) as any[];
    if (bai.length >= 3) {
      const eng = (p: any) => Number(p.engaged ?? 0) + Number(p.clicks ?? 0);
      const sorted = bai.map(eng).sort((a, b) => a - b);
      const trungVi = sorted[Math.floor(sorted.length / 2)];
      const lines = bai.slice(0, 10).map((p: any) => {
        const e = eng(p);
        const nhan = e < Math.max(3, trungVi) ? "KÉM — kiểu này không chạm, đừng lặp" : "ổn";
        return `- [${p.created} · ${e} tương tác · ${nhan}] ${String(p.msg || "").replace(/\s+/g, " ").slice(0, 160)}`;
      });
      parts.push(`VÒNG PHẢN HỒI — KẾT QUẢ CÁC BÀI VỪA ĐĂNG (trung vị ${trungVi} tương tác/bài). ĐỌC BẢNG NÀY TRƯỚC KHI VIẾT: bài gắn nhãn KÉM nghĩa là chủ đề/cách mở đó người đọc đã lướt qua — bài hôm nay phải ĐỔI góc, đổi cách mở, đổi tình huống; đừng nối dài chuỗi đang đuối:\n${lines.join("\n")}`);
    }
  } catch { }

  const mem = await campaignMemoryContext();
  if (mem) parts.push(mem);

  const alc = await agentLearningBrief("content");
  if (alc) parts.push(alc);

  const flop = await CFG("mkt_flop_posts");
  const flopPosts = Array.isArray(flop) ? flop : flop?.posts || [];
  if (flopPosts.length) {
    const lines = flopPosts.slice(0, 5).map((p: any, i: number) => {
      const eng = Number(p.engaged ?? (Number(p.reactions || 0) + Number(p.comments || 0) + Number(p.shares || 0)));
      const body = String(p.msg || p.message || "").replace(/\s+/g, " ").slice(0, 300);
      return `${i + 1}. [chỉ ${eng} tương tác] ${body}`;
    }).filter((l: string) => l.length > 25);
    if (lines.length) parts.push(`BÀI TƯƠNG TÁC KÉM NHẤT 30 NGÀY QUA — TRÁNH kiểu mở bài/chủ đề/giọng này (không chạm được người đọc):\n${lines.join("\n")}`);
  }

  const rs = await getResearch();
  if (rs?.summary) parts.push(`NGHIÊN CỨU THỊ TRƯỜNG & ĐỐI THỦ (cập nhật ${String(rs.at || "").slice(0, 10)}):\n${String(rs.summary).slice(0, 1800)}`);

  try {
    const from = vnDateStr().slice(0, 8) + "01";
    const { layDoanhThu } = await import("@/lib/doanh-thu");
    const { rows } = await layDoanhThu(sb, from, vnDateStr());
    const byP: Record<string, number> = {};
    for (const r of rows) if (r.product_name) byP[r.product_name] = (byP[r.product_name] || 0) + (Number(r.quantity) || 0);
    const topP = Object.entries(byP).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, q]) => `${n} (${q})`);
    if (topP.length) parts.push(`SẢN PHẨM BÁN CHẠY THÁNG NÀY: ${topP.join(" · ")}`);
  } catch { }

  try {
    const { buildOfferBlock } = await import("@/lib/offer-architecture");
    const ob = await buildOfferBlock();
    if (ob) parts.push(ob + "\nKhi viết bài BÁN (BOFU): chỉ nhắc offer trạng thái ĐÃ CHỐT; offer DRAFT thì không đưa vào bài.");
  } catch { }

  try {
    const { buildStoriesBlock } = await import("@/lib/case-study");
    const stb = await buildStoriesBlock();
    if (stb) parts.push(stb);
  } catch { }

  try {
    const rawScout = await CFG("ad_scout_digest");
    if (rawScout?.digest) {

      const full = String(rawScout.digest);
      const at = full.indexOf("CHỐT LẠI");
      const digest = at > 1600
        ? `${full.slice(0, 1600)}\n…\n${full.slice(at, at + 1400)}`
        : full.slice(0, 3000);
      parts.push(
        `TRINH SÁT QUẢNG CÁO ĐỐI THỦ (học hướng đánh, CẤM chép nguyên văn, CẤM bắt chước claim sai luật):\n${digest}`
      );
    }
  } catch { }

  try {
    const since = new Date(Date.now() - 21 * 864e5).toISOString();
    const { data } = await sb.from("content_items").select("title").gte("created_at", since)
      .neq("status", "archived").order("created_at", { ascending: false }).limit(80);
    const titles = (data || []).map((r) => r.title).filter(Boolean);
    if (titles.length) parts.push(`ĐÃ ĐĂNG/ĐANG CHỜ TRONG 21 NGÀY QUA (mới nhất trước) — CẤM TUYỆT ĐỐI viết lại các chủ đề này dù đổi cách diễn đạt (bài trùng chủ đề sẽ bị máy LOẠI trước khi lưu, viết là công cốc):\n- ${titles.join("\n- ")}`);
  } catch { }

  return parts.join("\n\n");
}

export async function generateDrafts(n = 3, slots?: Slot[]): Promise<{ ok: boolean; drafts: Draft[]; error?: string }> {
  if (!geminiConfigured()) return { ok: false, drafts: [], error: "chưa có GEMINI_API_KEY_BRAIN" };
  const ctx = await buildFactoryContext();

  const pillarRule = slots?.length
    ? `TUYẾN BÀI HÔM NAY — viết ĐÚNG ${slots.length} bài theo thứ tự, mỗi bài BÁM đúng trụ + tầng phễu (KHÔNG tự đổi):
${slots.map((s, i) => `  Bài ${i + 1}: trụ "${s.pillar}" · tầng ${s.funnelLabel} → mục tiêu: ${s.goal}`).join("\n")}
- pillar của mỗi bài PHẢI bằng đúng tên trụ ở trên.`
    : `- pillar = trụ nội dung (vd "Câu chuyện khách hàng", "Kiến thức dưỡng sinh", "Sau hậu trường", "Thói quen nhỏ").`;

  const system = `Bạn là Trưởng phòng Nội dung của ACME Corp — người Việt, viết tiếng Việt tự nhiên, ấm, có chiều sâu, KHÔNG sáo rỗng. Emoji dùng ĐÚNG KHUÔN CAPTION bên dưới, không rải bừa.

${VAN_PHONG_VIET_KHACH}

${SALEPAGE_PLAYBOOK}

${ctx}

NHIỆM VỤ: viết ${n} bài đăng mạng xã hội cho HÔM NAY (${vnDateStr()}).

KHUÔN CAPTION FANPAGE (đội truyền thông chốt 28/08/2026 — áp cho MỌI bài, đây là hình dạng bài chứ không phải trang trí):
- "hook" = MỘT dòng ngắn dưới 110 ký tự, mở đầu bằng MỘT emoji hợp không khí bài (tia sáng, chiếc lá, tách trà...), chạm đúng tình huống người đọc đang sống.
- Thân bài có mẹo/việc-làm-được thì tách MỖI VIỆC MỘT DÒNG (2-4 dòng), mỗi dòng mở đầu bằng một emoji đúng nghĩa của việc đó (người đi bộ, giọt nước, khuôn mặt thư giãn...); trước danh sách nên có một câu dẫn kiểu "hãy thử:". Sau danh sách là 1-2 câu văn trọn vẹn nói rõ lợi ích, không liệt kê tiếp.
- Emoji TIẾT CHẾ: cả bài 4-7 cái, mỗi dòng tối đa 1, đặt ở ĐẦU dòng chứ không chen giữa câu, không chuỗi emoji liền nhau.
- "cta" = 1 dòng mở đầu bằng emoji bàn tay chỉ hoặc mũi tên, kêu gọi đúng mục tiêu tầng phễu (bài kiến thức: mời thử ngay MỘT việc nhỏ hôm nay; bài bán: mời nhắn tin/bình luận), rồi XUỐNG DÒNG kết bằng 3-5 hashtag: LUÔN có #NOVA và #Healthylife, thêm 1-2 hashtag đúng chủ đề bài viết liền không dấu (vd #SongKhoe #ThoiQuenNho #NguNgon), được phép thêm #trending #ontop.
- CẤM hashtag dính từ cấm KỂ CẢ viết không dấu (#thaidoc #giaidoc #detox #thanhloc #giamcan #chuabenh #chualanh #khangkhuan #thuocbo #ungthu...) — hashtag không dấu vẫn là claim y học.
- Xưng hô trong bài: nói với người đọc bằng "mình"/"anh chị mình" hoặc câu vô nhân xưng, KHÔNG gọi "bạn" (đúng luật văn phong ở trên).

YÊU CẦU:
- Mỗi bài phải khác nhau về góc nhìn (đừng ra ${n} bài na ná).
- Mở bài (hook) phải giữ người đọc trong 2 giây đầu — chạm nỗi đau lối sống thật, không giật gân.
- Thân bài kể chuyện/chia sẻ có ích, người đọc không mua vẫn thấy được cho đi.
- Tuyệt đối tuân thủ TƯ CÁCH PHÁT NGÔN và LUẬT PHÁP LÝ ở trên: bạn là HUẤN LUYỆN VIÊN, không phải bác sĩ.
- CẤM BỊA KHÁCH HÀNG. Bạn KHÔNG có dữ liệu phản hồi khách thật, nên tuyệt đối không đặt tên một
  người ("chị Thảo", "anh Minh") rồi kể chuyện hoặc trích lời họ trong ngoặc kép. Lời chứng bịa là
  quảng cáo gian dối, và với thực phẩm bổ sung thì đó là rủi ro pháp lý thật. Trụ "câu chuyện/cảm
  nhận" hãy viết theo TÌNH HUỐNG CHUNG mà người đọc tự nhận ra mình ("nhiều người đi làm hay gặp
  cảnh 3 giờ chiều tụt năng lượng..."), KHÔNG gán cho một cá nhân cụ thể.
- KHÔNG nhắc TS. Trần Văn Bình, "Lương Y", "Học Viện Trần Văn Bình" ở bất kỳ đâu trong bài (CEO chốt
  17/09/2026: thương hiệu NOVA phải đứng một mình). Không viết câu "lấy cảm hứng từ nền tri thức của…".
  Nguồn gốc kiến thức: "đội chuyên môn NOVA biên soạn". Gọi ai là "Giáo sư"/"Lương y"/"bác sĩ" để bảo
  chứng sản phẩm là điều luật cấm.
- Bài chia sẻ kiến thức sức khoẻ thì kết bằng đúng dòng này: "${DISCLAIMER}"
- CTA nhẹ nhàng, TUYỆT ĐỐI KHÔNG dán đường link (URL) trong body — Facebook bóp view bài có link ngoài trong nội dung; link sẽ đặt ở BÌNH LUẬN.
- MỖI bài kèm 2-3 "comments" = BÌNH LUẬN MỒI (seeding) để thả dưới bài mở tương tác, GIỌNG NHƯ NGƯỜI XEM/KHÁCH (không phải thương hiệu): 1 câu hỏi gợi chuyện + 1 chia sẻ trải nghiệm đời thường + 1 câu đồng tình/hỏi thêm. TUÂN THỦ TPBS (không khoe chữa bệnh, không từ cấm). KHÔNG chèn link trong comments (hệ tự thêm 1 comment link riêng).
${pillarRule}

CHỈ trả về JSON array, không giải thích, không bọc markdown:
[{"title":"tiêu đề ngắn để quản lý","channel":"Facebook","type":"Post","pillar":"...","hook":"câu mở đầu có emoji đầu dòng","body":"thân bài đầy đủ, xuống dòng bằng \\n","cta":"dòng kêu gọi nhẹ nhàng + xuống dòng là dòng hashtag, KHÔNG có link","comments":["bình luận mồi 1 (câu hỏi)","bình luận mồi 2 (trải nghiệm)","bình luận mồi 3 (đồng tình/hỏi thêm)"]}]`;

  const tokens = 2400 * n + 2000;
  let arr: any[] = [];
  let lastErr = "";
  for (let attempt = 0; attempt < 2 && arr.length === 0; attempt++) {
    const r = await askGemini(system, [], `Viết ${n} bài cho hôm nay.`, {
      maxOutputTokens: attempt === 0 ? tokens : Math.round(tokens * 1.5),
      temperature: attempt === 0 ? 0.9 : 0.5,
      thinkingBudget: attempt === 0 ? 512 : 0,
      json: true, schema: DRAFT_SCHEMA,
    });
    if (!r.ok) { lastErr = (r as any).error || "AI lỗi"; continue; }
    arr = parseDraftArray(r.text);

    if (arr.length === 0) {
      const fin = (r as any).finishReason || "?";
      lastErr = fin === "MAX_TOKENS"
        ? `AI viết cụt vì hết trần chữ (MAX_TOKENS, nhận ${r.text.length} ký tự)`
        : `AI trả về không đúng định dạng (finish=${fin}, ${r.text.length} ký tự)`;
    }
  }
  if (arr.length === 0) return { ok: false, drafts: [], error: lastErr || "AI trả về không đúng định dạng" };

  const drafts: Draft[] = arr.filter((d) => d?.body).map((d) => ({
    title: clean(String(d.title || "Bài không tên")).slice(0, 180),
    channel: String(d.channel || "Facebook"),
    type: String(d.type || "Post"),
    pillar: String(d.pillar || ""),
    hook: clean(String(d.hook || "")),
    body: clean(String(d.body || "")),
    cta: clean(String(d.cta || "")),
  }));
  return { ok: true, drafts };
}

export type SavedDraft = { id: string; title: string; pillar: string; content_brief: string; flagged: boolean; imageUrl?: string; comments?: string[] };

const IMG_BUCKET = "content-images";

export function contentImagePublicUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${IMG_BUCKET}/${id}.png`;
}

export async function contentImageExists(id: string): Promise<boolean> {
  try {
    const r = await fetch(contentImagePublicUrl(id), { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch { return false; }
}

export type ImgRatio = "feed" | "square" | "story";
const RATIO_DIM: Record<ImgRatio, { w: number; h: number; label: string }> = {
  feed: { w: 1024, h: 1280, label: "Vertical 4:5 (Facebook feed)" },
  square: { w: 1080, h: 1080, label: "Square 1:1 (Instagram feed)" },
  story: { w: 1080, h: 1920, label: "Vertical 9:16 (Story/Reels)" },
};

function buildImagePrompt(d: { title: string; pillar: string; content_brief: string }, ratio: ImgRatio = "feed", extra?: string): string {
  const scene = `${d.title}. ${String(d.content_brief || "").replace(/\s+/g, " ").slice(0, 200)}${extra ? ". " + extra : ""}`;

  return `Professional lifestyle still-life photography, warm natural daylight, soft cozy earthy tones, shallow depth of field, high detail, photorealistic.
Vietnamese wellness context for scene: ${scene}
STRONGLY PREFER still-life / environment: a cup of herbal tea, healthy plant-based Vietnamese food on a wooden table, fresh herbs and vegetables, a calm sunlit kitchen or meditation corner, morning light.
Do NOT show close-up human faces (AI distorts faces) — if a person appears at all, only hands or a soft distant back view, out of focus.
Absolutely NO text, NO letters, NO logo, NO product packaging, NO label, NO watermark. ${RATIO_DIM[ratio].label}, clean composition, social-media-ready.`;
}

async function stampLogo(imgBuf: Buffer): Promise<Buffer> {
  const meta = await sharp(imgBuf).metadata();
  const W = meta.width || 1024, H = meta.height || 1024;

  const logoRaw = await sharp(path.join(process.cwd(), "public/logo/nova-logo-hong.png"))
    .resize({ height: Math.max(140, Math.round(H * 0.18)), kernel: "lanczos3" }).sharpen().png().toBuffer();
  const logoW = (await sharp(logoRaw).metadata()).width || 80;
  const logoH = (await sharp(logoRaw).metadata()).height || logoW;
  const pad = Math.round(logoW * 0.2);
  const chipW = logoW + pad * 2, chipH = logoH + pad * 2;
  const chipSvg = Buffer.from(
    `<svg width="${chipW}" height="${chipH}"><rect width="${chipW}" height="${chipH}" rx="${Math.round(chipW * 0.3)}" fill="white" fill-opacity="0.92"/></svg>`
  );
  const chip = await sharp(chipSvg).composite([{ input: logoRaw, top: pad, left: pad }]).png().toBuffer();
  const margin = Math.round(W * 0.03);
  return sharp(imgBuf)
    .composite([{ input: chip, top: Math.max(0, H - chipH - margin), left: Math.max(0, W - chipW - margin) }])
    .png().toBuffer();
}

async function freeImage(prompt: string, ratio: ImgRatio = "feed"): Promise<Buffer | null> {
  try {
    const { w, h } = RATIO_DIM[ratio];
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 2000 ? buf : null;
  } catch { return null; }
}

export function storageKeyUrl(key: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${IMG_BUCKET}/${key}`;
}

async function taiAnhThat(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length < 2000) return null;
    return await sharp(raw).png().toBuffer();
  } catch { return null; }
}

async function genStampedImage(prompt: string, ratio: ImgRatio): Promise<Buffer | null> {
  let raw: Buffer | null = null;
  const g = await geminiImage(prompt);
  if (g.ok && g.dataB64) raw = Buffer.from(g.dataB64, "base64");
  if (!raw) raw = await freeImage(prompt, ratio);
  if (!raw) return null;
  let buf: Buffer = raw;
  try { buf = await stampLogo(buf); } catch {  }
  return buf;
}

async function makeAndStoreImage(sb: any, item: SavedDraft, opts?: { ratio?: ImgRatio; key?: string; extra?: string }): Promise<string | null> {
  try {
    const ratio = opts?.ratio || "feed";
    const key = opts?.key || `${item.id}.png`;

    if (!opts?.extra) {
      const that = await anhSanPhamCho(`${item.title} ${item.content_brief}`, item.id);
      if (that) {
        const anh = await taiAnhThat(that.url);
        if (anh) {
          await sb.storage.createBucket(IMG_BUCKET, { public: true }).catch(() => { });
          const { error } = await sb.storage.from(IMG_BUCKET).upload(key, anh, { contentType: "image/png", upsert: true });
          if (!error) return storageKeyUrl(key);

        }
      }
    }

    const prompt = buildImagePrompt(item, ratio, opts?.extra);
    const buf = await genStampedImage(prompt, ratio);
    if (!buf) return null;
    await sb.storage.createBucket(IMG_BUCKET, { public: true }).catch(() => { });
    const { error } = await sb.storage.from(IMG_BUCKET).upload(key, buf, { contentType: "image/png", upsert: true });
    if (error) return null;
    return storageKeyUrl(key);
  } catch { return null; }
}

export async function makeCarousel(sb: any, item: SavedDraft, slides: string[], ratio: ImgRatio = "square"): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < Math.min(6, slides.length); i++) {
    const url = await makeAndStoreImage(sb, item, { ratio, key: `${item.id}_${i + 1}.png`, extra: slides[i] });
    if (url) urls.push(url);
  }
  return urls;
}

export async function persistDraft(sb: any, d: Draft, extra: { campaign?: string; funnel?: string; qaNote?: string }): Promise<SavedDraft | null> {

  try {
    const { trungVoiAi } = await import("@/lib/chong-trung-noi-dung");
    const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: gd } = await sb.from("content_items").select("title").eq("channel", "Facebook")
      .neq("status", "archived").gte("created_at", since7)
      .order("created_at", { ascending: false }).limit(80);
    const trung = trungVoiAi(d.title, (gd || []).map((r: any) => r.title).filter(Boolean));
    if (trung) {
      await recordFail(d.title, `trùng chủ đề trong 7 ngày với "${trung}" — máy tự loại (persistDraft)`).catch(() => { });
      return null;
    }
  } catch {  }
  const pillar = d.pillar || "";
  const chu = `${d.title} ${d.hook} ${d.body} ${d.cta}`;
  const bad = [...findBanned(chu), ...hashtagCam(chu), ...sanPhamNgungBan(chu)];
  const { data, error } = await sb.from("content_items").insert({
    title: d.title, channel: d.channel, type: d.type,
    content_brief: joinBody(d),
    status: "draft", publish_date: vnDateStr(),
    related_campaign: extra.campaign || (extra.funnel ? `Phễu ${extra.funnel}` : null),
    tags: ["AI", pillar, extra.funnel].filter(Boolean),
    notes: `Dispatch ${vnDateStr()}${extra.funnel ? ` · ${extra.funnel}` : ""}${extra.qaNote ? ` · QA: ${extra.qaNote}` : ""}${bad.length ? ` — TỪ CẤM: ${bad.join(", ")}` : ""}`,
  }).select("id,title,content_brief").maybeSingle();
  if (error || !data) return null;
  const item: SavedDraft = { id: data.id, title: data.title, pillar, content_brief: data.content_brief || "", flagged: bad.length > 0 };
  const url = await makeAndStoreImage(sb, item);
  if (url) item.imageUrl = url;
  return item;
}

export async function runFactory(n = 3, opts?: { funnel?: Funnel }): Promise<{ ok: boolean; saved: number; drafts: Draft[]; items: SavedDraft[]; error?: string; flagged: string[] }> {

  const plan = await getContentPlan();
  const now = new Date();
  const seed = now.getUTCDate() * 24 + now.getUTCHours();
  const today = vnDateStr();

  let slots: Slot[];
  let theoLich = 0;
  if (!opts?.funnel) {
    const oLich = await slotsForDate(today).catch(() => [] as any[]);
    const chua = oLich.filter((s: any) => s.status === "planned");
    if (chua.length) {
      slots = chua.slice(0, n).map((s: any) => ({
        pillar: s.pillar, funnel: s.funnel, funnelLabel: FUNNEL_LABEL[s.funnel as Funnel], goal: FUNNEL_GOAL[s.funnel as Funnel],
      }));
      theoLich = slots.length;

      if (slots.length < n) slots = slots.concat(buildSlots(plan, n - slots.length, now.getUTCDate()));
    } else slots = buildSlots(plan, n, now.getUTCDate());
  } else slots = buildSlotsForFunnel(plan, n, opts.funnel, seed);

  const g = await generateDrafts(n, slots);
  if (!g.ok) return { ok: false, saved: 0, drafts: [], items: [], error: g.error, flagged: [] };

  const sb = getServiceClient();

  const { trungVoiAi } = await import("@/lib/chong-trung-noi-dung");
  let ganDay: string[] = [];
  try {
    const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: gd } = await sb.from("content_items").select("title").eq("channel", "Facebook")
      .neq("status", "archived").gte("created_at", since7)
      .order("created_at", { ascending: false }).limit(80);
    ganDay = (gd || []).map((r: any) => r.title).filter(Boolean);
  } catch {  }
  const giu: { d: Draft; slot?: Slot }[] = [];
  for (let i = 0; i < g.drafts.length; i++) {
    const d = g.drafts[i];
    const trung = trungVoiAi(d.title, [...ganDay, ...giu.map((c) => c.d.title)]);
    if (trung) {
      await recordFail(d.title, `trùng chủ đề trong 7 ngày với "${trung}" — máy tự loại, phải tìm góc mới`).catch(() => { });
    } else giu.push({ d, slot: slots[i] });
  }
  if (!giu.length) {
    return { ok: true, saved: 0, drafts: g.drafts, items: [], error: `cả ${g.drafts.length} bài trùng chủ đề 7 ngày — máy loại hết, không lưu`, flagged: [] };
  }

  const flagged: string[] = [];
  const rows = giu.map(({ d, slot }) => {
    const pillar = slot?.pillar || d.pillar || "";

    const chu = `${d.title} ${d.hook} ${d.body} ${d.cta}`;
    const bad = [...findBanned(chu), ...hashtagCam(chu), ...sanPhamNgungBan(chu)];
    if (bad.length) flagged.push(`${d.title}: ${bad.join(", ")}`);
    return {
      title: d.title,
      channel: d.channel,
      type: d.type,

      content_brief: joinBody(d),
      status: "draft",
      publish_date: today,
      related_campaign: slot ? `Phễu ${slot.funnel}` : null,
      tags: ["AI", pillar, slot?.funnel].filter(Boolean),
      notes: `AI soạn ${today}${slot ? ` · ${slot.funnelLabel}` : ""}${bad.length ? ` — CẢNH BÁO TỪ CẤM CÒN SÓT: ${bad.join(", ")}` : ""}`,
      _pillar: pillar,
    };
  });

  const insertRows = rows.map(({ _pillar, ...r }) => r);
  const { data: saved, error } = await sb.from("content_items").insert(insertRows).select("id,title,content_brief");
  if (error) return { ok: false, saved: 0, drafts: g.drafts, items: [], error: error.message, flagged };
  await setCFG("content_factory_last", { at: new Date().toISOString(), n: insertRows.length, date: vnDateStr() });

  if (theoLich > 0) await markSlots(today, "drafted", Math.min(theoLich, insertRows.length)).catch(() => 0);

  for (const f of flagged) { const [t, r] = f.split(":"); await recordFail((t || "").trim(), `còn từ nhạy cảm:${(r || "").trim()}`); }

  const items: SavedDraft[] = (saved || []).map((s: any, i: number) => ({
    id: s.id, title: s.title, pillar: rows[i]?._pillar || "",
    content_brief: s.content_brief || "",
    flagged: findBanned(String(s.content_brief || "")).length > 0,
    comments: buildSeedingComments(giu[i]?.d.comments),
  }));

  for (const it of items) {
    const url = await makeAndStoreImage(sb, it);
    if (url) it.imageUrl = url;
  }
  return { ok: true, saved: insertRows.length, drafts: g.drafts, items, flagged };
}

export const PAGE_BAT_BUOC = [

  "NOVA Beauty & Wellness (id 000000000000000 — trang đích cố định ở lib/content-duyet.ts)",
];

function khoiBaPage(): string {
  if (PAGE_BAT_BUOC.length === 1) {
    return `\u{1F4CC} <b>ĐĂNG LÊN PAGE:</b> ${tgEscape(PAGE_BAT_BUOC[0])}`;
  }
  return `\u{1F4CC} <b>ĐĂNG TỐI THIỂU ${PAGE_BAT_BUOC.length} PAGE:</b>\n` +
    PAGE_BAT_BUOC.map((p, i) => `${i + 1}. ${tgEscape(p)}`).join("\n") +
    `\n<i>Đủ cả ${PAGE_BAT_BUOC.length} page rồi mới bấm nút bên dưới.</i>`;
}

export const KHUNG_DANG: Record<string, string> = { trua: "11h30 trưa", toi: "20h00 tối" };

export async function pushDraftsToCEO(items: SavedDraft[], khung?: string): Promise<number> {

  const cfgChat = ((await getConfigValue("content_tg_chat").catch(() => "")) || "").trim();
  const ceo = (cfgChat || process.env.TELEGRAM_CONTENT_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!ceo || !items.length) return 0;
  let pushed = 0;
  for (const it of items) {
    const body = tgEscape(it.content_brief).slice(0, 2600);

    let gdBlock = "";
    try {
      const v = await reviewContent(it.title, it.content_brief);
      gdBlock = `\n\n${verdictBlock(v)}`;
    } catch { }
    const warn = it.flagged ? `\n\n\u{26A0} <b>CÒN TỪ NHẠY CẢM — máy sẽ chặn không đăng, bấm Sửa.</b>` : "";

    const gioDe = khung && KHUNG_DANG[khung] ? `\n\u{23F0} <b>Khung đề xuất: đăng lúc ${KHUNG_DANG[khung]}</b> — bấm Duyệt quanh giờ này là máy đăng ngay.` : "";
    const text = `\u{1F4DD} <b>Bài mới chờ duyệt</b>${it.pillar ? ` · <i>${tgEscape(it.pillar)}</i>` : ""}${gioDe}\n\n<b>${tgEscape(it.title)}</b>\n\n${body}${warn}${gdBlock}\n\n${khoiBaPage()}\n\n<i>Duyệt &amp; đăng: máy đăng ngay lên page + tự thả bình luận có link quiz. Sửa: bấm rồi TRẢ LỜI (reply) tin có nút kèm góp ý, máy viết lại. Chỉ CEO và người được giao duyệt mới bấm được.</i>`;
    const buttons = [[
      { text: "\u{2705} Duyệt & đăng", callback_data: `cpub:${it.id}` },
      { text: "Sửa", callback_data: `csua:${it.id}` },
      { text: "Bỏ", callback_data: `cdrop:${it.id}` },
    ]];

    let sent;
    if (it.imageUrl) {
      const cap = `\u{1F4DD} <b>Bài mới chờ duyệt</b>${it.pillar ? ` · <i>${tgEscape(it.pillar)}</i>` : ""}\n<b>${tgEscape(it.title)}</b>`;
      sent = await sendTelegramPhoto(it.imageUrl, cap, buttons, ceo);

      if (!sent.ok) sent = await sendTelegramWithButtons(text, buttons, ceo);
      else await sendTelegramWithButtons(text, [], ceo).catch(() => { });
    } else {
      sent = await sendTelegramWithButtons(text, buttons, ceo);
    }
    if (sent.ok) pushed++;
  }
  return pushed;
}

export async function runResearch(): Promise<{ ok: boolean; summary?: string; error?: string }> {
  if (!geminiConfigured()) return { ok: false, error: "chưa có GEMINI_API_KEY_BRAIN" };
  const q = `Bạn là chuyên viên nghiên cứu thị trường cho thương hiệu thực phẩm bổ sung & dưỡng sinh (khách chính: phụ nữ 30-55 tuổi Việt Nam). Hãy TRA GOOGLE và viết một BÁO CÁO NGHIÊN CỨU CHUYÊN SÂU về thị trường thực phẩm bổ sung và chăm sóc sức khoẻ tự nhiên tại Việt Nam ${new Date().getFullYear()}. Yêu cầu: CỤ THỂ, có SỐ LIỆU/DẪN CHỨNG/TÊN thương hiệu thật, tránh nói chung chung sáo rỗng. Trình bày theo 6 mục, mỗi mục 4-6 ý có chiều sâu:

1. XU HƯỚNG NỘI DUNG SỨC KHOẺ đang hot trên MXH VN gần đây (Facebook, TikTok, ngách nào đang lên, dạng nội dung nào — video/story/reel, hashtag/chủ đề cụ thể, ví dụ thật).
2. ĐỐI THỦ & THƯƠNG HIỆU nổi bật (nêu TÊN thương hiệu VN cụ thể, họ đánh nỗi đau nào, tuyến sản phẩm, cách họ làm content/ưu đãi/KOL, điểm hay đáng học và điểm yếu để mình chen vào).
3. CHÂN DUNG & NỖI ĐAU phụ nữ 30-55 tuổi VN (phân theo nhóm: mẹ bỉm, phụ nữ công sở, tiền mãn kinh...; nỗi đau THẬT theo từng nhóm, insight tâm lý, ngôn ngữ họ hay dùng khi than phiền — để làm câu mở bài).
4. GÓC BÀI VIẾT gợi ý cho tuần tới (5-8 chủ đề/tiêu đề cụ thể có thể viết ngay, gắn với nỗi đau ở mục 3, ghi rõ tầng phễu TOFU/MOFU/BOFU).
5. TỪ KHOÁ & CÂU HỎI khách hay tìm/hỏi quanh chủ đề sức khoẻ tự nhiên, ăn lành, mất ngủ, mệt mỏi, tiêu hoá (để tối ưu tìm kiếm + làm tiêu đề).
6. QUY ĐỊNH PHÁP LÝ mới về quảng cáo thực phẩm bổ sung tại VN cần lưu ý (từ ngữ cấm, rủi ro bị phạt, cách diễn đạt an toàn).

Viết tiếng Việt tự nhiên, có tiêu đề mục rõ ràng và gạch đầu dòng. Ưu tiên thông tin MỚI, CỤ THỂ, KHẢ THI để đội content dùng làm brief viết bài. Không dùng markdown ** hay ##, chỉ dùng gạch đầu dòng "•" và số thứ tự.

QUAN TRỌNG VỀ ĐỘ DÀI: Viết ĐẦY ĐỦ CẢ 6 MỤC, mỗi mục có chiều sâu. Tổng bài PHẢI dài TỐI THIỂU 5000 ký tự (khoảng 900-1200 từ). TUYỆT ĐỐI KHÔNG dừng giữa chừng — phải viết trọn tới hết mục 6.`;

  const rl = await agentLearningBrief("research");

  const r = await geminiSearch(rl ? `${q}\n\n${rl}\n(Dựa trên bài học trên, ưu tiên đào sâu hướng mới, tránh lặp cái đã biết.)` : q, { maxOutputTokens: 8000, temperature: 0.5, thinkingBudget: 1024 });
  if (!r.ok) return { ok: false, error: (r as any).error || "tra cứu lỗi" };
  if (!r.text?.trim()) return { ok: false, error: "tra cứu không trả về nội dung" };
  await saveResearch({ summary: r.text });
  return { ok: true, summary: r.text };
}
