import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { sendTelegramMay } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { escapeHtml } from "@/lib/blog-nurture-chu";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { NGAY_RA_DON, gomDonTheoSdt, raDon } from "@/lib/cuoc-goi";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "claude-opus-5-5";
const MAU_MOI_BEN = 12;
const KY_TU_MOI_CUOC = 6000;
const THANG_TOI_THIEU = 3;

const SYS = `Bạn là giám đốc kinh doanh của ACME/NOVA (thực phẩm bổ sung: trà, bột đạm, cà phê thảo mộc). Bạn nhận bản chép lời các cuộc gọi của đội sale, chia hai nhóm theo KẾT QUẢ THẬT: nhóm THẮNG (khách đặt đơn trong ${NGAY_RA_DON} ngày sau cuộc gọi) và nhóm THUA (không ra đơn).

Việc của bạn: tìm ra cái nhóm THẮNG làm mà nhóm THUA không làm — đó là kịch bản bán hàng cần nhân bản cho cả đội.

RÀO PHÁP LÝ — QUAN TRỌNG HƠN DOANH SỐ:
- Sản phẩm là THỰC PHẨM BỔ SUNG, không phải thuốc. Câu nào nói sản phẩm chữa/trị/khỏi bệnh, thải độc, giảm cân, thay thuốc, hoặc tác động lên bệnh của khách thì TUYỆT ĐỐI KHÔNG đưa vào kịch bản mẫu — dù cuộc đó ra đơn. Gặp câu như vậy trong nhóm thắng thì nêu riêng ở mục "Cần sửa ngay" (ghi tên sale, không chép lời khách).
- Khuyến mãi là TẶNG QUÀ, không giảm giá %.
- Không chép tên, SĐT, địa chỉ, bệnh của khách vào bài.

VIẾT CHỮ THƯỜNG, KHÔNG markdown (không **, không #, không bảng). Đúng các mục sau, mỗi mục vài gạch đầu dòng ngắn bằng dấu "-":
1. Mở đầu thắng: câu/cách mở mà nhóm thắng dùng (trích nguyên văn lời SALE, ngắn).
2. Hỏi nhu cầu: hỏi gì, hỏi lúc nào.
3. Xử lý từ chối: các lời từ chối hay gặp và cách nhóm thắng đáp (trích lời sale).
4. Chốt: thời điểm và câu chốt.
5. Nhóm thua hay vấp ở đâu.
6. Cần sửa ngay (vi phạm phát ngôn, nếu có).
7. Ba đề xuất cụ thể cho đội tuần tới.
Mẫu nhỏ thì nói rõ là mẫu nhỏ, đừng khẳng định quá dữ liệu.`;

export async function GET(req: Request) {
  const chan = await chanMay(req, [khoaCron()]);
  if (chan) return chan;
  const chiThu = new URL(req.url).searchParams.get("thu") === "1";
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) return NextResponse.json({ ok: false, loi: "thiếu ANTHROPIC_API_KEY" }, { status: 500 });

  const tu = new Date(Date.now() - 21 * 86400e3), den = new Date(Date.now() - NGAY_RA_DON * 86400e3);
  const sb = getServiceClient();

  const layHet = async (q: () => any) => {
    let ra: any[] = [];
    for (let off = 0; off < 50000; off += 1000) {
      const { data, error } = await q().range(off, off + 999);
      if (error) return { ra, loi: error.message as string };
      ra = ra.concat(data || []);
      if (!data || data.length < 1000) break;
    }
    return { ra, loi: null };
  };
  const rc = await layHet(() => sb.from("cuoc_goi")
    .select("id,sale,sdt,chieu,bat_dau,thoi_luong_giay,diem,ban_chep")
    .eq("trang_thai", "da_cham").gte("bat_dau", tu.toISOString()).lt("bat_dau", den.toISOString())
    .order("bat_dau", { ascending: true }));
  const rd = await layHet(() => sb.from("tg_orders").select("sdt,ngay").gte("ngay", tu.toISOString().slice(0, 10)).order("id"));
  if (rc.loi || rd.loi) return NextResponse.json({ ok: false, loi: rc.loi || rd.loi }, { status: 500 });
  const cuoc = rc.ra, don = rd.ra;

  const theoSdt = gomDonTheoSdt(don);
  const thang = cuoc.filter((c: any) => raDon(c, theoSdt));
  const thua = cuoc.filter((c: any) => !raDon(c, theoSdt) && c.thoi_luong_giay >= 90);
  const khoang = `${tu.toISOString().slice(0, 10)} → ${den.toISOString().slice(0, 10)}`;

  let noiDung: string;
  if (thang.length < THANG_TOI_THIEU) {
    noiDung = `Chưa đủ dữ liệu: mới có ${thang.length} cuộc gọi ra đơn trong khoảng ${khoang} (cần ít nhất ${THANG_TOI_THIEU}). Tổng ${cuoc.length} cuộc đã chấm.`;
  } else {

    const chon = (ds: any[]) => [...ds].sort((a, b) => b.thoi_luong_giay - a.thoi_luong_giay).slice(0, MAU_MOI_BEN);
    const viet = (ds: any[], nhan: string) => ds.map((c, i) =>
      `=== ${nhan} ${i + 1} — sale ${c.sale || "?"}, ${c.chieu === "den" ? "khách gọi đến" : "sale gọi đi"}, ${Math.round(c.thoi_luong_giay / 60)} phút, điểm máy chấm ${c.diem ?? "?"}/10 ===\n${String(c.ban_chep || "").slice(0, KY_TU_MOI_CUOC)}`).join("\n\n");
    const tin = `NHÓM THẮNG (${thang.length} cuộc ra đơn, đưa ${Math.min(thang.length, MAU_MOI_BEN)}):\n\n${viet(chon(thang), "THẮNG")}\n\n\nNHÓM THUA (${thua.length} cuộc không ra đơn, đưa ${Math.min(thua.length, MAU_MOI_BEN)}):\n\n${viet(chon(thua), "THUA")}`;
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 6000, system: SYS, messages: [{ role: "user", content: tin }] }),
    });
    const j: any = await res.json().catch(() => ({}));
    ghiNhatKyAI({ noi: "kich-ban-thang", model: MODEL, inTok: j?.usage?.input_tokens, outTok: j?.usage?.output_tokens, ms: Date.now() - t0, ok: res.ok });
    const text = (j?.content?.find((b: any) => b.type === "text")?.text || "").trim();
    if (!res.ok || !text) return NextResponse.json({ ok: false, loi: j?.error?.message || `HTTP ${res.status}` }, { status: 500 });
    noiDung = text;
  }

  const ketQua = { at: new Date().toISOString(), khoang, thang: thang.length, thua: thua.length, tong: cuoc.length, noiDung };
  if (chiThu) return NextResponse.json({ ok: true, thu: true, ...ketQua });

  if (!cuoc.length) return NextResponse.json({ ok: true, chua_dung: true });

  await setConfigValue("kich_ban_thang", JSON.stringify(ketQua), "Kịch bản bán hàng thắng — so cuộc gọi ra đơn và không ra đơn (cron kich-ban-thang)");
  const tom = noiDung.length > 2500 ? noiDung.slice(0, 2500) + "\n..." : noiDung;
  const gui = await sendTelegramMay("cuoc-goi", escapeHtml(
    `KỊCH BẢN THẮNG TUẦN NÀY (${khoang}, ${thang.length} cuộc ra đơn / ${thua.length} cuộc không ra đơn)\n\n${tom}\n\nBản đầy đủ: ${appLink("/cuoc-goi")}`));
  if (!gui.ok) return NextResponse.json({ ok: false, loi: "gửi Telegram hỏng", gui }, { status: 500 });
  return NextResponse.json({ ok: true, khoang, thang: thang.length, thua: thua.length });
}
