import type { Ctx, O } from "./types";
import { WORK_HOURS } from "@/lib/payroll";
import { CAT, DON_QUAY_LAI, GIO, GIO_NGAY, MOT_TRAM, MUC, MS, NGAY_ZALO, PHUT_GIO } from "./muc-tieu";
import { chay, docBang, laThieuBang, oSo, oTrong, homNayVN, dauNgayIso, moiNhat, trungVi, type Khung } from "./khung";

const zalo: Khung = {
  key: "zalo_phan_hoi", phong: "CSKH", ten: "Thời gian phản hồi Zalo (trung vị, giờ làm việc)", donVi: "phút",
  mucTieu: MUC.zalo, nguon: "zalo_bridge_messages", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay, watchdog: "zalo_bridge_status",
};
const chat: Khung = {
  key: "chat_diem", phong: "CSKH", ten: "Điểm chất lượng tư vấn, tỉ lệ để tuột", donVi: "điểm",
  mucTieu: MUC.chat, nguon: "salework_chat_analysis", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const cham: Khung = {
  key: "cham_qua_han", phong: "CSKH", ten: "Việc chăm quá hạn", donVi: "việc",
  mucTieu: MUC.chamHan, nguon: "customer_care_log, care_events", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const quay: Khung = {
  key: "khach_quay_lai", phong: "CSKH", ten: "Khách quay lại/tháng", donVi: "khách",
  mucTieu: MUC.quayLai, nguon: "customers", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};

function phutCua(gio: string): number {
  const [h, m] = gio.split(":");
  return (Number(h) || 0) * PHUT_GIO + (Number(m) || 0);
}

function trongGioLam(iso: string): boolean {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  const thu = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(d);
  if (thu === "Sat" || thu === "Sun") return false;
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const p = phutCua(hm);
  const sangDau = phutCua(WORK_HOURS.morningStart);
  const sangCuoi = phutCua(WORK_HOURS.morningEnd);
  const chieuDau = phutCua(WORK_HOURS.afternoonStart);
  const chieuCuoi = phutCua(WORK_HOURS.afternoonEnd);
  const sang = p >= sangDau && p <= sangCuoi;
  const chieu = p >= chieuDau && p <= chieuCuoi;
  return sang || chieu;
}

export async function oZalo(sb: any, ctx?: Ctx): Promise<O> {
  return chay(zalo, async () => {
    const hom = homNayVN();
    const tu = dauNgayIso(hom);
    const moc = new Date(Date.parse(tu) - (NGAY_ZALO - CAT.mot) * MS.ngay).toISOString();
    const rows = await docBang(
      sb, "zalo_bridge_messages", "thread_id, direction, sent_at, thread_type",
      (q) => q.gte("sent_at", moc).eq("thread_type", "user"),
    );
    if (!rows.length) return oTrong(zalo, "chưa có tin zalo_bridge_messages");
    const theo = new Map<string, { t: number; dir: string }[]>();
    for (const r of rows) {
      if (!r.thread_id || !r.sent_at) continue;
      const t = Date.parse(r.sent_at);
      if (!Number.isFinite(t)) continue;
      const ds = theo.get(r.thread_id) || [];
      ds.push({ t, dir: String(r.direction || "") });
      theo.set(r.thread_id, ds);
    }
    const cho: number[] = [];
    for (const ds of theo.values()) {
      ds.sort((a, b) => a.t - b.t);
      for (let i = CAT.khong; i < ds.length; i += CAT.mot) {
        const tin = ds[i];
        if (tin.dir !== "in") continue;
        if (!trongGioLam(new Date(tin.t).toISOString())) continue;
        const ra = ds.slice(i + CAT.mot).find((x) => x.dir === "out" && x.t - tin.t <= GIO_NGAY * MS.gio && x.t >= tin.t);
        if (!ra) continue;
        cho.push((ra.t - tin.t) / MS.phut);
      }
    }
    const tv = trungVi(cho);
    if (tv == null) return oTrong(zalo, "không có cặp tin vào rồi ra trong giờ làm việc");
    return oSo(zalo, Math.round(tv), {
      den: "xanh",
      lyDo: `trung vị ${Math.round(tv)} phút trên ${cho.length} lượt, giờ làm việc`,
      capNhatLuc: moiNhat(rows.map((r) => r.sent_at)),
    });
  }, ctx);
}

export async function oChatDiem(sb: any, ctx?: Ctx): Promise<O> {
  return chay(chat, async () => {
    const rows = await docBang(sb, "salework_chat_analysis", "score, missed, analyzed_at");
    if (!rows.length) return oTrong(chat, "bảng salework_chat_analysis trống");
    let tong = 0;
    let n = 0;
    let tuot = 0;
    for (const r of rows) {
      const s = Number(r.score);
      if (Number.isFinite(s)) { tong += s; n += CAT.mot; }
      const missed = r.missed;
      const co = Array.isArray(missed) ? missed.length > CAT.khong : !!missed;
      if (co) tuot += CAT.mot;
    }
    if (!n) return oTrong(chat, "chưa có điểm trong salework_chat_analysis");
    const tb = Math.round((tong / n) * MOT_TRAM) / MOT_TRAM;
    const ty = Math.round((tuot * MOT_TRAM) / rows.length);
    return oSo(chat, tb, {
      den: "xanh",
      lyDo: `điểm trung bình ${tb} · để tuột ${tuot}/${rows.length} (${ty}%)`,
      capNhatLuc: moiNhat(rows.map((r) => r.analyzed_at)),
    });
  }, ctx);
}

export async function oChamQuaHan(sb: any, ctx?: Ctx): Promise<O> {
  return chay(cham, async () => {
    const hom = homNayVN();
    const logs = await docBang(sb, "customer_care_log", "next_due, status, updated_at");
    let care = 0;
    try {
      const ev = await docBang(sb, "care_events", "created_at, outcome", (q) => q.gte("created_at", dauNgayIso(hom)));
      care = ev.filter((e) => e.outcome === "miss").length;
    } catch (e) {
      if (!laThieuBang(e)) throw e;
    }
    const qua = logs.filter((r) => r.status !== "done" && r.status !== "paused" && r.next_due && String(r.next_due).slice(CAT.khong, CAT.ngay) < hom);
    if (!logs.length && !care) return oTrong(cham, "chưa có customer_care_log");
    const n = qua.length + care;
    return oSo(cham, n, {
      den: n > CAT.khong ? "do" : "xanh",
      lyDo: `${qua.length} nhật ký quá next_due · ${care} care_events outcome miss hôm nay`,
      capNhatLuc: moiNhat(logs.map((r) => r.updated_at)),
    });
  }, ctx);
}

export async function oQuayLai(sb: any, ctx?: Ctx): Promise<O> {
  return chay(quay, async () => {
    const rows = await docBang(sb, "customers", "total_orders, updated_at");
    if (!rows.length) return oTrong(quay, "bảng customers trống");
    const n = rows.filter((r) => Number(r.total_orders) >= DON_QUAY_LAI).length;
    return oSo(quay, n, {
      den: "xanh",
      lyDo: "đếm khách có total_orders từ ngưỡng quay lại; bảng không có cột tháng mua lại nên đây là số tích luỹ, không phải riêng tháng này",
      capNhatLuc: moiNhat(rows.map((r) => r.updated_at)),
    });
  }, ctx);
}

export async function oCskh(sb: any, ctx?: Ctx): Promise<O[]> {
  return [await oZalo(sb, ctx), await oChatDiem(sb, ctx), await oChamQuaHan(sb, ctx), await oQuayLai(sb, ctx)];
}
