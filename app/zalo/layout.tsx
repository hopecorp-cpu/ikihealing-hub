import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition, isCskhPosition } from "@/lib/auth";
import { nickChoPhep, layTrangThaiKho, layNick } from "@/lib/hop-thu-zalo-server";
import { nickOffCuaUser } from "@/lib/zalo-reconnect";
import NickOffBanner from "./NickOffBanner";
import ZaloNav, { ZaloThanhTop } from "./ZaloNav";
import { ZaloTabDuoi } from "./ZaloMobile";

export const dynamic = "force-dynamic";

export default async function ZaloLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const quanLy = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role);
  const duocVao = quanLy || isSalePosition((user as any).position) || isCskhPosition((user as any).position);
  if (!duocVao) redirect("/");

  const duocXem = await nickChoPhep(user);
  const sb = getServiceClient();
  const moc7Ngay = new Date(Date.now() - 7 * 864e5).toISOString();
  let qCho = sb.from("zalo_bridge_contacts").select("zalo_uid", { count: "exact", head: true })
    .eq("unreplied", true).gte("last_in_at", moc7Ngay);
  if (duocXem && duocXem.length) qCho = qCho.in("own_id", duocXem);
  const [cho, viec, kho, nickHet, nickOff] = await Promise.all([
    duocXem && !duocXem.length ? Promise.resolve({ count: 0 } as any) : qCho,
    (user as any).id
      ? sb.from("tasks").select("id", { count: "exact", head: true })
          .eq("assignee_id", (user as any).id).in("status", ["todo", "doing"])
      : Promise.resolve({ count: 0 } as any),
    layTrangThaiKho(),
    layNick(),
    nickOffCuaUser(user),
  ]);

  const nickHien = nickHet.filter((n) => !duocXem || duocXem.includes(n.ownId));
  const badge = { tinNhan: cho?.count || 0, viec: viec?.count || 0 };
  const online = !!kho.ok && (kho.gioTre ?? 99) < 8;

  return (
    <div className="sang-co-dinh flex h-screen w-full overflow-hidden bg-[#F5F7FA]">
      <ZaloNav ten={user.full_name || user.email || ""} chucVu={(user as any).position} online={online} badge={badge} nick={nickHien.map((n) => ({ ownId: n.ownId, sale: n.sale, tenZalo: n.tenZalo, song: n.song }))} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ZaloThanhTop ten={user.full_name || ""} />
        <NickOffBanner nick={nickOff.map((n) => ({ ownId: n.ownId, sale: n.sale, tenZalo: n.tenZalo, slug: n.slug }))} />
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
        <ZaloTabDuoi soTinNhan={badge.tinNhan} soViec={badge.viec} />
      </div>
    </div>
  );
}
