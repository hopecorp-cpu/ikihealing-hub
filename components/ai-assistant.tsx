"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, Send, Bot, User, ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { matchIntents, getSuggestionsForPage, type Intent } from "@/lib/ai-assistant-knowledge";
import type { AppUser } from "@/lib/supabase-types";
import { useLang } from "@/components/lang-provider";

type Message = {
  role: "user" | "bot";
  content: string;
  intents?: Intent[];
  timestamp: number;
};

export function AIAssistant({ user }: { user: AppUser }) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      const suggestions = getSuggestionsForPage(pathname, user.role);
      setMessages([{
        role: "bot",
        timestamp: Date.now(),
        content: `${t("Chào")} ${user.full_name.split(" ").slice(-1)[0]}! ${t("Tôi là ACME Assistant — trợ lý AI hướng dẫn dùng app.")}\n\n${suggestions.length > 0 ? t("Gợi ý cho trang này:") : t("Hỏi tôi bất cứ điều gì về app — VD: \"cách chấm công\", \"phạt 50k\", \"tính lương\"")}`,
        intents: suggestions
      }]);
    }
  }, [open, pathname, user.role]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, aiLoading]);

  const handleSend = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;

    const userMsg: Message = { role: "user", content: q, timestamp: Date.now() };
    setMessages(m => [...m, userMsg]);
    setInput("");

    const matched = matchIntents(q, pathname, user.role, 3);

    if (matched.length > 0) {

      const top = matched[0];
      const botMsg: Message = {
        role: "bot",
        timestamp: Date.now() + 1,
        content: top.answer,
        intents: matched.slice(1)
      };
      setMessages(m => [...m, botMsg]);
    } else {

      setAiLoading(true);
      try {
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, path: pathname, role: user.role, name: user.full_name })
        });
        const data = await res.json();
        if (data.ok) {
          setMessages(m => [...m, { role: "bot", timestamp: Date.now() + 1, content: data.answer }]);
        } else {

          setMessages(m => [...m, {
            role: "bot",
            timestamp: Date.now() + 1,
            content: t(`Mình chưa hiểu chính xác câu hỏi này. Bạn có thể thử:\n- "cách chấm công"\n- "tính lương tự động"\n- "thêm nhân viên"\n- "knowledge base"\n\nHoặc liên hệ admin (CEO) qua Zalo.`),
            intents: getSuggestionsForPage(pathname, user.role)
          }]);
        }
      } catch (e) {
        setMessages(m => [...m, { role: "bot", timestamp: Date.now() + 1, content: t("Lỗi kết nối — vui lòng thử lại") }]);
      }
      setAiLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-5 right-5 z-50 group ${pulse ? "animate-pulse" : ""}`}
        title={t("ACME AI Assistant")}
      >
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0B1F14] to-[#143020] flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
            <Sparkles className="w-6 h-6 text-[#F5C518]" />
          </div>
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">AI</span>
        </div>
        <div className="absolute right-16 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {t("Hỏi ACME Assistant")}
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="bg-gradient-to-br from-[#0B1F14] to-[#143020] text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-[#F5C518]/20 rounded-full flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#F5C518]" />
          </div>
          <div>
            <div className="font-bold text-sm">ACME Assistant</div>
            <div className="text-[10px] text-gray-300">{t("AI hướng dẫn sử dụng app")}</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "bot" && (
              <div className="w-7 h-7 bg-[#0B1F14] rounded-full flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#F5C518]" />
              </div>
            )}
            <div className={`max-w-[85%] ${m.role === "user" ? "bg-brand-600 text-white" : "bg-white border border-gray-200"} rounded-2xl p-3 text-sm`}>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

              {m.intents && m.intents.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                  {m.intents.map(intent => (
                    <button key={intent.id}
                      onClick={() => handleSend(tDich(intent.title))}
                      className="block w-full text-left bg-yellow-50 hover:bg-yellow-100 text-yellow-900 px-2 py-1 rounded text-xs font-medium">
                      <Lightbulb className="w-3 h-3 inline mr-1" /> {tDich(intent.title)}
                    </button>
                  ))}
                </div>
              )}

              {m.role === "bot" && i === messages.length - 1 && (
                <QuickActionsFromLastQuery messages={messages} pathname={pathname} role={user.role} />
              )}
            </div>
            {m.role === "user" && (
              <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        ))}

        {aiLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-[#0B1F14] rounded-full flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-[#F5C518] animate-spin" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-3 text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 flex gap-1 overflow-x-auto">
        {[tDich("Chấm công"), tDich("Phạt 50k"), tDich("Xin nghỉ"), tDich("Phiếu lương"), "Task", "KB"].map(q => (
          <button key={q} onClick={() => handleSend(q)}
            className="px-2 py-1 bg-gray-100 hover:bg-brand-100 text-xs rounded-md whitespace-nowrap">
            {t(q)}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-3 border-t border-gray-200 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t("Hỏi tôi về app ACME...")}
          className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="submit" disabled={!input.trim()}
          className="px-3 py-2 bg-brand-600 text-white rounded-lg disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

function QuickActionsFromLastQuery({ messages, pathname, role }: { messages: Message[]; pathname: string; role: string }) {
  const { t: tDich } = useLang();

  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return null;
  const matched = matchIntents(lastUser.content, pathname, role, 1);
  const intent = matched[0];
  if (!intent?.quickActions || intent.quickActions.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-1">
      {intent.quickActions.map(a => (
        <Link key={a.href} href={a.href}
          className="inline-flex items-center gap-1 bg-brand-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-brand-700">
          {tDich(a.label)} <ArrowRight className="w-3 h-3" />
        </Link>
      ))}
    </div>
  );
}
