"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, Wand2, AlertCircle, Lightbulb } from "lucide-react";
import { useLang } from "@/components/lang-provider";

type Tone = "thân thiện" | "chuyên nghiệp" | "hài hước" | "truyền cảm hứng";
type Length = "30 giây" | "60 giây" | "2 phút";

export default function ScriptStep({
  script, setScript, onNext,
}: { script: string; setScript: (s: string) => void; onNext: () => void }) {
  const { t } = useLang();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("thân thiện");
  const [length, setLength] = useState<Length>("60 giây");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estSeconds = Math.round(wordCount / 2.3);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tone, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      setScript(data.script);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <aside className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="font-semibold text-gray-900">{t("Tạo kịch bản với AI")}</h2>
          </div>

          <label className="block text-xs font-medium text-gray-700 mb-1">{t("Chủ đề video")}</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("VD: 5 mẹo quay video bằng điện thoại")}
            className="w-full mb-3 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />

          <label className="block text-xs font-medium text-gray-700 mb-1">{t("Tông giọng")}</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="w-full mb-3 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
          >
            <option value="thân thiện">{t("thân thiện")}</option>
            <option value="chuyên nghiệp">{t("chuyên nghiệp")}</option>
            <option value="hài hước">{t("hài hước")}</option>
            <option value="truyền cảm hứng">{t("truyền cảm hứng")}</option>
          </select>

          <label className="block text-xs font-medium text-gray-700 mb-1">{t("Độ dài")}</label>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as Length)}
            className="w-full mb-4 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
          >
            <option value="30 giây">{t("30 giây")}</option>
            <option value="60 giây">{t("60 giây")}</option>
            <option value="2 phút">{t("2 phút")}</option>
          </select>

          <button
            onClick={generate}
            disabled={loading || !topic.trim()}
            className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 font-medium text-sm"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? t("Đang tạo...") : t("Tạo kịch bản")}
          </button>

          {error && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
            {t("Cần set")} <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-700">ANTHROPIC_API_KEY</code> {t("trong env Vercel. Không có key vẫn dùng được bằng cách viết tay.")}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-gray-900 text-sm">{t("Mẹo viết kịch bản")}</h3>
          </div>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>{t("1 câu / 1 ý — dễ đọc trên teleprompter")}</li>
            <li>{t("Mở đầu ấn tượng trong 3 giây đầu")}</li>
            <li>{t("Kết thúc bằng call-to-action rõ ràng")}</li>
          </ul>
        </div>
      </aside>

      <section className="lg:col-span-2">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{t("Kịch bản")}</h2>
            <div className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{wordCount}</span> {t("từ")} ·
              <span className="font-medium text-gray-700"> ~{estSeconds}s</span>
            </div>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={t("Viết kịch bản tại đây...")}
            className="w-full h-[480px] p-5 text-base leading-relaxed resize-none outline-none text-gray-800"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onNext}
            disabled={!script.trim()}
            className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white flex items-center gap-2 font-medium text-sm"
          >
            {t("Tiếp theo: Quay video")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
