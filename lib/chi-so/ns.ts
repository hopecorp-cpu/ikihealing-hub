import type { Ctx, O } from "./types";
import { CAT, GIO, MUC } from "./muc-tieu";
import {
  chay, docBang, oSo, oTrong, denDem, homNayVN, treQuaMotNgay, xongChua, moiNhat, type Khung,
} from "./khung";

const cong: Khung = {
  key: "di_muon", phong: "NS", ten: "Đi muộn / vắng", donVi: "lượt",
  mucTieu: MUC.muonVang, nguon: "attendance", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const lech: Khung = {
  key: "lech_bao_cao", phong: "NS", ten: "Báo cáo tự khai lệch số đo", donVi: "người",
  mucTieu: MUC.lech, nguon: "daily_reports + lib/report-reconcile.ts", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const viec: Khung = {
  key: "viec_qua_han_nguoi", phong: "NS", ten: "Việc quá hạn theo người", donVi: "việc",
  mucTieu: MUC.viecNguoi, nguon: "tasks theo assignee_id", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};

type DoiChieu = (sb: any, ngay: string) => Promise<{ flagged?: { name?: string }[]; measurable?: boolean; notReported?: unknown[] }>;

export async function oDiMuon(sb: any, ctx?: Ctx): Promise<O> {
  return chay(cong, async () => {
    const hom = homNayVN();
    const rows = await docBang(sb, "attendance", "date, status, check_in_time, check_out_time");
    const homNay = rows.filter((r) => String(r.date || "").slice(CAT.khong, CAT.ngay) === hom);
    if (!homNay.length) return oTrong(cong, "chưa có dòng chấm công hôm nay");
    const muon = homNay.filter((r) => r.status === "late").length;
    const vang = homNay.filter((r) => r.status === "absent").length;
    const n = muon + vang;
    return oSo(cong, n, {
      den: n > CAT.khong ? "vang" : "xanh",
      lyDo: `${muon} muộn, ${vang} vắng hôm nay (chỉ đếm, không giờ từng người)`,
      capNhatLuc: moiNhat(homNay.flatMap((r) => [r.check_in_time, r.check_out_time])),
    });
  }, ctx);
}

export async function oLechBaoCao(sb: any, ctx?: Ctx & { doiChieu?: DoiChieu }): Promise<O> {
  return chay(lech, async () => {
    const hom = homNayVN();
    const fn: DoiChieu = ctx?.doiChieu ?? (async (s, ngay) => {
      const { computeReportReconcile } = await import("@/lib/report-reconcile");
      return computeReportReconcile(s, ngay);
    });
    const [kq, bao] = await Promise.all([
      fn(sb, hom),
      docBang(sb, "daily_reports", "report_date, submitted_at, reviewed_at", (q) => q.eq("report_date", hom)),
    ]);
    const n = kq.flagged?.length || 0;
    if (!kq.measurable && !n) return oTrong(lech, "cửa doanh thu chưa có đơn ngày này — không kết luận lệch");
    const ten = (kq.flagged || []).map((f) => f.name).filter(Boolean).join(", ");
    const homBao = bao.filter((r) => String(r.report_date || "").slice(CAT.khong, CAT.ngay) === hom);
    return oSo(lech, n, {
      den: denDem(n, true),
      lyDo: n ? ten : null,
      capNhatLuc: moiNhat(homBao.map((r) => r.submitted_at || r.reviewed_at)),
    });
  }, ctx);
}

export async function oViecNguoi(sb: any, ctx?: Ctx): Promise<O> {
  return chay(viec, async () => {
    const hom = homNayVN();
    const [tasks, users] = await Promise.all([
      docBang(sb, "tasks", "assignee_id, status, due_date, due_at, updated_at"),
      docBang(sb, "users", "id, full_name"),
    ]);
    const ten = new Map<string, string>();
    for (const u of users) if (u?.id) ten.set(u.id, u.full_name || "nhân viên");
    const dem = new Map<string, number>();
    let tong = 0;
    const moc: string[] = [];
    for (const t of tasks) {
      if (xongChua(t.status)) continue;
      if (!treQuaMotNgay(t.due_at || t.due_date, hom)) continue;
      tong += CAT.mot;
      const nhan = ten.get(t.assignee_id) || "chưa gán";
      dem.set(nhan, (dem.get(nhan) || 0) + CAT.mot);
      if (t.updated_at) moc.push(t.updated_at);
    }
    if (!tasks.length) return oTrong(viec, "bảng tasks trống");
    const phan = [...dem.entries()].map(([k, v]) => `${k}: ${v}`).join(", ");
    return oSo(viec, tong, {
      den: denDem(tong, true),
      lyDo: phan || null,
      capNhatLuc: moiNhat(moc),
    });
  }, ctx);
}

export async function oNs(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oDiMuon(sb, ctx), await oLechBaoCao(sb, ctx), await oViecNguoi(sb, ctx)];
}
