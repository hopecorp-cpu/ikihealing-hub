import { getServiceClient } from "./supabase-server";

export type Dem = { goi: number; loi: number; inTok: number; outTok: number; ms: number; cacheDoc?: number; cacheGhi?: number };
export type NgayNhatKy = { ngay: string; capNhat: string; tong: Dem; theo: Record<string, Dem> };

export const TIEN_TO_KEY = "ai_nhat_ky_";

const demRong = (): Dem => ({ goi: 0, loi: 0, inTok: 0, outTok: 0, ms: 0, cacheDoc: 0, cacheGhi: 0 });
const so = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };

function ngayVN(lui = 0): string {
  return new Date(Date.now() + 7 * 3600e3 - lui * 86400e3).toISOString().slice(0, 10);
}

function cong(a: Dem, b: Partial<Dem>): Dem {
  return {
    goi: a.goi + so(b.goi), loi: a.loi + so(b.loi), inTok: a.inTok + so(b.inTok), outTok: a.outTok + so(b.outTok), ms: a.ms + so(b.ms),
    cacheDoc: so(a.cacheDoc) + so(b.cacheDoc), cacheGhi: so(a.cacheGhi) + so(b.cacheGhi),
  };
}

type BanGhi = { noi: string; model: string; inTok?: number; outTok?: number; ms?: number; ok: boolean; cacheDoc?: number; cacheGhi?: number };

let hangDoi: Promise<void> = Promise.resolve();

async function ghiThat(b: BanGhi): Promise<void> {
  const sb = getServiceClient();
  const ngay = ngayVN();
  const key = TIEN_TO_KEY + ngay;
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  let cur: NgayNhatKy = { ngay, capNhat: "", tong: demRong(), theo: {} };
  try {
    const j = data?.value ? JSON.parse(data.value) : null;
    if (j && typeof j === "object" && j.tong && j.theo) cur = j as NgayNhatKy;
  } catch {  }
  const them: Dem = { goi: 1, loi: b.ok ? 0 : 1, inTok: so(b.inTok), outTok: so(b.outTok), ms: so(b.ms), cacheDoc: so(b.cacheDoc), cacheGhi: so(b.cacheGhi) };
  const k = `${String(b.noi || "?").slice(0, 60)}|${String(b.model || "?").slice(0, 60)}`;
  cur.tong = cong(cur.tong || demRong(), them);
  cur.theo[k] = cong(cur.theo[k] || demRong(), them);
  cur.capNhat = new Date().toISOString();
  const { error } = await sb.from("config").upsert(
    { key, value: JSON.stringify(cur), description: "Nhật ký lời gọi AI theo ngày (chỉ đếm, không nội dung)" },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

export function ghiNhatKyAI(b: BanGhi): void {
  try {
    hangDoi = hangDoi.then(() => ghiThat(b)).catch(() => {  });
  } catch {  }
}

export function choNhatKyXong(): Promise<void> {
  return hangDoi;
}

export async function tongNhatKyAI(soNgay: number): Promise<{
  tuNgay: string; denNgay: string; tong: Dem; theo: Record<string, Dem>; theoNgay: Record<string, Dem>;
}> {
  const n = Math.max(1, Math.min(400, Math.floor(soNgay) || 1));
  const ngays = Array.from({ length: n }, (_, i) => ngayVN(i));
  const kq = { tuNgay: ngays[ngays.length - 1], denNgay: ngays[0], tong: demRong(), theo: {} as Record<string, Dem>, theoNgay: {} as Record<string, Dem> };
  const sb = getServiceClient();
  const { data, error } = await sb.from("config").select("key,value").in("key", ngays.map((d) => TIEN_TO_KEY + d));
  if (error) throw new Error(`Đọc nhật ký AI hỏng: ${error.message}`);
  for (const row of data || []) {
    let j: NgayNhatKy | null = null;
    try { j = JSON.parse(row.value); } catch { continue; }
    if (!j?.tong) continue;
    const ngay = String(row.key).slice(TIEN_TO_KEY.length);
    kq.theoNgay[ngay] = cong(demRong(), j.tong);
    kq.tong = cong(kq.tong, j.tong);
    for (const [k, d] of Object.entries(j.theo || {})) kq.theo[k] = cong(kq.theo[k] || demRong(), d);
  }
  return kq;
}
