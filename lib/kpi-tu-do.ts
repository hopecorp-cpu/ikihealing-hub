import { getConfigValue, setConfigValue } from "@/lib/app-config";

export const KHOA_TRANG_NGUOI = "kpi_trang_nguoi";

export type KetQuaKpi = { kpiId: string; ten: string; tieuDe: string; cu: number | null; moi: number | null; nguon: string };

const kd = (s: any) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function trangCuaAi(): Promise<Record<string, string>> {
  try { return JSON.parse((await getConfigValue(KHOA_TRANG_NGUOI)) || "{}") || {}; } catch { return {}; }
}

async function baiTheoNguoi(tu: string, den: string): Promise<{ theoNguoi: Record<string, number>; ghiChu: string[] }> {
  const ghiChu: string[] = [];
  const map = await trangCuaAi();
  let snap: any = null;
  try { snap = JSON.parse((await getConfigValue("fb_bai_dang")) || "null"); } catch {  }
  const theoNguoi: Record<string, number> = {};
  if (!snap?.pages) { ghiChu.push("Chưa có snapshot bài fanpage (chạy scripts/fb-dem-bai-dang.mjs --commit)."); return { theoNguoi, ghiChu }; }
  if (!Object.keys(map).length) ghiChu.push("Chưa gán trang cho người (config kpi_trang_nguoi) — số bài không quy được về ai.");
  for (const p of snap.pages) {
    const ten = map[p.id];
    if (!ten) continue;
    const tn = p.theoNgay || {};
    let so = 0;
    for (const [d, n] of Object.entries(tn)) if (d >= tu && d <= den) so += Number(n) || 0;
    if (!Object.keys(tn).length && p.so) ghiChu.push(`Trang ${p.ten}: snapshot cũ chưa có theoNgay — chạy lại fb-dem-bai-dang để đếm đúng kỳ.`);
    theoNguoi[ten] = (theoNguoi[ten] || 0) + so;
  }
  return { theoNguoi, ghiChu };
}

async function leadContent(sb: any, tu: string, den: string): Promise<{ so: number; ngayLoai: string[] }> {
  const theoNgay: Record<string, number> = {};
  for (let f = 0; f < 20000; f += 1000) {
    const { data } = await sb.from("leads").select("source, created_at").gte("created_at", tu).lte("created_at", `${den}T23:59:59`).range(f, f + 999);
    if (!data?.length) break;
    for (const l of data) if (/facebook|fanpage|fb |quiz|blog|comment/i.test(String(l.source || ""))) {
      const d = String(l.created_at).slice(0, 10); theoNgay[d] = (theoNgay[d] || 0) + 1;
    }
    if (data.length < 1000) break;
  }
  const vals = Object.values(theoNgay).sort((a, b) => a - b);
  const trungVi = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  const ngayLoai: string[] = [];
  let so = 0;
  for (const [d, n] of Object.entries(theoNgay)) {
    if (vals.length >= 5 && n > Math.max(50, trungVi * 8)) { ngayLoai.push(`${d} (${n})`); continue; }
    so += n;
  }
  return { so, ngayLoai };
}

export async function dienKpiChuKy(sb: any, cycleId: string, chiXem = false): Promise<{ daDien: KetQuaKpi[]; ghiChu: string[] }> {
  const { data: cy } = await sb.from("cycles").select("id, name, start_date, end_date").eq("id", cycleId).maybeSingle();
  if (!cy) return { daDien: [], ghiChu: ["Không có chu kỳ"] };
  const tu = String(cy.start_date), den = String(cy.end_date);
  const { data: kpis } = await sb.from("kpis").select("id, title, current_value, target_value, user_id, users:user_id(full_name)").eq("cycle_id", cycleId);
  const daDien: KetQuaKpi[] = [];
  const ghiChu: string[] = [];

  const { theoNguoi: bai, ghiChu: gc1 } = await baiTheoNguoi(tu, den);
  ghiChu.push(...gc1);
  let soLead: { so: number; ngayLoai: string[] } | null = null;

  for (const k of (kpis || []) as any[]) {
    const t = kd(k.title);
    const ten = k.users?.full_name || "";
    let moi: number | null = null, nguon = "";
    if (/so bai|bai dang|bai viet/.test(t)) {
      if (ten in bai) { moi = bai[ten]; nguon = "bài thật trên fanpage (Graph API) theo trang phụ trách"; }
      else { ghiChu.push(`${ten} — "${k.title}": chưa gán trang nào cho người này, không đếm được.`); continue; }
    } else if (/lead do content|lead.*content|content.*lead/.test(t)) {
      if (soLead == null) {
        soLead = await leadContent(sb, tu, den);
        if (soLead.ngayLoai.length) ghiChu.push(`Lead content: đã LOẠI đợt nhập cục ${soLead.ngayLoai.join(", ")} — không phải nhịp thật.`);
      }
      moi = soLead.so; nguon = `lead nguồn Facebook/quiz/blog trong kỳ, đã trừ đợt nhập cục (tổng, chưa quy người viết)`;
    } else if (/reach|engagement|tuong tac/.test(t)) {
      ghiChu.push(`${ten} — "${k.title}": Graph API không trả reach cho page hiện tại — CHƯA ĐO ĐƯỢC, để trống, không điền 0.`);
      continue;
    } else continue;

    daDien.push({ kpiId: k.id, ten, tieuDe: k.title, cu: k.current_value, moi, nguon });
    if (!chiXem && moi != null) {
      await sb.from("kpis").update({ current_value: moi, description: `Máy đo ${new Date().toISOString().slice(0, 16).replace("T", " ")} — ${nguon}` }).eq("id", k.id);
    }
  }
  return { daDien, ghiChu };
}
