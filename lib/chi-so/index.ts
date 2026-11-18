import type { Ctx, O } from "./types";
import { KHOI, type Khoi } from "./quyen";
import { oChung } from "./chung";
import { oKd } from "./kd";
import { oKdSan } from "./kd-san";
import { oVhsp } from "./vhsp";
import { oCskh } from "./cskh";
import { oMkt } from "./mkt";
import { oTh } from "./th";
import { oTc } from "./tc";
import { oNs } from "./ns";
import { oKt } from "./kt";

export async function layBang(sb: any, ctx?: Ctx & { doSucKhoe?: () => Promise<Ctx["health"]>; duoc?: readonly Khoi[] }): Promise<O[]> {
  let health = ctx?.health;
  let loiWatchdog: string | null = null;
  if (!health) {
    try {
      const { checkAllSources } = await import("@/lib/watchdog");
      health = await checkAllSources();
    } catch (e) {
      loiWatchdog = e instanceof Error ? e.message : "checkAllSources lỗi";
      health = undefined;
    }
  }
  const c: Ctx & { doSucKhoe?: () => Promise<Ctx["health"]> } = {
    ...ctx,
    health,
    doSucKhoe: loiWatchdog ? async () => { throw new Error(loiWatchdog || "checkAllSources lỗi"); } : ctx?.doSucKhoe,
  };
  const duoc = ctx?.duoc;
  const lay = (k: Khoi, fn: () => Promise<O[]>) => (!duoc || duoc.includes(k) ? fn() : Promise.resolve([] as O[]));
  const [chung, kd, san, vhsp, cskh, mkt, th, tc, ns, kt] = await Promise.all([
    lay("Chung", () => oChung(sb, c)), lay("KD", () => oKd(sb, c)), lay("KD-SÀN", () => oKdSan(sb, c)),
    lay("VHSP", () => oVhsp(sb, c)), lay("CSKH", () => oCskh(sb, c)), lay("MKT", () => oMkt(sb, c)),
    lay("TH", () => oTh(sb, c)), lay("TC", () => oTc(sb, c)), lay("NS", () => oNs(sb, c)), lay("KT", () => oKt(sb, c)),
  ]);
  return [...chung, ...kd, ...san, ...vhsp, ...cskh, ...mkt, ...th, ...tc, ...ns, ...kt];
}

export function theoKhoi(ds: O[], duoc: readonly Khoi[]): { phong: Khoi; o: O[] }[] {
  return KHOI.filter((k) => duoc.includes(k)).map((phong) => ({
    phong,
    o: ds.filter((o) => o.phong === phong),
  })).filter((b) => b.o.length);
}

export function viecUuTien(ds: O[]): string {
  const gap = ds.find((o) => o.den === "do") || ds.find((o) => o.den === "vang");
  if (!gap) return "Không có ô đỏ hay vàng.";
  return `${gap.ten}${gap.lyDo ? `: ${gap.lyDo}` : ""}`;
}
