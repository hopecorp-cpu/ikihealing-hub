"use client";
import { useState } from "react";
import { zaloChatLink, zaloMessageLink } from "@/lib/zalo";
import { MessageCircle, Copy, Check } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function ZaloButton({ phone, message, label = "Zalo", size = "sm" }: {
  phone: string | null | undefined;
  message?: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const { t } = useLang();
  if (!phone) return null;

  const link = message ? zaloMessageLink(phone, message) : zaloChatLink(phone);
  if (!link) return null;

  const sizeClasses = size === "sm" ? "text-xs px-2 py-1" : "text-sm px-3 py-1.5";

  return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 ${sizeClasses} bg-[#0068FF] text-white rounded hover:bg-[#0052cc] font-medium`}
      title={`${t("Chat Zalo với")} ${phone}`}>
      <MessageCircle className="w-3 h-3" /> {label}
    </a>
  );
}

export function ZaloSendCredentialsButton({ phone, message }: { phone?: string; message: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const link = phone ? zaloChatLink(phone) : null;

  const copy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={copy}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${copied ? "bg-green-100 text-green-700" : "bg-gray-900 text-white"}`}>
        {copied ? <><Check className="w-3 h-3" />{t("Đã copy")}</> : <><Copy className="w-3 h-3" />{t("Copy tin nhắn")}</>}
      </button>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 bg-[#0068FF] text-white rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-[#0052cc]">
          <MessageCircle className="w-3 h-3" /> {t("Mở Zalo")}
        </a>
      )}
    </div>
  );
}
