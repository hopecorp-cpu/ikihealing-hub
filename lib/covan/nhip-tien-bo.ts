import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { buildSystem, callClaude, MODEL_FAST, MODEL_SMART } from "./advisor";
import { computePnl, tr, vnToday } from "./pnl";

export type Ky = "tuan" | "thang" | "quy" | "nam";

export const TEN_KY: Record<Ky, string> = {
  tuan: "TUẦN",
  thang: "THÁNG",
  quy: "QUÝ",
  nam: "NĂM",
};

const GOC_NHIN: Record<Ky, string> = {
  tuan: "Nhìn VIỆC: tuần rồi có làm đúng thứ đã hứa không, cái gì kẹt, tuần tới gỡ cái nào trước.",
  thang:
    "Nhìn SỐ: tháng rồi các chỉ số lõi nhúc nhích theo hướng nào, nút thắt trong bốn hệ thống đã đổi chưa.",
  quy:
    "Nhìn HƯỚNG: quý rồi mũi nhọn nào thật sự tiến, mũi nào chỉ bận rộn. Có gì cần DỪNG hẳn để dồn lực không.",
  nam:
    "Nhìn TẦM: một năm qua công ty khác đi ở đâu, năng lực nào đã dựng được và giữ lại được, và tầm nhìn có cần chỉnh không.",
};

export type KimChiNam = {
  tamNhin: string;

  muiNhon: Array<{ ten: string; chiSo?: string; muc?: string }>;
  nam?: number;
  capNhat?: string;
};

export type MocKy = {
  ky: Ky;
  ngay: string;
  soLieu: Record<string, number | string | null>;
  camKet: string[];
};

const KEY_KIM_CHI_NAM = "acme_kim_chi_nam";
const keyMoc = (ky: Ky) => `nhip_tien_bo_moc_${ky}`;
const KEY_NHIP = "nhip_tien_bo_last";
const GIU_MOC = 8;

export async function docKimChiNam(): Promise<KimChiNam | null> {
  try {
    const raw = await getConfigValue(KEY_KIM_CHI_NAM);
    if (!raw) return null;
    const o = JSON.parse(raw) as KimChiNam;
    if (o && typeof o.tamNhin === "string" && o.tamNhin.trim() && Array.isArray(o.muiNhon)) return o;
  } catch {

  }
  return null;
}

export async function luuKimChiNam(k: KimChiNam): Promise<void> {
  await setConfigValue(
    KEY_KIM_CHI_NAM,
    JSON.stringify({ ...k, capNhat: new Date().toISOString() }),
    "Kim chỉ nam ACME — tầm nhìn + 1-3 mũi nhọn của năm (CEO chốt, máy KHÔNG tự đặt)"
  );
}

export async function docMoc(ky: Ky): Promise<MocKy[]> {
  try {
    const raw = await getConfigValue(keyMoc(ky));
    if (raw) {
      const o = JSON.parse(raw);
      if (Array.isArray(o?.items)) return o.items as MocKy[];
    }
  } catch {

  }
  return [];
}

export async function ghiMoc(moc: MocKy): Promise<void> {
  const items = await docMoc(moc.ky);
  items.unshift(moc);
  await setConfigValue(
    keyMoc(moc.ky),
    JSON.stringify({ items: items.slice(0, GIU_MOC), updatedAt: new Date().toISOString() }),
    `Sổ lời hứa + số nền theo kỳ ${moc.ky}`
  );
}

export function kyDenHan(ngay = vnToday()): Ky | null {
  const d = new Date(`${ngay}T00:00:00Z`);
  const ngayTrongThang = d.getUTCDate();
  const thang = d.getUTCMonth() + 1;
  if (ngayTrongThang === 1 && thang === 1) return "nam";
  if (ngayTrongThang === 1 && [1, 4, 7, 10].includes(thang)) return "quy";
  if (ngayTrongThang === 1) return "thang";
  if (d.getUTCDay() === 1) return "tuan";
  return null;
}

export async function chupSoNen(): Promise<Record<string, number | string | null>> {
  const p = await computePnl();
  const thangNay = vnToday().slice(0, 7);
  const rows = p.pnl.filter((x) => x.revenue > 0 && x.month < thangNay);
  const cuoi = rows.length ? rows[rows.length - 1] : null;
  return {
    thang_gan_nhat: cuoi ? cuoi.month : null,
    doanh_thu: cuoi ? cuoi.revenue : null,
    gia_von: cuoi ? cuoi.cogs : null,
    luong: cuoi ? cuoi.payroll : null,
    quang_cao: cuoi ? cuoi.ads : null,
    van_hanh_rong: cuoi ? cuoi.net_operating : null,
    so_thang_co_so: rows.length,
  };
}

function moTaSo(s: Record<string, number | string | null>): string {
  const tien = (v: unknown) => (typeof v === "number" ? tr(v) : "chưa có");
  return [
    `tháng gần nhất có số: ${s.thang_gan_nhat || "chưa có"}`,
    `doanh thu ${tien(s.doanh_thu)}`,
    `giá vốn ${tien(s.gia_von)}`,
    `lương ${tien(s.luong)}`,
    `quảng cáo ${tien(s.quang_cao)}`,
    `vận hành ròng ${tien(s.van_hanh_rong)}`,
  ].join(" · ");
}

export async function soanRaSoat(ky: Ky): Promise<{ text: string; soLieu: Record<string, number | string | null>; camKet: string[] }> {
  const [kcn, mocCu, soLieu] = await Promise.all([docKimChiNam(), docMoc(ky), chupSoNen()]);
  const truoc = mocCu[0] || null;

  const khoiKimChiNam = kcn
    ? [
        "KIM CHỈ NAM (CEO đã chốt — mọi đánh giá phải quy về đây):",
        `Tầm nhìn: ${kcn.tamNhin}`,
        ...kcn.muiNhon.map(
          (m, i) => `Mũi nhọn ${i + 1}: ${m.ten}${m.chiSo ? ` — đo bằng ${m.chiSo}` : ""}${m.muc ? `, mục tiêu ${m.muc}` : ""}`
        ),
      ].join("\n")
    : "KIM CHỈ NAM: CHƯA CHỐT. Anh chưa chốt tầm nhìn và 1-3 mũi nhọn của năm, nên em chưa " +
      "có thước để nói mình đi đúng đường hay không. Mở đầu bản rà soát bằng đúng một câu nhắc " +
      "anh chốt, rồi vẫn rà soát bình thường trên số liệu. TUYỆT ĐỐI KHÔNG tự đặt tầm nhìn hay " +
      "mục tiêu thay anh.";

  const khoiSoCu = truoc
    ? [
        `MỐC KỲ TRƯỚC (${truoc.ngay}):`,
        `Số nền lúc đó: ${moTaSo(truoc.soLieu)}`,
        truoc.camKet.length
          ? `Đã cam kết:\n${truoc.camKet.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
          : "Kỳ trước không ghi cam kết nào.",
      ].join("\n")
    : `Đây là kỳ ${TEN_KY[ky]} ĐẦU TIÊN được ghi sổ — chưa có mốc để so. Nói rõ điều đó, đừng vờ như có.`;

  const cau = [
    `Làm bản RÀ SOÁT ${TEN_KY[ky]} cho ACME.`,
    GOC_NHIN[ky],
    "",
    khoiKimChiNam,
    "",
    khoiSoCu,
    "",
    `SỐ NỀN HÔM NAY: ${moTaSo(soLieu)}`,
    "",
    "Viết đúng bốn mục, chữ thuần, KHÔNG markdown, không emoji:",
    "1. ĐÃ HỨA GÌ, LÀM ĐƯỢC GÌ — đối chiếu từng cam kết kỳ trước với số bây giờ. Cái nào không " +
      "đo được thì nói thẳng là không đo được và thiếu dữ liệu gì. Không có mốc trước thì bỏ mục này.",
    "2. SỐ ĐỔI RA SAO — so số nền kỳ trước với hôm nay, chỉ nói phần đổi đáng kể, kèm cách đọc " +
      "cho đúng (lệch pha thu hộ, sổ ghi trễ, khoản còn thiếu).",
    "3. NÚT THẮT KỲ TỚI — chạy thang chẩn đoán bốn hệ thống, chốt đúng MỘT nút thắt.",
    "4. CAM KẾT KỲ TỚI — 1 tới 3 việc, mỗi việc một dòng, khuôn: việc cụ thể, chỉ số đo, mức " +
      "muốn đạt. Đây là thứ em sẽ mở ra đo vào kỳ sau nên phải đo được, cấm viết chung chung. " +
      "Đặt các dòng này dưới đúng một dòng tiêu đề CAMKET: rồi mỗi cam kết một dòng bắt đầu bằng dấu gạch ngang.",
    "",
    "Cuối bài thêm một câu hỏi ngược cho anh, cụ thể, trả lời được trong một câu.",
  ].join("\n");

  const system = await buildSystem(cau);
  const model = ky === "quy" || ky === "nam" ? MODEL_SMART : MODEL_FAST;
  const text = (await callClaude([{ role: "user", content: cau }], system, 6000, undefined, model)).trim();
  if (!text) throw new Error("model trả rỗng khi soạn bản rà soát");

  return { text, soLieu, camKet: bocCamKet(text) };
}

export function bocCamKet(text: string): string[] {
  const phan = (text || "").split(/CAMKET\s*:/i)[1];
  if (!phan) return [];
  return phan
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, "").trim())
    .filter((l) => l.length > 12)
    .slice(0, 3);
}

export async function ghiNhip(trangThai: string): Promise<void> {
  await setConfigValue(
    KEY_NHIP,
    JSON.stringify({ at: new Date().toISOString(), trangThai }),
    "Nhịp tim máy rà soát tuần/tháng/quý/năm"
  );
}
