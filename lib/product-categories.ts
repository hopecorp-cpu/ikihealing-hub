export type ProductCategory = {
  key: string;
  label: string;

  color: string;
  patterns: RegExp[];
};

export const FALLBACK_LABEL = "Khác / Không xác định";
export const FALLBACK_COLOR = "#9CA3AF";

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    key: "san_pham_a",
    label: "Đạm Mẫu (Đạm thực vật)",
    color: "#16A34A",
    patterns: [/true.?vegan/i, /protein.*pro/i, /\bprotein\b/i, /b[oôọ̣]t.{0,5}đ[aạ]m/i, /tv66/i, /tv55/i],
  },
  {
    key: "nova_detox",
    label: "NOVA Detox (Cà phê hữu cơ + Thải độc)",
    color: "#92400E",
    patterns: [/cà.?phê.{0,10}h[uưữ]u.?cơ|cafe.?h[uưữ]u.?cơ/i, /nova/i, /th[aả]i.?đ[oộ]c.?đ[aạ]i.?tràng/i, /thai.?doc/i, /cfnova/i, /\btđ\d/i],
  },
  {
    key: "silicon_set",
    label: "Bộ silicon + Dụng cụ thải độc",
    color: "#0EA5E9",
    patterns: [/silicon/i, /b[oôọ̣].*đ[uưữ].*silicon/i, /b[oôọ̣].*th[aả]i.?đ[oộ]c/i, /b[oôọ̣].*th[uưữ]t.?r[uưữ]a/i, /btlđk/i, /slc/i, /\bbtđ\b/i, /đầu.?silicon/i],
  },
  {
    key: "san_pham_c",
    label: "Trà Mẫu A",
    color: "#65A30D",
    patterns: [/tr[aà].{0,3}tu[eệ].{0,3}minh/i, /tu[eệ].?minh/i, /ttm/i],
  },
  {
    key: "tra_khac",
    label: "Trà khác (Bổ thận, Tản Viên Sơn...)",
    color: "#84CC16",
    patterns: [/tr[aà].{0,3}b[oổ].{0,3}th[aậ]n/i, /tr[aà].{0,5}ng[uủ].{0,5}ngon/i, /tr[aà].{0,3}t[aả]n.?vi[eê]n/i, /tbt|ttv/i],
  },
  {
    key: "tamari",
    label: "Tương Tamari + Xì dầu",
    color: "#B45309",
    patterns: [/tamari/i, /t[uươ]ng.?t/i, /xì.?dầu/i, /\bxd\b/i, /t10-001/i],
  },
  {
    key: "dau_an",
    label: "Dầu ăn (Dừa, Mè, Lạc, Oliu)",
    color: "#CA8A04",
    patterns: [/dầu.?dừa/i, /dầu.?mè/i, /dầu.?l[aạ]c/i, /dầu.?oliu/i, /dau.?dua|dau.?me|dau.?lac|dau.?oliu/i, /ddu-|dml-|dll-|dol-|dm21/i],
  },
  {
    key: "muoi_dac_san",
    label: "Muối tre + Đường mía + Mật mía",
    color: "#A16207",
    patterns: [/mu[oố]i.?tre/i, /sahu/i, /đ[uườ]ờng.?mía/i, /m[aậ]t.?mía/i, /m[aậ]t.?ong/i, /mu[oố]i.?đ[aắ]ng/i, /m[uưữ].?mu[oố]i/i, /mt1|mt3|đmtn|đmh|mm75|mm-001|đmth|mat\b|mđ/i],
  },
  {
    key: "hat_me_gao",
    label: "Hạt mè + Gạo lứt + Bún",
    color: "#D97706",
    patterns: [/h[aạ]t.?mè/i, /g[aạ]o.?l[uưữ]t/i, /b[uú]n.?g[aạ]o/i, /hm320|hm150|gl\b|bgđ/i],
  },
  {
    key: "kem_danh_rang",
    label: "Kem đánh răng thảo mộc",
    color: "#0891B2",
    patterns: [/kem.?đánh.?răng/i, /siri/i, /sudanta/i, /kđr/i],
  },
  {
    key: "hat_nem",
    label: "Hạt nêm rau củ",
    color: "#15803D",
    patterns: [/h[aạ]t.?n[eê]m/i, /hnr/i],
  },
  {
    key: "sach_khoa_hoc",
    label: "Sách / Khoá học",
    color: "#7C3AED",
    patterns: [/minh.?tri[eế]t/i, /ph[uươ]ng.?đ[oô]ng/i, /smt/i, /khoá.?h[oọ]c/i],
  },
  {
    key: "phu_kien_khac",
    label: "Phụ kiện (Dây truyền, Thẻ member, Cọ)",
    color: "#64748B",
    patterns: [/d[aâ]y.?truy[eề]n/i, /th[eẻ].?member/i, /c[oọ].?v[eệ].?sinh/i, /màng.?h[aấ]p.?thu/i, /eco.?g9/i, /m[oơ].?mu[oố]i/i, /dt-001|tmb|co-001|sđt|mo-001|đầu.?dây/i],
  },
];

export function categorizeNotes(notes: string | null | undefined): string {
  if (!notes) return FALLBACK_LABEL;
  for (const cat of PRODUCT_CATEGORIES) {
    for (const pat of cat.patterns) {
      if (pat.test(notes)) return cat.label;
    }
  }
  return FALLBACK_LABEL;
}

export function colorForLabel(label: string): string {
  if (label === FALLBACK_LABEL) return FALLBACK_COLOR;
  return PRODUCT_CATEGORIES.find(c => c.label === label)?.color ?? "#9CA3AF";
}

export const STRATEGIC_GROUPS: { label: string; color: string; members: string[] }[] = [
  {
    label: "Sản phẩm chủ đạo",
    color: "#16A34A",
    members: [
      "Đạm Mẫu (Đạm thực vật)",
      "NOVA Detox (Cà phê hữu cơ + Thải độc)",
      "Bộ silicon + Dụng cụ thải độc",
    ],
  },
  {
    label: "Trà & Đồ uống",
    color: "#84CC16",
    members: ["Trà Mẫu A", "Trà khác (Bổ thận, Tản Viên Sơn...)"],
  },
  {
    label: "Thực phẩm hỗ trợ",
    color: "#CA8A04",
    members: [
      "Tương Tamari + Xì dầu",
      "Dầu ăn (Dừa, Mè, Lạc, Oliu)",
      "Muối tre + Đường mía + Mật mía",
      "Hạt mè + Gạo lứt + Bún",
      "Hạt nêm rau củ",
    ],
  },
  {
    label: "Chăm sóc cá nhân",
    color: "#0891B2",
    members: ["Kem đánh răng thảo mộc"],
  },
  {
    label: "Sách & Khoá học",
    color: "#7C3AED",
    members: ["Sách / Khoá học"],
  },
  {
    label: "Phụ kiện",
    color: "#64748B",
    members: ["Phụ kiện (Dây truyền, Thẻ member, Cọ)"],
  },
];
