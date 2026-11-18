"use server";
import { getServerClient } from "@/lib/supabase-server";
import { fileToCsv } from "@/lib/file-to-csv";
import { docFileDon, docFileThanhToan, doiSoat, type San, type KetQuaDoiSoat } from "@/lib/doi-soat-san";

export async function doiSoatTuFile(fd: FormData): Promise<{ ok: true; kq: KetQuaDoiSoat; soDongDon: number; soDongTT: number } | { ok: false; error: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const san = (String(fd.get("san") || "shopee") === "tiktok" ? "tiktok" : "shopee") as San;
  const fDon = fd.get("fileDon") as File | null;
  const fTT = fd.get("fileTT") as File | null;
  if ((!fDon || !fDon.size) && (!fTT || !fTT.size)) return { ok: false, error: "Cần ít nhất một file: file ĐƠN hoặc file THANH TOÁN" };
  if (fDon && fDon.size > 25 * 1024 * 1024) return { ok: false, error: "File đơn quá 25MB" };
  try {
    let don: ReturnType<typeof docFileDon>["rows"] = [], cotThieu: string[] = [];
    if (fDon && fDon.size) {
      const csvDon = fileToCsv(new Uint8Array(await fDon.arrayBuffer()), fDon.name).csvContent;
      const r = docFileDon(csvDon, san); don = r.rows; cotThieu = r.cotThieu;
    }
    let tt: ReturnType<typeof docFileThanhToan>["rows"] = [];
    if (fTT && fTT.size) {

      const csvTT = fileToCsv(new Uint8Array(await fTT.arrayBuffer()), fTT.name, san === "tiktok" ? /chi ti[eế]t|order detail/i : /income|doanh thu|thanh to[aá]n/i).csvContent;
      const r = docFileThanhToan(csvTT, san);
      tt = r.rows; cotThieu.push(...r.cotThieu);
    }
    const kq = doiSoat(san, don, tt, cotThieu);
    return { ok: true, kq, soDongDon: don.length, soDongTT: tt.length };
  } catch (e: any) {
    return { ok: false, error: `Đọc file hỏng: ${String(e?.message || e).slice(0, 160)}` };
  }
}
