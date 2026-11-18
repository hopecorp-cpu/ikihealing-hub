import sharp from "sharp";
import { geminiImage } from "@/lib/gemini";

const WIDTH = 1200;
const HEIGHT = 675;
const MIN_BYTES = 5 * 1024;

const LUOT_GEMINI = 2;
const LUOT_POLLINATIONS = 1;
const CHO_MOI_LUOT_MS = 20_000;

async function chuanHoa(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

async function tuGemini(prompt: string): Promise<Buffer | null> {
  for (let i = 0; i < LUOT_GEMINI; i++) {
    try {
      const r = await geminiImage(
        `${prompt}. Photorealistic, warm natural light, calm minimal composition. ` +
        `NO text, NO letters, NO watermark, NO logo, no close-up of a human face.`
      );
      if (r.ok && r.dataB64) {
        const raw = Buffer.from(r.dataB64, "base64");
        if (raw.length >= MIN_BYTES) return await chuanHoa(raw);
      }
    } catch {  }
  }
  return null;
}

async function tuPollinations(prompt: string): Promise<Buffer | null> {
  for (let i = 0; i < LUOT_POLLINATIONS; i++) {
    try {
      const seed = Math.floor(Math.random() * 1_000_000);
      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=${WIDTH}&height=${HEIGHT}&nologo=true&model=flux&seed=${seed}`;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(CHO_MOI_LUOT_MS) });
      if (!res.ok) continue;
      const raw = Buffer.from(await res.arrayBuffer());
      if (raw.length >= MIN_BYTES) return await chuanHoa(raw);
    } catch {  }
  }
  return null;
}

async function nenTruuTuong(prompt: string): Promise<Buffer> {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) h = (h * 31 + prompt.charCodeAt(i)) >>> 0;
  const r = (n: number) => ((h >>> (n * 5)) % 100) / 100;

  const BO_MAU = [
    ["#2E6B2D", "#4BC0AB"],
    ["#2E6B2D", "#A8D254"],
    ["#1F4F3A", "#4BC0AB"],
    ["#3A7D44", "#CDE7A0"],
  ];
  const [c1, c2] = BO_MAU[h % BO_MAU.length];

  const bong = [0, 1, 2, 3]
    .map((i) => {
      const cx = Math.round(WIDTH * (0.1 + r(i) * 0.85));
      const cy = Math.round(HEIGHT * (0.1 + r(i + 1) * 0.8));
      const rad = Math.round(HEIGHT * (0.18 + r(i + 2) * 0.3));
      const mo = (0.06 + r(i + 3) * 0.12).toFixed(2);
      return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="#FFFFFF" opacity="${mo}" />`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)" />
    ${bong}
  </svg>`;

  return sharp(Buffer.from(svg)).blur(28).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

export async function fetchHeroCoNguon(prompt: string): Promise<{ buf: Buffer; nguon: string }> {
  const g = await tuGemini(prompt);
  if (g) return { buf: g, nguon: "gemini" };

  const p = await tuPollinations(prompt);
  if (p) return { buf: p, nguon: "pollinations" };

  return { buf: await nenTruuTuong(prompt), nguon: "nen-truu-tuong" };
}

export async function fetchHero(prompt: string): Promise<Buffer> {
  return (await fetchHeroCoNguon(prompt)).buf;
}
