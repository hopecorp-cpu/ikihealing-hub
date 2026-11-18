"use client";
import { useLang } from "@/components/lang-provider";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t: t } = useLang();
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}></div>
        <h2>{t("Lỗi nghiêm trọng")}</h2>
        <p style={{ color: "#666" }}>{error.message}</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", background: "#10B981", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
          {t("Tải lại")}
        </button>
      </body>
    </html>
  );
}
