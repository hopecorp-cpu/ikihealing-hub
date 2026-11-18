"use client";
import { useState, useTransition } from "react";
import { generateBgdAnalysis } from "./actions";
import { useLang } from "@/components/lang-provider";

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n"); const out: string[] = []; let inUl = false;
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/&lt;sub&gt;(.+?)&lt;\/sub&gt;/g, '<span class="text-xs text-gray-400">$1</span>');
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { if (inUl) { out.push("</ul>"); inUl = false; } continue; }
    if (l.startsWith("## ")) { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h3 class="font-bold text-base mt-3 mb-1">${inline(l.slice(3))}</h3>`); }
    else if (l.startsWith("### ")) { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h4 class="font-semibold mt-2">${inline(l.slice(4))}</h4>`); }
    else if (/^[-*]\s/.test(l)) { if (!inUl) { out.push('<ul class="list-disc pl-5 space-y-0.5">'); inUl = true; } out.push(`<li>${inline(l.replace(/^[-*]\s/, ""))}</li>`); }
    else { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<p class="my-1">${inline(l)}</p>`); }
  }
  if (inUl) out.push("</ul>");
  return out.join("");
}

export default function BgdAiPanel({ month, metrics, cached }: { month: string; metrics: any; cached: string | null }) {
  const { t } = useLang();
  const [text, setText] = useState<string | null>(cached);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const gen = () => { setErr(null); start(async () => {
    const r = await generateBgdAnalysis(month, metrics);
    if (r.ok && r.text) setText(r.text); else setErr(r.error || t("Lỗi"));
  }); };

  return (
    <div className="bg-white border border-violet-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="text-sm font-semibold text-violet-800">{t("Phân tích & Khuyến nghị (AI) — tháng")} {month}</div>
        <button onClick={gen} disabled={pending} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-50">
          {pending ? t("Đang phân tích…") : text ? t("Cập nhật") : t("Tạo phân tích")}
        </button>
      </div>
      {err && <div className="text-sm text-red-600 bg-red-50 rounded p-2 mb-2">{err}</div>}
      {text ? (
        <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />
      ) : (
        <div className="text-sm text-gray-400">{t("Chưa có phân tích. Bấm \"Tạo phân tích\" để AI đánh giá thực tế vs mục tiêu + khuyến nghị việc cần làm để đạt doanh số.")}</div>
      )}
    </div>
  );
}
