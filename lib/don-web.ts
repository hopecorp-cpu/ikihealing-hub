import { getConfigValue } from "@/lib/app-config";
import { chuanMa } from "@/lib/affiliate-don";
import { ghiDeSan, xetDonSo } from "@/lib/gia-v4";
import { giaVonQua } from "@/lib/gia-v4-von";
import { docCuaHang } from "@/lib/cua-hang";

export type DongHang = "dam" | "san-pham-c" | "san-pham-b" | "khac";

export function dongHang(ten: string): DongHang {
  const s = String(ten || "").toLowerCase();
  if (/true\s*vegan|đạm|dam\b|protein/.test(s)) return "dam";
  if (/tuệ\s*minh|tue\s*minh/.test(s)) return "san-pham-c";
  if (/thanh\s*hương|thanh\s*huong/.test(s)) return "san-pham-b";
  return "khac";
}

export function nhanSanPham(pkg: string): string {
  const raw = String(pkg || "").replace(/\s*[×x]\s*\d+\s*$/i, "").trim();
  switch (dongHang(raw)) {
    case "dam": return "Đạm Thực Vật Mẫu";
    case "san-pham-c": return "Trà Mẫu A";
    case "san-pham-b": return "Trà Mẫu B";
    default: return raw || "Hàng khác";
  }
}

export async function kenhBaoDon(tenHang: string): Promise<string> {
  const MAC_DINH = "don-moi";
  try {
    const dong = dongHang(tenHang);
    const rawMap = await getConfigValue("don_web_kenh").catch(() => "");
    const map: Record<string, string> = rawMap ? JSON.parse(rawMap) : {};
    const khoa = String(map[dong] || "").trim();
    if (!khoa) return MAC_DINH;
    const rawDt = await getConfigValue("tg_dinh_tuyen").catch(() => "");
    const dt: Record<string, any> = rawDt ? JSON.parse(rawDt) : {};
    const co = dt[khoa] && String(dt[khoa].chat || "").trim();
    return co ? khoa : MAC_DINH;
  } catch {
    return MAC_DINH;
  }
}

export function laDongDonWeb(chatId?: string | null): boolean {
  const c = String(chatId || "");
  return c.startsWith("web:") || c.startsWith("salepage:");
}

export function timDonWebTrung(
  row: { sdt?: string | null; khach_tra?: number | null; ngay?: string | null },
  donWeb: { id?: any; chat_id?: string | null; sdt?: string | null; khach_tra?: number | null; ngay?: string | null; ghi_chu?: string | null }[],
  soNgay = 3,
): any | null {
  const sdt = chuanSdtWeb(row.sdt); if (!sdt) return null;
  const tien = Number(row.khach_tra || 0); if (!(tien >= 1000)) return null;
  const ngay = String(row.ngay || ""); if (!ngay) return null;
  const moc = Date.parse(ngay + "T00:00:00Z"); if (!Number.isFinite(moc)) return null;
  for (const d of donWeb) {
    if (!laDongDonWeb(d.chat_id)) continue;
    if (chuanSdtWeb(d.sdt) !== sdt) continue;
    if (Math.abs(Number(d.khach_tra || 0) - tien) >= 1000) continue;
    const m2 = Date.parse(String(d.ngay || "") + "T00:00:00Z");
    if (!Number.isFinite(m2) || Math.abs(m2 - moc) > soNgay * 86400e3) continue;
    return d;
  }
  return null;
}

export async function locDonNhomTrungWeb(sb: any, rows: any[]): Promise<{ giu: any[]; boQua: { row: any; web: any }[] }> {
  const sdts = Array.from(new Set(rows.map((r) => chuanSdtWeb(r.sdt)).filter(Boolean)));
  if (!sdts.length) return { giu: rows, boQua: [] };
  const { data: web } = await sb.from("tg_orders").select("id,chat_id,sdt,khach_tra,ngay,ghi_chu,ma_ctv")
    .in("sdt", sdts as string[]).or("chat_id.like.web:%,chat_id.like.salepage:%").limit(200);
  if (!web?.length) return { giu: rows, boQua: [] };
  const giu: any[] = [], boQua: { row: any; web: any }[] = [];
  for (const r of rows) {
    const t = timDonWebTrung(r, web);
    if (t) boQua.push({ row: r, web: t }); else giu.push(r);
  }
  for (const { row, web: w } of boQua) {

    if (row.ma_ctv && !w.ma_ctv) await sb.from("tg_orders").update({ ma_ctv: row.ma_ctv }).eq("id", w.id);
    const vet = `sale ${row.sale || "?"} đã gọi xác nhận ${row.ngay}`;
    if (String(w.ghi_chu || "").includes("đã gọi xác nhận")) continue;
    await sb.from("tg_orders").update({ ghi_chu: [w.ghi_chu, vet].filter(Boolean).join(" · ") }).eq("id", w.id);
  }
  return { giu, boQua };
}

export async function ghiSoDonWeb(sb: any, o: {
  orderCode: number | string; name?: string; phone?: string; address?: string;
  product?: string; pkg?: string; qty?: number; amount: number; content?: string; paidAt?: string;

  kieuShip?: "ck_truoc" | "cod";

  maCtv?: string | null;

  lyDoGhiDe?: string | null;
  nguoi?: string | null;
}): Promise<{ ghi: boolean; lyDo?: string; canLyDo?: boolean }> {
  try {
    const amount = Number(o.amount || 0);
    if (!amount || amount < 1000) return { ghi: false, lyDo: "không có số tiền" };
    const messageId = Number(o.orderCode);
    if (!Number.isFinite(messageId)) return { ghi: false, lyDo: "orderCode không phải số" };

    const { data: da } = await sb.from("tg_orders").select("id").eq("chat_id", "web:nova").eq("message_id", messageId).maybeSingle();
    if (da) return { ghi: false, lyDo: "đã có" };

    const sdt = chuanSdtWeb(o.phone);
    if (sdt) {
      const truoc = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
      const sau = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
      const { data: trung } = await sb.from("tg_orders").select("id, khach_tra, ma_ctv").eq("sdt", sdt).gte("ngay", truoc).lte("ngay", sau).limit(20);
      const dong = (trung || []).find((r: any) => Math.abs(Number(r.khach_tra) - amount) < 1000);
      if (dong) {

        if (o.maCtv && !dong.ma_ctv) await sb.from("tg_orders").update({ ma_ctv: chuanMa(o.maCtv) || null }).eq("id", dong.id);
        return { ghi: false, lyDo: "sổ nhóm đã có đơn này (cùng SĐT, cùng tiền)" };
      }
    }

    const ten = nhanSanPham(o.product || o.pkg || "");
    const slDong = Math.max(1, Number(o.qty || 1));

    let quaVonTong = 0;
    try {
      const ds = await docCuaHang();
      const k = String(o.product || "").trim().toLowerCase();
      const sp = ds.find((p) => p.n.trim().toLowerCase() === k);
      quaVonTong = giaVonQua(sp?.qua || "").tong * slDong;
    } catch {  }
    const san = xetDonSo({ san_pham: [{ ten, sl: slDong, thanh_tien: amount }], khach_tra: amount, kenh: "le", quaGiaVon: quaVonTong });
    let nhanSan: string | null = null;
    if (san.muc !== "ok") {
      if (san.muc === "chan" && o.kieuShip === "cod") {
        const gd = ghiDeSan({ kq: san, lyDo: o.lyDoGhiDe, nguoi: o.nguoi });
        if (!gd.ok) return { ghi: false, lyDo: gd.loi || san.lyDo, canLyDo: true };
        nhanSan = gd.nhan;
      } else {
        nhanSan = `[GIÁ ${san.muc === "chan" ? "DƯỚI SÀN" : "CẢNH BÁO"} v4: ${san.lyDo}]`;
      }
    }
    const ngay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const { error } = await sb.from("tg_orders").insert({
      chat_id: "web:nova", message_id: messageId,
      sale: "Web",
      khach: o.name || null, sdt: sdt || null, dia_chi: o.address || null, tinh: null,
      san_pham: [{ ten, sl: slDong, thanh_tien: amount }],
      qua: [], gia_goc: amount, giam_gia: 0, khach_tra: amount,
      kieu_ship: o.kieuShip || "ck_truoc", phi_ship: 0,
      ghi_chu: [nhanSan, "Web example.com", "mã " + o.orderCode, o.content ? "CK: " + o.content : null,
        o.paidAt ? "đã CK payOS " + o.paidAt : null, o.kieuShip === "cod" ? "COD, chốt tay ở /admin/don-web" : null].filter(Boolean).join(" · "),
      ngay, sent_at: new Date().toISOString(), nguoi_gui: "web", boc_at: new Date().toISOString(),
      ma_ctv: chuanMa(o.maCtv) || null,
    });
    if (error) return { ghi: false, lyDo: error.message };
    return { ghi: true };
  } catch (e: any) {
    return { ghi: false, lyDo: String(e?.message || e) };
  }
}

function chuanSdtWeb(raw: any): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : "";
}

export async function donWebDaCoTrongSo(sb: any, ds: { orderCode: number; phone?: string; amount: number; createdAt: number }[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!ds.length) return out;
  const ma = ds.map((o) => Number(o.orderCode)).filter(Number.isFinite);
  const { data: theoMa, error: e1 } = await sb.from("tg_orders").select("message_id").eq("chat_id", "web:nova").in("message_id", ma.slice(0, 1000));
  if (e1) throw new Error(e1.message);
  for (const r of theoMa || []) out[String(r.message_id)] = "web:nova";
  const sdts = Array.from(new Set(ds.map((o) => chuanSdtWeb(o.phone)).filter(Boolean)));
  if (!sdts.length) return out;
  const { data: dong, error: e2 } = await sb.from("tg_orders").select("chat_id,sdt,khach_tra,ngay").in("sdt", sdts.slice(0, 500)).limit(2000);
  if (e2) throw new Error(e2.message);
  for (const o of ds) {
    if (out[String(o.orderCode)]) continue;
    const sdt = chuanSdtWeb(o.phone); if (!sdt) continue;
    const moc = Date.parse(new Date(o.createdAt + 7 * 3600e3).toISOString().slice(0, 10) + "T00:00:00Z");
    const t = (dong || []).find((r: any) => r.sdt === sdt && Math.abs(Number(r.khach_tra || 0) - Number(o.amount || 0)) < 1000
      && Math.abs(Date.parse(String(r.ngay) + "T00:00:00Z") - moc) <= 3 * 86400e3);
    if (t) out[String(o.orderCode)] = String(t.chat_id || "sổ nhóm");
  }
  return out;
}
