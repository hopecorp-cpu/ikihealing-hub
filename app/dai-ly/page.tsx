import { getT } from "@/lib/i18n-server";
import { requireManager } from "@/lib/auth-server";
import { isAdmin } from "@/lib/auth";
import { dungBangDaiLy, type BangDaiLy } from "@/lib/dai-ly-server";
import { giaNhapNppDam } from "@/lib/dai-ly";
import { NHAN_TRANG_THAI, NPP_DAM_NOI_BO } from "@/lib/gia-v4";
import DaiLyClient, { type NppNoiBo } from "./DaiLyClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Đại lý & NPP | ACME Ops Hub") };
}

function anNpp(bang: BangDaiLy): BangDaiLy {
  return {
    ...bang,
    cauHinh: { ...bang.cauHinh, thuong: { ...bang.cauHinh.thuong, nguongQuy: [], pct: [] } },
    dong: bang.dong.map((r) => ({
      ...r,
      chietKhau: r.chietKhau.map((c) => (r.dl.loai === "NPP đạm" && c.ma === "dam" && !c.ghiDe ? { ...c, pct: null, giaNhap: null, trangThai: null } : c)),
      thuong: { bac: 0, pct: 0, tien: 0, hop: null, nguongKe: null, conThieu: null, trangThai: r.thuong.trangThai },
    })),
  };
}

export default async function Page() {
  const user = await requireManager();
  const laAdmin = isAdmin(user.role);
  const bang = await dungBangDaiLy();
  const g = giaNhapNppDam();
  const npp: NppNoiBo | null = laAdmin
    ? { gia: g.gia, nhanTrangThai: NHAN_TRANG_THAI[g.trangThai], docQuyenTrieu: NPP_DAM_NOI_BO.docQuyenVungTuTrieuQuy }
    : null;
  return <DaiLyClient bang={laAdmin ? bang : anNpp(bang)} laAdmin={laAdmin} npp={npp} />;
}
