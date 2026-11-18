"use client";

import { useLang } from "@/components/lang-provider";
import Link from "next/link";
import type { AgentLive, AgentState } from "@/lib/ai-map";

const W = 1000, H = 640;
const CX = W / 2, CY = H / 2;
const CARD_W = 168, CARD_H = 74;

const MAU: Record<AgentState, string> = {
  live: "#10b981", realtime: "#10b981", stale: "#f59e0b", empty: "#ef4444", human: "#94a3b8", notbuilt: "#d1d5db",
};
const TU_CHU: Record<string, string> = {
  nguoi: "Người quyết", doc: "Chỉ đọc số", "de-xuat": "Chỉ đề xuất", "cho-duyet": "Chờ duyệt", "trong-han": "Tự làm trong hạn",
};

export default function SoDoDieuPhoi({ agents, choTheoAgent }: { agents: AgentLive[]; choTheoAgent: Record<string, number> }) {
  const { t: t } = useLang();
  const hub = agents.find((a) => a.hub);
  const quanh = agents.filter((a) => !a.hub);
  const n = quanh.length;

  const viTri = quanh.map((a, i) => {
    const g = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { a, x: CX + Math.cos(g) * (W / 2 - CARD_W / 2 - 14), y: CY + Math.sin(g) * (H / 2 - CARD_H / 2 - 10) };
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <div className="relative min-w-[880px]" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
          <defs>
            {Object.entries(MAU).map(([k, c]) => (
              <marker key={k} id={`mui-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={c} />
              </marker>
            ))}
          </defs>
          {viTri.map(({ a, x, y }) => {
            const chay = (a.sanLuong?.luot ?? 0) > 0;
            const raHang = (a.sanLuong?.sanPham ?? 0) > 0;
            const c = MAU[a.state];

            const dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy) || 1;
            const sx = CX + (dx / d) * 96, sy = CY + (dy / d) * 96;
            const ex = x - (dx / d) * 58, ey = y - (dy / d) * 40;
            const mx = (sx + ex) / 2 - dy * 0.08, my = (sy + ey) / 2 + dx * 0.08;
            const path = `M${sx},${sy} Q${mx},${my} ${ex},${ey}`;
            return (
              <g key={a.id}>
                <path id={`duong-${a.id}`} d={path} fill="none" stroke={c} strokeWidth={chay ? 2 : 1.2}
                  strokeDasharray={a.state === "notbuilt" || a.state === "empty" ? "3 5" : "7 6"} opacity={chay ? 0.9 : 0.45}
                  markerEnd={`url(#mui-${a.state})`}>
                  {chay && <animate attributeName="stroke-dashoffset" from="26" to="0" dur="1.2s" repeatCount="indefinite" />}
                </path>
                {raHang && (
                  <circle r="3.5" fill={c}>
                    <animateMotion dur="2.4s" repeatCount="indefinite"><mpath href={`#duong-${a.id}`} /></animateMotion>
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {hub && (
          <Link href={hub.link || "#"} className="absolute flex flex-col items-center justify-center text-center rounded-2xl border-2 border-brand-500 bg-brand-50 hover:bg-brand-100"
            style={{ left: `${((CX - 92) / W) * 100}%`, top: `${((CY - 92) / H) * 100}%`, width: `${(184 / W) * 100}%`, height: `${(184 / H) * 100}%` }}>
            <span className="text-[11px] font-semibold text-brand-700">{t("Hub điều phối")}</span>
            <span className="mt-0.5 px-3 text-sm font-bold text-gray-900 leading-tight">{t(hub.name).replace(/\s*—.*$/, "")}</span>
            <span className="mt-1 text-[11px] text-gray-500">{t(TU_CHU[hub.tuChu || ""]) || ""}</span>
          </Link>
        )}

        {viTri.map(({ a, x, y }) => {
          const cho = choTheoAgent[a.runKey || a.id] || 0;
          const hong = a.sanLuong?.hong ?? 0;
          return (
            <Link key={a.id} href={a.link || "/he-dieu-hanh-ai"}
              className="absolute rounded-lg border bg-white px-2 py-1.5 shadow-sm hover:border-brand-400 overflow-hidden"
              style={{ left: `${((x - CARD_W / 2) / W) * 100}%`, top: `${((y - CARD_H / 2) / H) * 100}%`, width: `${(CARD_W / W) * 100}%`, minHeight: `${(CARD_H / H) * 100}%`, borderColor: hong ? "#fca5a5" : "#e5e7eb" }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: MAU[a.state] }} />
                <span className="text-xs font-semibold text-gray-900 truncate">{t(a.name)}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500 truncate">{t(TU_CHU[a.tuChu || ""]) || t("Chưa khai mức")}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums">
                {a.sanLuong ? <span className="text-gray-700">{a.sanLuong.sanPham} {t(a.sanLuong.donVi || "sp")}/24h</span> : <span className="text-gray-400">{t("chưa cắm sổ")}</span>}
                {cho > 0 && <span className="text-violet-700 font-semibold">{cho} {t("chờ duyệt")}</span>}
                {hong > 0 && <span className="text-red-600 font-semibold">{hong} {t("hỏng")}</span>}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 px-3 py-2 text-[11px] text-gray-500">
        <span>{t("Mũi tên chạy: máy có lượt chạy trong 24 giờ")}</span>
        <span>{t("Chấm chạy: lượt đó làm ra sản phẩm")}</span>
        <span>{t("Nét đứt thưa: máy chưa dựng hoặc chưa có dữ liệu")}</span>
        <span>{t("Viền đỏ: có lượt hỏng")}</span>
      </div>
    </div>
  );
}
