"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, StatCard, Badge, Card } from "@/components/ui/kit";
import { Users, Phone, Clock, Repeat, CheckCircle2, AlertTriangle, Settings, ExternalLink, Shuffle, DownloadCloud, MessageSquare, History } from "lucide-react";
import { contactLead, setLeadStatus, reassignLead, saveLeadConfigAction } from "./actions";
import { PHAN_HOI, nhanKieu, nhanPhanHoi, sdt0, type DongCham, type MaPhanHoi } from "@/lib/quiz-cham-soc";

function SyncButton() {
  const { t: t } = useLang();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={async () => { setLoading(true); setMsg(""); try { const r = await (await fetch("/api/cron/leads-sync")).json(); setMsg(`+${(r.fb_new || 0) + (r.zalo_new || 0)} lead mới`); setTimeout(() => location.reload(), 900); } catch { setMsg(t("lỗi")); } finally { setLoading(false); } }}
        disabled={loading} className="text-[12px] px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-60">
        <DownloadCloud className="w-3.5 h-3.5" />{loading ? t("Đang kéo…") : t("Kéo lead ngay")}</button>
      {msg && <span className="text-[12px] text-emerald-600">{msg}</span>}
    </div>
  );
}

const STATUS: Record<string, { label: string; tone: any }> = {
  new: { label: "Mới", tone: "slate" }, contacted: { label: "Đã liên hệ", tone: "blue" },
  caring: { label: "Đang chăm", tone: "violet" }, won: { label: "Chốt", tone: "green" }, lost: { label: "Rớt", tone: "red" },
};
function ago(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso), mm = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0"), mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}
const minsSince = (iso: string | null) => iso ? (Date.now() - new Date(iso).getTime()) / 60000 : 0;

function fmtLuc(iso: string) {
  try { return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }); } catch { return ""; }
}

function BaoCaoBox({ l, nhatKy }: { l: any; nhatKy: DongCham[] }) {
  const { t: t } = useLang();
  const router = useRouter();
  const [phanHoi, setPhanHoi] = useState<MaPhanHoi | "">("");
  const [chu, setChu] = useState("");
  const [dangLuu, setDangLuu] = useState(false);
  const [bao, setBao] = useState<{ ok: boolean; text: string } | null>(null);
  const [xemHet, setXemHet] = useState(false);

  if (!sdt0(l.phone)) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[13px] text-gray-500">
        {t("Lead này chưa có số điện thoại hợp lệ nên chưa ghi được báo cáo (nhật ký chăm sóc lưu theo SĐT).\n        Xin số của khách trong hộp thư rồi quay lại đây.")}
      </div>
    );
  }

  async function luu() {
  const { t: t } = useLang();
    setDangLuu(true); setBao(null);
    try {
      const r = await fetch("/api/quiz-leads/cham-soc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viec: "phan-hoi", leadId: l.id, phone: l.phone, ten: l.customer_name || "",
          phanHoi, ghiChu: chu.trim(),

          kenh: String(l.external_id || l.source || "lead").split(":")[0].slice(0, 40),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setBao({ ok: false, text: j?.loi || `Lưu hỏng (${r.status})` }); return; }
      setBao({ ok: true, text: t("Đã lưu báo cáo") });
      setChu(""); setPhanHoi("");
      router.refresh();
    } catch (e: any) {
      setBao({ ok: false, text: "Không gửi được: " + String(e?.message || e) });
    } finally { setDangLuu(false); }
  }

  const hien = xemHet ? nhatKy : nhatKy.slice(0, 2);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div>
        <div className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-sky-600" /> {t("Báo cáo tình hình khách")}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {PHAN_HOI.map((p) => (
            <button key={p.ma} type="button" onClick={() => setPhanHoi((c) => (c === p.ma ? "" : p.ma))}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${phanHoi === p.ma ? "text-white bg-gray-900 border-gray-900" : p.cls}`}>
              {t(p.nhan)}
            </button>
          ))}
        </div>
        <textarea value={chu} onChange={(e) => setChu(e.target.value)} rows={2}
          placeholder={t("Ghi chú: khách nói gì, vướng gì, hẹn khi nào, đã gửi gì… (bắt buộc, để người sau đọc là hiểu)")}
          className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px]" />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button type="button" disabled={dangLuu || !phanHoi || chu.trim().length < 5} onClick={luu}
            className="text-[13px] font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl px-3.5 py-1.5 disabled:opacity-40">
            {dangLuu ? t("Đang lưu…") : t("Lưu báo cáo")}
          </button>
          {bao && <span className={`text-xs font-semibold ${bao.ok ? "text-emerald-600" : "text-rose-600"}`}>{bao.text}</span>}
          {!phanHoi && <span className="text-xs text-gray-400">{t("Chọn một tình trạng ở trên rồi ghi chú.")}</span>}
        </div>
      </div>

      {nhatKy.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <button type="button" onClick={() => setXemHet((v) => !v)} className="text-xs font-semibold text-gray-500 inline-flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> {t("Nhật ký chăm sóc (")}{nhatKy.length})
          </button>
          <div className="mt-2 space-y-1.5">
            {hien.map((d, i) => (
              <div key={i} className="text-[13px] leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
                <div className="text-gray-500 text-xs">
                  {fmtLuc(d.luc)} · {nhanKieu(d.kieu) || t("ghi chú")}{d.phanHoi ? ` · ${nhanPhanHoi(d.phanHoi) || d.phanHoi}` : ""}{d.nguoi ? ` · ${d.nguoi}` : ""}
                </div>
                {t(d.noiDung) && <div className="text-gray-700 mt-0.5 whitespace-pre-wrap">{t(d.noiDung)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadRow({ l, name, canSeeAll, meId, sales, slaMin, nhatKy = [] }: any) {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [moRong, setMoRong] = useState(false);
  const isMine = l.assignee_id === meId;
  const overdue = l.status === "new" && !l.first_contact_at && minsSince(l.assigned_at) > slaMin;
  const st = STATUS[l.status] || STATUS.new;
  const gan: DongCham | undefined = nhatKy[0];
  return (
    <>
    <tr className={`border-b border-gray-50 hover:bg-gray-50/60 ${overdue ? "bg-rose-50/40" : ""}`}>
      <td className="px-2 py-2 text-[12px] text-gray-500 whitespace-nowrap">{ago(l.assigned_at)}</td>
      <td className="px-2 py-2 text-[13px] font-medium text-gray-800">
        {l.customer_name || "—"}
        {l.ma_ctv && <div className="mt-0.5"><Badge tone="violet">CTV {l.ma_ctv}</Badge></div>}
      </td>
      <td className="px-2 py-2 text-[12px] text-gray-600 whitespace-nowrap">{l.phone || "—"}</td>
      <td className="px-2 py-2 text-[12px] font-semibold text-emerald-700 whitespace-nowrap">{name || t("(chưa chia)")}</td>
      <td className="px-2 py-2 text-[12px] text-gray-500 max-w-[140px] truncate">{l.source || "—"}</td>
      <td className="px-2 py-2 text-[12px] text-gray-500">{l.product || "—"}</td>
      <td className="px-2 py-2 text-center">
        <span className={`text-[12px] font-bold ${l.share_count > 1 ? "text-rose-600" : "text-gray-400"}`}>{l.share_count}</span>
      </td>
      <td className="px-2 py-2">
        <Badge tone={overdue ? "red" : st.tone}>{overdue ? t("Quá hạn") : t(st.label)}</Badge>
        {gan && (
          <div className="text-[11px] text-gray-500 mt-1 max-w-[180px]">
            <span className="font-semibold text-gray-600">{nhanPhanHoi(gan.phanHoi) || nhanKieu(gan.kieu) || t("ghi chú")}</span>
            {t(gan.noiDung) ? <span className="block truncate" title={t(gan.noiDung)}>{t(gan.noiDung)}</span> : null}
          </div>
        )}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5 justify-end flex-wrap">
          {(isMine || canSeeAll) && l.status === "new" && (
            <button onClick={() => start(async () => { await contactLead(l.id); })} disabled={pending}
              className="text-[11px] px-2 py-1 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 className="w-3 h-3" />{t("Đã liên hệ")}</button>
          )}
          {(isMine || canSeeAll) && l.status !== "new" && l.status !== "won" && l.status !== "lost" && (
            <select defaultValue={l.status} onChange={(e) => start(async () => { await setLeadStatus(l.id, e.target.value as any); })}
              className="text-[11px] px-1.5 py-1 rounded-lg border border-gray-200">
              <option value="contacted">{t("Đã liên hệ")}</option><option value="caring">{t("Đang chăm")}</option>
              <option value="won">{t("Chốt ✓")}</option><option value="lost">{t("Rớt")}</option>
            </select>
          )}
          {(isMine || canSeeAll) && (
            <button onClick={() => setMoRong((v) => !v)}
              title={t("Ghi báo cáo: khách không nghe máy / không có nhu cầu / chưa kết bạn Zalo… kèm ghi chú")}
              className={`text-[11px] px-2 py-1 rounded-lg font-semibold inline-flex items-center gap-1 ${moRong ? "bg-sky-600 text-white" : "bg-sky-50 text-sky-700 hover:bg-sky-100"}`}>
              <MessageSquare className="w-3 h-3" />{t("Báo cáo")}</button>
          )}
          {canSeeAll && (
            <button onClick={() => start(async () => { await reassignLead(l.id); })} disabled={pending}
              title={t("Chia lại cho sale khác (ít lead nhất)")}
              className="text-[11px] px-2 py-1 bg-gray-100 text-gray-600 rounded-lg inline-flex items-center gap-1 hover:bg-gray-200 disabled:opacity-60"><Shuffle className="w-3 h-3" />{t("Chia lại")}</button>
          )}
          {l.pancake_link && <a href={l.pancake_link} target="_blank" rel="noreferrer" title={t("Mở hộp thư Meta Business Suite")} className="text-[11px] text-blue-600 inline-flex items-center gap-0.5">Business Suite<ExternalLink className="w-3 h-3" /></a>}
          {l.pancake_thread_link && <a href={l.pancake_thread_link} target="_blank" rel="noreferrer" title={t("Mở đúng hội thoại trong Pancake (tốt cho điện thoại)")} className="text-[11px] text-emerald-700 inline-flex items-center gap-0.5">Pancake<ExternalLink className="w-3 h-3" /></a>}
        </div>
      </td>
    </tr>
    {moRong && (
      <tr className="border-b border-gray-100 bg-gray-50/60">
        <td colSpan={9} className="px-3 py-3"><BaoCaoBox l={l} nhatKy={nhatKy} /></td>
      </tr>
    )}
    </>
  );
}

function ConfigForm({ cfg }: { cfg: any }) {
  const { t: t } = useLang();
  const [open, setOpen] = useState(false);
  const [sla, setSla] = useState(String(cfg.slaMinutes));
  const [re, setRe] = useState(String(cfg.reassignMinutes));
  const [auto, setAuto] = useState(cfg.autoReassign);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="text-[12px] text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"><Settings className="w-3.5 h-3.5" />{t("Cấu hình chia lead")}</button>;
  return (
    <div className="border border-gray-200 rounded-xl p-3 flex flex-wrap items-end gap-3 bg-gray-50/50">
      <label className="text-[12px] text-gray-600">{t("Gọi sớm nếu liên hệ trong (phút)")}
        <input value={sla} onChange={(e) => { setSla(e.target.value.replace(/\D/g, "")); setSaved(false); }} className="ml-2 w-16 px-2 py-1 rounded border border-gray-200 text-xs" /></label>
      <label className="text-[12px] text-gray-600">{t("Tự chia lại sau (phút)")}
        <input value={re} onChange={(e) => { setRe(e.target.value.replace(/\D/g, "")); setSaved(false); }} className="ml-2 w-16 px-2 py-1 rounded border border-gray-200 text-xs" /></label>
      <label className="text-[12px] text-gray-600 inline-flex items-center gap-1">
        <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); setSaved(false); }} />{t("Bật tự chia lại")}</label>
      <button onClick={() => start(async () => { await saveLeadConfigAction({ slaMinutes: +sla, reassignMinutes: +re, autoReassign: auto }); setSaved(true); })}
        disabled={pending} className="text-[12px] px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">{t("Lưu")}</button>
      {saved && <span className="text-emerald-600 text-[12px]">{t("✓ đã lưu")}</span>}
      <button onClick={() => setOpen(false)} className="text-[12px] text-gray-400">{t("Đóng")}</button>
    </div>
  );
}

export default function LeadsClient({ leads, sales, idMap, stats, cfg, canSeeAll, meId, tableReady, month, nhatKy = {} }: any) {
  const { t: t } = useLang();
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const filtered = useMemo(() => (leads || []).filter((l: any) => {
    if (fStatus !== "all" && l.status !== fStatus) return false;
    if (q) { const s = (l.customer_name + " " + l.phone + " " + l.source + " " + l.product).toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  }), [leads, q, fStatus]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <PageHeader title="Chia lead" icon={Users} iconColor="#10B981"
        subtitle={`Tự chia lead cho sale ít lead nhất · gọi sớm trong ${cfg.slaMinutes}' · quá ${cfg.reassignMinutes}' chưa liên hệ tự chia lại`}
        actions={canSeeAll ? <ConfigForm cfg={cfg} /> : undefined} />

      {canSeeAll && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="text-[13px] text-emerald-900"><b>{t("Hút lead mới")}</b> {t("từ Zalo (Salework) + Fanpage/Pancake vào pool rồi tự chia cho sale. Sau khi bấm, hệ tự kéo mỗi 30 phút.")}</div>
          <SyncButton />
        </div>
      )}

      {!tableReady && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[13px] text-amber-800">
          <b>{t("Chưa tạo bảng lead.")}</b> {t("Anh vào Supabase → SQL Editor → dán nội dung file")} <code>supabase/migrations/036_leads.sql</code> {t("→ Run (hoặc chạy")} <code>node scripts/run-migration-036.mjs</code> {t("để lấy SQL). Sau đó tải lại trang là chạy.")}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("Lead tháng này")} value={String(stats.totalLeads)} icon={Users} color="#10B981" hint={`${month}`} />
        <StatCard label={t("Chưa chia được")} value={String(stats.unassigned)} icon={AlertTriangle} color={stats.unassigned ? "#F59E0B" : "#10B981"} hint={t("thiếu sale nhận")} />
        <StatCard label={`Quá ${stats.slaMinutes}' chưa liên hệ`} value={String(stats.overSla)} icon={Clock} color={stats.overSla ? "#EF4444" : "#10B981"} hint={t("cần gọi gấp")} />
        <StatCard label={t("Lead bị chia lại")} value={String(stats.reassignedLeads)} icon={Repeat} color={stats.reassignedLeads ? "#F59E0B" : "#10B981"} hint={t("ai đó chậm chăm")} />
      </div>

      {canSeeAll && stats.perSale.length > 0 && (
        <Card>
          <div className="font-bold text-gray-900 mb-2 text-sm">{t("Điểm chăm lead theo sale —")} {month}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left px-2 py-1.5">Sale</th><th className="text-right px-2 py-1.5">Lead</th>
                <th className="text-right px-2 py-1.5">{t("Đã liên hệ")}</th><th className="text-right px-2 py-1.5">{t("% gọi sớm")}</th>
                <th className="text-right px-2 py-1.5">{t("Phản hồi TB")}</th><th className="text-right px-2 py-1.5">{t("Chốt")}</th><th className="text-right px-2 py-1.5">{t("Bị chia lại")}</th>
              </tr></thead>
              <tbody>
                {stats.perSale.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-2 py-1.5 font-medium text-gray-800">{s.name}</td>
                    <td className="px-2 py-1.5 text-right">{s.total}</td>
                    <td className="px-2 py-1.5 text-right">{s.contacted}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${s.onTimePct >= 70 ? "text-emerald-600" : s.onTimePct >= 40 ? "text-amber-600" : "text-rose-600"}`}>{s.onTimePct}%</td>
                    <td className="px-2 py-1.5 text-right">{s.avgRespMin != null ? `${s.avgRespMin}'` : "—"}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-700 font-semibold">{s.won}</td>
                    <td className={`px-2 py-1.5 text-right ${s.reassignedIn ? "text-rose-600" : "text-gray-400"}`}>{s.reassignedIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="p-3 flex flex-wrap items-center gap-2 border-b border-gray-100">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Tìm khách / SĐT / nguồn…")} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm flex-1 min-w-[180px]" />
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm">
            <option value="all">{t("Tất cả trạng thái")}</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
          </select>
          <span className="text-[12px] text-gray-400">{filtered.length} lead</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="text-[11px] text-gray-400 border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-2 py-2 font-semibold">{t("THỜI GIAN CHIA")}</th><th className="text-left px-2 py-2 font-semibold">{t("KHÁCH")}</th>
              <th className="text-left px-2 py-2 font-semibold">{t("SĐT")}</th><th className="text-left px-2 py-2 font-semibold">{t("SALE NHẬN")}</th>
              <th className="text-left px-2 py-2 font-semibold">{t("NGUỒN")}</th><th className="text-left px-2 py-2 font-semibold">SP</th>
              <th className="text-center px-2 py-2 font-semibold">{t("LẦN CHIA")}</th><th className="text-left px-2 py-2 font-semibold">{t("TRẠNG THÁI")}</th><th className="px-2 py-2"></th>
            </tr></thead>
            <tbody>
              {filtered.map((l: any) => <LeadRow key={l.id} l={l} name={idMap[l.assignee_id]} canSeeAll={canSeeAll} meId={meId} sales={sales} slaMin={cfg.slaMinutes} nhatKy={nhatKy[sdt0(l.phone) || ""] || []} />)}
              {!filtered.length && <tr><td colSpan={9} className="text-center text-gray-400 py-10 text-sm">{tableReady ? t("Chưa có lead nào. Cắm webhook /api/leads/ingest hoặc để Pancake đẩy về.") : t("Chạy migration 036 để bắt đầu.")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
