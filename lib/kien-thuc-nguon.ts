import kienThuc from "@/data/kien-thuc-dinh-duong.json";
import storyBank from "@/data/story-bank-nova.json";
import playbook from "@/data/content-viral-playbook.json";

export type ChuDeDinhDuong = {
  id: string;
  ten: string;
  chuong: string;
  trangThai?: string;
  lyDoKhoa?: string;
  dungCho: string[];
  doTinCay: string;
  canhBaoSoLieu: boolean;
  cotLoi: string[];
  goiYHook?: string[];
  raoPhapLy: string;
  ungDung?: string;
};

export type TaiSanKeChuyen = {
  id: string;
  ten: string;
  trangThai?: string;
  lyDoKhoa?: string;
  dungCho: string[];
  tomTat?: string;
  vaiTro: string;
  cachKeAnToan: string;
  camKhiKe: string[];
  buoc?: string[];
  diemNhan?: string;
};

export const KIEN_THUC_DINH_DUONG = kienThuc as unknown as typeof kienThuc & { chuDe: ChuDeDinhDuong[] };
export const STORY_BANK = storyBank as unknown as typeof storyBank & { taiSanKeChuyen: TaiSanKeChuyen[] };
export const VIRAL_PLAYBOOK = playbook;

function dungDuoc(c: { id: string; trangThai?: string }): boolean {
  return c.trangThai !== "khoa";
}

export function chuDeCho(kenh: string): ChuDeDinhDuong[] {
  return (KIEN_THUC_DINH_DUONG.chuDe || []).filter((c) => dungDuoc(c) && c.dungCho.includes(kenh));
}

export function chuyenCho(kenh: string): TaiSanKeChuyen[] {
  return (STORY_BANK.taiSanKeChuyen || []).filter((c) => dungDuoc(c) && c.dungCho.includes(kenh));
}

export function buildKienThucBlock(dayOfMonth: number, soChuDe = 3): string {
  const ds = chuDeCho("blog");
  if (!ds.length) return "";
  const start = (dayOfMonth * soChuDe) % ds.length;
  const pick: ChuDeDinhDuong[] = [];
  for (let i = 0; i < Math.min(soChuDe, ds.length); i++) pick.push(ds[(start + i) % ds.length]);

  const blocks = pick.map((c) => {
    const y = c.cotLoi.slice(0, 6).map((x) => `  - ${x}`).join("\n");
    const hook = c.goiYHook?.length ? `\n  Gợi ý mở bài: ${c.goiYHook.join(" | ")}` : "";
    const canhBao = c.canhBaoSoLieu
      ? "\n  CẢNH BÁO SỐ LIỆU: chủ đề này trong tài liệu gốc có số chưa kiểm chứng. CẤM đưa số cụ thể vào bài."
      : "";
    return `[${c.ten}]\n${y}${hook}\n  RÀO: ${c.raoPhapLy}${canhBao}`;
  });

  return `KHO KIẾN THỨC DINH DƯỠNG CỦA CÔNG TY — ĐỀ TÀI HÔM NAY LẤY TỪ ĐÂY (đây là kiến thức nhà, không phải kiến thức chung chung trên mạng; bám vào thì bài mới có chiều sâu):

${blocks.join("\n\n")}

LUẬT DÙNG KHO NÀY:
- ${KIEN_THUC_DINH_DUONG.luatDung.tuCach}
- CẤM: ${KIEN_THUC_DINH_DUONG.luatDung.camTuyetDoi.join(" ")}
- ĐƯỢC: ${KIEN_THUC_DINH_DUONG.luatDung.duocPhep.join(" ")}`;
}

export function buildStoryBankBlock(dayOfMonth: number, soChuyen = 2): string {
  const ds = chuyenCho("blog").concat(chuyenCho("fanpage")).filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
  if (!ds.length) return "";
  const start = (dayOfMonth * soChuyen) % ds.length;
  const pick: TaiSanKeChuyen[] = [];
  for (let i = 0; i < Math.min(soChuyen, ds.length); i++) pick.push(ds[(start + i) % ds.length]);

  const blocks = pick.map((c) => {
    const than = c.buoc?.length ? c.buoc.map((b, i) => `  ${i + 1}. ${b}`).join("\n") : `  ${c.tomTat || ""}`;
    const cam = c.camKhiKe.length ? `\n  CẤM KHI KỂ: ${c.camKhiKe.join(" ")}` : "";
    return `[${c.ten}]\n${than}\n  Cách kể an toàn: ${c.cachKeAnToan}${cam}`;
  });

  return `KHO CÂU CHUYỆN THƯƠNG HIỆU NOVA — chất liệu THẬT của công ty, dùng cho bài hậu trường và bài thương hiệu (không phải bịa):

${blocks.join("\n\n")}`;
}

export function buildViralPlaybookBlock(): string {
  const p = VIRAL_PLAYBOOK as any;
  const dungTot = (p.yeuToLanToa?.dungTot || []).slice(0, 8).map((y: any) => `- ${y.ten}: ${y.cachDung}`).join("\n");
  const camDung = (p.yeuToLanToa?.camDung || []).map((y: any) => `${y.ten} (${y.lyDo})`).join(" | ");
  const hookOk = (p.hookBaGiay?.mauDung || []).map((x: string) => `- ${x}`).join("\n");
  const hookCam = (p.hookBaGiay?.mauCam || []).join(" | ");
  const tieuDe = (p.congThucTieuDe?.khung || []).map((x: string) => `- ${x}`).join("\n");

  const lt = p.longTinHonChuY;
  const khoiLongTin = lt
    ? `\n\nLONG TIN HON SU CHU Y:
${lt.yKhoiDau}
${lt.viSaoBayGio}
Thu khong dan dung duoc (uu tien dung): ${(lt.thuKhongDanDungDuoc || []).join(" | ")}
Ap vao bai viet: ${lt.apVaoACME?.baiVietFanpage || ""}
KHONG doi: ${lt.apVaoACME?.caiKhongDoi || ""}
Doc dung: ${lt.canhBaoDocSai || ""}`
    : "";

  return `CÁCH VIẾT ĐỂ NGƯỜI TA ĐỌC (playbook nội bộ ACME):

YẾU TỐ NÊN DÙNG:
${dungTot}

YẾU TỐ CẤM VỚI NGÀNH THỰC PHẨM BỔ SUNG: ${camDung}

BA GIÂY ĐẦU:
${hookOk}
Kiểu hook CẤM: ${hookCam}

KHUNG TIÊU ĐỀ:
${tieuDe}
Cấm trong tiêu đề: ${(p.congThucTieuDe?.camTrongTieuDe || []).join(", ")}${khoiLongTin}`;
}

export function buildSaleKnowledgeBlock(): string {
  const ds = chuDeCho("telesales");
  if (!ds.length) return "";
  const lines = ds.map((c) => `- ${c.ten}: ${c.cotLoi.slice(0, 3).join(" ")}`).join("\n");
  return `KIẾN THỨC ĐỂ CHO TRƯỚC KHI TƯ VẤN (nói cái này trước, nói sản phẩm sau):
${lines}

Rào: bạn là huấn luyện viên lối sống, không phải bác sĩ. Khách mô tả triệu chứng kéo dài thì khuyên đi khám, KHÔNG tư vấn tiếp và KHÔNG gợi ý sản phẩm thay thế việc khám.`;
}
