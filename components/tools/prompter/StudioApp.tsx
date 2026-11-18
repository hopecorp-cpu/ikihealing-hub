"use client";

import { useState } from "react";
import { FileText, Video, Scissors, Check } from "lucide-react";
import ScriptStep from "./ScriptStep";
import RecordStep from "./RecordStep";
import EditStep from "./EditStep";
import { useLang } from "@/components/lang-provider";

export type Step = "script" | "record" | "edit";

export default function StudioApp() {
  const { t } = useLang();
  const [step, setStep] = useState<Step>("script");
  const [script, setScript] = useState<string>(
    t("Xin chào, hôm nay tôi sẽ chia sẻ với các bạn cách tạo video chuyên nghiệp ngay trên trình duyệt.\n\nVới teleprompter tích hợp, bạn có thể đọc kịch bản trong khi quay mà không cần học thuộc.\n\nHãy thử ngay nhé!")
  );
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  const steps: { key: Step; label: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean }[] = [
    { key: "script", label: t("Kịch bản"), icon: FileText },
    { key: "record", label: t("Quay video"), icon: Video },
    { key: "edit", label: t("Chỉnh sửa"), icon: Scissors, disabled: !recordedBlob },
  ];

  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4">
      <nav className="bg-white rounded-xl border border-gray-200 p-2 flex items-center gap-1 overflow-x-auto">
        {steps.map((s, i) => {
  const { t: t } = useLang();
          const active = s.key === step;
          const done = i < stepIdx;
          return (
            <button
              key={s.key}
              onClick={() => !s.disabled && setStep(s.key)}
              disabled={s.disabled}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : done
                  ? "text-brand-700 bg-brand-50 hover:bg-brand-100"
                  : s.disabled
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              <span>
                <span className="opacity-60 mr-1">{i + 1}.</span>
                {t(s.label)}
              </span>
            </button>
          );
        })}
      </nav>

      {step === "script" && (
        <ScriptStep
          script={script}
          setScript={setScript}
          onNext={() => setStep("record")}
        />
      )}
      {step === "record" && (
        <RecordStep
          script={script}
          onDone={(blob) => {
            setRecordedBlob(blob);
            setStep("edit");
          }}
          onBack={() => setStep("script")}
        />
      )}
      {step === "edit" && recordedBlob && (
        <EditStep
          blob={recordedBlob}
          script={script}
          transcript={transcript}
          setTranscript={setTranscript}
          onBack={() => setStep("record")}
          onRetake={() => {
            setRecordedBlob(null);
            setTranscript("");
            setStep("record");
          }}
        />
      )}
    </div>
  );
}
