import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { docAlias, doanTheoAlias, docMapTg, ghiMapTg } from "@/lib/sale-tg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TEN_TOKEN = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_SALE_BOT_TOKEN", "TELEGRAM_BRAIN_BOT_TOKEN", "COVAN_BOT_TOKEN"];

const KHOA_NHOM = ["doc-viec-sale", "lead-nong"];

type ThanhVien = { tgId: string; ten: string; username?: string; nhom: string };

async function goiTelegram(token: string, method: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}?${qs}`, { cache: "no-store" });
  return r.json().catch(() => ({ ok: false }));
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) {
    return NextResponse.json({ ok: false, loi: "Cần đăng nhập bằng tài khoản quản lý trở lên" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sb = getServiceClient();
  const ghi = url.searchParams.get("ghi") === "1";

  const gan = url.searchParams.get("gan");
  if (gan) {
    const [acmeId, tgId] = gan.split(":");
    if (!acmeId || !tgId) return NextResponse.json({ ok: false, loi: "Dạng đúng: ?gan=<acmeUserId>:<tgUserId>" }, { status: 400 });
    const doi = await ghiMapTg(sb, acmeId.trim(), tgId.trim());
    const { data: u } = await sb.from("users").select("full_name").eq("id", acmeId.trim()).maybeSingle();
    return NextResponse.json({
      ok: true, ganTay: true, ai: u?.full_name || acmeId, tgId,
      ketQua: doi ? "đã ghi" : "giữ nguyên (người này đã có mã rồi)",
    });
  }

  let nhomList: { id: string; ten: string }[] = [];
  const ep = url.searchParams.get("nhom");
  if (ep) {
    nhomList = [{ id: ep, ten: ep }];
  } else {
    let dt: any = {};
    try {
      const raw = (await sb.from("config").select("value").eq("key", "tg_dinh_tuyen").maybeSingle()).data?.value;
      dt = typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
    } catch { }
    for (const k of KHOA_NHOM) if (dt[k]?.chat) nhomList.push({ id: String(dt[k].chat), ten: String(dt[k].nhom || k) });
  }
  if (!nhomList.length) return NextResponse.json({ ok: false, loi: "Không tìm thấy nhóm nào trong config tg_dinh_tuyen" }, { status: 400 });

  const tokens = TEN_TOKEN.map((n) => ({ ten: n, token: (process.env[n] || "").trim() })).filter((t) => t.token);
  if (!tokens.length) return NextResponse.json({ ok: false, loi: "Chưa có token bot nào trên máy chủ" }, { status: 500 });

  const thanhVien: ThanhVien[] = [];
  const loiNhom: { nhom: string; loi: string }[] = [];
  for (const n of nhomList) {
    let xong = false;
    for (const t of tokens) {
      const j: any = await goiTelegram(t.token, "getChatAdministrators", { chat_id: n.id });
      if (!j?.ok) continue;
      for (const m of j.result || []) {
        const u = m.user || {};
        if (u.is_bot) continue;
        thanhVien.push({
          tgId: String(u.id),
          ten: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
          username: u.username || undefined,
          nhom: n.ten,
        });
      }
      xong = true;
      break;
    }
    if (!xong) loiNhom.push({ nhom: n.ten, loi: "không bot nào đọc được nhóm này (chưa được mời vào?)" });
  }

  const alias = await docAlias(sb);
  const { data: users } = await sb.from("users").select("id, full_name, position").eq("active", true);
  const tenById: Record<string, string> = {};
  for (const u of users || []) tenById[u.id] = u.full_name || "";
  const mapCu = await docMapTg(sb);

  const nhanRa: any[] = [];
  const chuaNhanRa: any[] = [];
  for (const tv of thanhVien) {
    const uid = doanTheoAlias(`${tv.ten} ${tv.username || ""}`, alias);
    if (!uid) { chuaNhanRa.push(tv); continue; }
    const daCo = mapCu[uid] ? String(mapCu[uid]) : null;
    let ketQua = "xem thử — chưa ghi";
    if (ghi) ketQua = (await ghiMapTg(sb, uid, tv.tgId)) ? "đã ghi" : (daCo === tv.tgId ? "đã có sẵn" : "giữ mã cũ");
    nhanRa.push({ tenTelegram: tv.ten, nhom: tv.nhom, tgId: tv.tgId, laAi: tenById[uid] || uid, acmeUserId: uid, maCu: daCo, ketQua });
  }

  const conThieu = (users || [])
    .filter((u: any) => Object.keys(alias).includes(u.id))
    .filter((u: any) => !(nhanRa.some((x) => x.acmeUserId === u.id) || mapCu[u.id]))
    .map((u: any) => ({ ten: u.full_name, acmeUserId: u.id }));

  return NextResponse.json({
    ok: true,
    cheDo: ghi ? "ĐÃ GHI vào sổ map" : "chỉ xem thử — thêm ?ghi=1 để ghi",
    nhomDaQuet: nhomList.map((n) => n.ten),
    loiNhom,
    nhanRa,
    chuaNhanRa: chuaNhanRa.map((t) => ({ tenTelegram: t.ten, nhom: t.nhom, tgId: t.tgId, goiY: "gán tay: ?gan=<acmeUserId>:" + t.tgId })),
    conThieu,
    ghiChu: conThieu.length
      ? "Người còn thiếu không phải quản trị viên nhóm. Họ chỉ cần gõ một tin bất kỳ trong nhóm là máy tự nhớ mã (cần tắt chế độ riêng tư của bot ở BotFather)."
      : "Đủ người rồi — tin đốc việc sẽ tag đích danh trong nhóm.",
  });
}
