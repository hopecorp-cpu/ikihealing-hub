import { NextResponse } from "next/server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { callClaude } from "@/lib/covan/advisor";
import { covanSendCEO, covanSendDocumentCEO, covanTelegramConfigured } from "@/lib/covan/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  try {
    const raw = await getConfigValue("ad_library_scout");
    if (!raw) return NextResponse.json({ ok: false, error: "Chưa có dữ liệu trinh sát (script local chưa chạy?)" }, { status: 200 });
    const scout = JSON.parse(raw);
    const ageDays = Math.floor((Date.now() - new Date(scout.at).getTime()) / 864e5);

    const lines: string[] = [`# DỮ LIỆU TRINH SÁT AD LIBRARY (cào ${scout.at.slice(0, 10)}, ${ageDays} ngày tuổi)`];
    for (const k of scout.keywords || []) {
      lines.push(`\n## Từ khóa "${k.kw}" — trang tìm kiếm: ${k.url}`);
      for (const a of k.advertisers || []) {
        lines.push(`- ${a.name} | ${a.count} ads | page: ${a.fbUrl}${a.adLinks?.length ? ` | xem ad: ${a.adLinks.join(" , ")}` : ""}`);
        for (const s of a.samples || []) lines.push(`  * mẫu: ${s.slice(0, 300)}`);
      }
    }

    try {
      const prevRaw = await getConfigValue("ad_library_scout_prev");
      if (prevRaw) {
        const prev = JSON.parse(prevRaw);
        const oldAds = new Set<string>();
        const oldPages = new Set<string>();
        for (const k of prev.keywords || []) for (const a of k.advertisers || []) {
          oldPages.add(a.fbUrl);
          for (const l of a.adLinks || []) oldAds.add(l);
        }
        const newAdvertisers: string[] = [];
        let newAdCount = 0;
        for (const k of scout.keywords || []) for (const a of k.advertisers || []) {
          if (!oldPages.has(a.fbUrl)) newAdvertisers.push(`${a.name} (${a.fbUrl})`);
          for (const l of a.adLinks || []) if (!oldAds.has(l)) newAdCount++;
        }
        lines.push(
          `\n# SO VỚI LẦN CÀO TRƯỚC (${String(prev.at || "").slice(0, 10)})`,
          `- Nhà quảng cáo MỚI xuất hiện: ${newAdvertisers.length ? newAdvertisers.slice(0, 10).join("; ") : "không có"}`,
          `- Số quảng cáo mới chưa từng thấy: ${newAdCount}`,
          `LƯU Ý CHO BÁO CÁO: mở đầu bằng CÁI MỚI hôm nay; phần đối thủ cũ chỉ nhắc khi có thay đổi đáng kể.`
        );
      }
    } catch {  }

    const facts = lines.join("\n").replace(/[\uD800-\uDFFF]/g, "");

    const out = await callClaude(
      [{ role: "user", content: facts.slice(0, 55_000) }],
      "Bạn là trinh sát quảng cáo của ACME (đạm thực vật là thực phẩm bổ sung; trà thảo mộc không phải thực phẩm bổ sung), xưng 'em', gọi CEO là 'anh'. " +
        "Từ dữ liệu Ad Library dưới đây: (1) LỌC bỏ nhà quảng cáo không cùng ngành sức khỏe/thực phẩm (spa, tiếng Anh, kiến trúc...). " +
        "(2) Chọn tối đa 8 đối thủ đáng học nhất, mỗi đối thủ 3-4 dòng: Tên — link page và link xem ad (COPY NGUYÊN VĂN link từ dữ liệu, cấm tự chế link) — hook họ dùng — góc tấn công — ưu đãi. " +
        "(3) Chốt: 3 điều ACME nên HỌC và 2 điều nên TRÁNH (đối chiếu luật ACME: tặng quà không giảm %, không claim chữa/trị). " +
        "Chữ thuần không markdown, không emoji, tiếng Việt đủ dấu. Tối đa 45 dòng.",
      6000
    );
    const digest = out.trim() || facts.slice(0, 3000);
    await setConfigValue("ad_scout_digest", JSON.stringify({ at: new Date().toISOString(), digest }), "Digest trinh sát Ad Library tuần (content factory đọc)");

    if (url.searchParams.get("dry") === "1") return NextResponse.json({ ok: true, dry: true, digest });
    if (!covanTelegramConfigured()) return NextResponse.json({ ok: false, error: "Chưa cấu hình COVAN bot" });

    const head = `TRINH SÁT QUẢNG CÁO ĐỐI THỦ — thứ Hai\n(dữ liệu Ad Library cào ${scout.at.slice(0, 10)})\n\n`;
    const sent = await covanSendCEO(head + digest);

    await covanSendDocumentCEO(`trinh-sat-ads-${new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)}.md`, `${head}${digest}\n\n---\nDỮ LIỆU THÔ\n${facts}`);
    return NextResponse.json({ ok: sent.ok, age_days: ageDays });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
