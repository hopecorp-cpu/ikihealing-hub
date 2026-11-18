"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition, useRef, useEffect } from "react";
import { Boxes, Search, Send, ArrowLeft, Copy, Check, History } from "lucide-react";
import { PageHeader } from "@/components/ui/kit";
import type { AiApp, AppLogRow } from "@/lib/ai-apps";
import { chatAction } from "./actions";

const NHOM_STYLE: Record<string, string> = {
  "Nội dung": "bg-violet-50 text-violet-700 border-violet-200",
  "Bán hàng": "bg-amber-50 text-amber-700 border-amber-200",
  "Chăm sóc": "bg-sky-50 text-sky-700 border-sky-200",
  "Quản trị": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

type Turn = { role: "user" | "assistant"; content: string };

export default function AppsClient({ apps, log, canSeeLog }: { apps: AiApp[]; log: AppLogRow[]; canSeeLog: boolean }) {
  const { t: tDich } = useLang();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AiApp | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, pending]);

  const filtered = apps.filter((a) =>
    !q.trim() || `${a.ten} ${a.mo_ta} ${a.nhom}`.toLowerCase().includes(q.toLowerCase().trim()));

  const send = (text: string) => {
    const t = text.trim();
    if (!t || !open) return;
    setErr(""); setInput("");
    const next: Turn[] = [...turns, { role: "user", content: t }];
    setTurns(next);
    start(async () => {
      const r = await chatAction(open.code, next);
      if (!r.ok) { setErr(r.error || "Lỗi"); return; }
      setTurns([...next, { role: "assistant", content: r.reply || "" }]);
    });
  };

  const copy = (text: string, i: number) => {
    navigator.clipboard?.writeText(text);
    setCopied(i); setTimeout(() => setCopied(null), 1500);
  };

  if (open) {
    return (
      <div className="max-w-3xl mx-auto space-y-3">
        <button onClick={() => { setOpen(null); setTurns([]); setErr(""); }}
          className="text-[13px] text-gray-500 hover:text-emerald-700 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />{tDich("Về kho app")}
        </button>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-gray-800">{tDich(open.ten)}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${NHOM_STYLE[tDich(open.nhom)] || ""}`}>{tDich(open.nhom)}</span>
          </div>
          <p className="text-[13px] text-gray-500 mt-1">{tDich(open.mo_ta)}</p>
        </div>

        {turns.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 p-4 space-y-2">
            <div className="text-[12px] text-gray-500">{tDich("Bấm một gợi ý để bắt đầu, hoặc gõ việc của mình:")}</div>
            <div className="flex flex-wrap gap-2">
              {open.goi_y.map((g) => (
                <button key={g} onClick={() => send(g)} disabled={pending}
                  className="text-[12px] px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 transition">
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
              <div className={`rounded-2xl px-4 py-3 text-[13.5px] whitespace-pre-wrap max-w-[92%] ${t.role === "user" ? "bg-emerald-600 text-white" : "bg-white border border-gray-100 shadow-sm text-gray-800"}`}>
                {t.content}
                {t.role === "assistant" && (
                  <button onClick={() => copy(t.content, i)} className="mt-2 block text-[11px] text-gray-400 hover:text-emerald-600 inline-flex items-center gap-1">
                    {copied === i ? <><Check className="w-3 h-3" />{tDich("Đã chép")}</> : <><Copy className="w-3 h-3" />{tDich("Chép nội dung")}</>}
                  </button>
                )}
              </div>
            </div>
          ))}
          {pending && <div className="text-[13px] text-gray-400">{tDich("Đang soạn...")}</div>}
          {err && <div className="text-[13px] text-rose-600">{err}</div>}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-3 flex gap-2 bg-white/90 backdrop-blur rounded-xl p-2 border border-gray-100 shadow-sm">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(input); }}
            placeholder={tDich("Mô tả việc cần làm... (Ctrl/Cmd + Enter để gửi)")}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-[13.5px] resize-none" />
          <button onClick={() => send(input)} disabled={pending || !input.trim()}
            className="px-4 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-1">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Kho app AI"
        subtitle={tDich("Mỗi app là một bộ hướng dẫn đã duyệt cho một việc — chọn app rồi trò chuyện, không cần tự nghĩ câu lệnh")}
        icon={Boxes}
        actions={canSeeLog ? (
          <button onClick={() => setShowLog((v) => !v)} className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-emerald-300 inline-flex items-center gap-1">
            <History className="w-3.5 h-3.5" />{tDich("Nhật ký dùng")}
          </button>
        ) : undefined}
      />

      <div className="relative">
        <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tDich("Tìm app theo tên hoặc công việc...")}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
      </div>

      {showLog && canSeeLog && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-2">
          <div className="text-[12px] font-bold text-gray-700">{tDich("Nhật ký dùng gần đây")}</div>
          {log.length === 0 && <div className="text-[12px] text-gray-400">{tDich("Chưa có ai dùng.")}</div>}
          {log.map((r, i) => (
            <div key={i} className="text-[12px] text-gray-600 border-b border-gray-50 pb-1.5">
              <span className="text-gray-400">{r.at}</span> · <b>{r.user || "?"}</b> · {r.app}
              <div className="text-gray-500 truncate">{r.q}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <button key={a.code} onClick={() => { setOpen(a); setTurns([]); setErr(""); }}
            className="text-left rounded-2xl border border-gray-100 bg-white shadow-sm p-4 hover:border-emerald-300 hover:shadow transition flex flex-col gap-1.5">
            <span className={`self-start text-[11px] font-semibold px-2 py-0.5 rounded-full border ${NHOM_STYLE[tDich(a.nhom)] || ""}`}>{tDich(a.nhom)}</span>
            <span className="text-[15px] font-bold text-gray-800">{tDich(a.ten)}</span>
            <span className="text-[12.5px] text-gray-500">{tDich(a.mo_ta)}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0 && <div className="text-[13px] text-gray-400">{tDich("Không tìm thấy app nào khớp.")}</div>}

      <p className="text-[11px] text-gray-400">
        {tDich("Mọi app đều bị ràng luật ACME: không nói quá công dụng, khuyến mãi bằng quà, chỉ nhắc combo và giá đã duyệt. Cần thêm app mới cho việc của phòng mình thì báo quản trị.")}
      </p>
    </div>
  );
}
