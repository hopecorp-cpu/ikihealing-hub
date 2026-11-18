"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLang } from "./lang-provider";

export function PrivacyToggle() {
  const { t } = useLang();
  const [on, setOn] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("acme_privacy");
    const saved = raw === null ? true : raw === "1";
    setOn(saved);
    document.documentElement.classList.toggle("acme-privacy", saved);
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle("acme-privacy", next);
    try { localStorage.setItem("acme_privacy", next ? "1" : "0"); } catch { }
  };

  return (
    <button onClick={toggle}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${on ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
      title={on ? t("Số đang được ẩn — bấm để HIỆN") : t("Bấm để ẨN số nhạy cảm")}>
      {on ? <><Eye className="w-4 h-4" /> <span className="hidden sm:inline">{t("Hiện số")}</span></> : <><EyeOff className="w-4 h-4" /> <span className="hidden sm:inline">{t("Ẩn số")}</span></>}
    </button>
  );
}
