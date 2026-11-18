import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";

export const KHOA_LINK = "kenh_dan_duong";
export const KHOA_DIEM = "kenh_diem_bai";

const GOC_BLOG = "https://example.com";

export type LinkDan = {
  ma: string;
  kenh: string;
  slug: string;

  dich?: string;
  tieuDe?: string;
  taoLuc: string;
  dangLuc?: string;
  bam: number;
  bamTheoNgay: Record<string, number>;
};

export type DiemBai = {
  ma: string;

  viral?: { xem: number; tuongTac: number; nguon: "api" | "nguoi-nhap"; luc: string };

  chuyenMon?: { diem: number; vi: string; luc: string };

  chuyenDoi?: { bam: number; lead: number; don: number; doanhThu: number; luc: string };
};

type KhoLink = { links: LinkDan[] };
type KhoDiem = { diem: DiemBai[] };

async function docJson<T>(khoa: string, macDinh: T): Promise<T> {
  try { const raw = await getConfigValue(khoa); return raw ? { ...macDinh, ...JSON.parse(raw) } : macDinh; }
  catch { return macDinh; }
}

export const layKhoLink = () => docJson<KhoLink>(KHOA_LINK, { links: [] });
export const layKhoDiem = () => docJson<KhoDiem>(KHOA_DIEM, { diem: [] });

export function taoMa(kenh: string, slug: string, lan = 0): string {
  const s = `${kenh}|${slug}|${lan}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(6, "0").slice(0, 6);
}

export const linkDan = (ma: string, goc = "https://ikihealing-hub.example.com") => `${goc}/di/${ma}`;

export function linkDich(l: LinkDan): string {
  if (l.dich) return l.dich;
  const u = new URL(`${GOC_BLOG}/blog/${l.slug}.html`);
  u.searchParams.set("utm_source", l.kenh);
  u.searchParams.set("utm_medium", "dang-cheo");
  u.searchParams.set("utm_campaign", l.ma);
  return u.toString();
}

export async function baoDamLink(kenh: string, slug: string, tieuDe?: string): Promise<LinkDan> {
  const kho = await layKhoLink();
  const co = kho.links.find((l) => l.kenh === kenh && l.slug === slug);
  if (co) return co;
  const moi: LinkDan = { ma: taoMa(kenh, slug), kenh, slug, tieuDe, taoLuc: new Date().toISOString(), bam: 0, bamTheoNgay: {} };
  kho.links.push(moi);
  await setConfigValue(KHOA_LINK, JSON.stringify(kho), "Link dẫn đường bài đăng kênh ngoài");
  return moi;
}

export async function baoDamLinkZalo(kenh: string, tenSale: string, sdt: string): Promise<LinkDan> {
  const so = String(sdt || "").replace(/\D/g, "").replace(/^0/, "84");
  if (!/^84\d{9}$/.test(so)) throw new Error("Số Zalo không hợp lệ");
  const slug = "zalo-" + tenSale.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dich = `https://zalo.me/${so}`;
  const kho = await layKhoLink();
  let l = kho.links.find((x) => x.kenh === kenh && x.slug === slug);
  if (l) l.dich = dich;
  else {
    l = { ma: taoMa(kenh, slug), kenh, slug, dich, tieuDe: `Zalo ${tenSale}`, taoLuc: new Date().toISOString(), bam: 0, bamTheoNgay: {} };
    kho.links.push(l);
  }
  await setConfigValue(KHOA_LINK, JSON.stringify(kho), "Link dẫn đường bài đăng kênh ngoài");
  return l;
}

export async function ghiBam(ma: string): Promise<LinkDan | null> {
  const kho = await layKhoLink();
  const l = kho.links.find((x) => x.ma === ma);
  if (!l) return null;
  const ngay = vnDateStr();
  l.bam = (l.bam || 0) + 1;
  l.bamTheoNgay[ngay] = (l.bamTheoNgay[ngay] || 0) + 1;
  await setConfigValue(KHOA_LINK, JSON.stringify(kho), "Link dẫn đường bài đăng kênh ngoài");
  return l;
}

export async function ghiDiem(ma: string, phan: Partial<Omit<DiemBai, "ma">>): Promise<void> {
  const kho = await layKhoDiem();
  const cu = kho.diem.find((d) => d.ma === ma);
  if (cu) Object.assign(cu, phan);
  else kho.diem.push({ ma, ...phan });
  await setConfigValue(KHOA_DIEM, JSON.stringify(kho), "Điểm ba tiêu chí của bài đăng kênh ngoài");
}

const sdtChuan = (p: any) => String(p || "").replace(/\D/g, "").replace(/^84/, "0");

export async function doChuyenDoi(sb: any, layDoanhThuNhieuThang: any): Promise<{
  theoMa: Record<string, { bam: number; lead: number; don: number; doanhThu: number }>;
  doDuoc: boolean;
  ghiChu: string[];
}> {
  const kho = await layKhoLink();
  const theoMa: Record<string, { bam: number; lead: number; don: number; doanhThu: number }> = {};
  for (const l of kho.links) theoMa[l.ma] = { bam: l.bam || 0, lead: 0, don: 0, doanhThu: 0 };

  const ghiChu: string[] = [];
  if (!kho.links.length) return { theoMa, doDuoc: false, ghiChu: ["Chưa có link dẫn nào — chưa đăng bài kênh ngoài qua máy."] };

  let leads: any[] = [];
  try {
    const { data } = await sb.from("leads").select("phone, source, created_at").not("source", "is", null).limit(5000);
    leads = data || [];
  } catch (e: any) { ghiChu.push(`không đọc được bảng lead: ${String(e?.message || e).slice(0, 60)}`); }

  const sdtTheoMa: Record<string, Set<string>> = {};
  for (const l of leads) {
    const src = String(l.source || "");
    const hit = kho.links.find((x) => src.includes(x.ma));
    if (!hit) continue;
    theoMa[hit.ma].lead++;
    const p = sdtChuan(l.phone);
    if (p.length >= 9) (sdtTheoMa[hit.ma] ||= new Set()).add(p);
  }

  const coLead = Object.values(theoMa).some((v) => v.lead > 0);
  if (!coLead) ghiChu.push("Chưa lead nào mang mã chiến dịch — kiểm form lead trên blog đã chuyền utm_campaign vào trường source chưa. Số 0 ở đây là CHƯA ĐO ĐƯỢC, không phải bài không ra khách.");

  if (coLead) {
    try {
      const tu = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
      const { rows } = await layDoanhThuNhieuThang(sb, tu, vnDateStr());
      const donTheoSdt: Record<string, { don: Set<string>; tien: number }> = {};
      for (const r of rows) {
        const p = sdtChuan(r.customer_phone);
        if (!p) continue;
        const o = (donTheoSdt[p] ||= { don: new Set(), tien: 0 });
        o.don.add(r.order_code);
        o.tien += r.net_amount || 0;
      }
      for (const [ma, ds] of Object.entries(sdtTheoMa)) {
        for (const p of ds) {
          const o = donTheoSdt[p];
          if (!o) continue;
          theoMa[ma].don += o.don.size;
          theoMa[ma].doanhThu += o.tien;
        }
      }
    } catch (e: any) { ghiChu.push(`không đọc được sổ đơn: ${String(e?.message || e).slice(0, 60)}`); }
  }

  return { theoMa, doDuoc: coLead, ghiChu };
}

export const THANG_CHUYEN_MON = `Chấm HÀM LƯỢNG CHUYÊN MÔN của bài, thang 0-100, cộng theo 5 phần:

1. CÓ SỐ VÀ CÓ NGUỒN (0-25): bài đưa con số cụ thể và nói số đó ở đâu ra. Nói chung chung "nhiều
   nghiên cứu cho thấy" mà không dẫn được gì thì 0.
2. GIẢI THÍCH CƠ CHẾ (0-25): nói được VÌ SAO chứ không chỉ LÀM GÌ. Người đọc hiểu xong tự suy ra
   được ca khác thì điểm cao.
3. DÙNG ĐƯỢC NGAY (0-20): có phần áp dụng cụ thể — liều lượng, thời điểm, cách làm, dấu hiệu nhận biết.
4. TRUNG THỰC VỀ GIỚI HẠN (0-20): nói rõ chỗ chưa chắc, ai không nên áp dụng, khi nào cần gặp bác sĩ.
   Bài nào cũng chỉ toàn lợi ích thì phần này 0.
5. KHÔNG NÓI QUÁ (0-10): trừ hết nếu có chữ chữa/trị/điều trị/khỏi bệnh/thải độc, hứa kết quả theo
   mốc thời gian, hoặc lấy lời khen sức khoẻ của khách làm bằng chứng.

Trả về JSON: {"diem": <0-100>, "vi": "<một câu nói rõ mất điểm ở phần nào và sửa thế nào>"}`;
