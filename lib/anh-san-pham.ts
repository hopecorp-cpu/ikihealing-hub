export type AnhThat = { path: string; url: string; sanPham: string };

const SAN_PHAM: { ten: string; tuKhoaBai: RegExp; anh: string[] }[] = [
  {
    ten: "Đạm Mẫu Protein",

    tuKhoaBai: /true\s*vegan/,

    anh: [],
  },
  {
    ten: "Dầu dừa tinh khiết",
    tuKhoaBai: /dau\s*dua|coconut\s*oil/,
    anh: [
      "fanpage/san-pham/dau-dua-tinh-khiet-rawvirgin-coconut-oil-b7afda.jpg",
      "fanpage/san-pham/dau-dua-tinh-khiet-rawvirgin-coconut-oil-fd0928.jpg",
      "fanpage/san-pham/dau-dua-tinh-khiet-coconut-oil-993cb2.jpg",
      "fanpage/san-pham/dau-dua-tinh-khiet-coconut-oil-77f2fd.jpg",
    ],
  },
  {
    ten: "Trà Mẫu A",
    tuKhoaBai: /tue\s*minh/,
    anh: [
      "salepage/san-pham/san-pham-c-hop-30-goi.jpg",
      "salepage/san-pham/san-pham-c-hop-va-ly-tra.jpg",
      "salepage/san-pham/san-pham-c-goi-le.jpg",
    ],
  },
  {
    ten: "Trà Mẫu B",
    tuKhoaBai: /thanh\s*huong/,
    anh: [
      "salepage/san-pham/san-pham-b-hop-tui-loc-ly.jpg",
      "salepage/san-pham/san-pham-b-ba-hop-ly-tra.jpg",
      "salepage/san-pham/san-pham-b-hop-don.jpg",
      "salepage/san-pham/san-pham-b-hop-vuon-thien.jpg",
    ],
  },

];

const BO_DAU = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

export function anhSanPhamUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/brand-photos/${path}`;
}

export async function anhSanPhamCho(text: string, seed = ""): Promise<AnhThat | null> {
  const t = BO_DAU(text);
  const sp = SAN_PHAM.find((s) => s.tuKhoaBai.test(t));
  if (!sp || !sp.anh.length) return null;

  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const path = sp.anh[h % sp.anh.length];
  return { path, url: anhSanPhamUrl(path), sanPham: sp.ten };
}
