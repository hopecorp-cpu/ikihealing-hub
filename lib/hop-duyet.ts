import "server-only";
import { isAdmin, isManagerOrAbove, isMktPosition, isSalePosition, isCskhPosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { sapXep, type KetQuaHopDuyet, type MucDuyet } from "@/lib/hop-duyet-core";

type NguoiXem = { role?: string | null; position?: string | null };

export async function docHopDuyet(sb: any, u: NguoiXem): Promise<KetQuaHopDuyet> {
  const muc: MucDuyet[] = [];
  const nguonHong: string[] = [];
  const admin = isAdmin(u.role);
  const quanLy = isManagerOrAbove(u.role);
  const cfg = async (k: string) => {
    const { data, error } = await sb.from("config").select("value").eq("key", k).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.value ? JSON.parse(data.value) : null;
  };
  const chay = async (ten: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e: any) { nguonHong.push(ten); console.error(`[hop-duyet] ${ten}:`, e?.message || e); }
  };

  const viec: Promise<void>[] = [];

  if (quanLy) viec.push(chay("Xin nghỉ", async () => {
    const { data, error } = await sb.from("leaves").select("*, user:users!leaves_user_id_fkey(full_name)").eq("status", "pending").limit(200);
    if (error) throw new Error(error.message);
    for (const l of data || []) {
      const tu = l.from_date || l.start_date || "", den = l.to_date || l.end_date || "";
      muc.push({
        id: `leave:${l.id}`, nguon: "Xin nghỉ", nhom: "Nhân sự", ruiRo: "vua", hanGio: 24, link: "/admin/xin-nghi",
        tieuDe: `${l.user?.full_name || "Nhân viên"} xin nghỉ${l.total_days ? ` ${l.total_days} ngày` : ""}`,
        chiTiet: [tu && `từ ${tu}`, den && den !== tu && `đến ${den}`, l.leave_type].filter(Boolean).join(" · "),
        luc: l.created_at,
      });
    }
  }));

  if (admin) viec.push(chay("Sửa chấm công", async () => {
    const { data, error } = await sb.from("attendance_correction_requests")
      .select("*, users!attendance_correction_requests_user_id_fkey(full_name)").eq("status", "pending").limit(200);
    if (error) throw new Error(error.message);
    for (const r of data || []) muc.push({
      id: `att:${r.id}`, nguon: "Sửa chấm công", nhom: "Nhân sự", ruiRo: "thap", hanGio: 48, link: "/admin/cham-cong",
      tieuDe: `${r.users?.full_name || "Nhân viên"} xin sửa công${r.date ? ` ngày ${r.date}` : ""}`,
      chiTiet: String(r.reason || r.note || "").slice(0, 140) || undefined, luc: r.created_at,
    });
  }));

  if (admin) viec.push(chay("Bảng lương", async () => {

    const nay = vnDateStr().slice(0, 7);
    const d = new Date(`${nay}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
    const truoc = d.toISOString().slice(0, 7);
    const { data, error } = await sb.from("payroll").select("month, status, created_at").in("month", [truoc, nay]).in("status", ["preview", "draft"]);
    if (error) throw new Error(error.message);
    const theoThang: Record<string, { n: number; luc: string }> = {};
    for (const r of data || []) {
      const t = (theoThang[r.month] ??= { n: 0, luc: r.created_at });
      t.n++; if (r.created_at < t.luc) t.luc = r.created_at;
    }
    for (const [thang, t] of Object.entries(theoThang)) muc.push({
      id: `payroll:${thang}`, nguon: "Bảng lương", nhom: "Tài chính", ruiRo: "cao", hanGio: 48, link: `/bang-luong?month=${thang}`,
      tieuDe: `Bảng lương tháng ${thang.slice(5)}/${thang.slice(0, 4)}: ${t.n} dòng chờ duyệt`,
      chiTiet: "Nhân viên chưa xem được phiếu lương tới khi duyệt", luc: t.luc,
    });
  }));

  if (quanLy) viec.push(chay("Bài chờ duyệt", async () => {
    const { data, error } = await sb.from("content_items").select("*").eq("status", "review").limit(200);
    if (error) throw new Error(error.message);
    for (const c of data || []) muc.push({
      id: `content:${c.id}`, nguon: "Bài chờ duyệt", nhom: "Nội dung", ruiRo: "vua", hanGio: 24, link: "/content",
      tieuDe: c.title || "(bài chưa đặt tên)", chiTiet: [c.channel, c.type].filter(Boolean).join(" · ") || undefined,
      luc: c.updated_at || c.created_at,
    });
  }));

  if (quanLy || isMktPosition(u.position)) viec.push(chay("Video chờ duyệt", async () => {
    const q = await cfg("video_queue");
    const ds: any[] = Array.isArray(q) ? q : Array.isArray(q?.items) ? q.items : [];
    for (const v of ds.filter((x) => x?.status === "nhap")) muc.push({
      id: `video:${v.id}`, nguon: "Video chờ duyệt", nhom: "Nội dung", ruiRo: "vua", hanGio: 24, link: "/lich-dang-video",
      tieuDe: v.title || "(video chưa đặt tên)", chiTiet: `${v.pageName || "fanpage"} · hẹn ${v.publishAt || "?"}`,
      luc: v.createdAt,
    });
  }));

  if (quanLy || isSalePosition(u.position) || isCskhPosition(u.position)) viec.push(chay("Tin Zalo chờ gửi", async () => {
    const oa = (await cfg("zalo_oa_nhap")) || {};
    const chuoi = (await cfg("zalo_tin_soan"))?.tin || [];
    const lucOa = Object.values(oa).map((t: any) => t?.luc).filter(Boolean).sort();
    if (lucOa.length) muc.push({
      id: "zalo:oa", nguon: "Tin Zalo chờ gửi", nhom: "Bán hàng", ruiRo: "cao", hanGio: 2, link: "/tin-soan",
      tieuDe: `${lucOa.length} khách nhắn Zalo OA đang chờ trả lời`,
      chiTiet: "Zalo chỉ cho trả lời trong 48 giờ kể từ tin của khách", luc: lucOa[0],
    });
    if (chuoi.length) muc.push({
      id: "zalo:chuoi", nguon: "Tin Zalo chờ gửi", nhom: "Bán hàng", ruiRo: "thap", hanGio: 24, link: "/tin-soan",
      tieuDe: `${chuoi.length} tin chuỗi chăm sóc máy đã soạn, chờ người gửi`,
      luc: (await cfg("zalo_tin_soan"))?.at || new Date().toISOString(),
    });
  }));

  if (admin) viec.push(chay("Việc giao Claude Code", async () => {
    const j = await cfg("cc_queue");
    for (const t of (Array.isArray(j?.items) ? j.items : []).filter((x: any) => x?.status === "pending")) muc.push({
      id: `cc:${t.id}`, nguon: "Việc giao Claude Code", nhom: "Vận hành", ruiRo: "vua", hanGio: 24, link: "/may-chay-ngam",
      tieuDe: String(t.task || "").slice(0, 120), chiTiet: `${t.byName || "?"} giao · duyệt bằng /duyet ${t.id} trên Telegram`,
      luc: t.createdAt,
    });
  }));

  await Promise.all(viec);
  return { muc: sapXep(muc, Date.now()), nguonHong };
}
