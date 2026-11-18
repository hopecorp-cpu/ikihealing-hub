import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";
import { dongBoViec, type ViecCan, type KetQuaViec } from "@/lib/viec-tu-may";
import { appLink } from "@/lib/app-url";

export const KHOA = "ra_mat_sp";
export const THE_VIEC = "ra-mat-sp";

export type ViecMau = {
  khoa: string;
  phong: "content" | "sale" | "kho" | "mkt";
  tieuDe: string;
  moTa: string;
  hanSauNgay: number;
  nguoi?: string;
};

export const VIEC_CHUAN: ViecMau[] = [
  { khoa: "kho-nhap",     phong: "kho",     hanSauNgay: 0, tieuDe: "Nhập kho + chụp ảnh thật {ten}", moTa: "Nhập số lượng vào kho. Chụp ảnh thật sản phẩm (bao bì, nhãn, kích thước) và gửi vào nhóm nội dung — ảnh thật là đầu vào cho mọi bài sau, không có ảnh thì content không làm được gì." },
  { khoa: "sp-len-he-thong", phong: "kho",  hanSauNgay: 1, tieuDe: "Lên sản phẩm {ten} vào danh mục + giá", moTa: "Tạo mã SKU, tên chuẩn, giá bán, đơn vị trong danh mục sản phẩm. Chưa có trong danh mục thì đơn không lên được và mọi số đo về sau đều mù." },
  { khoa: "content-brief", phong: "content", hanSauNgay: 2, tieuDe: "Bài giới thiệu {ten} — bản đầu tiên", moTa: "Một bài giới thiệu đủ ba ý: sản phẩm là gì, ai nên dùng, dùng thế nào. Qua cổng từ cấm trước khi đăng. Gắn related_product = {sku} để máy đếm được." },
  { khoa: "content-3-bai", phong: "content", hanSauNgay: 7, tieuDe: "Đủ 3 bài về {ten} trong 7 ngày đầu", moTa: "Tối thiểu 3 bài (giới thiệu, cách dùng, câu hỏi khách hay hỏi) trên các kênh đang có. Máy đếm theo related_product = {sku} — bài không gắn mã sản phẩm thì không được tính." },
  { khoa: "sale-kich-ban", phong: "sale",   hanSauNgay: 2, tieuDe: "Kịch bản tư vấn {ten} cho đội sale", moTa: "Một trang: sản phẩm giải quyết việc gì cho khách, giá, combo đi kèm, 5 câu khách hay hỏi và cách trả lời. Đưa vào playbook để người mới cũng nói được." },
  { khoa: "sale-bao-khach", phong: "sale",  hanSauNgay: 5, tieuDe: "Báo {ten} cho tệp khách cũ phù hợp", moTa: "Chọn tệp khách đã mua dòng liên quan, nhắn/gọi giới thiệu trong 5 ngày đầu. Ghi vào nhật ký chăm sóc để máy đếm được số khách đã báo." },
  { khoa: "mkt-do-7-ngay",  phong: "mkt",   hanSauNgay: 7, tieuDe: "Đo 7 ngày đầu của {ten}", moTa: "Sau 7 ngày: bao nhiêu bài đã lên, bao nhiêu khách đã báo, bao nhiêu đơn đầu tiên. Máy tự đếm và ghi vào phiếu; người xem số rồi quyết đẩy tiếp hay dừng." },
];

export type PhieuRaMat = {
  ma: string;
  ten: string;
  sku?: string;
  ngayRaMat: string;
  moTa?: string;
  phuTrach: Partial<Record<ViecMau["phong"], string>>;
  taoLuc: string;
  taoBoi?: string;
  trangThai: "dang-chay" | "xong" | "huy";

  do?: { luc: string; soBai: number; soBaiDaDang: number; soKhachDaBao: number; soDon: number; ghiChu: string[] };
};

type Kho = { phieu: PhieuRaMat[] };
async function docKho(): Promise<Kho> {
  try { const raw = await getConfigValue(KHOA); return raw ? JSON.parse(raw) : { phieu: [] }; } catch { return { phieu: [] }; }
}
async function ghiKho(k: Kho) { await setConfigValue(KHOA, JSON.stringify(k), "Phiếu ra mắt sản phẩm mới"); }

export const layPhieu = async () => (await docKho()).phieu.sort((a, b) => b.ngayRaMat.localeCompare(a.ngayRaMat));

async function layMau(): Promise<ViecMau[]> {
  try { const raw = await getConfigValue(`${KHOA}_mau`); const j = raw ? JSON.parse(raw) : null; return Array.isArray(j) && j.length ? j : VIEC_CHUAN; }
  catch { return VIEC_CHUAN; }
}

const congNgay = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const the = (s: string, p: PhieuRaMat) => s.replace(/\{ten\}/g, p.ten).replace(/\{sku\}/g, p.sku || p.ma);

export async function moPhieu(sb: any, p: Omit<PhieuRaMat, "taoLuc" | "trangThai" | "do">, taoBoi?: string): Promise<{ phieu: PhieuRaMat; viec: KetQuaViec }> {
  const kho = await docKho();
  let phieu = kho.phieu.find((x) => x.ma === p.ma);

  if (phieu) Object.assign(phieu, p, { trangThai: "dang-chay" as const });
  else { phieu = { ...p, taoLuc: new Date().toISOString(), taoBoi, trangThai: "dang-chay" }; kho.phieu.push(phieu); }
  await ghiKho(kho);
  const viec = await deViec(sb, phieu);
  return { phieu, viec };
}

export async function deViec(sb: any, p: PhieuRaMat): Promise<KetQuaViec> {
  const mau = await layMau();
  const cans: ViecCan[] = p.trangThai === "dang-chay" ? mau.map((m) => ({
    khoa: `${p.ma}:${m.khoa}`,
    tieuDe: `[Ra mắt] ${the(m.tieuDe, p)}`.slice(0, 200),
    moTa: `${the(m.moTa, p)}\n\nSản phẩm: ${p.ten}${p.sku ? ` (${p.sku})` : ""} · ra mắt ${p.ngayRaMat}\nPhiếu ra mắt: ${appLink("/ra-mat-san-pham")}`,
    nguoi: m.nguoi || p.phuTrach[m.phong],
    han: congNgay(p.ngayRaMat, m.hanSauNgay),
    uuTien: m.hanSauNgay <= 1 ? "high" : "medium",
  })) : [];
  return dongBoViec(sb, {
    the: THE_VIEC,
    cans,

    tuDong: false,
    ngayLeoThang: 2,
  });
}

export async function dongViecCuaPhieu(sb: any, ma: string, lyDo: string): Promise<number> {
  const { data } = await sb.from("tasks").select("id, tags").contains("tags", [THE_VIEC]).in("status", ["todo", "doing", "review", "blocked"]).limit(300);
  let n = 0;
  for (const t of (data || []) as any[]) {
    if (!(t.tags || []).some((x: string) => x.startsWith(`${THE_VIEC}:${ma}:`))) continue;
    const { error } = await sb.from("tasks").update({ status: "done", completed_at: new Date().toISOString(), description: `[Máy đóng] ${lyDo}` }).eq("id", t.id);
    if (!error) n++;
  }
  return n;
}

export async function doiTrangThai(sb: any, ma: string, trangThai: PhieuRaMat["trangThai"]): Promise<void> {
  const kho = await docKho();
  const p = kho.phieu.find((x) => x.ma === ma);
  if (!p) return;
  p.trangThai = trangThai;
  await ghiKho(kho);
  if (trangThai !== "dang-chay") await dongViecCuaPhieu(sb, ma, trangThai === "xong" ? "Phiếu ra mắt đã đóng — xong." : "Phiếu ra mắt đã huỷ.");
}

export async function doPhieu(sb: any, p: PhieuRaMat): Promise<NonNullable<PhieuRaMat["do"]>> {
  const ghiChu: string[] = [];
  const tu = p.ngayRaMat;
  const kd = (s: any) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const khop = (s: any) => { const k = kd(s); return (p.sku && k.includes(kd(p.sku))) || k.includes(kd(p.ten)); };

  let soBai = 0, soBaiDaDang = 0;
  try {
    const { data } = await sb.from("content_items").select("status, related_product, title, created_at, publish_date").gte("created_at", tu).limit(2000);
    const ds = (data || []).filter((c: any) => khop(c.related_product) || khop(c.title));
    soBai = ds.length;
    soBaiDaDang = ds.filter((c: any) => /published|posted|da-dang|đã đăng/i.test(String(c.status || "")) || (c.publish_date && c.publish_date <= vnDateStr())).length;
    if (!soBai) ghiChu.push("Chưa bài nào gắn related_product hoặc tiêu đề khớp tên sản phẩm — bài không gắn mã thì máy không đếm được.");
  } catch (e: any) { ghiChu.push(`không đọc được content_items: ${String(e?.message || e).slice(0, 60)}`); }

  let soKhachDaBao = 0;
  try {
    const { data } = await sb.from("care_events").select("customer_phone, note, created_at").gte("created_at", tu).limit(5000);
    soKhachDaBao = new Set((data || []).filter((e: any) => khop(e.note)).map((e: any) => e.customer_phone)).size;
  } catch { ghiChu.push("không đọc được care_events (chưa có bảng hoặc chưa ghi nhật ký chăm)."); }

  let soDon = 0;
  try {
    const { data } = await sb.from("tg_orders").select("chat_id, message_id, san_pham, ngay").gte("ngay", tu).limit(5000);
    soDon = (data || []).filter((o: any) => (Array.isArray(o.san_pham) ? o.san_pham : []).some((x: any) => khop(x?.ten))).length;
  } catch { ghiChu.push("không đọc được sổ đơn Telegram."); }

  return { luc: new Date().toISOString(), soBai, soBaiDaDang, soKhachDaBao, soDon, ghiChu };
}

export async function doTatCa(sb: any): Promise<{ soPhieu: number; ketQua: Array<{ ma: string; ten: string; do: NonNullable<PhieuRaMat["do"]>; ngayThu: number }> }> {
  const kho = await docKho();
  const kq: any[] = [];
  for (const p of kho.phieu) {
    if (p.trangThai !== "dang-chay") continue;
    p.do = await doPhieu(sb, p);
    const ngayThu = Math.floor((Date.now() - new Date(`${p.ngayRaMat}T00:00:00Z`).getTime()) / 864e5) + 1;
    kq.push({ ma: p.ma, ten: p.ten, do: p.do, ngayThu });

    if (ngayThu >= 7) {
      const { data } = await sb.from("tasks").select("id").contains("tags", [`${THE_VIEC}:${p.ma}:mkt-do-7-ngay`]).in("status", ["todo", "doing"]).limit(1);
      if (data?.length) await sb.from("tasks").update({ status: "done", completed_at: new Date().toISOString(), description: `[Máy đo] Ngày ${ngayThu}: ${p.do.soBaiDaDang}/${p.do.soBai} bài đã đăng · ${p.do.soKhachDaBao} khách đã báo · ${p.do.soDon} đơn.` }).eq("id", data[0].id);
    }
  }
  await ghiKho(kho);
  return { soPhieu: kq.length, ketQua: kq };
}
