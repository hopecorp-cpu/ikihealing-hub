import type { Ctx, O } from "./types";
import { doanhThuTheoThang, type DoanhThuThat } from "@/lib/doanh-thu-that";
import { VAT_RATE } from "@/lib/money";
import { xetDonSo } from "@/lib/gia-v4";
import { BA_CANH_BAO, CAT, CHU, GIO, MOT_TRAM, MUC, mucTieuDoanhThuNgay } from "./muc-tieu";
import {
  chay, docBang, docKhoa, laThieuBang, oSo, oTrong, denDem, homNayVN, dauNgayIso, thangCua, moiNhat, type Khung,
} from "./khung";

const dt: Khung = {
  key: "doanh_thu_ngay", phong: "KD", ten: "Doanh thu thật/ngày", donVi: "đồng",
  mucTieu: MUC.doanhThuNgay, nguon: "tg_orders qua lib/doanh-thu-that.ts (net)", tanSuat: "nhiều lần/ngày",
  nhayCam: true, nguongGio: GIO.nhieuLan, watchdog: "so_don_tele",
};
const don: Khung = {
  key: "so_don_ngay", phong: "KD", ten: "Số đơn/ngày theo sale và sản phẩm", donVi: "đơn",
  mucTieu: MUC.soDon, nguon: "tg_orders", tanSuat: "nhiều lần/ngày",
  nguongGio: GIO.nhieuLan, watchdog: "so_don_tele",
};
const lead: Khung = {
  key: "lead_ngay", phong: "KD", ten: "Lead mới/ngày theo nguồn, tỉ lệ được chăm", donVi: "lead",
  mucTieu: MUC.lead, nguon: "leads, care_events", tanSuat: "hằng ngày",
  nguongGio: GIO.hangNgay,
};
const chot: Khung = {
  key: "chot_lead", phong: "KD", ten: "Tỉ lệ chốt lead → đơn", donVi: "%",
  mucTieu: MUC.chotLead, nguon: "leads × tg_orders", tanSuat: "hằng tuần",
  nguongGio: GIO.hangTuan,
};
const san: Khung = {
  key: "duoi_san", phong: "KD", ten: "Đơn dưới sàn giá", donVi: "đơn",
  mucTieu: MUC.duoiSan, nguon: "tg_orders (cờ sàn giá v4 của cron tg-boc-don)", tanSuat: "mỗi đơn",
  nguongGio: GIO.moiDon, watchdog: "boc_don_tele",
};

function tenSp(sp: unknown): string[] {
  if (!Array.isArray(sp)) return [];
  return sp.map((d) => String(d?.ten || "").trim()).filter(Boolean);
}

async function donTrongNgay(sb: any, cot: string, ctx?: Ctx): Promise<{ rows: any[]; loai: number }> {
  const hom = homNayVN();
  const [raw, cfg] = await Promise.all([
    docBang(sb, "tg_orders", cot, (q) => q.eq("ngay", hom)),
    docKhoa(sb, "sale_excluded_orders", ctx),
  ]);
  const khoa = cfg && typeof cfg === "object" && !Array.isArray(cfg) ? new Set(Object.keys(cfg as Record<string, unknown>)) : new Set<string>();
  const rows = raw.filter((r) => !khoa.has(`TG-${r.chat_id}-${r.message_id}`));
  return { rows, loai: raw.length - rows.length };
}

export async function oDoanhThuNgay(sb: any, ctx?: Ctx & { docThang?: () => Promise<DoanhThuThat> }): Promise<O> {
  return chay(dt, async () => {
    const hom = homNayVN();
    const { rows, loai } = await donTrongNgay(sb, "ngay, khach_tra, boc_at, chat_id, message_id", ctx);
    if (!rows.length) {
      const them = loai > CAT.khong ? " Đơn trong sale_excluded_orders không tính." : "";
      return oTrong(dt, `chưa có đơn tg_orders hôm nay.${them}`);
    }
    let thang: DoanhThuThat | null = null;
    let loiThang: string | null = null;
    try {
      thang = await (ctx?.docThang ?? doanhThuTheoThang)();
    } catch (e) {
      loiThang = e instanceof Error ? e.message : "không đọc được doanh-thu-that";
    }
    const thangNay = thang?.thang.find((x) => x.thang === thangCua(hom)) || null;
    const gop = rows.reduce((s, r) => s + (Number(r.khach_tra) || CAT.khong), CAT.khong);
    const tien = Math.round(gop / (CAT.mot + VAT_RATE));
    const canh = (thang?.caveats || []).slice(CAT.khong, BA_CANH_BAO);
    const rieng = thangNay?.canhBao || [];
    const ly = [...canh, ...rieng, loiThang].filter(Boolean).join(" · ") || null;
    const muc = mucTieuDoanhThuNgay();
    const den = tien >= muc ? "xanh" : tien > CAT.khong ? "vang" : "do";
    return oSo(dt, tien, {
      den,
      lyDo: ly,
      capNhatLuc: moiNhat(rows.map((r) => r.boc_at)) || thang?.tuoiNguon.soDonToi || null,
      nguon: dt.nguon,
    });
  }, ctx);
}

export async function oSoDonNgay(sb: any, ctx?: Ctx): Promise<O> {
  return chay(don, async () => {
    const { rows } = await donTrongNgay(sb, "ngay, sale, san_pham, boc_at, chat_id, message_id", ctx);
    if (!rows.length) return oTrong(don, "chưa có đơn tg_orders hôm nay");
    const theoSale = new Map<string, number>();
    const theoSp = new Map<string, number>();
    for (const r of rows) {
      const s = String(r.sale || "chưa rõ");
      theoSale.set(s, (theoSale.get(s) || 0) + 1);
      const ts = tenSp(r.san_pham);
      if (!ts.length) theoSp.set("chưa bóc sản phẩm", (theoSp.get("chưa bóc sản phẩm") || 0) + 1);
      for (const t of ts) theoSp.set(t, (theoSp.get(t) || 0) + 1);
    }
    const a = [...theoSale.entries()].map(([k, v]) => `${k} ${v}`).join(", ");
    const b = [...theoSp.entries()].map(([k, v]) => `${k} ${v}`).join(", ");
    return oSo(don, rows.length, {
      den: "xanh",
      lyDo: `sale: ${a} · sản phẩm: ${b}`,
      capNhatLuc: moiNhat(rows.map((r) => r.boc_at)),
    });
  }, ctx);
}

export async function oLeadNgay(sb: any, ctx?: Ctx): Promise<O> {
  return chay(lead, async () => {
    const dau = dauNgayIso(homNayVN());
    const [leads, care] = await Promise.all([
      docBang(sb, "leads", "source, channel, created_at, first_contact_at", (q) => q.gte("created_at", dau)),
      docBang(sb, "care_events", "created_at", (q) => q.gte("created_at", dau)).catch((e) => {
        if (laThieuBang(e)) return [];
        throw e;
      }),
    ]);
    if (!leads.length && !care.length) return oTrong(lead, "chưa có lead mới hôm nay (leads, care_events)");
    const theo = new Map<string, number>();
    let cham = 0;
    for (const r of leads) {
      const ng = String(r.source || r.channel || "chưa rõ nguồn");
      theo.set(ng, (theo.get(ng) || 0) + 1);
      if (r.first_contact_at) cham += 1;
    }
    const phan = [...theo.entries()].map(([k, v]) => `${k} ${v}`).join(", ");
    const ty = leads.length ? Math.round((cham * MOT_TRAM) / leads.length) : CAT.khong;
    return oSo(lead, leads.length, {
      den: "xanh",
      lyDo: `${phan || "không có lead"} · được chăm ${cham}/${leads.length} (${ty}%) · care_events hôm nay ${care.length}. leadStats là cửa tháng, chưa tách nguồn theo ngày nên ô đếm thẳng bảng.`,
      capNhatLuc: moiNhat(leads.map((r) => r.created_at)),
    });
  }, ctx);
}

export async function oChotLead(sb: any, ctx?: Ctx): Promise<O> {
  return chay(chot, async () => {
    void sb;
    return oTrong(chot, CHU.chotLead);
  }, ctx);
}

export async function oDuoiSan(sb: any, ctx?: Ctx): Promise<O> {
  return chay(san, async () => {
    const { rows } = await donTrongNgay(sb, "ngay, san_pham, khach_tra, ghi_chu, boc_at, chat_id, message_id", ctx);
    if (!rows.length) return oTrong(san, "chưa có đơn tg_orders hôm nay để xét sàn");
    let lech = 0;
    for (const r of rows) {
      const co = String(r.ghi_chu || "").includes("DƯỚI SÀN");
      const kq = xetDonSo({ san_pham: r.san_pham, khach_tra: r.khach_tra, kenh: "le" });
      if (co || kq.muc === "chan") lech += 1;
    }
    return oSo(san, lech, {
      den: denDem(lech, true),
      lyDo: lech ? "cờ ghi_chu DƯỚI SÀN hoặc xetDonSo mức chặn (lib/gia-v4, cùng cron tg-boc-don)" : null,
      capNhatLuc: moiNhat(rows.map((r) => r.boc_at)),
    });
  }, ctx);
}

export async function oKd(sb: any, ctx?: Ctx): Promise<O[]> {
  return [
    await oDoanhThuNgay(sb, ctx),
    await oSoDonNgay(sb, ctx),
    await oLeadNgay(sb, ctx),
    await oChotLead(sb, ctx),
    await oDuoiSan(sb, ctx),
  ];
}
