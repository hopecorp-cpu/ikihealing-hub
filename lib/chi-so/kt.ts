import type { Ctx, O } from "./types";
import { CAT, GIO, MUC, MS, TRAN_TIN_NHOM } from "./muc-tieu";
import { chay, docBang, docKhoa, docNap, oTuNap, oSo, oTrong, denDem, homNayVN, moiNhat, ngayTuIso, type Khung } from "./khung";

const may: Khung = {
  key: "may_hong", phong: "KT", ten: "Lượt máy hỏng / tổng lượt", donVi: "lượt",
  mucTieu: MUC.mayHong, nguon: "agent_runs", tanSuat: "liên tục",
  nguongGio: GIO.lienTuc, watchdog: "agent_runs",
};
const chet: Khung = {
  key: "nguon_chet", phong: "KT", ten: "Số nguồn dữ liệu chết", donVi: "nguồn",
  mucTieu: MUC.nguonChet, nguon: "checkAllSources()", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const token: Khung = {
  key: "claude_token", phong: "KT", ten: "Token Claude theo việc", donVi: "token",
  mucTieu: MUC.token, nguon: "nhat-ky/claude-token.jsonl", tanSuat: "mỗi phiên",
  nguongGio: GIO.hangNgay,
};
const tin: Khung = {
  key: "tin_bot", phong: "KT", ten: "Tin bot/nhóm/ngày, tin bị lọc", donVi: "tin",
  mucTieu: MUC.tinBot, nguon: "config tg_nhom_log, tg_ceo_log", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};

export async function oMayHong(sb: any, ctx?: Ctx): Promise<O> {
  return chay(may, async () => {
    const tu = new Date(Date.now() - GIO.agent * MS.gio).toISOString();
    const rows = await docBang(sb, "agent_runs", "trang_thai, created_at", (q) => q.gte("created_at", tu));
    if (!rows.length) return oTrong(may, "không có lượt agent_runs trong 24 giờ");
    const hong = rows.filter((r) => r.trang_thai === "hong").length;
    return oSo(may, `${hong}/${rows.length}`, {
      den: hong > CAT.khong ? "do" : "xanh",
      lyDo: null,
      capNhatLuc: rows.map((r) => r.created_at).sort().at(-CAT.mot) || null,
    });
  }, ctx);
}

export async function oNguonChet(sb: any, ctx?: Ctx & { doSucKhoe?: () => Promise<Ctx["health"]> }): Promise<O> {
  return chay(chet, async () => {
    void sb;
    let health = ctx?.health;
    if (!health) {
      const fn = ctx?.doSucKhoe ?? (async () => {
        const { checkAllSources } = await import("@/lib/watchdog");
        return checkAllSources();
      });
      health = await fn() || [];
    }
    const ds = (health || []).filter((s) => !s.ok && !s.chiThamKhao);
    const nhan = ds.map((s) => s.key).slice(CAT.khong, CAT.ten).join(", ");
    return oSo(chet, ds.length, {
      den: denDem(ds.length, true),
      lyDo: nhan || null,
      capNhatLuc: new Date().toISOString(),
    });
  }, ctx);
}

export async function oToken(sb: any, ctx?: Ctx): Promise<O> {
  return chay(token, async () => oTuNap(token, (await docNap(sb, ctx)).claude_token, "máy nhật ký"), ctx);
}

export async function oTinBot(sb: any, ctx?: Ctx): Promise<O> {
  return chay(tin, async () => {
    const [nhom, ceo] = await Promise.all([
      docKhoa(sb, "tg_nhom_log", ctx),
      docKhoa(sb, "tg_ceo_log", ctx),
    ]);
    const a = Array.isArray(nhom) ? nhom : [];
    const b = Array.isArray(ceo) ? ceo : [];
    if (!a.length && !b.length && nhom == null && ceo == null) return oTrong(tin, "chưa có config tg_nhom_log và tg_ceo_log");
    const hom = homNayVN();
    const homNay = (r: any) => ngayTuIso(r?.t) === hom;
    const n1 = a.filter(homNay);
    const n2 = b.filter(homNay);
    const loc = [...n1, ...n2].filter((r) => r?.chan).length;
    const theoNhom = new Map<string, number>();
    for (const r of n1) {
      if (r?.chan) continue;
      const k = String(r?.dich || "");
      if (!k) continue;
      theoNhom.set(k, (theoNhom.get(k) || 0) + CAT.mot);
    }
    let vuot = 0;
    for (const v of theoNhom.values()) if (v > TRAN_TIN_NHOM) vuot += CAT.mot;
    const tong = n1.length + n2.length;
    return oSo(tin, tong, {
      den: vuot > CAT.khong ? "do" : "xanh",
      lyDo: `lọc ${loc} · ${vuot} nhóm vượt trần tóm tắt (không in mã nhóm)`,
      capNhatLuc: moiNhat([...a, ...b].map((r) => r?.t)),
    });
  }, ctx);
}

export async function oKt(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oMayHong(sb, ctx), await oNguonChet(sb, ctx), await oToken(sb, ctx), await oTinBot(sb, ctx)];
}
