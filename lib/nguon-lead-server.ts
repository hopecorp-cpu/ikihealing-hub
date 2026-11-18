import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { tachSource, xepCua, xepKenh, postIdFanpage, tenPageTuSource, laPageTuBinhLuan } from "@/lib/nguon-lead";

export type DongLead = {
  t: number;
  loai: "sdt" | "email";
  ai: string;
  cua: string;
  kenh: string;
  doan: boolean;
  chiTiet: string;
  trang: string;
  trangThai: string;
  goc: string;
};

const cheSdt = (p: string) => (p.length >= 9 ? p.slice(0, 4) + "***" + p.slice(-2) : p);
const cheEmail = (e: string) => {
  const [a, b] = e.split("@");
  return (a.length > 2 ? a.slice(0, 2) + "***" : a) + "@" + (b || "");
};

export async function docLeadKhoang(tuIso: string, denIso?: string): Promise<{
  dong: { t: number; phone: string; cua: string; kenh: string; doan: boolean; chiTiet: string; trang: string; trangThai: string; goc: string }[];
  loi?: string;
}> {
  const dong: { t: number; phone: string; cua: string; kenh: string; doan: boolean; chiTiet: string; trang: string; trangThai: string; goc: string }[] = [];
  let loi = "";
  try {
    const sb = getServiceClient();
    for (let tu = 0; tu < 20000; tu += 1000) {
      let q = sb.from("leads")
        .select("created_at,phone,source,channel,status")
        .gte("created_at", tuIso);
      if (denIso) q = q.lt("created_at", denIso);
      const { data, error } = await q.order("created_at", { ascending: false }).range(tu, tu + 999);
      if (error) { loi = error.message; break; }
      const rows = data || [];
      for (const r of rows) {
        const { goc, nguon } = tachSource(r.source || "");
        const k = xepKenh(r.source || "", r.channel);
        dong.push({
          t: Date.parse(r.created_at), phone: String(r.phone || ""),
          cua: xepCua(goc, r.channel), kenh: k.kenh, doan: k.doan, chiTiet: k.chiTiet,
          trang: nguon?.lp || "", trangThai: r.status || "", goc,
        });
      }
      if (rows.length < 1000) break;
    }
  } catch (e: any) { loi = String(e?.message || e); }
  return { dong, loi: loi || undefined };
}

export async function docNguonLead(ngay = 30): Promise<{
  dong: DongLead[];
  tuNgay: string;
  theoKenh: { ten: string; sdt: number; email: number; tong: number; doan: number }[];
  theoCua: { ten: string; tong: number }[];
  daGanNhan: number;
  loi?: string;
}> {
  const moc = Date.now() - ngay * 864e5;
  const tuNgay = new Date(moc).toISOString().slice(0, 10);
  const dong: DongLead[] = [];
  let loi = "";

  const lk = await docLeadKhoang(new Date(moc).toISOString());
  if (lk.loi) loi = lk.loi;
  for (const r of lk.dong) {
    dong.push({
      t: r.t, loai: "sdt", ai: cheSdt(String(r.phone || "")),
      cua: r.cua, kenh: r.kenh, doan: r.doan, chiTiet: r.chiTiet,
      trang: r.trang, trangThai: r.trangThai, goc: r.goc,
    });
  }

  try {
    const raw = await getConfigValue("blog_leads");
    const list: any[] = raw ? JSON.parse(raw) : [];
    for (const l of list) {
      if (!l?.ts || l.ts < moc) continue;
      const { goc, nguon } = tachSource(l.source || "");
      const k = xepKenh(l.source || "");
      dong.push({
        t: l.ts, loai: "email", ai: cheEmail(String(l.email || "")),
        cua: xepCua(goc), kenh: k.kenh, doan: k.doan, chiTiet: k.chiTiet,
        trang: nguon?.lp || "",
        trangThai: l.tuChoi ? "đã huỷ nhận" : `đã gửi ${(l.sent || []).length} thư`,
        goc,
      });
    }
  } catch {  }

  dong.sort((a, b) => b.t - a.t);

  const gomKenh = new Map<string, { sdt: number; email: number; doan: number }>();
  const gomCua = new Map<string, number>();
  for (const d of dong) {
    const g = gomKenh.get(d.kenh) || { sdt: 0, email: 0, doan: 0 };
    g[d.loai === "sdt" ? "sdt" : "email"]++;
    if (d.doan) g.doan++;
    gomKenh.set(d.kenh, g);
    gomCua.set(d.cua, (gomCua.get(d.cua) || 0) + 1);
  }

  return {
    dong, tuNgay, loi: loi || undefined,
    daGanNhan: dong.filter((d) => !d.doan).length,
    theoKenh: [...gomKenh.entries()].map(([ten, v]) => ({ ten, ...v, tong: v.sdt + v.email })).sort((a, b) => b.tong - a.tong),
    theoCua: [...gomCua.entries()].map(([ten, tong]) => ({ ten, tong })).sort((a, b) => b.tong - a.tong),
  };
}

export async function docNguonApp(): Promise<{
  soLieu: any; nguon: any; tuoiGio: number | null;
  theoKenh: { ten: string; so: number; doan: boolean }[];
  luotBam: { nguon: string; so: number }[];
} | null> {
  try {
    const [rawSo, rawNguon, rawDem] = await Promise.all([
      getConfigValue("nova_app_dosong"), getConfigValue("nova_app_nguon"), getConfigValue("ebook_tai_dem"),
    ]);
    if (!rawSo) return null;
    const soLieu = JSON.parse(rawSo);
    const nguon = rawNguon ? JSON.parse(rawNguon) : null;
    const moc = Date.parse(soLieu.at || soLieu.doLuc || "");
    const gom = new Map<string, { so: number; doan: boolean }>();
    for (const [src, n] of Object.entries<any>(nguon?.theoNguon || {})) {
      const k = xepKenh(String(src));
      const g = gom.get(k.kenh) || { so: 0, doan: false };
      g.so += Number(n) || 0; g.doan = g.doan || k.doan;
      gom.set(k.kenh, g);
    }
    const dem = rawDem ? JSON.parse(rawDem) : {};
    const luotBam = Object.entries<any>(dem)
      .filter(([k]) => k.startsWith("app:"))
      .map(([k, v]) => ({ nguon: k.slice(4), so: Number(v) || 0 }))
      .sort((a, b) => b.so - a.so);
    return {
      soLieu, nguon, tuoiGio: Number.isFinite(moc) ? Math.round((Date.now() - moc) / 36e5) : null,
      theoKenh: [...gom.entries()].map(([ten, v]) => ({ ten, ...v })).sort((a, b) => b.so - a.so),
      luotBam,
    };
  } catch { return null; }
}

export async function docBaiFanpage(ngay = 30): Promise<{
  bai: { pid: string; so: number; page: string; moiNhat: number; chu?: string; link?: string }[];
  tongLead: number;
  daLoai: number;
  moiNhat: number | null;
  tuoiChuGio: number | null;
} | null> {
  try {
    const sb = getServiceClient();
    const moc = Date.now() - ngay * 864e5;
    const gom = new Map<string, { so: number; page: string; moiNhat: number }>();
    let tongLead = 0, daLoai = 0;
    for (let tu = 0; tu < 20000; tu += 1000) {
      const { data, error } = await sb.from("leads")
        .select("created_at,source,external_id,customer_name")
        .like("external_id", "fbc%")
        .gte("created_at", new Date(moc).toISOString())
        .order("created_at", { ascending: false })
        .range(tu, tu + 999);
      if (error) break;
      const rows = data || [];
      for (const r of rows) {
        const pid = postIdFanpage(r.external_id);
        if (!pid) continue;

        if (laPageTuBinhLuan(r.customer_name, r.source)) { daLoai++; continue; }
        tongLead++;
        const t = Date.parse(r.created_at);
        const g = gom.get(pid) || { so: 0, page: tenPageTuSource(r.source), moiNhat: t };
        g.so++; if (t > g.moiNhat) g.moiNhat = t;
        gom.set(pid, g);
      }
      if (rows.length < 1000) break;
    }

    let moiNhat: number | null = null;
    const { data: cuoi } = await sb.from("leads")
      .select("created_at").like("external_id", "fbc%")
      .order("created_at", { ascending: false }).limit(1);
    if (cuoi?.[0]?.created_at) moiNhat = Date.parse(cuoi[0].created_at);

    let chu: Record<string, { chu?: string; link?: string }> = {};
    let tuoiChuGio: number | null = null;
    try {
      const raw = await getConfigValue("fb_bai_de_lead");
      if (raw) {
        const v = JSON.parse(raw);
        for (const b of v.bang || []) chu[b.pid] = { chu: b.chu, link: b.link };
        const m = Date.parse(v.at || "");
        if (Number.isFinite(m)) tuoiChuGio = Math.round((Date.now() - m) / 36e5);
      }
    } catch {  }

    return {
      tongLead, daLoai, moiNhat, tuoiChuGio,
      bai: [...gom.entries()].map(([pid, v]) => ({ pid, ...v, ...(chu[pid] || {}) }))
        .sort((a, b) => b.so - a.so),
    };
  } catch { return null; }
}
