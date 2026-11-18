import soTay from "@/data/so-tay-dang-cheo.json";
import dsCam from "@/lib/dang-cheo-cam.json";
import { callClaude, MODEL_FAST } from "@/lib/covan/advisor";
import { findBanned, sanitizeContent } from "@/lib/banned-words";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { appLink } from "@/lib/app-url";

export type NenTang = {
  ma: string;
  ten: string;
  url: string;
  mucTuDong: "may-dang" | "may-soan-nguoi-dang" | "tam-tat";
  lyDoTat?: string;
  nhipNgay: number;
  hopChuDe: string[];
  dinhDang: string;
  doDai: string;
  backlink: string;

  datLink?: "than-bai" | "binh-luan" | "canonical" | "tut-cuoi";
  camKyThuat: string[];
  duocPhep: string;
  vaoSeo: string;
  nguon: string;
  ghiChu?: string;
};

export type BaiBlog = { slug: string; url: string; tieuDe: string; moTa: string; nhom: string };

export type BanSoan = {
  ma: string;
  ten: string;
  slug: string;
  tieuDe: string;
  noiDung: string;
  link: string;

  binhLuan?: string;
  huongDan: string;
  mucTuDong: NenTang["mucTuDong"];
  daLoc: boolean;

  anh?: string;
};

export type KetQua = {
  at: string;
  ds: BanSoan[];
  boQua: { ten: string; vi: string }[];
  text: string;
};

const SITE = "https://example.com";
const LLMS = `${SITE}/llms.txt`;
const KHOA_SO = "dang_cheo_so";
const KHOA_HANG_DOI = "dang_cheo_hang_doi";

export const NEN_TANG: NenTang[] = (soTay as any).nenTang;
export const LUAT_CHUNG: string[] = (soTay as any).luatChung;
export const NHOM_CHU_DE: Record<string, string> = (soTay as any).nhomChuDe;

export function lyDoNenTangCam(ma: string, url = ""): string {
  const nenTang = (dsCam as any).nenTang as Record<string, string>;
  if (nenTang?.[ma]) return nenTang[ma];
  const tk = ((dsCam as any).taiKhoan as string[] || []).find((t) => url.toLowerCase().includes(t.toLowerCase()));
  return tk ? `tài khoản ${tk} là của nhân vật ảo Nhân vật Mẫu — không đăng bài thương hiệu/blog NOVA` : "";
}

export function timNenTang(ma: string): NenTang | undefined {
  return NEN_TANG.find((n) => n.ma === ma);
}

type So = Record<string, Record<string, string>>;

export async function docSo(): Promise<So> {
  try {
    return JSON.parse((await getConfigValue(KHOA_SO)) || "{}") as So;
  } catch {
    return {};
  }
}

export async function ghiDaDang(ma: string, slug: string): Promise<So> {
  const so = await docSo();
  so[ma] = { ...(so[ma] || {}), [slug]: new Date().toISOString() };
  await setConfigValue(KHOA_SO, JSON.stringify(so), "Sổ bài đã đăng chéo theo từng nền tảng");
  return so;
}

export function phanNhom(slug: string): string {
  if (slug.startsWith("bao-cao-")) return "bao-cao";
  if (slug.startsWith("app-nova-") || slug.includes("cong-nghe")) return "cong-nghe";
  if (slug.startsWith("lo-trinh-")) return "lo-trinh";
  return "kien-thuc";
}

export async function layDanhMucBlog(): Promise<BaiBlog[]> {
  const res = await fetch(LLMS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Không đọc được ${LLMS} (HTTP ${res.status})`);
  const raw = await res.text();
  const ds: BaiBlog[] = [];
  const re = /^-\s*\[([^\]]+)\]\((https:\/\/example\.com\/blog\/([a-z0-9-]+)\.html)\)\s*:?\s*(.*)$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const [, tieuDe, url, slug, moTa] = m;
    ds.push({ slug, url, tieuDe: tieuDe.trim(), moTa: (moTa || "").trim(), nhom: phanNhom(slug) });
  }
  if (!ds.length) throw new Error("llms.txt đọc được nhưng không bóc ra bài nào — cấu trúc file đã đổi");
  return ds;
}

export async function layNoiDungBai(url: string): Promise<{ chu: string; anh?: string }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Không mở được bài gốc (HTTP ${res.status})`);
  const html = await res.text();
  const than = html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html;
  const chu = than
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (chu.length < 400) throw new Error("Bài gốc bóc ra quá ngắn — có thể trang đã đổi cấu trúc");
  const anh = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
  return { chu: chu.slice(0, 14000), anh };
}

export function denHan(nt: NenTang, so: So, homNay = new Date()): boolean {
  if (nt.mucTuDong === "tam-tat") return false;
  const ds = Object.values(so[nt.ma] || {});
  if (!ds.length) return true;
  const ganNhat = ds.map((d) => new Date(d).getTime()).sort((a, b) => b - a)[0];

  const ngayVN = (t: number | Date) =>
    Math.floor(Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(t) + "T00:00:00Z") / 86400e3);
  return ngayVN(homNay) - ngayVN(ganNhat) >= nt.nhipNgay;
}

export function chonBai(nt: NenTang, danhMuc: BaiBlog[], so: So, dangDung = new Set<string>()): BaiBlog | null {
  const daDang = so[nt.ma] || {};
  const con = (b: BaiBlog) => !daDang[b.slug] && !dangDung.has(b.slug);
  if (nt.hopChuDe.includes("tat-ca")) return danhMuc.find(con) || null;
  for (const nhom of nt.hopChuDe) {
    const b = danhMuc.find((x) => x.nhom === nhom && con(x));
    if (b) return b;
  }
  return null;
}

function heThong(nt: NenTang): string {
  return [
    "Bạn là biên tập viên nội dung của NOVA (Công ty Cổ phần ACME) — hệ sinh thái chăm sóc sức khoẻ chủ động.",
    `Việc của bạn: chuyển một bài blog đã đăng trên example.com thành một bản đăng phù hợp NỘI QUY của ${nt.ten}.`,
    "",
    `NỘI QUY ${nt.ten.toUpperCase()} — bám sát, đây là điều kiện bài được sống trên đó:`,
    `- Định dạng: ${nt.dinhDang}`,
    `- Độ dài: ${nt.doDai}`,
    `- Được phép: ${nt.duocPhep}`,
    ...nt.camKyThuat.map((c) => `- CẤM: ${c}`),
    "",
    "LUẬT CHUNG:",
    ...LUAT_CHUNG.map((l) => `- ${l}`),
    "",
    "RÀO PHÁP LÝ BẮT BUỘC (sản phẩm ACME/NOVA là THỰC PHẨM BỔ SUNG, không phải thuốc):",
    "- Cấm các chữ: chữa, trị, điều trị, khỏi bệnh, thải độc, detox, thanh lọc, giảm cân, kháng khuẩn, phòng ngừa ung thư.",
    "- Cấm hứa kết quả theo mốc thời gian kiểu 'hiệu quả sau 7 ngày'.",
    "- Cấm lấy lời khen về sức khoẻ của khách hàng làm bằng chứng.",
    "- Nói về thói quen và cách chăm sóc, không nói sản phẩm làm được gì cho bệnh tật.",
    "",
    "CÁCH TRẢ LỜI — chép đúng ba dòng mốc này, không thêm lời dẫn, không rào markdown:",
    "TIEUDE: <tiêu đề một dòng>",
    "HUONGDAN: <một câu dặn người đăng cần làm gì thêm trên nền tảng này>",
    "---NOIDUNG---",
    "<toàn bộ bài đăng, xuống dòng thoải mái>",
    "",
    "KHÔNG tự chèn đường link — hệ thống tự gắn link bài gốc ở cuối. Viết xong phải kết trọn câu.",
  ].join("\n");
}

function bocBan(raw: string): { tieuDe: string; noiDung: string; huongDan: string } | null {
  const t = String(raw || "").replace(/```/g, "").trim();
  const i = t.indexOf("---NOIDUNG---");
  if (i < 0) return null;
  const dau = t.slice(0, i);
  const noiDung = t.slice(i + "---NOIDUNG---".length).trim();
  if (!noiDung) return null;
  return {
    tieuDe: (dau.match(/TIEUDE:\s*(.+)/)?.[1] || "").trim(),
    huongDan: (dau.match(/HUONGDAN:\s*([\s\S]+?)(?:\n[A-Z]{4,}:|$)/)?.[1] || "").trim(),
    noiDung,
  };
}

function bicat(noiDung: string): boolean {
  return !/[.!?…:)"”'’\]]\s*$/.test(noiDung.trim());
}

function tranToken(nt: NenTang): number {
  const so = (nt.doDai.match(/\d+/g) || ["400"]).map(Number);
  const tuToiDa = Math.max(...so);
  return Math.min(16000, Math.max(2000, Math.round(tuToiDa * 4 + 1200)));
}

const CTA_MEM =
  'Ai muốn bản cẩm nang đầy đủ theo thể trạng, để lại một chữ "cẩm nang" dưới bình luận hoặc nhắn mình, mình gửi link nhé.';

export function phaAutoLink(chu: string): string {

  return chu.replace(
    /(^|[\s(\[,;:"'“‘])((?:[A-Za-z][\w-]*\.)*[A-Za-z][\w-]{1,40})\.(com|vn|net|io|org|co|shop|site|blog)\b(?!\/)/g,
    (_k, truoc, ten, duoi) => `${truoc}${ten} .${duoi}`,
  );
}

let doCache: Promise<{ luc?: string; nenTang?: Record<string, { tieuDe: string; soLieu: string }[]> } | null> | null = null;
async function khoiPhanHoi(nt: NenTang): Promise<string> {
  if (!doCache) {
    doCache = getConfigValue("dang_cheo_do")
      .then((v) => JSON.parse(v || "null"))
      .catch(() => null);
  }
  const d = await doCache;
  const ds = d?.nenTang?.[nt.ma];
  if (!Array.isArray(ds) || !ds.length) return "";
  return [
    "",
    `VÒNG PHẢN HỒI — tương tác thật các bài gần đây trên ${nt.ten} (đo ${String(d?.luc || "").slice(0, 10)}):`,
    ...ds.slice(0, 8).map((b) => `- "${b.tieuDe}" — ${b.soLieu}`),
    "Học CÁCH MỞ BÀI và GIỌNG của bài tương tác cao hơn mặt bằng; bài thấp thì đừng lặp lối viết đó.",
    "CẤM viết trùng chủ đề hoặc trùng góc với các bài liệt kê ở trên.",
  ].join("\n");
}

export async function soanMotBan(nt: NenTang, bai: BaiBlog, goc: { chu: string; anh?: string }, danhMucChoLink: BaiBlog[] = []): Promise<BanSoan> {
  const nhac = [
    `BÀI GỐC: ${bai.tieuDe}`,
    `MÔ TẢ: ${bai.moTa}`,
    await khoiPhanHoi(nt),
    "",
    "NỘI DUNG BÀI GỐC:",
    goc.chu,
  ].join("\n");

  let j: { tieuDe: string; noiDung: string; huongDan: string } | null = null;
  let loi = "";
  for (const heSo of [1, 1.6]) {
    const raw = await callClaude(
      [{ role: "user", content: nhac }],
      heThong(nt),
      Math.min(16000, Math.round(tranToken(nt) * heSo)),
      undefined,
      MODEL_FAST
    );
    const ban = bocBan(raw);
    if (!ban) { loi = "model trả về không đúng khung (thiếu dòng mốc ---NOIDUNG---)"; continue; }
    if (bicat(ban.noiDung)) { loi = "bản trả lời bị cắt giữa câu"; j = null; continue; }
    j = ban;
    break;
  }
  if (!j) throw new Error(loi || "không soạn được");

  const dat = nt.datLink || "than-bai";
  const duoi =
    dat === "canonical"
      ? `\n\nBài gốc đăng tại NOVA: ${bai.url}\n(Đặt canonical về đường dẫn này khi đăng.)`
      : dat === "binh-luan"
        ? `\n\n${CTA_MEM}`
        : `\n\nBài gốc: ${bai.url}`;

  const docThem = await khoiDocThem(bai, danhMucChoLink).catch(() => "");
  let noiDung = phaAutoLink(String(j.noiDung).trim()) + docThem + duoi;
  let daLoc = false;
  if (findBanned(noiDung).length) {
    noiDung = sanitizeContent(noiDung);
    daLoc = true;
  }
  const conSot = findBanned(noiDung);
  if (conSot.length) throw new Error(`còn từ cấm sau khi lọc: ${conSot.slice(0, 3).join(", ")}`);

  return {
    ma: nt.ma,
    ten: nt.ten,
    slug: bai.slug,
    tieuDe: String(j.tieuDe || bai.tieuDe).trim(),
    noiDung,
    link: bai.url,
    binhLuan: dat === "binh-luan" ? `${CTA_MEM}\n\nBài đầy đủ: ${bai.url}` : undefined,
    huongDan: String(j.huongDan || "").trim(),
    mucTuDong: nt.mucTuDong,
    daLoc,
    anh: goc.anh,
  };
}

export async function khoiDocThem(bai: BaiBlog, danhMuc: BaiBlog[], soLuong = 3): Promise<string> {
  let banDo: { chuaLap?: string[]; daDung?: Record<string, string> } = {};
  try { banDo = JSON.parse((await getConfigValue("blog_chi_muc_ban_do")) || "{}"); } catch { }
  const chua = (banDo.chuaLap || []).filter((sl) => sl !== bai.slug);
  if (chua.length < soLuong) return "";

  const daDung = banDo.daDung || {};
  const xep = [...chua].sort((a, b) => (daDung[a] || "").localeCompare(daDung[b] || ""));
  const chon = xep.slice(0, soLuong)
    .map((sl) => danhMuc.find((b) => b.slug === sl))
    .filter((b): b is BaiBlog => !!b);
  if (chon.length < 2) return "";

  const nay = new Date().toISOString();
  for (const b of chon) daDung[b.slug] = nay;
  try {
    await setConfigValue("blog_chi_muc_ban_do", JSON.stringify({ ...banDo, daDung }),
      "Bản đồ trạng thái lập chỉ mục của bài blog + sổ bài đã được dẫn link trong bài đăng chéo");
  } catch { }

  return "\n\nĐọc thêm trên NOVA:\n" + chon.map((b) => `- ${b.tieuDe}: ${b.url}`).join("\n");
}

export async function chayMotLuot(dry = false): Promise<KetQua> {
  const danhMuc = await layDanhMucBlog();
  const so = await docSo();
  const ds: BanSoan[] = [];
  const boQua: { ten: string; vi: string }[] = [];

  const viec: { nt: NenTang; bai: BaiBlog }[] = [];

  const daChonHomNay = new Set<string>();
  for (const nt of NEN_TANG) {

    const cam = lyDoNenTangCam(nt.ma, nt.url);
    if (cam) {
      boQua.push({ ten: nt.ten, vi: `CẤM — ${cam}` });
      continue;
    }
    if (nt.mucTuDong === "tam-tat") {
      boQua.push({ ten: nt.ten, vi: `tạm tắt — ${nt.lyDoTat || "chưa đủ điều kiện"}` });
      continue;
    }
    if (!denHan(nt, so)) continue;
    const bai = chonBai(nt, danhMuc, so, daChonHomNay);
    if (!bai) {
      boQua.push({ ten: nt.ten, vi: "hết bài hợp chủ đề chưa đăng" });
      continue;
    }
    viec.push({ nt, bai });
    daChonHomNay.add(bai.slug);
  }

  const HAN_GIO = 150_000;
  const ketQua = await Promise.allSettled(
    viec.map(async ({ nt, bai }) => {
      const chay = (async () => {
        const goc = await layNoiDungBai(bai.url);
        return soanMotBan(nt, bai, goc, danhMuc);
      })();
      const hetGio = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("quá 150 giây, bỏ lượt này")), HAN_GIO)
      );
      return Promise.race([chay, hetGio]);
    })
  );
  ketQua.forEach((r, i) => {
    if (r.status === "fulfilled") ds.push(r.value);
    else boQua.push({ ten: viec[i].nt.ten, vi: String(r.reason?.message || r.reason).slice(0, 120) });
  });

  const at = new Date().toISOString();
  if (ds.length && !dry) {
    await setConfigValue(
      KHOA_HANG_DOI,
      JSON.stringify({ at, ds }),
      "Hàng đợi bài đăng chéo hôm nay (máy soạn, người đăng ở /dang-cheo)"
    );
  }
  return { at, ds, boQua, text: dungBanTin(ds, boQua) };
}

export async function docHangDoi(): Promise<{ at: string; ds: BanSoan[] } | null> {
  try {
    const v = await getConfigValue(KHOA_HANG_DOI);
    if (!v) return null;
    const j = JSON.parse(v);
    return Array.isArray(j?.ds) ? j : null;
  } catch {
    return null;
  }
}

function dungBanTin(ds: BanSoan[], boQua: { ten: string; vi: string }[]): string {
  const d = new Date();
  const ngay = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const out: string[] = [`ĐĂNG CHÉO BLOG NOVA — ${ngay}`, ""];

  if (!ds.length) {
    out.push("Hôm nay không nền tảng nào đến hạn. Nhịp của mỗi trang ghi trong sổ tay đăng chéo.");
  } else {
    out.push(`Đã soạn ${ds.length} bản đăng, mở ${appLink("/dang-cheo")} để chép và đăng:`);
    out.push("");
    for (const b of ds) {
      out.push(`• ${b.ten} — "${b.tieuDe}"`);
      out.push(`  bài gốc: ${b.slug}${b.anh ? " · có sẵn ảnh" : " · CHƯA có ảnh"}${b.daLoc ? " (đã lọc lại chữ theo rào thực phẩm bổ sung)" : ""}`);
      if (b.huongDan) out.push(`  lưu ý: ${b.huongDan}`);
    }
  }
  if (boQua.length) {
    out.push("");
    out.push("Không soạn:");
    for (const b of boQua) out.push(`• ${b.ten}: ${b.vi}`);
  }
  out.push("");
  out.push("Máy KHÔNG tự đăng. Mỗi bản đăng phải có người đọc rồi bấm đăng bằng tài khoản của mình.");
  return out.join("\n");
}
