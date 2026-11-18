import crypto from "node:crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { findBanned, hasBanned } from "@/lib/banned-words";
import { loiTra } from "@/lib/bo-bai-doi-tac";
import {
  BUCKET_XUONG, KHOA_MA, KHOA_VIEC, duongManh, type MaDaiLy, type ViecXuong, type ViecCongKhai,
} from "@/lib/xuong-video";

const bam = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

async function docJson<T>(key: string): Promise<T | null> {
  const { data, error } = await getServiceClient().from("config").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`đọc ${key}: ${error.message}`);
  if (!data?.value) return null;
  try { return JSON.parse(data.value) as T; } catch { return null; }
}
async function ghiJson(key: string, v: unknown, description?: string): Promise<void> {
  const row: any = { key, value: JSON.stringify(v) };
  if (description) row.description = description;
  const { error } = await getServiceClient().from("config").upsert(row, { onConflict: "key" });
  if (error) throw new Error(`ghi ${key}: ${error.message}`);
}

export async function dsMa(): Promise<MaDaiLy[]> {
  const m = (await docJson<Record<string, MaDaiLy>>(KHOA_MA)) || {};
  return Object.values(m).sort((a, b) => b.tao_luc.localeCompare(a.tao_luc));
}

export async function capMa(ten: string, boi: string): Promise<{ ma: string; ban: MaDaiLy }> {
  const sach = ten.trim().slice(0, 80);
  if (sach.length < 2) throw new Error("Cần tên đại lý");
  const ma = crypto.randomBytes(12).toString("base64url");
  const ban: MaDaiLy = { id: crypto.randomUUID().slice(0, 8), ten: sach, bam: bam(ma), tao_luc: new Date().toISOString(), tao_boi: boi };
  const m = (await docJson<Record<string, MaDaiLy>>(KHOA_MA)) || {};
  m[ban.id] = ban;
  await ghiJson(KHOA_MA, m, "Xưởng video: mã vào cửa của đại lý (chỉ lưu băm sha256)");
  return { ma, ban };
}

export async function thuHoiMa(id: string): Promise<void> {
  const m = (await docJson<Record<string, MaDaiLy>>(KHOA_MA)) || {};
  if (!m[id]) throw new Error("Không có mã này");
  m[id].thu_hoi = new Date().toISOString();
  await ghiJson(KHOA_MA, m);
}

export async function timMa(ma: string): Promise<MaDaiLy | null> {
  if (!ma || ma.length < 12 || ma.length > 64) return null;
  const m = await docJson<Record<string, MaDaiLy>>(KHOA_MA);
  if (!m) return null;
  const b = Buffer.from(bam(ma), "hex");
  for (const x of Object.values(m)) {
    const y = Buffer.from(x.bam || "", "hex");
    if (y.length === b.length && crypto.timingSafeEqual(y, b)) return x.thu_hoi ? null : x;
  }
  return null;
}

export async function docViec(id: string): Promise<ViecXuong | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return docJson<ViecXuong>(KHOA_VIEC + id);
}
export async function ghiViec(v: ViecXuong): Promise<void> {
  await ghiJson(KHOA_VIEC + v.id, v, "Xưởng video: một việc dựng video cho đại lý");
}
export async function dsViec(): Promise<ViecXuong[]> {
  const { data, error } = await getServiceClient().from("config").select("value").like("key", KHOA_VIEC + "%").limit(1000);
  if (error) throw new Error(`đọc hàng đợi: ${error.message}`);
  const out: ViecXuong[] = [];
  for (const r of data || []) { try { out.push(JSON.parse(r.value)); } catch {  } }
  return out.sort((a, b) => b.tao_luc.localeCompare(a.tao_luc));
}

export function tuCam(chu: string): string[] {
  const ds = findBanned(chu);
  const chung = ds.length ? ds : hasBanned(chu) ? ["(từ cấm)"] : [];
  return [...chung, ...loiTra(chu)];
}

export async function linkTaiLen(id: string, manh: number): Promise<string[]> {
  const sb = getServiceClient();
  const out: string[] = [];
  for (let i = 0; i < manh; i++) {
    const { data, error } = await sb.storage.from(BUCKET_XUONG).createSignedUploadUrl(duongManh(id, i), { upsert: true });
    if (error || !data) throw new Error("không cấp được chỗ lưu: " + (error?.message || ""));
    out.push(data.signedUrl);
  }
  return out;
}

export async function manhDaLen(id: string): Promise<{ so: number; bytes: number }> {
  const { data, error } = await getServiceClient().storage.from(BUCKET_XUONG).list(`nguon/${id}`, { limit: 100 });
  if (error) throw new Error("đọc kho lỗi: " + error.message);
  const f = (data || []).filter((x) => /^\d{3}$/.test(x.name));
  return { so: f.length, bytes: f.reduce((s, x) => s + Number((x.metadata as any)?.size || 0), 0) };
}

export async function linkXem(paths: string[], giay = 3600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await getServiceClient().storage.from(BUCKET_XUONG).createSignedUrls(paths, giay);
  if (error) throw new Error("không tạo được link xem: " + error.message);
  const out: Record<string, string> = {};
  for (const d of data || []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function viecCongKhai(maId: string): Promise<ViecCongKhai[]> {
  const cua = (await dsViec()).filter((v) => v.ma_id === maId).slice(0, 30);
  const dat = cua.flatMap((v) => (v.trang_thai === "da_duyet" ? (v.ket_qua || []).filter((k) => k.duyet === true).map((k) => k.path) : []));
  const link = await linkXem(dat);
  return cua.map((v) => ({
    id: v.id, tao_luc: v.tao_luc, trang_thai: v.trang_thai, san_pham: v.san_pham, file_ten: v.file.ten,
    video: v.trang_thai === "da_duyet"
      ? (v.ket_qua || []).filter((k) => k.duyet === true && link[k.path]).map((k) => ({ ten: k.ten, url: link[k.path] }))
      : [],
  }));
}
