"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock, X, ChevronRight, CalendarOff, FileText } from "lucide-react";
import type { AttendanceReminderStatus } from "@/lib/attendance-status";
import { vnDateStr } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

const DISMISS_KEY_PREFIX = "acme-att-reminder-dismiss";

function getDismissKey(type: string) {
  const today = vnDateStr();
  return `${DISMISS_KEY_PREFIX}-${type}-${today}`;
}

export function AttendanceReminder({ status }: { status: AttendanceReminderStatus | null }) {
  const { t } = useLang();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const types = ["check_in", "check_out", "unclosed", "daily_report"];
    const d = new Set<string>();
    for (const t of types) {
      if (typeof window !== "undefined" && sessionStorage.getItem(getDismissKey(t))) {
        d.add(t);
      }
    }
    setDismissed(d);
  }, []);

  if (!mounted || !status) return null;

  if (pathname === "/cham-cong") return null;
  if (pathname === "/daily-report") return null;

  const dismiss = (type: string) => {
    sessionStorage.setItem(getDismissKey(type), "1");
    setDismissed(new Set([...Array.from(dismissed), type]));
  };

  const banners: Array<{ key: string; node: JSX.Element }> = [];

  if (status.needsCheckIn && !dismissed.has("check_in")) {
    const lateMinutes = (status.currentVnHour - 8) * 60 + status.currentVnMinute;
    banners.push({
      key: "check_in",
      node: (
        <BannerCard
          tone="red"
          icon={<AlertTriangle className="w-5 h-5" />}
          title={t("Bạn chưa check-in hôm nay")}
          message={
            <>
              {t("Đã quá giờ làm")} <b>{lateMinutes > 0 ? `${lateMinutes} ${t("phút")}` : ""}</b>.
              {lateMinutes > 5 && <> {t("Quên check-in sẽ")} <b>{t("bị phạt 50.000đ")}</b>.</>}
              {" "}{t("Bấm vào đây để chấm công ngay.")}
            </>
          }
          cta={t("Chấm công ngay")}
          onDismiss={() => dismiss("check_in")}
        />
      ),
    });
  }

  if (status.needsDailyReport && !dismissed.has("daily_report")) {
    banners.push({
      key: "daily_report",
      node: (
        <DailyReportBanner
          currentVnHour={status.currentVnHour}
          currentVnMinute={status.currentVnMinute}
          onDismiss={() => dismiss("daily_report")}
        />
      ),
    });
  }

  if (status.needsCheckOut && !dismissed.has("check_out")) {
    banners.push({
      key: "check_out",
      node: (
        <BannerCard
          tone="orange"
          icon={<Clock className="w-5 h-5" />}
          title={t("Bạn chưa check-out hôm nay")}
          message={
            <>
              {t("Đã")} <b>{status.currentVnHour}:{String(status.currentVnMinute).padStart(2, "0")}</b>.
              {" "}{t("Quên check-out sẽ")} <b>{t("bị phạt 50.000đ")}</b>.
            </>
          }
          cta={t("Check-out ngay")}
          onDismiss={() => dismiss("check_out")}
        />
      ),
    });
  }

  if (status.unclosedDaysCount > 0 && !dismissed.has("unclosed")) {
    banners.push({
      key: "unclosed",
      node: (
        <BannerCard
          tone="yellow"
          icon={<CalendarOff className="w-5 h-5" />}
          title={`${status.unclosedDaysCount} ${t("ngày cũ chưa check-out")}`}
          message={
            <>
              {t("Các ngày:")} <b>{status.unclosedDays.join(", ")}</b>
              {status.unclosedDaysCount > 3 && ` (+${status.unclosedDaysCount - 3})`}.
              {" "}{t('Vào trang chấm công bấm "Xin sửa chấm công" để admin duyệt.')}
            </>
          }
          cta={t("Xin sửa")}
          onDismiss={() => dismiss("unclosed")}
        />
      ),
    });
  }

  if (banners.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {banners.map(b => <div key={b.key}>{b.node}</div>)}
    </div>
  );
}

function DailyReportBanner({
  currentVnHour, currentVnMinute, onDismiss,
}: {
  currentVnHour: number;
  currentVnMinute: number;
  onDismiss: () => void;
}) {
  const { t } = useLang();
  const time = `${currentVnHour}:${String(currentVnMinute).padStart(2, "0")}`;

  const afterCheckoutTime = currentVnHour > 17 || (currentVnHour === 17 && currentVnMinute >= 30);
  return (
    <div className={`border-2 rounded-xl p-3 flex items-center gap-3 shadow-sm ${
      afterCheckoutTime
        ? "bg-amber-50 border-amber-400 text-amber-900 animate-pulse"
        : "bg-amber-50 border-amber-300 text-amber-900"
    }`}>
      <div className="shrink-0"><FileText className="w-5 h-5" /></div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">
          {t("Bạn chưa làm báo cáo cuối ngày hôm nay")}
        </div>
        <div className="text-xs mt-0.5">
          {t("Đã")} <b>{time}</b>.{" "}
          {afterCheckoutTime
            ? <>{t("Vẫn check-out được, nhưng")} <b>{t("đừng quên nộp báo cáo")}</b> {t("nhé. Bấm vào đây để làm ngay.")}</>
            : <>{t("Nhớ làm báo cáo cuối ngày trước khi về nhé.")}</>
          }
        </div>
      </div>
      <Link
        href="/daily-report"
        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 shrink-0"
      >
        {t("Làm báo cáo")} <ChevronRight className="w-3 h-3" />
      </Link>
      <button
        onClick={onDismiss}
        className="opacity-50 hover:opacity-100 p-1 shrink-0"
        title={t("Đóng nhắc nhở hôm nay")}
        aria-label={t("Đóng")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function BannerCard({
  tone, icon, title, message, cta, onDismiss,
}: {
  tone: "red" | "orange" | "yellow";
  icon: JSX.Element;
  title: string;
  message: JSX.Element;
  cta: string;
  onDismiss: () => void;
}) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const styles = {
    red:    { bg: "bg-red-50",    border: "border-red-300",    text: "text-red-900",    btn: "bg-red-600 hover:bg-red-700" },
    orange: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-900", btn: "bg-orange-600 hover:bg-orange-700" },
    yellow: { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-900", btn: "bg-yellow-600 hover:bg-yellow-700" },
  }[tone];

  return (
    <div className={`${styles.bg} ${styles.border} ${styles.text} border-2 rounded-xl p-3 flex items-center gap-3 shadow-sm ${tone === "red" ? "animate-pulse" : ""}`}>
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{title}</div>
        <div className="text-xs mt-0.5">{message}</div>
      </div>
      <Link
        href="/cham-cong"
        className={`${styles.btn} text-white px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 shrink-0`}
      >
        {cta} <ChevronRight className="w-3 h-3" />
      </Link>
      <button
        onClick={onDismiss}
        className="opacity-50 hover:opacity-100 p-1 shrink-0"
        title={t("Đóng nhắc nhở hôm nay")}
        aria-label={t("Đóng")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
