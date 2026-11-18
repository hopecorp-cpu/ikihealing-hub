import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { sendTelegramMay } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { escapeHtml } from "@/lib/blog-nurture-chu";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const chan = await chanMay(req, [khoaCron()]);
  if (chan) return chan;
  const chiThu = new URL(req.url).searchParams.get("thu") === "1";

  const homNayVN = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const den = new Date(`${homNayVN}T00:00:00+07:00`);
  const tu = new Date(den.getTime() - 86400e3);
  const ngayChu = new Date(tu.getTime() + 7 * 3600e3).toISOString().slice(0, 10).split("-").reverse().slice(0, 2).join("/");

  const sb = getServiceClient();
  const { data, error } = await sb.from("cuoc_goi")
    .select("sale,chieu,thoi_luong_giay,trang_thai,diem,cham,bat_dau")
    .gte("bat_dau", tu.toISOString()).lt("bat_dau", den.toISOString()).limit(1000);
  if (error) return NextResponse.json({ ok: false, loi: error.message }, { status: 500 });
  const ds = data || [];
  if (!ds.length) {

    const { count } = await sb.from("cuoc_goi").select("id", { count: "exact", head: true });
    if (!count) return NextResponse.json({ ok: true, chua_dung: true });
  }

  const theoSale = new Map<string, { goi: number; di: number; den: number; cham: number; tongDiem: number; phut: number }>();
  const demTag = new Map<string, number>();
  const viPham: string[] = [];
  let daCham = 0, quaNgan = 0, loi = 0, cho = 0;
  for (const c of ds as any[]) {
    const ten = c.sale || "(chưa gán)";
    const s = theoSale.get(ten) || { goi: 0, di: 0, den: 0, cham: 0, tongDiem: 0, phut: 0 };
    s.goi++; s[c.chieu === "den" ? "den" : "di"]++; s.phut += (c.thoi_luong_giay || 0) / 60;
    if (c.trang_thai === "da_cham" && c.diem != null) { s.cham++; s.tongDiem += c.diem; daCham++; }
    else if (c.trang_thai === "qua_ngan") quaNgan++;
    else if (c.trang_thai === "loi") loi++;
    else cho++;
    theoSale.set(ten, s);
    for (const t of (c.cham?.tags || []) as string[]) {
      demTag.set(t, (demTag.get(t) || 0) + 1);
      if (t.startsWith("VI PHẠM")) viPham.push(`${ten} lúc ${new Date(new Date(c.bat_dau).getTime() + 7 * 3600e3).toISOString().slice(11, 16)} — ${t.replace("VI PHẠM: ", "")}`);
    }
  }

  const dong: string[] = [`CUỘC GỌI CÓ GHI ÂM — ${ngayChu}`];
  if (!ds.length) {
    dong.push("Không có cuộc nào được đẩy lên.", "Đề xuất: kiểm app ACME Ghi âm trên từng máy (mở app xem dòng trạng thái) — máy có gọi mà không đẩy là app bị tắt nền hoặc chưa bật tự động ghi âm.");
  } else {
    dong.push(`Tổng ${ds.length} cuộc: đã chấm ${daCham}, dưới 30 giây ${quaNgan}, lỗi ${loi}${cho ? `, còn chờ chấm ${cho}` : ""}.`, "");
    for (const [ten, s] of [...theoSale.entries()].sort((a, b) => b[1].goi - a[1].goi)) {
      const tb = s.cham ? (s.tongDiem / s.cham).toFixed(1) : "—";
      dong.push(`${ten}: ${s.goi} cuộc (gọi đi ${s.di}, khách gọi đến ${s.den}), ${Math.round(s.phut)} phút, điểm TB ${tb}/10`);
    }
    const topTag = [...demTag.entries()].filter(([t]) => !t.startsWith("VI PHẠM")).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (topTag.length) dong.push("", "Lỗi hay gặp: " + topTag.map(([t, n]) => `${t} (${n})`).join(", "));
    if (viPham.length) dong.push("", `VI PHẠM PHÁT NGÔN ${viPham.length} cuộc — nghe lại ngay:`, ...viPham.slice(0, 8));
    dong.push("", "Đề xuất: " + (viPham.length
      ? "nghe lại các cuộc vi phạm cùng sale trong hôm nay, sửa câu nói trước khi gọi tiếp."
      : topTag.length ? `buổi kèm 15 phút cho cả đội về "${topTag[0][0]}" — lỗi gặp nhiều nhất hôm qua.` : "giữ nhịp, xem cuộc điểm cao nhất để nhân bản cách nói."));
    if (loi || cho > 10) dong.push(`Máy chấm: ${loi} cuộc lỗi${cho > 10 ? `, ${cho} cuộc còn tồn` : ""} — xem config cham_cuoc_goi_status.`);
  }
  dong.push("", "Nghe và đọc từng cuộc: " + appLink("/cuoc-goi"));
  const text = dong.join("\n");

  if (chiThu) return NextResponse.json({ ok: true, thu: true, text });
  const gui = await sendTelegramMay("cuoc-goi", escapeHtml(text));
  if (!gui.ok) return NextResponse.json({ ok: false, loi: "gửi Telegram hỏng", gui }, { status: 500 });
  await setConfigValue("bao_cao_cuoc_goi_last", JSON.stringify({ at: new Date().toISOString(), ngay: ngayChu, tong: ds.length }), "Nhịp báo cáo cuộc gọi hằng ngày");
  return NextResponse.json({ ok: true, tong: ds.length });
}
