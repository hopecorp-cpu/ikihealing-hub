import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { randomBytes } from "crypto";
import { appLink } from "@/lib/app-url";
import { duocXinReconnect } from "@/lib/zalo-reconnect";

export const dynamic = "force-dynamic";

const doc = async (sb: any, key: string) => { const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle(); try { return JSON.parse(data?.value || "null"); } catch { return null; } };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });
  const sb = getServiceClient();
  const [yeuCau, trangThai, cauNoi] = await Promise.all([doc(sb, "zalo_ket_noi_yeu_cau"), doc(sb, "zalo_ket_noi_trang_thai"), doc(sb, "zalo_cau_noi_last")]);
  const cauNoiSong = !!cauNoi?.at && Date.now() - Date.parse(cauNoi.at) < 30_000;
  return NextResponse.json({ yeuCau, trangThai, cauNoi: { song: cauNoiSong, at: cauNoi?.at || null, dang: cauNoi?.dang || [], phien: cauNoi?.phien || [] } });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });

  const b = await req.json().catch(() => ({} as any));
  const nick = String(b.nick || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!nick || nick.length > 20) return NextResponse.json({ loi: "Tên nick không hợp lệ (chữ thường/số/gạch ngang, ví dụ: tien, yen)" }, { status: 400 });

  const quanLy = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role);
  if (!quanLy) {
    const ok = await duocXinReconnect(user, nick);
    if (!ok) return NextResponse.json({ loi: "Chỉ nối lại được nick Zalo đã gán cho bạn" }, { status: 403 });
  }

  const sb = getServiceClient();
  const luc = new Date().toISOString();
  await sb.from("config").upsert({ key: "zalo_ket_noi_yeu_cau", value: JSON.stringify({ nick, boi: user.full_name || user.email, luc, trangThai: "cho" }) }, { onConflict: "key" });
  await sb.from("config").upsert({ key: "zalo_ket_noi_trang_thai", value: JSON.stringify({ nick, buoc: "cho-may", luc }) }, { onConflict: "key" });

  const canLink = !!b.taoLink || !quanLy;
  if (canLink) {
    const token = randomBytes(16).toString("hex");
    await sb.from("config").upsert({
      key: "zalo_quet_link",
      value: JSON.stringify({ token, nick, boi: user.full_name || user.email, luc, dung: false }),
      description: "Link mot lan cho nhan vien quet QR noi nick Zalo (han 15 phut) — /quet-zalo/<token>",
    }, { onConflict: "key" });
    return NextResponse.json({ ok: true, nick, link: appLink(`/quet-zalo/${token}`) });
  }

  return NextResponse.json({ ok: true, nick });
}
