import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { addTask } from "@/lib/cc-queue";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { chayLaiMay, layBanDoMay } from "@/lib/may-chay-ngam";
import { duAnPhong, phongCuaMay } from "@/lib/thi-tran";
import { KHOA_PHAN_HOI, docSo, donSo, type HanhDong, type PhanHoi } from "@/lib/thi-tran-phan-hoi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isManagerOrAbove(user.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const hanhDong = String(body?.hanhDong ?? "") as HanhDong | "mo-lai";
  if (!["giao", "chay-lai", "de-sau", "bo-qua", "mo-lai"].includes(hanhDong)) return NextResponse.json({ ok: false, error: "Hành động không hợp lệ" }, { status: 400 });
  const keys = [...new Set((Array.isArray(body?.keys) ? body.keys : []).map((k: unknown) => String(k)).filter(Boolean))].slice(0, 20) as string[];
  if (!keys.length) return NextResponse.json({ ok: false, error: "Thiếu máy" }, { status: 400 });

  const banDo = await layBanDoMay();
  const tatCa = banDo.chuoi.flatMap((c) => c.may.map((m) => ({ m, chuoi: c.ma })));
  const dangDut = new Set(tatCa.filter(({ m }) => m.trangThai === "chet" && !m.chiThamKhao).map(({ m }) => m.key));
  const sai = keys.filter((k) => !dangDut.has(k));
  if (sai.length === keys.length) return NextResponse.json({ ok: false, error: "Máy này không còn đứt nữa — tải lại trang để xem" }, { status: 409 });
  const may = tatCa.filter(({ m }) => keys.includes(m.key) && dangDut.has(m.key));

  const boi = (user as any).full_name || user.email || user.id;
  const so = donSo(docSo(await getConfigValue(KHOA_PHAN_HOI)), dangDut);
  const luc = new Date().toISOString();
  let ketQua = "";
  let taskId: string | undefined;

  if (hanhDong === "mo-lai") {
    for (const { m } of may) delete so[m.key];
    ketQua = "Đã mở lại đề xuất.";
  } else {
    if (hanhDong === "giao") {
      const viec = String(body?.viec ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
      if (viec.length < 8) return NextResponse.json({ ok: false, error: "Việc quá ngắn" }, { status: 400 });
      const phong = phongCuaMay(may[0].m.key, may[0].chuoi).phong;
      const t = await addTask(`[Sửa chỗ đứt] ${viec}`, duAnPhong(phong), `web:${user.id}`, boi);
      taskId = t.id;
      ketQua = `Đã giao, mã ${t.id}. Máy chỉ làm sau khi anh gõ /duyet ${t.id} trên Telegram.`;
    } else if (hanhDong === "chay-lai") {
      const kq: string[] = [];
      for (const { m } of may) kq.push((await chayLaiMay(m.key, boi)).thongBao);
      ketQua = kq.join(" ");
    } else {
      ketQua = hanhDong === "de-sau" ? "Đã hẹn, 24 giờ nữa máy vẫn đứt thì nhắc lại." : "Đã gạt, 7 ngày nữa máy vẫn đứt thì nhắc lại.";
    }
    const ph: PhanHoi = { hanhDong, luc, boi, ...(taskId ? { taskId } : {}) };
    for (const { m } of may) so[m.key] = ph;
  }

  await setConfigValue(KHOA_PHAN_HOI, JSON.stringify(so), "Thị trấn máy: câu trả lời của anh cho từng chỗ đứt (vòng phản hồi hai chiều)");
  return NextResponse.json({ ok: true, ketQua, taskId: taskId ?? null, boQua: sai });
}
