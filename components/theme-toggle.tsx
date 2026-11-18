"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useLang } from "./lang-provider";

export function ThemeToggle() {
  const { t } = useLang();
  const [toi, setToi] = useState(true);
  useEffect(() => { setToi(document.documentElement.classList.contains("dark")); }, []);
  const doi = () => {
    const next = !toi;
    setToi(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("acme_theme", next ? "dark" : "light"); } catch { }
  };
  return (
    <button onClick={doi} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600" title={toi ? t("Chuyển sang nền sáng") : t("Chuyển sang nền tối")}>
      {toi ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
