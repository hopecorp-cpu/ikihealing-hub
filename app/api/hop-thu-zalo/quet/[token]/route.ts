import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const doc = async (sb: any, key: string) => {
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  try { return JSON.parse(data?.value || "null"); } catch { return null; }
};

const HAN_MS = 15 * 60 * 1000;

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = String(params.token || "");
  if (!/^[a-f0-9]{32}$/.test(token)) return NextResponse.json({ loi: "Link không hợp lệ" }, { status: 404 });

  const sb = getServiceClient();
  const link = await doc(sb, "zalo_quet_link");
  if (!link?.token || link.token !== token) return NextResponse.json({ loi: "Link không còn dùng được. Nhờ quản lý tạo link mới." }, { status: 404 });

  const tuoi = Date.now() - Date.parse(link.luc || 0);
  if (link.dung) return NextResponse.json({ loi: "Link này đã dùng xong (nick đã nối). Cần nối lại thì nhờ quản lý tạo link mới." }, { status: 410 });
  if (!(tuoi < HAN_MS)) return NextResponse.json({ loi: "Link đã quá 15 phút. Nhờ quản lý tạo link mới." }, { status: 410 });

  const [tt, cauNoi] = await Promise.all([doc(sb, "zalo_ket_noi_trang_thai"), doc(sb, "zalo_cau_noi_last")]);
  const maySong = !!cauNoi?.at && Date.now() - Date.parse(cauNoi.at) < 60_000;

  const hopNick = tt?.nick === link.nick;
  const ttCu = !tt?.luc || Date.now() - Date.parse(tt.luc) > HAN_MS;
  if (!hopNick || ttCu || tt?.buoc === "het-han") {
    const luc = new Date().toISOString();
    await sb.from("config").upsert({ key: "zalo_ket_noi_yeu_cau", value: JSON.stringify({ nick: link.nick, boi: `link cua ${link.boi}`, luc, trangThai: "cho" }) }, { onConflict: "key" });
    await sb.from("config").upsert({ key: "zalo_ket_noi_trang_thai", value: JSON.stringify({ nick: link.nick, buoc: "cho-may", luc }) }, { onConflict: "key" });
    return NextResponse.json({ nick: link.nick, buoc: "cho-may", luc, maySong, conLai: Math.max(0, HAN_MS - tuoi) });
  }

  if (tt?.buoc === "da-noi" && !link.dung) {
    await sb.from("config").upsert({ key: "zalo_quet_link", value: JSON.stringify({ ...link, dung: true, xongLuc: new Date().toISOString() }) }, { onConflict: "key" });
  }

  return NextResponse.json({
    nick: link.nick, buoc: tt.buoc, luc: tt.luc, qr: tt.qr || null,
    luot: tt.luot || 1, ten: tt.ten || null, maySong, conLai: Math.max(0, HAN_MS - tuoi),
  });
}
