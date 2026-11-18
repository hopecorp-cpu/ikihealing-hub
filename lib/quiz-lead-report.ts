import { getServiceClient } from "@/lib/supabase-server";
import { appLink } from "@/lib/app-url";
import { getQuizSubmissions, sdtQuiz } from "@/lib/quiz-leads";
import { nhanPhanHoi, sdt0 } from "@/lib/quiz-cham-soc";

type Row = { id: string; customer_name: string | null; phone: string | null; note: string | null; external_id: string | null; source: string | null; assigned_at: string | null; created_at: string; users: { full_name: string } | null };

const CHUONG_TRINH: { tienTo: string; ten: string; loTrinh: string; canSdt?: boolean }[] = [
  { tienTo: "quiz:", ten: "QUIZ THỂ TRẠNG (example.com/quiz)", loTrinh: "Mở đầu bằng đúng thể trạng của họ, gửi thực đơn 3 ngày. Kịch bản: " },
  { tienTo: "ebook:", ten: "EBOOK 100 MÓN ĐỦ ĐẠM (camp 20/08)", loTrinh: "Nhắn Zalo hỏi đã tải được sách chưa, gửi lại file + mời đo thể trạng. Chốt bằng BỘ KHỞI ĐẦU ĐỦ ĐẠM (CEO 21/08): đơn đạm ĐẦU TIÊN tặng 1 hộp Trà Mẫu B 226k + PDF thực đơn 7 ngày — đơn ghi nguồn ebook-deal PHẢI kèm đủ hai quà. Khách chê đạm đắt/chưa sẵn sàng thì DOWNSALE sang 1 hộp Trà Mẫu B 226k — FREESHIP + tặng thực đơn 3 ngày theo thể trạng gửi Zalo (nguồn ebook-deal-tra)." },
  { tienTo: "sp:", ten: "SALE PAGE (để số / đặt dở)", loTrinh: "Gọi sớm — khách đang cân nhắc mua, hỏi họ vướng gì ở bước đặt hàng." },
  { tienTo: "fbc:", ten: "BÌNH LUẬN FANPAGE (để SĐT)", loTrinh: "Nhắn Zalo/gọi theo đúng nội dung họ bình luận (xem link bình luận trong lead).", canSdt: true },
];

const TRAN_LIET_KE = 8;

const TRAN_GHI_CHU = 6;

async function khoiDaBaoCao(sb: any): Promise<string[]> {
  const tu = new Date(Date.now() - 24 * 3600e3).toISOString();
  const { data } = await sb
    .from("care_events")
    .select("customer_phone, customer_name, sale_name, outcome, content, created_at")
    .not("outcome", "is", null)
    .gte("created_at", tu)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data || []) as any[];
  if (!rows.length) return [];

  const dem: Record<string, number> = {};
  for (const r of rows) dem[r.outcome] = (dem[r.outcome] || 0) + 1;
  const ds = [
    `== SALE ĐÃ BÁO CÁO 24H QUA — ${rows.length} lượt ==`,
    Object.entries(dem).sort((a, b) => b[1] - a[1]).map(([o, n]) => `${nhanPhanHoi(o) || o}: ${n}`).join(" · "),
  ];
  for (const r of rows.slice(0, TRAN_GHI_CHU)) {
    const ten = r.customer_name || sdt0(r.customer_phone) || "(chưa tên)";
    const chu = String(r.content || "").replace(/\s+/g, " ").slice(0, 110);
    ds.push(`  - ${ten} · ${nhanPhanHoi(r.outcome) || r.outcome}${r.sale_name ? ` · ${r.sale_name}` : ""}${chu ? `: ${chu}` : ""}`);
  }
  if (rows.length > TRAN_GHI_CHU) ds.push(`  ... còn ${rows.length - TRAN_GHI_CHU} báo cáo nữa — xem đủ: ${appLink("/leads")}`);
  ds.push("");
  return ds;
}

export async function buildQuizLeadReport(): Promise<{ text: string; tong: number; theoSale: Record<string, number> }> {
  const sb = getServiceClient();

  const rows: Row[] = [];
  for (let from = 0; from < 4000; from += 1000) {
    const { data } = await sb
      .from("leads")
      .select("id, customer_name, phone, note, external_id, source, assigned_at, created_at, users:assignee_id(full_name)")
      .or(CHUONG_TRINH.map((c) => `external_id.like.${c.tienTo}%`).join(","))
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    rows.push(...((data || []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const lucLamQuiz: Record<string, number> = {};
  try {
    for (const q of await getQuizSubmissions()) { const p = sdtQuiz(q.phone); if (p && (!lucLamQuiz[p] || q.ts < lucLamQuiz[p])) lucLamQuiz[p] = q.ts; }
  } catch {  }

  const theoSale: Record<string, number> = {};
  const now = Date.now();
  const khoi: string[] = [];

  let soDoc = 0;

  for (const ct of CHUONG_TRINH) {
    const tatCa = rows.filter((r) => (r.external_id || "").startsWith(ct.tienTo));

    const dsCt = ct.canSdt ? tatCa.filter((r) => (r.phone || "").trim().length >= 9) : tatCa;
    const khongSo = tatCa.length - dsCt.length;
    if (!dsCt.length) {
      if (khongSo) khoi.push(`== ${ct.ten} — 0 khách gọi được (${khongSo} người chỉ có tên Facebook, không để số) ==`, "");
      continue;
    }
    soDoc += dsCt.length;
    khoi.push(`== ${ct.ten} — ${dsCt.length} khách ==`);
    if (khongSo) khoi.push(`(Thêm ${khongSo} người bình luận nhưng KHÔNG để số — không gọi được, máy trả lời bình luận lo phần này.)`);
    khoi.push(`Lộ trình: ${ct.loTrinh}${ct.tienTo === "quiz:" ? appLink("/quiz-leads") : ""}`);
    const nhom: Record<string, Row[]> = {};
    for (const r of dsCt) (nhom[r.users?.full_name || "CHƯA GIAO AI"] ||= []).push(r);
    for (const [sale, ds] of Object.entries(nhom).sort((a, b) => b[1].length - a[1].length)) {
      theoSale[sale] = (theoSale[sale] || 0) + ds.length;
      khoi.push(`>> ${sale}: ${ds.length} khách chưa chạm`);
      for (const r of ds.slice(0, TRAN_LIET_KE)) {

        const the = (r.note || "").replace(/^Quiz thể trạng:\s*/, "").replace(/^Nhận ebook [^.]*\.\s*/, "").split(" · ").slice(0, 3).join(" · ").slice(0, 110);
        const moc = (r.external_id || "").startsWith("quiz:") && r.phone && lucLamQuiz[r.phone] ? lucLamQuiz[r.phone] : new Date(r.created_at).getTime();
        const ngay = Math.floor((now - moc) / 864e5);
        khoi.push(`  - ${r.customer_name || "(chưa tên)"} · ${r.phone || "?"}${the ? ` · ${the}` : ""}${ngay ? ` · chờ ${ngay} ngày` : " · hôm nay"}`);
      }
      if (ds.length > TRAN_LIET_KE) khoi.push(`  ... và ${ds.length - TRAN_LIET_KE} khách nữa — xem đủ: ${appLink("/leads")}`);
    }
    khoi.push("");
  }

  let daBaoCao: string[] = [];
  try { daBaoCao = await khoiDaBaoCao(sb); } catch { daBaoCao = []; }

  const text = rows.length
    ? [
      `KHÁCH TỪ CÁC CHƯƠNG TRÌNH CHƯA AI CHẠM — ${soDoc} người gọi được`,
      `Khách TỰ để lại số qua các phễu của NOVA. Danh sách nhóm theo chương trình để biết mở đầu thế nào.`,
      ``,
      ...khoi,
      ...daBaoCao,
      `Gọi xong bấm "Báo cáo" ngay trên dòng khách để chọn tình trạng (không nghe máy / không có nhu cầu / chưa kết bạn Zalo…) kèm ghi chú: ${appLink("/leads")}`,
    ].join("\n")
    : "";
  return { text, tong: soDoc, theoSale };
}
