"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { FileText, Copy, Check, ExternalLink, Info } from "lucide-react";

const SITE = "https://example.com";

type Doc = { slug: string; title: string; tag: string };

export default function ShareClient({ docs, meName, meSlug }: { docs: Doc[]; meName: string; meSlug: string }) {
  const { t: t } = useLang();
  const [attribute, setAttribute] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const linkFor = (slug: string) =>
    `${SITE}/tai-lieu/${slug}` + (attribute && meSlug ? `?s=${encodeURIComponent(meSlug)}` : "");

  async function copy(slug: string) {
    const link = linkFor(slug);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 2000);
    } catch {
      setCopied("__err");
      setTimeout(() => setCopied((c) => (c === "__err" ? null : c)), 2000);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t("Gửi tài liệu cho khách")}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t("Copy link tài liệu rồi gửi cho khách qua Zalo/Messenger. Khách để lại email là nhận được file —\n          và vào phễu nuôi dưỡng tự động, mình có thêm email để chăm về sau.")}
        </p>
      </div>

      <label className="flex items-start gap-2 mb-5 bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={attribute}
          onChange={(e) => setAttribute(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm text-gray-700">
          {t("Gắn tên tôi vào link")}{meName ? ` (${meName})` : ""} {t("để hệ thống ghi nhận khách này do tôi mang về.")}
          {!meSlug && <span className="text-amber-600"> {t("(Chưa có tên hiển thị — link sẽ không gắn được, báo quản lý cập nhật hồ sơ.)")}</span>}
        </span>
      </label>

      <div className="space-y-3">
        {docs.map((d) => {
  const { t: t } = useLang();
          const link = linkFor(d.slug);
          const isCopied = copied === d.slug;
          return (
            <div
              key={d.slug}
              className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{d.tag}</div>
                  <div className="font-semibold text-gray-900 leading-tight">{t(d.title)}</div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <code className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 break-all">
                      {link}
                    </code>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => copy(d.slug)}
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl px-3 py-2 ${
                        isCopied ? "bg-emerald-600 text-white" : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {isCopied ? t("Đã copy") : t("Copy link gửi khách")}
                    </button>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 rounded-xl px-3 py-2 border border-gray-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t("Mở thử")}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {copied === "__err" && (
        <p className="text-sm text-amber-600 mt-3">{t("Không copy tự động được — bạn bấm giữ vào link phía trên để copy tay nhé.")}</p>
      )}

      <div className="mt-6 flex items-start gap-2 text-sm text-gray-500 bg-blue-50/50 border border-blue-100 rounded-2xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <span>
          {t("Mẹo: khách")} <b>{t("mới / chưa mua")}</b> {t("thì gửi link để lấy email vào phễu. Khách")} <b>{t("đã thân / đã mua")}</b> {t("mà cần file gấp\n          thì cứ gửi file thẳng cho nhanh, đừng bắt điền form — tránh làm phiền.")}
        </span>
      </div>
    </div>
  );
}
