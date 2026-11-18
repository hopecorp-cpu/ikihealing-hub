"use client";
import { useState, useTransition } from "react";
import { addManagerComment, markAsSeen } from "./actions";
import { fmtVND } from "@/lib/payroll";
import {
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, MessageCircle,
  Send, Eye, Smile, Frown, Meh, Battery, BatteryLow, X
} from "lucide-react";
import { useLang } from "@/components/lang-provider";

const MOOD_ICON: Record<string, { icon: any; color: string; label: string }> = {
  great:    { icon: Smile,  color: "text-emerald-600", label: "Tuyệt vời" },
  good:     { icon: Smile,  color: "text-green-600",   label: "Tốt" },
  ok:       { icon: Meh,    color: "text-yellow-600",  label: "Bình thường" },
  tired:    { icon: BatteryLow, color: "text-orange-600", label: "Mệt" },
  stressed: { icon: Frown,  color: "text-red-600",     label: "Căng thẳng" },
};

export function DailyReportAdminClient({ data, weeklyTrend }: any) {
  const { t } = useLang();
  const [expandedDept, setExpandedDept] = useState<string | null>(data.departments[0]?.id || null);
  const [filter, setFilter] = useState<"all" | "submitted" | "missing" | "blockers" | "unreviewed">("all");
  const [showReportId, setShowReportId] = useState<string | null>(null);

  const filteredDepts = data.departments.map((d: any) => {
    let filteredMembers = d.members;
    if (filter === "submitted") filteredMembers = d.members.filter((m: any) => m.report);
    else if (filter === "missing") filteredMembers = d.members.filter((m: any) => !m.report);
    else if (filter === "blockers") filteredMembers = d.members.filter((m: any) => m.report?.blockers);
    else if (filter === "unreviewed") filteredMembers = d.members.filter((m: any) => m.report && m.report.status !== "reviewed");
    return { ...d, filteredMembers };
  }).filter((d: any) => d.members.length > 0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-semibold">{t("% nộp báo cáo 7 ngày gần nhất")}</div>
          <div className="text-xs text-gray-500">{data.overall.totalUsers} {t("NV active")}</div>
        </div>
        <div className="flex gap-1.5 items-end h-20">
          {weeklyTrend.map((d: any) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] text-gray-400">{d.rate}%</div>
              <div className="w-full bg-gray-100 rounded-t flex items-end" style={{ height: "60px" }}>
                <div
                  className={`w-full rounded-t transition-all ${
                    d.rate >= 90 ? "bg-emerald-500" :
                    d.rate >= 70 ? "bg-yellow-500" :
                    d.rate > 0 ? "bg-red-500" : "bg-gray-300"
                  }`}
                  style={{ height: `${d.rate}%` }}
                  title={`${d.submitted}/${d.total}`}
                />
              </div>
              <div className="text-[10px] text-gray-500">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <Chip active={filter === "all"}        onClick={() => setFilter("all")}>{t("Tất cả")}</Chip>
        <Chip active={filter === "submitted"}  onClick={() => setFilter("submitted")} accent="emerald">
          {t("Đã nộp")} ({data.overall.submitted})
        </Chip>
        <Chip active={filter === "missing"}    onClick={() => setFilter("missing")} accent="red">
          {t("Chưa nộp")} ({data.overall.totalUsers - data.overall.submitted})
        </Chip>
        <Chip active={filter === "blockers"}   onClick={() => setFilter("blockers")} accent="orange">
          {t("Có vướng mắc")} ({data.overall.blockers})
        </Chip>
        <Chip active={filter === "unreviewed"} onClick={() => setFilter("unreviewed")} accent="blue">
          {t("Chưa review")} ({data.overall.submitted - data.overall.reviewed})
        </Chip>
      </div>

      <div className="space-y-3">
        {filteredDepts.map((d: any) => (
          <DeptAccordion
            key={d.id}
            dept={d}
            expanded={expandedDept === d.id}
            onToggle={() => setExpandedDept(expandedDept === d.id ? null : d.id)}
            onOpenReport={(id: string) => setShowReportId(id)}
          />
        ))}
        {data.unassigned.length > 0 && (
          <DeptAccordion
            dept={{
              id: "unassigned",
              name: t("Chưa thuộc phòng ban"),
              color: "#9CA3AF",
              members: data.unassigned,
              filteredMembers: data.unassigned.filter((m: any) => {
                if (filter === "submitted") return m.report;
                if (filter === "missing") return !m.report;
                if (filter === "blockers") return m.report?.blockers;
                if (filter === "unreviewed") return m.report && m.report.status !== "reviewed";
                return true;
              }),
              summary: {
                total: data.unassigned.length,
                submitted: data.unassigned.filter((m: any) => m.report).length,
                reviewed: data.unassigned.filter((m: any) => m.report?.status === "reviewed").length,
                rate: 0, totalRevenue: 0, totalCalls: 0, totalOrders: 0,
                blockers: data.unassigned.filter((m: any) => m.report?.blockers).map((m: any) => ({ user: m.full_name, text: m.report.blockers })),
              }
            }}
            expanded={expandedDept === "unassigned"}
            onToggle={() => setExpandedDept(expandedDept === "unassigned" ? null : "unassigned")}
            onOpenReport={(id: string) => setShowReportId(id)}
          />
        )}
      </div>

      {showReportId && (
        <ReportDetailModal
          reportId={showReportId}
          report={findReport(data, showReportId)}
          onClose={() => setShowReportId(null)}
        />
      )}
    </div>
  );
}

function findReport(data: any, reportId: string) {
  for (const d of data.departments) {
    for (const m of d.members) {
      if (m.report?.id === reportId) return { ...m.report, user: m };
    }
  }
  for (const m of data.unassigned) {
    if (m.report?.id === reportId) return { ...m.report, user: m };
  }
  return null;
}

function Chip({ active, onClick, accent, children }: any) {
  const colors: any = {
    emerald: active ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-200 text-emerald-700",
    red:     active ? "bg-red-600 text-white border-red-600" : "border-red-200 text-red-700",
    orange:  active ? "bg-orange-600 text-white border-orange-600" : "border-orange-200 text-orange-700",
    blue:    active ? "bg-blue-600 text-white border-blue-600" : "border-blue-200 text-blue-700",
  };
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-md border font-medium ${
        accent ? colors[accent] : (active ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-700")
      }`}>
      {children}
    </button>
  );
}

function DeptAccordion({ dept, expanded, onToggle, onOpenReport }: any) {
  const { t } = useLang();
  const s = dept.summary;
  const rateColor = s.rate >= 90 ? "text-emerald-600" : s.rate >= 70 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
      <button onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition text-left">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: dept.color + "22", color: dept.color }}>

        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold">{dept.name}</div>
          <div className="text-xs text-gray-500 flex flex-wrap gap-3 mt-0.5">
            <span><b className={rateColor}>{s.submitted}/{s.total}</b> {t("nộp")} ({s.rate}%)</span>
            {s.reviewed > 0 && <span>✓ {s.reviewed} {t("đã review")}</span>}
            {s.blockers.length > 0 && <span className="text-red-600 font-semibold">{s.blockers.length} {t("vướng mắc")}</span>}
            {s.totalRevenue > 0 && <span>{fmtVND(s.totalRevenue)}</span>}
            {s.totalCalls > 0 && <span>{s.totalCalls}</span>}
            {s.totalOrders > 0 && <span>{s.totalOrders}</span>}
          </div>
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {dept.filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">{t("Không có NV nào khớp filter")}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {dept.filteredMembers.map((m: any) => (
                <MemberRow key={m.id} member={m} onOpenReport={onOpenReport} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, onOpenReport }: any) {
  const { t } = useLang();
  const r = member.report;
  const mood = r?.mood ? MOOD_ICON[r.mood] : null;
  const MoodIcon = mood?.icon;

  return (
    <div className="p-3 hover:bg-gray-50 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
        {member.full_name?.[0] ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{member.full_name}</div>
        <div className="text-xs text-gray-500 truncate">
          {member.position}
          {r ? (
            <>
              {" · "}
              {r.hours_worked && <span>⏱ {r.hours_worked}h · </span>}
              {r.calls_made > 0 && <span>{r.calls_made} · </span>}
              {r.orders_closed > 0 && <span>{r.orders_closed} · </span>}
              {r.revenue_today > 0 && <span>{fmtVND(r.revenue_today)}</span>}
            </>
          ) : (
            <span className="text-red-500"> {t("· chưa nộp báo cáo")}</span>
          )}
        </div>
        {r?.blockers && (
          <div className="text-xs text-red-600 mt-1 italic truncate">
            {r.blockers.slice(0, 80)}{r.blockers.length > 80 && "..."}
          </div>
        )}
      </div>
      {mood && MoodIcon && (
        <div className={`text-xs ${mood.color} shrink-0`} title={t(mood.label)}>
          <MoodIcon className="w-5 h-5" />
        </div>
      )}
      {r ? (
        r.status === "reviewed" ? (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded shrink-0">
            <CheckCircle2 className="w-3 h-3 inline mr-1" />Reviewed
          </span>
        ) : (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded shrink-0">
            <MessageCircle className="w-3 h-3 inline mr-1" />Pending
          </span>
        )
      ) : (
        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded shrink-0">
          <XCircle className="w-3 h-3 inline mr-1" />Missing
        </span>
      )}
      {r && (
        <button onClick={() => onOpenReport(r.id)}
          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded font-medium inline-flex items-center gap-1 shrink-0">
          <Eye className="w-3 h-3" /> {t("Xem")}
        </button>
      )}
    </div>
  );
}

function ReportDetailModal({ reportId, report, onClose }: { reportId: string; report: any; onClose: () => void }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState(report?.manager_comment || "");
  const [msg, setMsg] = useState("");

  if (!report) return null;

  const submitComment = () => {
    if (comment.length < 3) { setMsg(t("Cần ≥3 ký tự")); return; }
    startTransition(async () => {
      const res = await addManagerComment(reportId, comment);
      if (res.success) { setMsg(t("Đã gửi")); setTimeout(() => location.reload(), 600); }
      else setMsg("" + (res as any).error);
    });
  };

  const mood = report.mood ? MOOD_ICON[report.mood] : null;
  const MoodIcon = mood?.icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex justify-between items-start">
          <div>
            <div className="font-bold text-lg">{report.user?.full_name}</div>
            <div className="text-sm text-gray-500">
              {report.user?.position} · {t("Báo cáo ngày")} {report.report_date}
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="flex gap-3 flex-wrap">
            {mood && MoodIcon && (
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 ${mood.color}`}>
                <MoodIcon className="w-4 h-4" />
                <span className="font-semibold">{t(mood.label)}</span>
              </div>
            )}
            {report.energy_level && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50">
                <Battery className="w-4 h-4 text-blue-600" />
                <span>{t("Năng lượng:")} {report.energy_level}/5</span>
              </div>
            )}
            {report.hours_worked && (
              <div className="px-3 py-1.5 rounded-lg bg-gray-50">⏱ {report.hours_worked}h</div>
            )}
          </div>

          {report.yesterday_done && (
            <Section title={t("Hôm nay đã làm gì")}>{report.yesterday_done}</Section>
          )}
          {report.today_plan && (
            <Section title={t("Ngày mai làm gì")}>{report.today_plan}</Section>
          )}
          {report.blockers && (
            <Section title={t("Vướng mắc")} tone="red">{report.blockers}</Section>
          )}
          {report.highlights && (
            <Section title={t("Điểm tự hào")}>{report.highlights}</Section>
          )}
          {report.learnings && (
            <Section title={t("Học được hôm nay")}>{report.learnings}</Section>
          )}

          {(report.calls_made > 0 || report.orders_closed > 0 || report.customer_interactions > 0) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="font-semibold text-purple-900 mb-2">{t("Sales metrics")}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><b>{t("Tương tác:")}</b> {report.customer_interactions || 0}</div>
                <div><b>{t("Gọi:")}</b> {report.calls_made || 0}</div>
                <div><b>{t("Chốt:")}</b> {report.orders_closed || 0}</div>
                <div><b>{t("Doanh thu:")}</b> {fmtVND(report.revenue_today || 0)}</div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="font-semibold mb-2">{t("Comment của bạn (Manager)")}</div>
            {report.manager_comment && report.status === "reviewed" ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="italic">"{report.manager_comment}"</div>
                <div className="text-xs text-gray-500 mt-1">
                  {t("✓ Đã review")} {report.reviewed_at && new Date(report.reviewed_at).toLocaleString("vi-VN")}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  placeholder={t("Feedback / khen / góp ý cho NV...")}
                  className="w-full p-2 border border-gray-200 rounded text-sm"
                />
                <div className="flex justify-end gap-2 items-center">
                  {msg && <span className="text-xs">{msg}</span>}
                  <button onClick={submitComment} disabled={pending}
                    className="px-4 py-2 bg-brand-600 text-white rounded text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-50">
                    <Send className="w-3 h-3" /> {t("Gửi + Đánh dấu reviewed")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, tone, children }: { title: string; tone?: "red"; children: React.ReactNode }) {
  const bg = tone === "red" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200";
  return (
    <div className={`${bg} border rounded-lg p-3`}>
      <div className="font-semibold mb-1 text-xs uppercase text-gray-600">{title}</div>
      <div className="whitespace-pre-wrap text-sm">{children}</div>
    </div>
  );
}
