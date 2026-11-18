import { findBanned } from "@/lib/banned-words";
import { banCongKhai, docCuaHang, type SanPhamShop } from "@/lib/cua-hang";
import { commitBatch, getFile } from "@/lib/blogwriter/github";

const MIEN = "https://example.com";

const DANH_SACH_LOAI: Record<string, string> = {
  "mang-hap-thu-song-dien-tu-eco-g9":
    "Pinterest hạn chế sản phẩm nêu công dụng sức khoẻ chưa có căn cứ; đưa lên dễ bị từ chối cả danh mục. Chờ CEO chốt.",
};

const NHOM: Record<string, [string, string]> = {
  dam: ["Thực phẩm bổ sung", "Health & Beauty > Health Care > Fitness & Nutrition > Nutritional Supplements"],
  tra: ["Trà thảo mộc", "Food, Beverages & Tobacco > Beverages > Tea & Infusions"],
  caphe: ["Cà phê", "Food, Beverages & Tobacco > Beverages > Coffee"],
  dau: ["Dầu ăn và nước chấm", "Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients"],
  giavi: ["Gia vị", "Food, Beverages & Tobacco > Food Items > Seasonings & Spices"],
  thucduong: ["Đồ thực dưỡng", "Food, Beverages & Tobacco > Food Items"],
  khac: ["Khác", ""],
};

const GIU_HOA = new Set([
  "NOVA", "ACME", "SADHU", "HANUTI", "SUDANTA", "ECO", "G9", "RAW", "VIRGIN",
  "COCONUT", "OIL", "TRUE", "VEGAN", "PROTEIN", "PRO", "AQUAMIN",
]);

function slugHoa(s: string) {
  return String(s || "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function nanQuyCach(tu: string) {
  return tu.replace(/(\d+(?:[.,]\d+)?)\s*(KG|G|ML|L)\b/gi, (_, so, dv) => {
    const d = String(dv).toUpperCase();
    return so + (d === "L" ? "L" : d.toLowerCase());
  });
}

function nanTieuDe(ten: string) {
  const nan = String(ten).split(/(\s+)/).map((tu) => {
    if (/^\s+$/.test(tu)) return tu;
    const loi = tu.replace(/[^\p{L}\p{N}]/gu, "");
    if (!loi) return tu;
    if (GIU_HOA.has(loi.toUpperCase())) return nanQuyCach(tu.toUpperCase());
    const toanHoa = loi.length > 1 && loi === loi.toUpperCase() && loi !== loi.toLowerCase();
    return nanQuyCach(toanHoa ? tu.toLowerCase() : tu);
  }).join("").replace(/\s+/g, " ").trim();
  return nan.replace(/\p{L}/u, (c) => c.toUpperCase());
}

function anhTuyetDoi(img?: string) {
  const s = String(img || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return MIEN + (s.startsWith("/") ? s : "/" + s);
}

const oCsv = (v: unknown) => '"' + String(v ?? "").replace(/\r?\n/g, " ").trim().replace(/"/g, '""') + '"';
const oTsv = (v: unknown) => String(v ?? "").replace(/[\t\r\n]+/g, " ").trim();

const COT = ["id", "title", "description", "link", "image_link", "price", "availability", "condition", "brand",
  "product_type", "google_product_category"] as const;

export type FeedPinterest = { csv: string; tsv: string; soDong: number; tong: number; boQua: [string, string][]; viPham: [string, string][] };

export function dungFeed(ds: SanPhamShop[]): FeedPinterest {
  const sanPham = banCongKhai(ds);
  const dong: Record<string, string>[] = [];
  const boQua: [string, string][] = [];
  const viPham: [string, string][] = [];
  for (const p of sanPham) {
    const id = slugHoa(p.n);
    if (DANH_SACH_LOAI[id]) { boQua.push([p.n, DANH_SACH_LOAI[id]]); continue; }
    const title = nanTieuDe(p.n);
    const description = String(p.desc || p.t || "").trim();
    const cam = findBanned(title + " \n " + description);
    if (cam.length) { viPham.push([p.n, cam.join(" · ")]); continue; }
    const anh = anhTuyetDoi(p.img);
    if (!anh) { boQua.push([p.n, "thiếu ảnh"]); continue; }
    if (!Number.isFinite(p.price) || p.price <= 0) { boQua.push([p.n, "thiếu giá"]); continue; }
    const [loai, gpc] = NHOM[p.cat] || NHOM.khac;
    dong.push({
      id, title, description,
      link: `${MIEN}/shop/?sp=${id}&utm_source=pinterest&utm_medium=catalog`,
      image_link: anh, price: `${p.price} VND`, availability: p.het_hang === true || p.trangThai === "ngung-ban" ? "out of stock" : p.trangThai === "sap-ra-mat" ? "preorder" : "in stock", condition: "new", brand: "NOVA",
      product_type: loai, google_product_category: gpc,
    });
  }
  const csv = [COT.map(oCsv).join(",")].concat(dong.map((d) => COT.map((c) => oCsv(d[c])).join(","))).join("\n") + "\n";
  const tsv = [COT.join("\t")].concat(dong.map((d) => COT.map((c) => oTsv(d[c])).join("\t"))).join("\n") + "\n";
  return { csv, tsv, soDong: dong.length, tong: sanPham.length, boQua, viPham };
}

export async function dongBoPinterest(): Promise<string> {
  const f = dungFeed(await docCuaHang());
  if (f.viPham.length) return "Pinterest: CHƯA cập nhật, còn từ cấm ở " + f.viPham.map(([n, l]) => `${n} (${l})`).join("; ");
  if (!f.soDong) return "Pinterest: CHƯA cập nhật, 0 sản phẩm hợp lệ (giữ bản cũ)";
  let cu = "";
  try { cu = await getFile("pinterest-feed.csv"); } catch {  }
  if (cu === f.csv) return `Pinterest: không đổi (${f.soDong} sản phẩm)`;
  await commitBatch(
    [{ path: "pinterest-feed.csv", content: f.csv }, { path: "pinterest-feed.tsv", content: f.tsv }],
    `pinterest-feed: dựng lại từ /admin/cua-hang (${f.soDong}/${f.tong} sản phẩm)`,
  );
  return `Pinterest: đã cập nhật feed (${f.soDong} sản phẩm)`;
}
