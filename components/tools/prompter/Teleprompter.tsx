"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Type, Gauge } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export type TeleprompterHandle = {
  start: () => void;
  pause: () => void;
  reset: () => void;
};

export default function Teleprompter({
  script,
  autoStart = false,
}: { script: string; autoStart?: boolean }) {
  const { t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const [playing, setPlaying] = useState(autoStart);
  const [speed, setSpeed] = useState(40);
  const [fontSize, setFontSize] = useState(40);

  useEffect(() => {
    if (autoStart) setPlaying(true);
  }, [autoStart]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = scrollRef.current;
      if (el) {
        offsetRef.current += speed * dt;
        el.scrollTop = offsetRef.current;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          setPlaying(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed]);

  function reset() {
    offsetRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setPlaying(false);
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      <div
        ref={scrollRef}
        className="prompter-scroll flex-1 overflow-hidden px-6 py-12"
        style={{ scrollBehavior: "auto" }}
      >
        <div style={{ height: "40%" }} />
        <div
          className="prompter-text mx-auto max-w-3xl"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.4 }}
        >
          {script}
        </div>
        <div style={{ height: "60%" }} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-brand-500/40" />

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-2 rounded-full border border-white/10">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="w-9 h-9 rounded-full bg-brand-600 hover:bg-brand-700 flex items-center justify-center"
          aria-label={playing ? t("Tạm dừng") : t("Phát")}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={reset}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label={t("Đặt lại")}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5 px-2 text-xs text-white/80">
          <Gauge className="w-3.5 h-3.5" />
          <input
            type="range" min={10} max={120} value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
            className="w-24 accent-brand-500"
            aria-label={t("Tốc độ")}
          />
          <span className="w-8 tabular-nums">{speed}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 text-xs text-white/80">
          <Type className="w-3.5 h-3.5" />
          <input
            type="range" min={20} max={72} value={fontSize}
            onChange={(e) => setFontSize(+e.target.value)}
            className="w-20 accent-brand-500"
            aria-label={t("Cỡ chữ")}
          />
          <span className="w-7 tabular-nums">{fontSize}</span>
        </div>
      </div>
    </div>
  );
}
