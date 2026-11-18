import { getServiceClient } from "./supabase-server";
import { setConfigValue } from "./app-config";

export type TrangThaiMay = "xong" | "khong_co_gi" | "hong";

export type ViecMay = {
  id: number;
  agent: string;
  agent_ten: string | null;
  viec: string;
  trang_thai: TrangThaiMay;
  so_luong: number;
  don_vi: string | null;
  chi_tiet: string | null;
  link: string | null;
  giay: number | null;
  chi_phi_vnd: number | null;
  can_duyet: boolean;
  duyet_boi: string | null;
  duyet_luc: string | null;
  duyet_ok: boolean | null;
  duyet_ghi_chu: string | null;
  created_at: string;
};

export type GhiViecMayInput = {
  agent: string;
  viec: string;
  trangThai: TrangThaiMay;
  agentTen?: string;
  soLuong?: number;
  donVi?: string;
  chiTiet?: string | null;
  link?: string;
  giay?: number;
  chiPhiVnd?: number;

  canDuyet?: boolean;
};

export const KHOA_LOI_GHI_SO = "agent_runs_loi";

export async function ghiViecMay(r: GhiViecMayInput): Promise<void> {
  try {
    const { error } = await getServiceClient().from("agent_runs").insert({
      agent: r.agent,
      agent_ten: r.agentTen ?? null,
      viec: r.viec.slice(0, 500),
      trang_thai: r.trangThai,
      so_luong: Math.max(0, Math.round(r.soLuong ?? 0)),
      don_vi: r.donVi ?? null,
      chi_tiet: r.chiTiet ? String(r.chiTiet).slice(0, 2000) : null,
      link: r.link ?? null,
      giay: r.giay != null ? Number(r.giay.toFixed(2)) : null,
      chi_phi_vnd: r.chiPhiVnd ?? null,
      can_duyet: !!r.canDuyet,
    });
    if (error) throw new Error(error.message);
  } catch (e: any) {
    const msg = `[viec-may] ghi sổ hỏng cho agent "${r.agent}": ${e?.message || e}`;
    console.error(msg);

    try { await setConfigValue(KHOA_LOI_GHI_SO, JSON.stringify({ luc: new Date().toISOString(), loi: msg })); } catch {  }
  }
}

export async function listViecMay(opts?: { agent?: string; limit?: number }): Promise<ViecMay[]> {
  try {
    let q = getServiceClient().from("agent_runs").select("*").order("created_at", { ascending: false });
    if (opts?.agent) q = q.eq("agent", opts.agent);
    const { data } = await q.limit(Math.min(500, opts?.limit ?? 200));
    return (data ?? []) as ViecMay[];
  } catch { return []; }
}

export async function listChoDuyetMay(limit = 50): Promise<ViecMay[]> {
  try {
    const { data } = await getServiceClient().from("agent_runs").select("*")
      .eq("can_duyet", true).is("duyet_luc", null)
      .order("created_at", { ascending: false }).limit(limit);
    return (data ?? []) as ViecMay[];
  } catch { return []; }
}

export async function duyetViecMay(id: number, userId: string, ok: boolean, ghiChu?: string): Promise<boolean> {
  const { error } = await getServiceClient().from("agent_runs")
    .update({ duyet_boi: userId, duyet_luc: new Date().toISOString(), duyet_ok: ok, duyet_ghi_chu: ghiChu ?? null })
    .eq("id", id).is("duyet_luc", null);
  return !error;
}

export type TomTatMay = {

  theoAgent: { agent: string; agentTen: string; luot: number; sanPham: number; donVi: string | null; hong: number; khongCoGi: number; lanCuoi: string }[];
  tongLuot: number;
  tongHong: number;
  tongKhongCoGi: number;
  choDuyet: number;
};

export async function tomTatMay(soNgay = 1): Promise<TomTatMay> {
  const tu = new Date(Date.now() - soNgay * 24 * 3600 * 1000).toISOString();
  let rows: ViecMay[] = [];
  try {
    const { data } = await getServiceClient().from("agent_runs").select("*")
      .gte("created_at", tu).order("created_at", { ascending: false }).limit(1000);
    rows = (data ?? []) as ViecMay[];
  } catch { rows = []; }

  const m = new Map<string, TomTatMay["theoAgent"][number]>();
  for (const r of rows) {
    let a = m.get(r.agent);
    if (!a) {
      a = { agent: r.agent, agentTen: r.agent_ten || r.agent, luot: 0, sanPham: 0, donVi: r.don_vi, hong: 0, khongCoGi: 0, lanCuoi: r.created_at };
      m.set(r.agent, a);
    }
    a.luot++;
    a.sanPham += r.so_luong || 0;
    if (!a.donVi && r.don_vi) a.donVi = r.don_vi;
    if (r.trang_thai === "hong") a.hong++;
    if (r.trang_thai === "khong_co_gi") a.khongCoGi++;
    if (r.created_at > a.lanCuoi) a.lanCuoi = r.created_at;
  }

  return {
    theoAgent: [...m.values()].sort((x, y) => (y.hong - x.hong) || (y.luot - x.luot)),
    tongLuot: rows.length,
    tongHong: rows.filter(r => r.trang_thai === "hong").length,
    tongKhongCoGi: rows.filter(r => r.trang_thai === "khong_co_gi").length,
    choDuyet: rows.filter(r => r.can_duyet && !r.duyet_luc).length,
  };
}
