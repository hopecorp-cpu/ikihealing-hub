import type { Ctx, O } from "./types";
import { MUC, GIO } from "./muc-tieu";
import {
  chay, docBang, docNap, oTuNap, oSo, oTrong, denDem, homNayVN, treQuaMotNgay, xongChua, moiNhat, type Khung,
} from "./khung";

const viec: Khung = {
  key: "viec_tre", phong: "Chung", ten: "Việc trễ hạn theo phòng", donVi: "việc",
  mucTieu: MUC.viecTre, nguon: "tasks + phong-chung/bang-viec.md", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const loi: Khung = {
  key: "vong_phan_hoi", phong: "Chung", ten: "Lỗi / làm lại / báo sai theo phòng", donVi: "lỗi lặp",
  mucTieu: MUC.loiLap, nguon: "so-tay/vong-phan-hoi/chi-so.md", tanSuat: "thứ Hai",
  nguongGio: GIO.thuHai,
};

export async function oViecTre(sb: any, ctx?: Ctx): Promise<O> {
  return chay(viec, async () => {
    const hom = homNayVN();
    const [tasks, phong, nap] = await Promise.all([
      docBang(sb, "tasks", "status, due_date, due_at, target_department_id, updated_at"),
      docBang(sb, "departments", "id, name").catch(() => [] as any[]),
      docNap(sb, ctx),
    ]);
    const ten = new Map<string, string>();
    for (const d of phong) if (d?.id) ten.set(d.id, d.name || d.id);
    const dem = new Map<string, number>();
    let tong = 0;
    const moc: string[] = [];
    for (const t of tasks) {
      if (xongChua(t.status)) continue;
      const due = t.due_at || t.due_date;
      if (!treQuaMotNgay(due, hom)) continue;
      tong += 1;
      const nhan = ten.get(t.target_department_id) || "chưa gán phòng";
      dem.set(nhan, (dem.get(nhan) || 0) + 1);
      if (t.updated_at) moc.push(t.updated_at);
    }
    const phan = [...dem.entries()].map(([k, v]) => `${k}: ${v}`).join(", ");
    const file = nap.bang_viec_tre;
    const coFile = file != null && file.giaTri != null && file.giaTri !== "";
    const ly: string[] = [];
    if (phan) ly.push(phan);
    if (!coFile) ly.push("phần bang-viec.md chưa nạp (config.chi_so_nap.bang_viec_tre)");
    else ly.push(`bang-viec.md: ${file.giaTri}`);
    const den = denDem(tong, true);
    return oSo(viec, tong, {
      den: den === "xanh" && !coFile ? "vang" : den,
      lyDo: ly.join(" · ") || null,
      capNhatLuc: moiNhat([...moc, file?.capNhatLuc]),
      trangThai: "song",
    });
  }, ctx);
}

export async function oVongPhanHoi(sb: any, ctx?: Ctx): Promise<O> {
  return chay(loi, async () => {
    const nap = await docNap(sb, ctx);
    const o = oTuNap(loi, nap.vong_phan_hoi, "máy sổ tay");
    if (o.trangThai === "chua-co-du-lieu") return o;
    const n = typeof o.giaTri === "number" ? o.giaTri : Number(o.giaTri);
    if (Number.isFinite(n)) return { ...o, den: denDem(n, true) };
    return o;
  }, ctx);
}

export async function oChung(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oViecTre(sb, ctx), await oVongPhanHoi(sb, ctx)];
}

export { oTrong };
