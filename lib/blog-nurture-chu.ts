export type Doan = string[];

const LINK_RE = /\(((?:https?:\/\/|mailto:)[^\s()]+|\{\{LINK_HUY\}\})\)/g;

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const tachDoan = (chu: string): Doan[] => chu.split("\n\n").map((p) => p.split("\n"));

export function dongSangHtml(dong: string, lid: string): string {
  let out = "", pos = 0;
  for (const m of dong.matchAll(LINK_RE)) {
    const i = m.index!;
    const doan = dong.slice(pos, i);
    const cat = Math.max(0, ...[...doan.matchAll(/[.:?!,;]\s/g)].map((x) => x.index! + 2));
    let chu = doan.slice(cat).replace(/\s+$/, "");
    const tu = chu.split(/\s+/).filter(Boolean);
    if (tu.length > 6) chu = tu.slice(-3).join(" ");
    const idx = doan.lastIndexOf(chu);
    const href = m[1].split("LID").join(encodeURIComponent(lid));

    out += escapeHtml(doan.slice(0, idx)) + `<a href="${escapeHtml(href)}" style="color:#B5436A;font-weight:700;text-decoration:none">${escapeHtml(chu)}</a>`;
    pos = i + m[0].length;
  }
  return out + escapeHtml(dong.slice(pos));
}

export function doanSangHtml(doan: Doan, lid: string, logoUrl: string, style = ""): string {
  const anh = doan.length === 1 ? doan[0].match(/^\[ảnh: (.+)\]$/) : null;
  if (anh) return `<div style="text-align:center"><img src="${logoUrl}" width="56" height="110" alt="${escapeHtml(anh[1])}" style="display:inline-block" /></div>`;
  if (doan.every((l) => l.startsWith("- "))) return `<ul style="padding-left:20px;margin:0">${doan.map((l) => `<li style="margin:4px 0">${dongSangHtml(l.slice(2), lid)}</li>`).join("")}</ul>`;
  return `<p style="margin:0${style ? ";" + style : ""}">${doan.map((l) => dongSangHtml(l, lid)).join("<br/>")}</p>`;
}

export function htmlToText(h: string): string {
  let s = h;
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "[ảnh: $1]");
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => `${inner.replace(/<[^>]+>/g, "").trim()} (${href})`);
  s = s.replace(/<li[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "");
  s = s.replace(/<(p|div|ul|h\d|tr|table)[^>]*>/gi, "\n").replace(/<\/(p|div|ul|h\d|tr|table)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

export type Khung = { dau: Doan[]; cuoi: Doan[] };
export function tachKhung(wrapChu: string): Khung {
  const ds = tachDoan(wrapChu);
  const iTieuDe = ds.findIndex((p) => p.length === 1 && p[0] === "{TIEU_DE_KHUNG}");
  const iThan = ds.findIndex((p) => p.length === 1 && p[0] === "{THAN}");
  if (iTieuDe < 0 || iThan !== iTieuDe + 1) throw new Error("wrap.txt: thiếu {TIEU_DE_KHUNG}/{THAN} hoặc sai thứ tự");
  return { dau: ds.slice(0, iTieuDe), cuoi: ds.slice(iThan + 1) };
}

export type MauChu = { subject: string; tieuDeKhung: string; than: Doan[] };
export function tachMau(chu: string, khung: Khung): MauChu {
  if (chu.endsWith("\n")) throw new Error("file duyệt có dòng trống cuối");
  const dong = chu.split("\n");
  if (dong[1] !== "") throw new Error("dòng 2 phải trống");
  const ds = tachDoan(dong.slice(2).join("\n"));
  const giong = (a: Doan[], b: Doan[]) => a.length === b.length && a.every((p, i) => p.join("\n") === b[i].join("\n"));
  if (!giong(ds.slice(0, khung.dau.length), khung.dau)) throw new Error("đoạn đầu không khớp khung");
  if (!giong(ds.slice(ds.length - khung.cuoi.length), khung.cuoi)) throw new Error("đoạn cuối không khớp khung");
  const td = ds[khung.dau.length];
  if (!td || td.length !== 1) throw new Error("thiếu tiêu đề khung");
  return { subject: dong[0], tieuDeKhung: td[0], than: ds.slice(khung.dau.length + 1, ds.length - khung.cuoi.length) };
}
