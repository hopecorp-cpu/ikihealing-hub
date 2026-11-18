"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type TrangThaiCau = "nghi" | "nghe" | "dang-nghi" | "dang-noi" | "ghi-am";
type Mau = [number, number, number];

const MAU: Record<TrangThaiCau, [Mau, Mau]> = {
  nghi: [[52, 211, 153], [15, 118, 110]],
  nghe: [[52, 211, 153], [20, 184, 166]],
  "dang-nghi": [[129, 140, 248], [167, 139, 250]],
  "dang-noi": [[250, 204, 21], [245, 158, 11]],
  "ghi-am": [[248, 113, 113], [251, 146, 60]],
};

const rgba = (c: Mau, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const tron = (x: Mau, y: Mau, k: number): Mau => [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];

export default function QuaCau({ trangThai, mucAm }: { trangThai: TrangThaiCau; mucAm: MutableRefObject<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ttRef = useRef(trangThai);
  ttRef.current = trangThai;

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let raf = 0;
    let muc = 0;
    let a: Mau = MAU.nghi[0];
    let b: Mau = MAU.nghi[1];
    const t0 = performance.now();

    const ve = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const t = (now - t0) / 1000;
      const tt = ttRef.current;
      const dich = tt === "nghe" || tt === "ghi-am" ? Math.min(1, mucAm.current)
        : tt === "dang-noi" ? 0.3 + 0.35 * Math.abs(Math.sin(t * 5.1) * Math.sin(t * 1.9 + 1))
        : tt === "dang-nghi" ? 0.12 : 0.04;
      muc += (dich - muc) * 0.18;
      a = tron(a, MAU[tt][0], 0.12);
      b = tron(b, MAU[tt][1], 0.12);

      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.34 * (1 + muc * 0.12 + 0.015 * Math.sin(t * 1.3));

      const g = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 2.2);
      g.addColorStop(0, rgba(a, 0.32));
      g.addColorStop(0.5, rgba(b, 0.1));
      g.addColorStop(1, rgba(b, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      for (const ben of [-1, 1]) {
        for (let d = 0; d < 3; d++) {
          for (let i = 0; i < 70; i++) {
            const k = i / 70;
            const x = cx + ben * (R * 1.02 + k * (w / 2 - R));
            const y = cy + Math.sin(k * 7 + t * (1.4 + d * 0.3) + d * 2) * R * (0.12 + d * 0.08) * (0.4 + k) * (1 + muc * 1.6);
            ctx.fillStyle = rgba(d === 1 ? b : a, (1 - k) * (0.55 - d * 0.12));
            ctx.beginPath();
            ctx.arc(x, y, (1 - k) * 1.6 + 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";

      const than = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      than.addColorStop(0, rgba(b, 0.10));
      than.addColorStop(0.7, rgba(a, 0.22));
      than.addColorStop(1, rgba(a, 0.55));
      ctx.fillStyle = than;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) {
        ctx.filter = `blur(${k % 2 ? 3 : 1}px)`;
        ctx.strokeStyle = rgba(k % 2 ? b : a, 0.35 + muc * 0.3);
        ctx.lineWidth = 1.2 + (k % 2) * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.sin(t * 0.7 + k) * R * 0.08, cy, R * (0.95 - k * 0.12), R * (0.3 + 0.25 * Math.sin(t * (0.6 + k * 0.17) + k)) * (1 + muc * 0.5), t * (0.25 + k * 0.08) + k * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.filter = "none";
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";

      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(a, 0.85);
      ctx.filter = "blur(1px)";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.filter = "none";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.9, Math.PI * 1.08, Math.PI * 1.42);
      ctx.stroke();

      if (tt === "dang-nghi") {
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        for (let k = 0; k < 2; k++) {
          const bd = t * (k ? -1.6 : 2.2);
          ctx.strokeStyle = rgba(k ? b : a, 0.8);
          ctx.beginPath();
          ctx.arc(cx, cy, R * (1.28 + k * 0.12), bd, bd + Math.PI * 0.6);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(ve);
    };
    raf = requestAnimationFrame(ve);
    return () => cancelAnimationFrame(raf);
  }, [mucAm]);

  return <canvas ref={ref} className="h-full w-full" aria-hidden="true" />;
}
