export type Nguon = {
  s?: string;
  m?: string;
  c?: string;
  ref?: string;
  lp?: string;
};

const gon = (v: unknown, n = 30) =>
  String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9._\-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, n);

function hostCua(v: unknown): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  try { return gon(new URL(raw).hostname.replace(/^www\./, "")); } catch { return gon(raw); }
}

export function docNguonTuBody(b: any): Nguon | null {
  if (!b || typeof b !== "object") return null;
  if (typeof b.nguon === "string" && b.nguon.trim()) return bocChuoi(b.nguon.trim().replace(/^~/, ""));
  const o = (b.nguon && typeof b.nguon === "object" ? b.nguon : b) as any;
  const n: Nguon = {
    s: gon(o.s ?? o.utm_source ?? o.utmSource),
    m: gon(o.m ?? o.utm_medium ?? o.utmMedium),
    c: gon(o.c ?? o.utm_campaign ?? o.utmCampaign, 40),
    ref: hostCua(o.ref ?? o.referrer ?? o.referer),
    lp: String(o.lp ?? o.landing ?? "").trim().slice(0, 60),
  };
  if (!n.s && !n.m && !n.c && !n.ref && !n.lp) return null;
  return n;
}

export function nhanNguon(n: Nguon | null): string {
  if (!n) return "";
  const s = n.s || (n.ref ? "ref:" + n.ref : "");
  if (!s && !n.lp) return "";
  const phan = [s || "?", n.m || "", n.c || ""].join("/").replace(/\/+$/, "");
  const lp = n.lp ? "@" + n.lp.replace(/\.html$/, "") : "";
  return ("~" + phan + lp).slice(0, 80);
}

export function themNhan(source: string, n: Nguon | null): string {
  const goc = String(source || "").trim();
  const nhan = nhanNguon(n);
  if (!nhan || goc.includes(" ~")) return goc;
  return (goc + " " + nhan).slice(0, 200);
}

export function bocChuoi(raw: string): Nguon | null {
  const [phan, lp] = String(raw || "").trim().split("@");
  const [a, b, c] = phan.split("/");
  const n: Nguon = { lp: lp || undefined };
  if (a && a.startsWith("ref:")) n.ref = a.slice(4);
  else if (a && a !== "?") n.s = a;
  if (b) n.m = b;
  if (c) n.c = c;
  return n.s || n.m || n.c || n.ref || n.lp ? n : null;
}

export function bocNhan(source: string): Nguon | null {
  const s = String(source || "");
  const i = s.indexOf("~");
  return i < 0 ? null : bocChuoi(s.slice(i + 1));
}
export function tachSource(source: string): { goc: string; nguon: Nguon | null } {
  const s = String(source || "");
  const i = s.indexOf(" ~");
  return i < 0 ? { goc: s.trim(), nguon: null } : { goc: s.slice(0, i).trim(), nguon: bocNhan(s.slice(i)) };
}

export function xepCua(source: string, channel?: string | null): string {
  const s = (source || "").toLowerCase();
  const ch = (channel || "").toLowerCase();
  if (s.startsWith("exit:")) return "Pop-up blog";
  if (s.startsWith("ebook:") || s.startsWith("app:") || s.startsWith("theodoi:")) return "Landing ebook";
  if (s.startsWith("quiz")) return "Quiz thể trạng";
  if (s.startsWith("tailieu")) return "Đổi tài liệu";
  if (s.startsWith("salepage")) return "Sale page";
  if (s.startsWith("shop")) return "Web /shop";
  if (s.startsWith("qua-tang-doanh-nghiep") || s.includes("qua-tang-dn")) return "Quà tặng doanh nghiệp";
  if (s.startsWith("fb comment") || s.startsWith("bình luận")) return "Bình luận fanpage";
  if (s.startsWith("fanpage")) return "Inbox fanpage";
  if (s.startsWith("zalo ")) return "Hộp thư Zalo";
  if (ch === "zalo") return "Hộp thư Zalo";
  if (ch === "facebook") return "Facebook (không rõ cửa)";
  if (ch) return ch;
  return "Không rõ";
}

const KENH: [RegExp, string][] = [
  [/^(fb|facebook|meta|instagram|ig)$/, "Facebook / Instagram"],
  [/^(google|gg|adwords|google-ads)$/, "Google"],
  [/^(tiktok|tt|douyin)$/, "TikTok"],
  [/^(youtube|yt)$/, "YouTube"],
  [/^(zalo|zalo-oa)$/, "Zalo"],
  [/^(pinterest|pin)$/, "Pinterest"],
  [/^(email|resend|drip|newsletter)$/, "Email NOVA"],
  [/^(telegram|tele)$/, "Telegram"],
  [/^(linkedin|li)$/, "LinkedIn"],
  [/^(threads|thread)$/, "Threads"],
  [/^(shopee|tiktokshop|lazada)$/, "Sàn TMĐT"],
  [/^(blog|website|web|example)$/, "Web NOVA (nội bộ)"],
  [/^(dang-cheo|crosspost)$/, "Đăng chéo"],
];
const KENH_REF: [RegExp, string][] = [
  [/facebook|fb\.|instagram|l\.facebook/, "Facebook / Instagram"],
  [/google|gstatic|googleusercontent/, "Google"],
  [/tiktok/, "TikTok"],
  [/youtu/, "YouTube"],
  [/zalo/, "Zalo"],
  [/pinterest/, "Pinterest"],
  [/bing|duckduckgo|coccoc|yandex/, "Tìm kiếm khác"],
  [/example|ikihealing-hub|sanphamaprotein/, "Web NOVA (nội bộ)"],
];

export function xepKenh(source: string, channel?: string | null): { kenh: string; chiTiet: string; doan: boolean } {
  const { goc, nguon } = tachSource(source || "");
  if (nguon?.s) {
    const k = KENH.find(([re]) => re.test(nguon.s!));
    const paid = /cpc|paid|ads|ppc/.test(nguon.m || "");
    return { kenh: (k ? k[1] : nguon.s) + (paid ? " (trả tiền)" : ""), chiTiet: [nguon.s, nguon.m, nguon.c].filter(Boolean).join(" / "), doan: false };
  }
  if (nguon?.ref) {
    const k = KENH_REF.find(([re]) => re.test(nguon.ref!));
    return { kenh: k ? k[1] : "Trang khác dẫn về", chiTiet: nguon.ref, doan: false };
  }
  const s = goc.toLowerCase();

  if (/gclid|google ads/.test(s)) return { kenh: "Google", chiTiet: "dấu vết trong source", doan: true };
  if (/fbclid/.test(s)) return { kenh: "Facebook / Instagram", chiTiet: "fbclid", doan: true };

  const m = s.match(/:s-([a-z0-9._\-]+)/);
  if (m) {
    const t = m[1];
    const k = KENH.find(([re]) => re.test(t.split(/[-_.]/)[0]));
    return { kenh: k ? k[1] : "Link tự phát: " + t, chiTiet: "s-" + t, doan: true };
  }

  if (s.startsWith("salepage")) {
    const cuoi = goc.split(":").slice(2).join(":").trim();
    if (cuoi && !/^tr(ự|u)c ti(ế|e)p/i.test(cuoi)) {
      const dau = cuoi.split(/[\/ ]/)[0].toLowerCase();
      const k = KENH.find(([re]) => re.test(dau));
      return { kenh: k ? k[1] : cuoi.slice(0, 28), chiTiet: cuoi, doan: true };
    }
  }
  if (s.startsWith("fanpage") || s.startsWith("fb comment") || s.startsWith("bình luận")) return { kenh: "Facebook / Instagram", chiTiet: goc, doan: true };
  if (s.startsWith("zalo ")) return { kenh: "Zalo", chiTiet: goc, doan: true };
  if (s.startsWith("exit:") || s.startsWith("ebook:") || s.startsWith("quiz")) return { kenh: "Chưa đo được", chiTiet: "trang chưa gắn nhãn nguồn", doan: true };
  if ((channel || "").toLowerCase() === "facebook") return { kenh: "Facebook / Instagram", chiTiet: "channel", doan: true };
  if ((channel || "").toLowerCase() === "zalo") return { kenh: "Zalo", chiTiet: "channel", doan: true };
  return { kenh: "Chưa đo được", chiTiet: "", doan: true };
}

export function postIdFanpage(externalId?: string | null): string | null {
  const m = String(externalId || "").match(/^fbcm?:(\d{6,})_\d+/);
  return m ? m[1] : null;
}

export function tenPageTuSource(source?: string | null): string {
  const goc = String(source || "").replace(/ ~.*$/, "").trim();
  const m = goc.match(/^(?:FB comment\s*·\s*|Bình luận\s+|Fanpage\s+)(.+)$/i);
  return (m ? m[1] : "").trim();
}

export function laPageTuBinhLuan(tenNguoi?: string | null, source?: string | null): boolean {
  const bo = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "");
  const ten = bo(tenNguoi);
  const page = bo(tenPageTuSource(source));
  if (!ten || !page) return false;
  return ten === page || ten.includes(page) || page.includes(ten);
}
