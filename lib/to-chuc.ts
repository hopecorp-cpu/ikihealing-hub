import { AGENTS } from "@/lib/ai-map";
import { PHONG_MAC_DINH, chuanHoaTen } from "@/lib/to-chuc-seed";

export const USERS_COT_CAY = "id, full_name, position, role, department_id, active";

const PHONG_COT_DAY = "id, name, color, manager_id, parent_id, ma, loai, thu_tu, active, manager:users!departments_manager_fk(id, full_name)";
const PHONG_COT_PHANG = "id, name, color, manager_id, manager:users!departments_manager_fk(id, full_name)";

export type PhongNut = {
  id: string;
  name: string;
  color: string | null;
  manager_id: string | null;
  manager?: { id: string; full_name: string } | null;
  parent_id: string | null;
  ma: string | null;
  loai: string | null;
  thu_tu: number | null;
  active: boolean;
};
export type NguoiNut = { id: string; full_name: string; position: string | null; role: string; department_id: string | null; active: boolean };
export type AgentNut = { id: string; ten: string; loai: string; phong_id: string | null; department_id: string | null; trang_thai: string | null; ghi_chu: string | null };
export type KiemNhiem = { user_id: string; department_id: string; vai_tro: string; ca: string | null };
export type NutCay = { phong: PhongNut; con: NutCay[] };

type LoiDb = { code?: string; message?: string } | null | undefined;

export const laThieuCot = (e: LoiDb) => !!e && (e.code === "42703" || e.code === "PGRST204");

export const laThieuBang = (e: LoiDb, status?: number) =>
  (!!e && (e.code === "42P01" || e.code === "PGRST205")) || (!!e && status === 404);

const soSanhPhong = (a: PhongNut, b: PhongNut) => {
  const ta = a.thu_tu ?? Number.MAX_SAFE_INTEGER;
  const tb = b.thu_tu ?? Number.MAX_SAFE_INTEGER;
  if (ta !== tb) return ta - tb;
  return a.name.localeCompare(b.name, "vi");
};

export function dungCay(ds: PhongNut[]): NutCay[] {
  const theoId = new Map(ds.map((p) => [p.id, p]));
  const trongVong = new Set<string>();
  for (const p of ds) {
    const daQua = new Set<string>();
    let cur: PhongNut | undefined = p;
    while (cur && cur.parent_id && theoId.has(cur.parent_id)) {
      if (daQua.has(cur.id)) break;
      daQua.add(cur.id);
      if (cur.parent_id === p.id) { trongVong.add(p.id); break; }
      cur = theoId.get(cur.parent_id);
    }
  }
  const nut = new Map(ds.map((p) => [p.id, { phong: p, con: [] as NutCay[] }]));
  const goc: NutCay[] = [];
  for (const p of ds) {
    const n = nut.get(p.id)!;
    const cha = p.parent_id && !trongVong.has(p.id) ? nut.get(p.parent_id) : undefined;
    if (cha) cha.con.push(n);
    else goc.push(n);
  }
  const sap = (arr: NutCay[]) => {
    arr.sort((a, b) => soSanhPhong(a.phong, b.phong));
    for (const n of arr) sap(n.con);
  };
  sap(goc);
  return goc;
}

export function phangCay(goc: NutCay[]): { phong: PhongNut; cap: number }[] {
  const ra: { phong: PhongNut; cap: number }[] = [];
  const di = (arr: NutCay[], cap: number) => {
    for (const n of arr) { ra.push({ phong: n.phong, cap }); di(n.con, cap + 1); }
  };
  di(goc, 0);
  return ra;
}

export function taoVong(ds: { id: string; parent_id: string | null }[], id: string, parentMoi: string | null): boolean {
  if (!parentMoi) return false;
  if (parentMoi === id) return true;
  const theoId = new Map(ds.map((p) => [p.id, p.parent_id]));
  const daQua = new Set<string>();
  let cur: string | null | undefined = parentMoi;
  while (cur) {
    if (cur === id) return true;
    if (daQua.has(cur)) return false;
    daQua.add(cur);
    cur = theoId.get(cur);
  }
  return false;
}

export function agentDuPhong(): AgentNut[] {
  return AGENTS.filter((a) => !a.human).map((a) => ({
    id: a.id, ten: a.name, loai: "may", phong_id: null, department_id: null, trang_thai: null, ghi_chu: null,
  }));
}

export type ToChuc = {
  phong: PhongNut[];
  nguoi: NguoiNut[];
  agents: AgentNut[];
  kiemNhiem: KiemNhiem[];
  coCotCay: boolean;
  coBangAgents: boolean;
  coBangKiemNhiem: boolean;
};

export async function docToChuc(sb: any): Promise<ToChuc> {
  let coCotCay = true;
  let rP = await sb.from("departments").select(PHONG_COT_DAY);
  if (laThieuCot(rP.error)) {
    coCotCay = false;
    rP = await sb.from("departments").select(PHONG_COT_PHANG);
  }
  if (rP.error) throw new Error(`Đọc phòng ban lỗi: ${rP.error.message}`);
  const phong: PhongNut[] = (rP.data ?? []).map((d: any) => ({
    id: d.id, name: d.name, color: d.color ?? null, manager_id: d.manager_id ?? null, manager: d.manager ?? null,
    parent_id: coCotCay ? d.parent_id ?? null : null,
    ma: coCotCay ? d.ma ?? null : null,
    loai: coCotCay ? d.loai ?? null : null,
    thu_tu: coCotCay ? d.thu_tu ?? null : null,
    active: coCotCay ? d.active !== false : true,
  }));

  const rU = await sb.from("users").select(USERS_COT_CAY).eq("active", true).order("full_name");
  if (rU.error) throw new Error(`Đọc nhân sự lỗi: ${rU.error.message}`);
  const nguoi: NguoiNut[] = rU.data ?? [];

  let coBangAgents = true;
  let agents: AgentNut[];
  const rA = await sb.from("agents").select("id, ten, loai, phong_id, department_id, trang_thai, ghi_chu").order("id");
  if (rA.error) {
    coBangAgents = false;
    agents = agentDuPhong();
  } else agents = rA.data ?? [];

  let coBangKiemNhiem = true;
  let kiemNhiem: KiemNhiem[] = [];
  const rK = await sb.from("vai_tro_kiem_nhiem").select("user_id, department_id, vai_tro, ca");
  if (rK.error) coBangKiemNhiem = false;
  else kiemNhiem = rK.data ?? [];

  return { phong, nguoi, agents, kiemNhiem, coCotCay, coBangAgents, coBangKiemNhiem };
}

const THE_DIEM_THEO_MA: Record<string, string> = { mkt: "MKT", sale: "KD", cskh: "CSKH", finance: "TC", kho: "KHO" };

export function denTheoPhong(
  phong: PhongNut[],
  the: { key: string; light: string; note?: string }[],
): Record<string, { light: string; note?: string }> {
  const ra: Record<string, { light: string; note?: string }> = {};
  for (const t of the) {
    const ma = THE_DIEM_THEO_MA[t.key];
    if (!ma) continue;
    const tenGoc = PHONG_MAC_DINH.find((p) => p.ma === ma)?.name;
    const p = phong.find((x) => x.ma === ma) ??
      (tenGoc ? phong.find((x) => !x.ma && chuanHoaTen(x.name) === chuanHoaTen(tenGoc)) : undefined);
    if (p) ra[p.id] = { light: t.light, note: t.note };
  }
  return ra;
}
