import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { covanSendCEO } from "@/lib/covan/telegram";
import { appLink } from "@/lib/app-url";
import { dongBoViec, tomTat } from "@/lib/viec-tu-may";
import { tinhLaiKyChuaTra } from "@/lib/lai-vay";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  if (!secret || (req.headers.get("authorization") !== `Bearer ${secret}` && url.searchParams.get("key") !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = getServiceClient();

  const { data: vay, error: eVay } = await sb.from("loans").select("id,contract_code,status").in("status", ["active", "overdue"]);
  if (eVay) {
    await covanSendCEO(`NHẮC TRẢ LÃI VAY — HỎNG\nKhông đọc được bảng loans: ${eVay.message}`);
    return NextResponse.json({ ok: false, loi: eVay.message }, { status: 500 });
  }
  const loiTinh: string[] = [];
  for (const v of vay || []) {
    const r = await tinhLaiKyChuaTra(sb, v.id);
    if (r.loi) loiTinh.push(`${v.contract_code}: ${r.loi}`);
  }

  const { data: ky, error: eKy } = await sb.from("loan_payments")
    .select("id,payment_type,period,due_date,gross_amount,withholding_tax,net_amount,loans(contract_code,status)")
    .eq("status", "pending").not("due_date", "is", null).order("due_date");
  if (eKy) {
    await covanSendCEO(`NHẮC TRẢ LÃI VAY — HỎNG\nKhông đọc được lịch trả: ${eKy.message}`);
    return NextResponse.json({ ok: false, loi: eKy.message }, { status: 500 });
  }

  const homNay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const conNgay = (han: string) => Math.round((Date.parse(han) - Date.parse(homNay)) / 86_400_000);
  const ganHan = (ky || [])
    .filter((k: any) => ["active", "overdue"].includes(k.loans?.status))
    .map((k: any) => ({ ...k, con: conNgay(k.due_date) }))
    .filter((k: any) => k.con <= 7);

  const tien = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("vi-VN")}đ`;
  const loai = (t: string) => (t === "principal" ? "gốc" : "lãi");
  const dong = ganHan.map((k: any) =>
    `- ${k.loans?.contract_code} ${loai(k.payment_type)} ${k.period || ""}: chuyển ${tien(k.net_amount)}` +
    (k.payment_type === "interest" ? ` (lãi ${tien(k.gross_amount)}, giữ lại thuế TNCN ${tien(k.withholding_tax)})` : "") +
    ` — hạn ${k.due_date.split("-").reverse().join("/")}, ${k.con < 0 ? `QUÁ HẠN ${-k.con} ngày` : k.con === 0 ? "HÔM NAY" : `còn ${k.con} ngày`}`);

  const trungMoc = ganHan.some((k: any) => k.con < 0 || [7, 3, 1, 0].includes(k.con));
  let telegram: any = "không tới mốc nhắc";
  if (ganHan.length && (trungMoc || url.searchParams.get("gui") === "1")) {
    telegram = await covanSendCEO([
      "NHẮC TRẢ VAY",
      ...dong,
      "Trả xong thì bấm \"đã trả\" tại " + appLink("/admin/loans") + " để máy dừng nhắc và tính lại lãi kỳ sau.",
      loiTinh.length ? `Lưu ý: tính lại lãi bị lỗi — ${loiTinh.join("; ")}` : "",
    ].filter(Boolean).join("\n"));
  }

  const soViec = tomTat(await dongBoViec(sb, {
    the: "tra-lai-vay",
    ngayLeoThang: 0,
    lyDoDong: "Kỳ này đã được đánh dấu đã trả.",
    cans: ganHan.map((k: any) => ({
      khoa: k.id,
      tieuDe: `[Trả ${loai(k.payment_type)} vay] ${k.loans?.contract_code} ${k.period || ""}`,
      moTa: `Chuyển ${tien(k.net_amount)} trước ${k.due_date.split("-").reverse().join("/")}. Trả xong bấm "đã trả" tại ${appLink("/admin/loans")}.`,
      uuTien: k.con < 0 ? "urgent" : k.con <= 3 ? "high" : "medium",
      han: k.due_date,
    })),
  }));

  return NextResponse.json({ ok: loiTinh.length === 0, ganHan: ganHan.length, telegram, soViec, loiTinh });
}
