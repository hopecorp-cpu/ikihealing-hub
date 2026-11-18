"use client";
import { useState, useEffect, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/notifications";
import { useLang } from "@/components/lang-provider";

export function NotificationBell() {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const data = await getMyNotifications();
      setItems(data.items);
      setUnread(data.unread);
    });
  };

  useEffect(() => {
    load();

    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 300000);
    const khiHien = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", khiHien);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", khiHien); };
  }, []);

  const onItemClick = async (item: any) => {
    if (!item.read) {
      await markNotificationRead(item.id);
      load();
    }
    if (item.action_url) {
      window.location.href = item.action_url;
    }
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    load();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 hover:bg-gray-100 rounded-lg relative">
        <Bell className="w-4 h-4 text-gray-700" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-40 max-h-[500px] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-sm">{t("Thông báo")} ({unread} {t("chưa đọc")})</h3>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                  <CheckCheck className="w-3 h-3" /> {t("Đánh dấu đọc hết")}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {t("Chưa có thông báo nào")}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map(n => (
                  <button key={n.id} onClick={() => onItemClick(n)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition ${!n.read ? "bg-blue-50/50" : ""}`}>
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        {tDich(n.title) && <div className="font-semibold text-sm">{tDich(n.title)}</div>}
                        <div className="text-sm text-gray-600 line-clamp-2">{n.content}</div>
                        <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("vi-VN")}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
