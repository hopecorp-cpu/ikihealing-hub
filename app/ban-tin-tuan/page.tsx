import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { khungTuan, khungTuTuNgay } from "@/lib/ban-tin-tuan-core";
import { gomTuan, docNhap, demNguoiNhan } from "@/lib/ban-tin-tuan";
import BanTinClient from "./BanTinClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bản tin email tuần | IKIHEALING Hub" };

export default async function Page({ searchParams }: { searchParams: { tuan?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role) && !isMktPosition((user as any).position)) redirect("/?denied=ban-tin-tuan");

  const k = (searchParams.tuan && khungTuTuNgay(searchParams.tuan)) || khungTuan(Date.now(), 1);
  const [gom, nhap, dem] = await Promise.all([
    gomTuan(k),
    docNhap(),
    demNguoiNhan().catch(() => ({ tong: 0, duocGui: 0 })),
  ]);
  const cacTuan = [0, 1, 2, 3, 4].map((lui) => khungTuan(Date.now(), lui));

  return (
    <BanTinClient
      khung={{ tuNgay: k.tuNgay, denNgay: k.denNgay }}
      cacTuan={cacTuan.map((t) => ({ tuNgay: t.tuNgay, denNgay: t.denNgay }))}
      muc={gom.muc}
      loi={gom.loi}
      nhap={nhap[k.tuNgay] || null}
      dem={dem}
    />
  );
}
