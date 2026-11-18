import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { nickChoPhep } from "@/lib/hop-thu-zalo-server";
import { datChatbot, xinDoiKhoaGui, docCaiDatNhom } from "@/lib/zalo-nhom-cai-dat";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });

  let than: any = null;
  try { than = await req.json(); } catch {  }
  const ma = String(than?.ma || "").trim();
  if (!ma.includes("|")) return NextResponse.json({ loi: "Thiếu mã nhóm" }, { status: 400 });

  const duocXem = await nickChoPhep(user);
  const ownId = ma.split("|")[0];
  if (duocXem !== null && !duocXem.includes(ownId)) {
    return NextResponse.json({ loi: "Không có quyền với nhóm của nick này" }, { status: 403 });
  }

  const boi = String(user.full_name || user.email || "?");
  const ten = than?.ten ? String(than.ten).slice(0, 200) : undefined;

  try {
    if (typeof than?.chatbot === "boolean") {
      const sau = await datChatbot(ma, than.chatbot, boi, ten);
      return NextResponse.json({ ok: true, caiDat: sau });
    }
    if (typeof than?.khoaGui === "boolean") {
      if (duocXem !== null) {
        return NextResponse.json({ loi: "Chỉ quản lý mới khoá/mở nhóm được" }, { status: 403 });
      }
      const sau = await xinDoiKhoaGui(ma, than.khoaGui, boi, ten);
      return NextResponse.json({ ok: true, caiDat: sau, chuMay: true });
    }
    return NextResponse.json({ loi: "Không có công tắc nào trong yêu cầu" }, { status: 400 });
  } catch (e: any) {

    return NextResponse.json({ loi: e?.message || "Lỗi không rõ" }, { status: 500 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });
  const duocXem = await nickChoPhep(user);
  const all = await docCaiDatNhom();
  if (duocXem === null) return NextResponse.json({ caiDat: all });
  const loc = Object.fromEntries(Object.entries(all).filter(([k]) => duocXem.includes(k.split("|")[0])));
  return NextResponse.json({ caiDat: loc });
}
