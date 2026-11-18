import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { findBanned } from "@/lib/banned-words";
import seedingPlan from "@/data/seeding-plan.json";

export const dynamic = "force-dynamic";

const KEY = "zalo_mau_tin";
const doc = async (sb: any) => { const { data } = await sb.from("config").select("value").eq("key", KEY).maybeSingle(); try { return JSON.parse(data?.value || "null"); } catch { return null; } };
const ghi = (sb: any, ds: any[]) => sb.from("config").upsert({ key: KEY, value: JSON.stringify(ds) }, { onConflict: "key" });

function mauMoi(): any[] {
  const cf: any = (seedingPlan as any).careFlows || {};
  const nhom: Record<string, string> = { bought: "Sau mua", notBought: "Chưa mua", reorder: "Mua lại" };
  const ra: any[] = [];
  for (const [flow, steps] of Object.entries(cf)) for (const s of (steps as any[]).slice(0, 4)) {
    ra.push({ id: randomUUID(), ten: `${nhom[flow] || flow} · ngày ${s.day}: ${s.goal}`, noiDung: s.message, nhom: nhom[flow] || flow, boi: "máy (careFlows)", luc: new Date().toISOString() });
  }
  return ra;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });
  const sb = getServiceClient();
  let ds = await doc(sb);
  if (!Array.isArray(ds)) { ds = mauMoi(); await ghi(sb, ds); }
  return NextResponse.json({ mau: ds });
}

const quanLy = (u: any) => u.role === "admin" || u.role === "ceo" || isManagerOrAbove(u.role);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });
  if (!quanLy(user)) return NextResponse.json({ loi: "Chỉ quản lý sửa được mẫu tin" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const ten = String(b.ten || "").trim().slice(0, 80), noiDung = String(b.noiDung || "").trim().slice(0, 2000), nhom = String(b.nhom || "Chung").trim().slice(0, 40);
  if (!ten || !noiDung) return NextResponse.json({ loi: "Thiếu tên hoặc nội dung" }, { status: 400 });
  const tuCam = findBanned(noiDung);
  if (tuCam.length) return NextResponse.json({ loi: `Mẫu có từ không được dùng với thực phẩm bổ sung: ${tuCam.join(", ")}`, tuCam }, { status: 400 });
  const sb = getServiceClient();
  const ds: any[] = (await doc(sb)) || mauMoi();
  const id = String(b.id || "") || randomUUID();
  const i = ds.findIndex((m) => m.id === id);
  const ngung = typeof b.ngung === "boolean" ? b.ngung : !!ds[i]?.ngung;
  const moi = { id, ten, noiDung, nhom, boi: user.full_name || user.email, luc: new Date().toISOString(), ...(ngung ? { ngung: true } : {}) };
  if (i >= 0) ds[i] = moi; else ds.push(moi);
  await ghi(sb, ds);
  return NextResponse.json({ ok: true, mau: ds });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });
  if (!quanLy(user)) return NextResponse.json({ loi: "Chỉ quản lý xoá được mẫu tin" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const sb = getServiceClient();
  const ds: any[] = ((await doc(sb)) || []).filter((m: any) => m.id !== id);
  await ghi(sb, ds);
  return NextResponse.json({ ok: true, mau: ds });
}
