import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition, isCskhPosition } from "@/lib/auth";
import { layDanhSachKhach, layDoanChat, layHoSoKhach, layHoatDong, layNick, layTrangThaiKho, nickChoPhep } from "@/lib/hop-thu-zalo-server";
import HopThuClient from "./HopThuClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Tin nhắn Zalo | IKIHEALING Hub") };
}

const khoaNhom = (ten: string) =>
  String(ten || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();

function gopNhomTheoTen<T extends { laNhom: boolean; ten: string; tinCuoiAt: string | null; soTin: number; chuaDoc: number }>(ds: T[]): T[] {
  const ra: T[] = [];
  const nhom: Record<string, T> = {};
  for (const k of ds) {
    if (!k.laNhom) { ra.push(k); continue; }
    const key = khoaNhom(k.ten);
    const co = nhom[key];
    if (!co) { nhom[key] = { ...k }; continue; }

    const moiHon = !co.tinCuoiAt || (k.tinCuoiAt && k.tinCuoiAt > co.tinCuoiAt);
    nhom[key] = { ...(moiHon ? k : co), soTin: co.soTin + k.soTin, chuaDoc: co.chuaDoc + k.chuaDoc };
  }
  return ra.concat(Object.values(nhom));
}

export default async function HopThuZaloPage({
  searchParams,
}: {
  searchParams?: { "hoi-thoai"?: string };
}) {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const quanLy = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role);
  const duocVao = quanLy || isSalePosition((user as any).position) || isCskhPosition((user as any).position);
  if (!duocVao) redirect("/");

  const duocXem = await nickChoPhep(user);
  if (duocXem !== null && !duocXem.length) {

    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">{t("Hộp thư Zalo")}</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-600">
          {t("Tài khoản của anh/chị chưa được gán nick Zalo nào nên chưa có hộp thư để hiện.\n          Nhờ quản lý đối chiếu tên trong hệ thống với tên sale gắn trên nick Zalo giúp nhé.")}
        </p>
      </div>
    );
  }

  const [khachTho, nick, kho] = await Promise.all([
    layDanhSachKhach(duocXem ?? [], 10000),
    layNick(),
    layTrangThaiKho(),
  ]);

  const khach = gopNhomTheoTen(khachTho);

  let banDau = null;
  const [own, uid] = (searchParams?.["hoi-thoai"] || "").split("|");
  if (own && uid && (duocXem === null || duocXem.includes(own))) {
    const kh = khach.find((k) => k.ownId === own && k.uid === uid);
    if (kh) {
      const [tin, hoSo, hoatDong] = await Promise.all([
        layDoanChat(own, uid), layHoSoKhach(kh.phone, kh.ten), layHoatDong(kh.phone),
      ]);
      banDau = { khach: kh, tin, hoSo, hoatDong };
    }
  }

  return (
    <HopThuClient
      khach={khach}
      nick={quanLy ? nick : nick.filter((n) => (duocXem ?? []).includes(n.ownId))}
      kho={kho}
      quanLy={quanLy}
      toi={user.full_name || ""}
      banDau={banDau}
    />
  );
}
