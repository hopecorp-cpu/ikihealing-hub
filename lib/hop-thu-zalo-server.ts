import "server-only";
import { getServiceClient } from "@/lib/supabase-server";
import {
  chuanSdt, gioTu, chuCuaTinCuoi, laTinChoGui, laTinGuiLoi,
  type HopThuKhach, type HopThuNick, type HopThuTin, type HoSoKhach, type TrangThaiKho,
  type HoatDong, type TongQuanZalo, type NhomZalo,
} from "@/lib/hop-thu-zalo";

const TRAN_TIN_XEM_TRUOC = 2000;

let _cot: Set<string> | null = null;
async function cotCoThat(): Promise<Set<string>> {
  if (_cot) return _cot;
  try {
    const { data } = await getServiceClient().from("zalo_bridge_contacts").select("*").limit(1);
    _cot = new Set(data?.length ? Object.keys(data[0]) : []);
  } catch { _cot = new Set(); }
  return _cot;
}
const coCot054 = async () => (await cotCoThat()).has("thread_type");
const coCot055 = async () => (await cotCoThat()).has("nhan_sale");
const coCot058 = async () => (await cotCoThat()).has("avatar_url");

let _cotTin: Set<string> | null = null;
async function coCot061(): Promise<boolean> {
  if (!_cotTin) {
    try {
      const { data } = await getServiceClient().from("zalo_bridge_messages").select("*").limit(1);
      _cotTin = new Set(data?.length ? Object.keys(data[0]) : []);
    } catch { _cotTin = new Set(); }
  }
  return _cotTin.has("media_type");
}

async function theTheoSdt(): Promise<Record<string, { the: string[]; soDon: number; tong: number }>> {
  const sb = getServiceClient();
  let rows: any[] = [], off = 0;
  while (true) {

    const { data } = await sb.from("tg_orders").select("sdt, khach_tra, ngay").range(off, off + 999);
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    off += 1000;
  }
  const gom: Record<string, { the: string[]; soDon: number; tong: number }> = {};
  for (const r of rows) {
    const p = chuanSdt(r.sdt);
    if (!p) continue;
    const g = (gom[p] ??= { the: [], soDon: 0, tong: 0 });
    g.soDon++;
    g.tong += Number(r.khach_tra) || 0;
  }
  for (const g of Object.values(gom)) {
    if (g.soDon >= 3 || g.tong >= 5_000_000) g.the.push("vip");
    else if (g.soDon >= 2) g.the.push("mua-lai");
    else g.the.push("da-mua");
  }
  return gom;
}

export async function layNick(): Promise<HopThuNick[]> {
  const sb = getServiceClient();
  const [acc, cfg, cau] = await Promise.all([
    sb.from("zalo_bridge_accounts").select("own_id, sale_name, display_name").order("sale_name", { ascending: true }),
    sb.from("config").select("value").eq("key", "zalo_nick_status").maybeSingle(),
    sb.from("config").select("value").eq("key", "zalo_bridge_nick").maybeSingle(),
  ]);

  const sucKhoe: Record<string, { song: boolean | null; status: string | null }> = {};
  try {
    for (const n of JSON.parse(cfg.data?.value || "{}")?.nick || []) {
      if (n?.id) sucKhoe[String(n.id)] = { song: typeof n.song === "boolean" ? n.song : null, status: n.status || null };
    }
  } catch {  }

  try {
    for (const [ownId, v] of Object.entries(JSON.parse(cau.data?.value || "{}") as Record<string, any>)) {
      const tuoiPhut = v?.at ? (Date.now() - Date.parse(v.at)) / 60000 : 999;
      const song = !!v?.ok && tuoiPhut <= 20;
      sucKhoe[ownId] = { song, status: song ? "CẦU NỐI" : `cầu đứng ${Math.round(tuoiPhut)} phút` };
    }
  } catch {  }

  return (acc.data || []).map((r) => ({
    ownId: r.own_id,
    sale: r.sale_name || null,
    tenZalo: r.display_name || null,
    song: sucKhoe[r.own_id]?.song ?? null,
    status: sucKhoe[r.own_id]?.status ?? null,
  }));
}

export async function nickChoPhep(
  user: { role?: string | null; position?: string | null; full_name?: string | null } | null
): Promise<string[] | null> {
  if (!user) return [];
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "ceo" || role === "manager") return null;

  const ten = String(user.full_name || "").trim().toLowerCase();
  if (!ten) return [];
  const nick = await layNick();
  return nick.filter((n) => String(n.sale || "").trim().toLowerCase() === ten).map((n) => n.ownId);
}

export async function layDanhSachKhach(
  chiNick: string[] = [], tran = 3000, chiKieu?: "user" | "group",
): Promise<HopThuKhach[]> {
  const sb = getServiceClient();
  const nick = await layNick();
  const saleTheoNick = Object.fromEntries(nick.map((n) => [n.ownId, n.sale]));

  const co054 = await coCot054();
  const co055 = await coCot055();
  const co058 = await coCot058();
  const COT = "own_id, zalo_uid, display_name, phone, phone_norm, last_msg_at, last_in_at, last_out_at, unreplied, msg_count"
    + (co054 ? ", thread_type, unread_count, last_content, last_type" : "")
    + (co055 ? ", zalo_name, ngay_sinh, trang_thai, la_ban_be, nhan_sale" : "")
    + (co058 ? ", avatar_url, thu_hoi_so, thu_hoi_luc" : "");
  const truyVan = (chiCho: boolean, gioiHan: number) => {
    let q = sb.from("zalo_bridge_contacts").select(COT)
      .order("last_msg_at", { ascending: false, nullsFirst: false })
      .limit(gioiHan);
    if (chiCho) q = q.eq("unreplied", true);
    if (chiNick.length) q = q.in("own_id", chiNick);
    if (chiKieu && co054) q = q.eq("thread_type", chiKieu);
    return q;
  };

  const latTrang = async (chiCho: boolean, gioiHan: number) => {
    let ra: any[] = [];
    for (let off = 0; off < gioiHan; off += 1000) {
      const { data } = await truyVan(chiCho, Math.min(1000, gioiHan - off)).range(off, off + Math.min(1000, gioiHan - off) - 1);
      if (!data?.length) break;
      ra = ra.concat(data);
      if (data.length < 1000) break;
    }
    return { data: ra };
  };
  const [cho, moi] = await Promise.all([latTrang(true, 2000), latTrang(false, tran)]);

  const rows = ([...(cho.data || []), ...(moi.data || [])] as any[])
    .filter((r, i, a) => i === a.findIndex((x) => x.own_id === r.own_id && x.zalo_uid === r.zalo_uid))
    .sort((a, b) => String(b.last_msg_at || "").localeCompare(String(a.last_msg_at || "")));
  if (!rows.length) return [];

  const cuoi: Record<string, { noiDung: string; huong: "in" | "out" }> = {};
  if (!co054) {
    let mq = sb.from("zalo_bridge_messages")
      .select("thread_id, own_id, content, direction, sent_at")
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(TRAN_TIN_XEM_TRUOC);
    if (chiNick.length) mq = mq.in("own_id", chiNick);
    const { data: tin } = await mq;
    for (const m of tin || []) {
      const k = `${m.own_id}|${m.thread_id}`;
      if (cuoi[k]) continue;
      cuoi[k] = { noiDung: String(m.content || ""), huong: m.direction === "out" ? "out" : "in" };
    }
  }

  const thieu = co054 ? [] : rows.filter((r) => r.unreplied && r.last_in_at && !cuoi[`${r.own_id}|${r.zalo_uid}`]);
  if (thieu.length) {
    for (let i = 0; i < thieu.length; i += 200) {
      const lo = thieu.slice(i, i + 200);
      const { data: bu } = await sb.from("zalo_bridge_messages")
        .select("thread_id, own_id, content, direction, sent_at")
        .in("thread_id", lo.map((r) => r.zalo_uid))
        .in("sent_at", lo.map((r) => r.last_in_at as string));
      for (const m of bu || []) {
        const k = `${m.own_id}|${m.thread_id}`;
        if (cuoi[k]) continue;
        cuoi[k] = { noiDung: String(m.content || ""), huong: m.direction === "out" ? "out" : "in" };
      }
    }
  }

  const the = await theTheoSdt();

  return rows.map((r) => {
    const k = `${r.own_id}|${r.zalo_uid}`;

    const huongSuy: "in" | "out" | null = r.last_out_at && r.last_in_at
      ? (r.last_out_at >= r.last_in_at ? "out" : "in")
      : r.last_out_at ? "out" : r.last_in_at ? "in" : null;
    const c = (r as any).last_content
      ? { noiDung: String((r as any).last_content), huong: cuoi[k]?.huong ?? huongSuy }
      : cuoi[k];
    return {
      ownId: r.own_id,
      uid: r.zalo_uid,
      ten: r.display_name || r.phone || r.zalo_uid,
      phone: r.phone || null,
      phoneNorm: r.phone_norm || null,
      sale: saleTheoNick[r.own_id] || null,
      tinCuoiAt: r.last_msg_at || null,
      dangCho: !!r.unreplied,
      soTin: r.msg_count || 0,

      choGio: r.unreplied ? gioTu(r.last_in_at || r.last_msg_at) : null,
      cauCuoi: chuCuaTinCuoi(c?.noiDung),
      huongCuoi: c?.huong || null,
      laNhom: (r as any).thread_type === "group",
      chuaDoc: Number((r as any).unread_count) || 0,
      the: (r.phone_norm ? the[r.phone_norm]?.the : null) as any || (r.phone_norm ? ["chua-mua"] : []),
      tenZalo: (r as any).zalo_name || null,
      ngaySinh: (r as any).ngay_sinh || null,
      trangThai: (r as any).trang_thai || null,
      laBanBe: !!(r as any).la_ban_be,
      nhanSale: Array.isArray((r as any).nhan_sale) ? (r as any).nhan_sale : [],
      anh: (r as any).avatar_url || null,
      thuHoiSo: Number((r as any).thu_hoi_so) || 0,
      thuHoiLuc: (r as any).thu_hoi_luc || null,
    };
  });
}

export async function layHoatDong(phone: string | null, tran = 12): Promise<HoatDong[]> {
  const norm = chuanSdt(phone);
  if (!norm) return [];
  const sb = getServiceClient();
  const noiDia = "0" + norm.slice(2);

  const [don, su] = await Promise.all([
    sb.from("tg_orders").select("ngay, san_pham, khach_tra, sale")
      .in("sdt", [noiDia, norm]).order("ngay", { ascending: false }).limit(tran),
    sb.from("care_events").select("created_at, kind, channel, content, outcome, sale_name")
      .in("customer_phone", [noiDia, norm]).order("created_at", { ascending: false }).limit(tran),
  ]);

  const ds: HoatDong[] = [];
  for (const d of don.data || []) {
    const sp = Array.isArray(d.san_pham)
      ? d.san_pham.map((p: any) => (typeof p === "string" ? p : p?.ten || p?.name || "")).filter(Boolean).join(", ")
      : String(d.san_pham || "");
    ds.push({
      luc: d.ngay || null, loai: "don",
      tieuDe: `Đơn hàng ${(Number(d.khach_tra) || 0).toLocaleString("vi-VN")}đ`,
      chiTiet: sp || null, nguoi: d.sale || null,
    });
  }
  for (const e of su.data || []) {
    const loai: HoatDong["loai"] = e.kind === "call" ? "goi" : e.kind === "gift" ? "qua" : "cham";
    ds.push({
      luc: e.created_at || null, loai,
      tieuDe: e.kind === "call" ? "Gọi điện" : e.kind === "gift" ? "Tặng quà" : `Chăm sóc qua ${e.channel || "zalo"}`,
      chiTiet: e.content || e.outcome || null, nguoi: e.sale_name || null,
    });
  }
  return ds
    .sort((a, b) => String(b.luc || "").localeCompare(String(a.luc || "")))
    .slice(0, tran);
}

export async function layDoanChat(ownId: string, uid: string, tran = 200, truocLuc?: string | null, sauLuc?: string | null): Promise<HopThuTin[]> {
  const sb = getServiceClient();
  const coMedia = await coCot061();
  const cot = `msg_id, direction, content, sent_at${coMedia ? ", media_type, media_url, media_thumb, media_ten, cli_msg_id" : ""}`;

  let q = sb.from("zalo_bridge_messages")
    .select(cot)
    .eq("own_id", ownId).eq("thread_id", uid)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(tran);
  if (truocLuc) q = q.lt("sent_at", truocLuc);

  if (sauLuc) q = q.gt("sent_at", sauLuc);
  const [{ data }, { data: cfg }] = await Promise.all([
    q,
    sb.from("config").select("value").eq("key", "zalo_thu_hoi").maybeSingle(),
  ]);

  const thuHoi = new Map<string, { luc: string; boi: string | null }>();
  try {
    for (const v of Object.values(JSON.parse(cfg?.value || "{}")) as any[]) {
      if (String(v?.own) !== String(ownId)) continue;
      for (const id of v.ids || []) thuHoi.set(String(id), { luc: v.luc, boi: v.boiTen || v.boi || null });
    }
  } catch {  }
  return ((data || []) as any[])
    .map((m) => ({
      id: m.msg_id,
      huong: (m.direction === "out" ? "out" : "in") as "in" | "out",
      noiDung: String(m.content || ""),
      luc: m.sent_at || null,
      ...(m.media_type
        ? {
            media: {
              loai: String(m.media_type),

              daTai: (!!m.media_url && m.media_url !== QUA_TRAN) || !!m.media_thumb,
              ten: m.media_ten || null,
              ...(m.media_url === QUA_TRAN ? { quaTran: true } : {}),
            },
          }
        : {}),
      ...(laTinChoGui(m.msg_id) ? { dangGui: true } : {}),
      ...(laTinGuiLoi(m.msg_id) ? { guiLoi: true } : {}),

      ...(thuHoi.has(String(m.msg_id))
        ? { thuHoi: thuHoi.get(String(m.msg_id))! }
        : m.cli_msg_id && thuHoi.has(String(m.cli_msg_id))
          ? { thuHoi: thuHoi.get(String(m.cli_msg_id))! }
          : {}),
    }))
    .reverse();
}

export async function layHoSoKhach(phone: string | null, tenGoiY: string): Promise<HoSoKhach> {
  const nen: HoSoKhach = {
    ten: tenGoiY, phone: null, sale: null, tags: [], diemTuVan: null, nhuCau: null,
    soDon: 0, tongChi: 0, donGanDay: [], care: null, lead: null,
  };
  const norm = chuanSdt(phone);
  if (!norm) return nen;

  const sb = getServiceClient();

  const noiDia = "0" + norm.slice(2);

  const [don, care, lead, chat] = await Promise.all([
    sb.from("tg_orders").select("ngay, san_pham, khach_tra, khach, sale")
      .in("sdt", [noiDia, norm, phone as string]).order("ngay", { ascending: false }).limit(50),
    sb.from("customer_care_log").select("flow_type, current_day, last_contact, next_due, status, sale_name")
      .in("customer_phone", [noiDia, norm]).order("updated_at", { ascending: false }).limit(1),
    sb.from("leads").select("source, status, assigned_at, first_contact_at, customer_name")
      .in("phone", [noiDia, norm]).order("created_at", { ascending: false }).limit(1),
    sb.from("salework_chat_analysis").select("score, customer_need, tags, customer_name")
      .in("phone", [noiDia, norm]).order("analyzed_at", { ascending: false }).limit(1),
  ]);

  const dons = don.data || [];
  const c = (care.data || [])[0];
  const l = (lead.data || [])[0];
  const a = (chat.data || [])[0];

  return {
    ten: dons[0]?.khach || a?.customer_name || l?.customer_name || tenGoiY,
    phone: noiDia,
    sale: dons[0]?.sale || c?.sale_name || null,
    tags: Array.isArray(a?.tags) ? a!.tags.filter(Boolean).map(String) : [],
    diemTuVan: typeof a?.score === "number" ? a.score : null,
    nhuCau: a?.customer_need || null,
    soDon: dons.length,
    tongChi: dons.reduce((s, d) => s + (Number(d.khach_tra) || 0), 0),
    donGanDay: dons.slice(0, 5).map((d) => ({
      ngay: d.ngay || null,
      sanPham: Array.isArray(d.san_pham)
        ? d.san_pham.map((p: any) => (typeof p === "string" ? p : p?.ten || p?.name || "")).filter(Boolean).join(", ")
        : String(d.san_pham || ""),
      khachTra: Number(d.khach_tra) || 0,
    })),
    care: c ? {
      flow: c.flow_type || null, ngay: c.current_day ?? null, lanCuoi: c.last_contact || null,
      hanKe: c.next_due || null, trangThai: c.status || null,
    } : null,
    lead: l ? {
      nguon: l.source || null, trangThai: l.status || null,
      giaoLuc: l.assigned_at || null, chamLuc: l.first_contact_at || null,
    } : null,
  };
}

export async function layTrangThaiKho(): Promise<TrangThaiKho> {
  const sb = getServiceClient();

  const { data: tinCuoi } = await sb.from("zalo_bridge_messages")
    .select("created_at").order("created_at", { ascending: false }).limit(1);
  const mocThat = tinCuoi?.[0]?.created_at || null;

  const { data } = await sb.from("config").select("value").eq("key", "zalo_hop_thu_status").maybeSingle();
  if (!data?.value) {
    return { ok: !!mocThat, at: mocThat, note: mocThat ? "Cầu nối đang ghi tin" : "Chưa có tin nào", gioTre: gioTu(mocThat), nick: null, khach: null, tin: null };
  }
  try {
    const v = JSON.parse(data.value);

    const at = mocThat && (!v.at || mocThat > v.at) ? mocThat : (v.at || null);
    return {
      ok: at === mocThat ? true : !!v.ok, at, note: v.note || null, gioTre: gioTu(at),
      nick: v.nick ?? null, khach: v.khach ?? null, tin: v.tin ?? null,
    };
  } catch {
    return { ok: false, at: null, note: "Cờ trạng thái hỏng khuôn", gioTre: null, nick: null, khach: null, tin: null };
  }
}

export async function layTongQuan(chiNick: string[] = []): Promise<TongQuanZalo> {
  const [ds, nick, nhom] = await Promise.all([
    layDanhSachKhach(chiNick, 10000), layNick(), layNhom(chiNick),
  ]);
  const le = ds.filter((k) => !k.laNhom);
  const cho = le.filter((k) => k.dangCho);

  const theoNick = nick
    .filter((n) => !chiNick.length || chiNick.includes(n.ownId))
    .map((n) => {
      const cua = le.filter((k) => k.ownId === n.ownId);
      const c = cua.filter((k) => k.dangCho);
      const lau = c.reduce((m, k) => Math.max(m, k.choGio ?? 0), 0);
      return {
        ownId: n.ownId, sale: n.sale, song: n.song, status: n.status,
        hoiThoai: cua.length,
        cho: c.length,
        choTrongTuan: c.filter((k) => (k.choGio ?? 1e9) <= 7 * 24).length,
        choQua30Ngay: c.filter((k) => (k.choGio ?? 0) > 30 * 24).length,
        lauNhatNgay: lau ? Math.round(lau / 24) : null,
      };
    })
    .sort((a, b) => b.cho - a.cho);

  const daDo = nhom.filter((n) => n.soThanhVien != null);
  const nhomDaDo = daDo.length;
  const nhomThanhVien = nhomDaDo ? daDo.reduce((s, n) => s + (n.soThanhVien || 0), 0) : null;

  return {
    tongHoiThoai: le.length,
    soNhom: nhom.length,
    soChuaDoc: le.filter((k) => k.chuaDoc).length,
    choTrongTuan: cho.filter((k) => (k.choGio ?? 1e9) <= 7 * 24).length,
    choTatCa: cho.length,
    choQua30Ngay: cho.filter((k) => (k.choGio ?? 0) > 30 * 24).length,
    theoNick,
    nhomThanhVien,
    nhomDaDo,
  };
}

const khoaNhom = (ten: string) =>
  String(ten || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();

const QUA_TRAN = "(qua-tran)";

export async function layNhom(chiNick: string[] = []): Promise<NhomZalo[]> {
  const ds = (await layDanhSachKhach(chiNick, 2000, "group")).filter((k) => k.laNhom);

  const soTv: Record<string, number> = {};
  try {
    const { data } = await getServiceClient()
      .from("zalo_group_snapshots").select("ten_nhom, so_tv, ngay")
      .order("ngay", { ascending: false }).limit(1000);
    for (const r of data || []) {
      const k = khoaNhom(r.ten_nhom);
      if (k && !(k in soTv)) soTv[k] = Number(r.so_tv) || 0;
    }
  } catch {  }

  const gom: Record<string, NhomZalo & { nick: Set<string> }> = {};
  for (const k of ds) {
    const key = khoaNhom(k.ten);
    const g = (gom[key] ??= {
      ownId: k.ownId, uid: k.uid, ten: k.ten, sale: null,
      soTin: 0, tinCuoiAt: null, cauCuoi: "", soThanhVien: soTv[key] ?? null,
      nick: new Set<string>(),
    });
    if (k.sale) g.nick.add(k.sale);
    g.soTin += k.soTin;

    if (!g.tinCuoiAt || (k.tinCuoiAt && k.tinCuoiAt > g.tinCuoiAt)) {
      g.tinCuoiAt = k.tinCuoiAt; g.cauCuoi = k.cauCuoi; g.ownId = k.ownId; g.uid = k.uid;
    }
  }

  return Object.values(gom)
    .map(({ nick, ...g }) => ({ ...g, sale: [...nick].sort().join(", ") || null }))
    .sort((a, b) => (b.soThanhVien ?? -1) - (a.soThanhVien ?? -1));
}
