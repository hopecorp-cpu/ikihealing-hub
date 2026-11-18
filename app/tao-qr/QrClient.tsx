"use client";
import { useLang } from "@/components/lang-provider";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { QrCode, Download, Copy, Check, ImagePlus, X } from "lucide-react";

const PRESETS = ["https://example.com/", "https://example.com"];
const RECENT_KEY = "acme_tao_qr_recent";

type Shape = "square" | "rounded";
type Ecc = "L" | "M" | "Q" | "H";

if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
}

function slugOf(text: string) {
  const s = text.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return "qr-" + (s || "acme");
}

export default function QrClient() {
  const { t } = useLang();
  const [text, setText] = useState(PRESETS[0]);
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [size, setSize] = useState(1024);
  const [margin, setMargin] = useState(4);
  const [shape, setShape] = useState<Shape>("square");
  const [eccPick, setEccPick] = useState<Ecc>("M");
  const [logo, setLogo] = useState<{ data: string; img: HTMLImageElement } | null>(null);
  const [preview, setPreview] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ecc: Ecc = logo ? "H" : eccPick;
  const value = text.trim();

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")); } catch {  }
  }, []);

  function build() {
    if (!value) return null;
    const qr = qrcode(0, ecc);
    qr.addData(value, "Byte");
    qr.make();
    return qr;
  }

  function logoArea(n: number) {
    const k = Math.floor(n * 0.2), a = Math.floor((n - k) / 2);
    return { k, a };
  }
  function isFinder(r: number, c: number, n: number) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  }

  function renderCanvas(px: number): HTMLCanvasElement | null {
    const qr = build(); if (!qr) return null;
    const n = qr.getModuleCount(), total = n + margin * 2, s = px / total;
    const cv = document.createElement("canvas"); cv.width = px; cv.height = px;
    const ctx = cv.getContext("2d")!;
    if (!transparent) { ctx.fillStyle = bg; ctx.fillRect(0, 0, px, px); }
    ctx.fillStyle = fg;
    const { k, a } = logoArea(n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      if (logo && r >= a - 1 && r < a + k + 1 && c >= a - 1 && c < a + k + 1) continue;
      const x = (c + margin) * s, y = (r + margin) * s;

      const sh = isFinder(r, c, n) ? "square" : shape;
      if (sh === "rounded" && ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, s, s, s * 0.3); ctx.fill(); }
      else ctx.fillRect(x, y, Math.ceil(s), Math.ceil(s));
    }
    if (logo) {
      const box = (k + 2) * s, bx = (a - 1 + margin) * s;
      ctx.fillStyle = transparent ? "#ffffff" : bg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, bx, box, box, s * 1.2); else ctx.rect(bx, bx, box, box);
      ctx.fill();
      const inner = box - s * 2.8;
      const ratio = Math.min(inner / logo.img.width, inner / logo.img.height);
      const w = logo.img.width * ratio, h = logo.img.height * ratio;
      ctx.drawImage(logo.img, bx + (box - w) / 2, bx + (box - h) / 2, w, h);
    }
    return cv;
  }

  function buildSvg(): string {
    const qr = build(); if (!qr) return "";
    const n = qr.getModuleCount(), total = n + margin * 2;
    const { k, a } = logoArea(n);
    let path = "", extra = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      if (logo && r >= a - 1 && r < a + k + 1 && c >= a - 1 && c < a + k + 1) continue;
      const x = c + margin, y = r + margin;
      const sh = isFinder(r, c, n) ? "square" : shape;
      if (sh === "square") path += `M${x} ${y}h1v1h-1z`;
      else extra += `<rect x="${x}" y="${y}" width="1" height="1" rx="0.3"/>`;
    }
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="1024" height="1024" shape-rendering="${shape === "square" ? "crispEdges" : "geometricPrecision"}">`];
    if (!transparent) parts.push(`<rect width="100%" height="100%" fill="${bg}"/>`);
    parts.push(`<g fill="${fg}"><path d="${path}"/>${extra}</g>`);
    if (logo) {
      const bx = a - 1 + margin, box = k + 2;
      parts.push(`<rect x="${bx}" y="${bx}" width="${box}" height="${box}" rx="1.2" fill="${transparent ? "#ffffff" : bg}"/>`);
      parts.push(`<image href="${logo.data}" x="${bx + 1.4}" y="${bx + 1.4}" width="${box - 2.8}" height="${box - 2.8}" preserveAspectRatio="xMidYMid meet"/>`);
    }
    parts.push("</svg>");
    return parts.join("");
  }

  useEffect(() => {
    try {
      const cv = renderCanvas(720);
      setPreview(cv ? cv.toDataURL("image/png") : "");
      setMsg(null);
    } catch {
      setPreview("");
      setMsg({ text: t("Nội dung quá dài để tạo một mã QR. Rút ngắn link hoặc hạ độ chịu hỏng xuống Thấp."), ok: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fg, bg, transparent, margin, shape, ecc, logo]);

  function remember() {
    if (!value) return;
    const list = [value, ...recent.filter((x) => x !== value)].slice(0, 8);
    setRecent(list);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {  }
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = filename;
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({ text: t("Đã tải") + " " + filename, ok: true });
  }

  function downloadPng() {
    const cv = renderCanvas(size); if (!cv) return;
    remember();
    cv.toBlob((b) => b && saveBlob(b, slugOf(value) + ".png"), "image/png");
  }
  function downloadSvg() {
    const svg = buildSvg(); if (!svg) return;
    remember();
    saveBlob(new Blob([svg], { type: "image/svg+xml" }), slugOf(value) + ".svg");
  }
  async function copyImage() {
    const cv = renderCanvas(size); if (!cv) return;
    remember();
    try {
      const item = new ClipboardItem({ "image/png": new Promise<Blob>((res) => cv.toBlob((b) => res(b!), "image/png")) });
      await navigator.clipboard.write([item]);
      setMsg({ text: t("Đã copy ảnh. Dán thẳng vào Zalo, Canva, Facebook."), ok: true });
    } catch {
      setMsg({ text: t("Trình duyệt này chặn copy ảnh. Dùng nút Tải PNG."), ok: false });
    }
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => setLogo({ data: rd.result as string, img });
      img.onerror = () => setMsg({ text: t("Không đọc được ảnh logo này. Thử file PNG hoặc JPG khác."), ok: false });
      img.src = rd.result as string;
    };
    rd.readAsDataURL(f);
  }
  function clearLogo() { setLogo(null); if (fileRef.current) fileRef.current.value = ""; }

  const chips = [...recent, ...PRESETS.filter((p) => !recent.includes(p))].slice(0, 8);
  const label = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5";
  const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-300";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
          <QrCode className="w-5 h-5 text-pink-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("Tạo mã QR")}</h1>
          <p className="text-gray-500 mt-1 text-sm max-w-2xl">
            {t("Dán link, chỉnh màu và logo, rồi tải ảnh về. Mã QR tĩnh nên quét được mãi, không hết hạn, không mất phí.")}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-5 min-w-0">
          <div>
            <label className={label} htmlFor="qr-text">{t("Link hoặc nội dung")}</label>
            <input id="qr-text" type="url" inputMode="url" spellCheck={false} autoComplete="off" className={input}
              value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1.5">{t("Website, sale page, fanpage, Zalo, Shopee đều được. Gõ chữ thường cũng ra mã.")}</p>
          </div>

          <div>
            <span className={label}>{t("Link dùng gần đây")}</span>
            <div className="flex flex-wrap gap-2">
              {chips.map((u) => (
                <button key={u} type="button" title={u} onClick={() => setText(u)}
                  className={`text-xs border rounded-md px-2.5 py-1.5 max-w-full truncate ${u === value ? "border-pink-400 bg-pink-50 text-pink-800" : "border-gray-200 text-gray-700 hover:border-pink-300"}`}>
                  {u.replace(/^https?:\/\//, "")}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="qr-fg">{t("Màu mã")}</label>
              <div className="flex gap-2">
                <input id="qr-fg" type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="w-11 h-10 border border-gray-200 rounded-lg p-0.5 bg-white cursor-pointer" />
                <input type="text" value={fg} aria-label={t("Mã màu mã")} className={input + " tabular-nums"}
                  onChange={(e) => { const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setFg(v); }} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="qr-bg">{t("Màu nền")}</label>
              <div className="flex gap-2">
                <input id="qr-bg" type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-11 h-10 border border-gray-200 rounded-lg p-0.5 bg-white cursor-pointer" />
                <input type="text" value={bg} aria-label={t("Mã màu nền")} className={input + " tabular-nums"}
                  onChange={(e) => { const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setBg(v); }} />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
            {t("Nền trong suốt (để dán lên thiết kế)")}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="qr-size">{t("Cỡ ảnh tải về")}: <span className="tabular-nums">{size}</span> px</label>
              <input id="qr-size" type="range" min={256} max={4096} step={128} value={size} onChange={(e) => setSize(+e.target.value)} className="w-full accent-pink-700" />
            </div>
            <div>
              <label className={label} htmlFor="qr-margin">{t("Viền quanh mã")}: <span className="tabular-nums">{margin}</span> {t("ô")}</label>
              <input id="qr-margin" type="range" min={0} max={8} step={1} value={margin} onChange={(e) => setMargin(+e.target.value)} className="w-full accent-pink-700" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="qr-shape">{t("Kiểu chấm")}</label>
              <select id="qr-shape" className={input} value={shape} onChange={(e) => setShape(e.target.value as Shape)}>
                <option value="square">{t("Vuông (dễ quét nhất)")}</option>
                <option value="rounded">{t("Bo góc nhẹ")}</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="qr-ecc">{t("Độ chịu hỏng")}</label>
              <select id="qr-ecc" className={input} value={ecc} disabled={!!logo} onChange={(e) => setEccPick(e.target.value as Ecc)}>
                <option value="M">{t("Vừa (15%)")}</option>
                <option value="Q">{t("Khá (25%)")}</option>
                <option value="H">{t("Cao (30%), nên dùng khi có logo")}</option>
                <option value="L">{t("Thấp (7%), mã thưa nhất")}</option>
              </select>
            </div>
          </div>

          <div>
            <span className={label}>{t("Logo giữa mã (tuỳ chọn)")}</span>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-1.5 text-sm font-semibold border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:border-pink-300">
                <ImagePlus className="w-4 h-4" /> {t("Chọn file logo")}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onLogo} />
              </label>
              {logo && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo.data} alt={t("Logo đã chọn")} className="w-10 h-10 object-contain border border-gray-200 rounded-md bg-white" />
                  <button type="button" onClick={clearLogo} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-red-600">
                    <X className="w-4 h-4" /> {t("Bỏ logo")}
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{t("Có logo thì máy tự đặt độ chịu hỏng lên Cao để vẫn quét được. Nên dùng logo PNG nền trong.")}</p>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 lg:sticky lg:top-4 min-w-0">
          <div className="rounded-md p-4 grid place-items-center"
            style={{ background: "repeating-conic-gradient(#eee 0 25%, transparent 0 50%) 0 0 / 16px 16px" }}>
            {preview
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={preview} alt={t("Mã QR xem trước")} className="w-full max-w-[340px] aspect-square" style={{ imageRendering: "pixelated" }} />
              : <div className="w-full max-w-[340px] aspect-square grid place-items-center text-sm text-gray-400">{t("Dán link để tạo mã")}</div>}
          </div>
          <p className="text-xs text-gray-500 break-all">{value}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadPng} disabled={!preview}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2 bg-pink-700 text-white hover:bg-pink-800 disabled:opacity-50">
              <Download className="w-4 h-4" /> {t("Tải PNG")}
            </button>
            <button type="button" onClick={downloadSvg} disabled={!preview}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2 border border-gray-200 text-gray-800 hover:border-pink-300 disabled:opacity-50">
              <Download className="w-4 h-4" /> {t("Tải SVG (in ấn)")}
            </button>
            <button type="button" onClick={copyImage} disabled={!preview}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2 border border-gray-200 text-gray-800 hover:border-pink-300 disabled:opacity-50">
              {msg?.ok && msg.text.startsWith(t("Đã copy")) ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {t("Copy ảnh")}
            </button>
          </div>
          {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
          <p className="text-xs text-gray-500">{t("PNG để đăng web, Zalo, Facebook. SVG phóng to bao nhiêu cũng nét, gửi bên in tem nhãn, standee, danh thiếp.")}</p>
        </section>
      </div>
    </div>
  );
}
