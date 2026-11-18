"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { inFinanceWL } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { HM } from "@/lib/bao-cao-tai-chinh";
import { revalidatePath } from "next/cache";

export async function ganHangMuc(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !inFinanceWL(user.email)) throw new Error("Không có quyền");
  const id = String(form.get("id") || "");
  const hm = String(form.get("hm") || "");
  if (!/^(MB|TCB)\|/.test(id) || id.length > 120) throw new Error("Mã giao dịch không hợp lệ");
  if (hm !== "tu-dong" && !HM[hm]) throw new Error("Hạng mục không hợp lệ");
  let map: Record<string, string> = {};
  try { map = JSON.parse((await getConfigValue("bctc_phan_loai")) || "{}"); } catch { map = {}; }
  if (hm === "tu-dong") delete map[id]; else map[id] = hm;
  await setConfigValue("bctc_phan_loai", JSON.stringify(map), "Báo cáo tài chính: nhãn hạng mục gán tay cho giao dịch ngân hàng (khoá NH|mã|tiền|loại)");
  revalidatePath("/bao-cao-tai-chinh");
}
