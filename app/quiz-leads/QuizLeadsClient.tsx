"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Mail, Copy, Check, Activity, Gift, ShieldAlert, UtensilsCrossed, ChevronDown, ChevronUp, MessageSquare, History } from "lucide-react";
import { KIEU_CHAM, PHAN_HOI, nhanKieu, nhanPhanHoi, type DongCham, type MaPhanHoi } from "@/lib/quiz-cham-soc";

const DIMS: Record<string, string> = {
  nangluong: "Năng lượng", giacngu: "Giấc ngủ", tieuhoa: "Tiêu hoá & bài tiết",
  anuong: "Ăn uống", vandong: "Vận động", tinhthan: "Tinh thần",
};
function band(v: number) { return v >= 67 ? "ok" : v >= 40 ? "warn" : "alert"; }
function bandLabel(v: number) { return v >= 67 ? "Đang ổn" : v >= 40 ? "Cần chú ý" : "Nên ưu tiên"; }
const bandCls: Record<string, string> = {
  ok: "text-emerald-600 bg-emerald-50", warn: "text-amber-600 bg-amber-50", alert: "text-rose-600 bg-rose-50",
};

function fmtTime(ts: number) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}
function normPhone(p?: string) { return (p || "").replace(/[^\d]/g, "").replace(/^84/, "0"); }

type Lead = {
  id: string; ts: number; name: string; email: string; phone?: string;
  profile: string; profileName?: string; overall: number;
  dims: Record<string, number>; pkg?: string | null;
  vat?: { company?: string; taxCode?: string; email?: string } | null; source: string;
};
type Sol = {
  name: string; dauHieu: string; mealFocus: string; sanPham: string;
  comboTrongGoi: string; tuVan30: string[]; appNova: string; upsell: string;
};
type MealDay = { d: number; sang: string; trua: string; toi: string; phu?: string };
type MealPlan = { ten: string; nguyenTac?: string; luuY?: string | string[]; ngay: MealDay[] };
function luuYText(v?: string | string[]) { return Array.isArray(v) ? v.join(" ") : (v || ""); }

function mealPlanText(name: string, mp: MealPlan) {
  const head = [`THỰC ĐƠN 14 NGÀY — ${mp.ten}`, name ? `Gửi ${name}` : "", mp.nguyenTac ? `Nguyên tắc: ${mp.nguyenTac}` : "", ""];
  const days = (mp.ngay || []).map((x) =>
    `Ngày ${x.d}\n- Sáng: ${x.sang}\n- Trưa: ${x.trua}\n- Tối: ${x.toi}${x.phu ? `\n- Phụ: ${x.phu}` : ""}`
  );
  const ly = luuYText(mp.luuY);
  const tail = ly ? ["", `Lưu ý: ${ly}`] : [];
  return [...head.filter((l, i) => l !== "" || i === 3), ...days, ...tail].join("\n");
}

type ChamSoc = { status: string; cham: boolean; sale: string | null; ngay: string | null };
function sdtChuan(p?: string) {
  let d = (p || "").replace(/\D/g, ""); if (d.startsWith("84")) d = "0" + d.slice(2); if (!d.startsWith("0")) d = "0" + d; return d;
}

function fmtLuc(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function ChamSocBox({ phone, ten, nhatKy }: { phone?: string; ten: string; nhatKy: DongCham[] }) {
  const { t: t } = useLang();
  const router = useRouter();
  const [phanHoi, setPhanHoi] = useState<MaPhanHoi | "">("");
  const [chu, setChu] = useState("");
  const [ban, setBan] = useState("");
  const [bao, setBao] = useState<{ ok: boolean; text: string } | null>(null);
  const [xemHet, setXemHet] = useState(false);

  if (!phone) {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[13px] text-gray-500">
        {t("Khách mới để email, chưa có số điện thoại nên chưa ghi được lượt chăm sóc. Gửi email trước, xin số rồi quay lại đây.")}
      </div>
    );
  }

  async function gui(than: any, dangLam: string) {
    setBan(dangLam); setBao(null);
    try {
      const r = await fetch("/api/quiz-leads/cham-soc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, ten, ...than }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setBao({ ok: false, text: j?.loi || `Lưu hỏng (${r.status})` }); return; }
      setBao({ ok: true, text: j?.trongMayChia === false ? "Đã ghi (khách này chưa vào máy chia lead)" : "Đã ghi" });
      if (than.viec === "phan-hoi") { setChu(""); setPhanHoi(""); }
      router.refresh();
    } catch (e: any) {
      setBao({ ok: false, text: "Không gửi được: " + String(e?.message || e) });
    } finally { setBan(""); }
  }

  const gan = nhatKy[0];
  const hien = xemHet ? nhatKy : nhatKy.slice(0, 1);

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div>
        <div className="text-[13px] font-bold text-gray-900">{t("Cập nhật chăm sóc")}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {gan ? `Lần gần nhất: ${nhanKieu(gan.kieu) || t("ghi chú")} · ${fmtLuc(gan.luc)}${gan.nguoi ? ` · ${gan.nguoi}` : ""}` : t("Chưa ghi lượt chăm sóc nào.")}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {KIEU_CHAM.map((k) => (
            <button key={k.ma} disabled={!!ban} onClick={() => gui({ viec: "cham", kieu: k.ma }, k.ma)}
              className="text-[13px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50">
              {ban === k.ma ? t("Đang ghi…") : t(k.nhan)}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5">
          <MessageSquare size={14} className="text-sky-600" /> {t("Khách phản hồi thế nào?")}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {PHAN_HOI.map((p) => (
            <button key={p.ma} onClick={() => setPhanHoi((c) => (c === p.ma ? "" : p.ma))}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${phanHoi === p.ma ? "text-white bg-gray-900 border-gray-900" : p.cls}`}>
              {t(p.nhan)}
            </button>
          ))}
        </div>
        <textarea value={chu} onChange={(e) => setChu(e.target.value)} rows={2}
          placeholder={t("Khách nói gì, đang vướng gì, hẹn khi nào… (bắt buộc, để người sau đọc là hiểu tình hình)")}
          className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px]" />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button disabled={!!ban || !phanHoi || chu.trim().length < 5}
            onClick={() => gui({ viec: "phan-hoi", phanHoi, ghiChu: chu.trim() }, "phan-hoi")}
            className="text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl px-3.5 py-2 disabled:opacity-40">
            {ban === "phan-hoi" ? t("Đang lưu…") : t("Lưu tình trạng phản hồi")}
          </button>
          {bao && <span className={`text-xs font-semibold ${bao.ok ? "text-emerald-600" : "text-rose-600"}`}>{bao.text}</span>}
        </div>
      </div>

      {nhatKy.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <button onClick={() => setXemHet((v) => !v)} className="text-xs font-semibold text-gray-500 inline-flex items-center gap-1.5">
            <History size={13} /> {t("Nhật ký chăm sóc (")}{nhatKy.length}) {xemHet ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
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

export default function QuizLeadsClient({ leads, chamSoc = {}, nhatKy = {}, solutions, guardrails, mealPlans }: {
  leads: Lead[]; chamSoc?: Record<string, ChamSoc>; nhatKy?: Record<string, DongCham[]>;
  solutions: Record<string, Sol>; guardrails: string[]; mealPlans: Record<string, MealPlan>;
}) {
  const { t: t } = useLang();
  const [copied, setCopied] = useState<string | null>(null);
  const [openMeal, setOpenMeal] = useState<string | null>(null);
  const [q, setQ] = useState("");

  function buildScript(l: Lead, s: Sol) {
    const ph = l.phone ? ` (${l.phone})` : "";
    const lines = [
      `Chào ${l.name || "anh/chị"}${ph}, em bên NOVA đây ạ.`,
      `Kết quả kiểm tra của mình nghiêng về hồ sơ "${s.name}" — ${s.dauHieu}`,
      ``,
      `Gợi ý chăm sóc cho mình:`,
      `• Ăn uống: ${s.mealFocus}`,
      `• Đồng hành: ${s.sanPham}`,
      `• App NOVA: ${s.appNova}`,
      ``,
      s.tuVan30[0],
      ``,
      `Em gửi mình thực đơn 21 ngày theo đúng hồ sơ này nhé. Bên em đang tặng cẩm nang + app NOVA đồng hành ạ.`,
    ];
    return lines.join("\n");
  }
  function copy(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800); });
  }

  const filtered = leads.filter((l) => {
    if (!q.trim()) return true;
    const s = (l.name + " " + (l.phone || "") + " " + l.email + " " + (l.profileName || "")).toLowerCase();
    return s.includes(q.toLowerCase().trim());
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-gray-700 font-semibold"><Activity size={18} className="text-emerald-600" /> {leads.length} {t("khách từ Quiz")}</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Tìm tên / SĐT / thể trạng…")}
          className="ml-auto w-full sm:w-64 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[13px] text-amber-800 flex gap-2">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <div><b>{t("Tuân thủ khi tư vấn:")}</b> {guardrails.join(" ")}</div>
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-400">{t("Chưa có khách nào từ quiz.")}</div>
      )}

      {filtered.map((l) => {
  const { t: t } = useLang();
        const s = solutions[l.profile];
        const mp = mealPlans?.[l.profile];
        const mealOpen = openMeal === l.id;
        const weak = Object.keys(l.dims || {}).sort((a, b) => (l.dims[a] ?? 0) - (l.dims[b] ?? 0)).filter((d) => (l.dims[d] ?? 0) < 67);
        const isOrder = l.source?.startsWith("quiz-order");
        const cs = l.phone ? chamSoc[sdtChuan(l.phone)] : undefined;
        const nk = (l.phone ? nhatKy[sdtChuan(l.phone)] : undefined) || [];
        const phanHoiCuoi = nk.find((d) => d.phanHoi);
        const gioCho = Math.round((Date.now() - l.ts) / 36e5);
        return (
          <div key={l.id} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-bold text-gray-900 text-[15px]">{l.name || t("(chưa tên)")} </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {s?.name || l.profileName || l.profile} {t("· điểm tổng")} {l.overall}/100 · {fmtTime(l.ts)}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {isOrder && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">{t("Đã chọn gói")}</span>}
                {!l.phone ? (
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{t("Chỉ có email")}</span>
                ) : cs?.cham ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">{t("Đã chạm")}{cs.sale ? ` · ${cs.sale}` : ""}</span>
                ) : cs ? (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gioCho >= 24 ? "text-rose-700 bg-rose-50" : "text-amber-700 bg-amber-50"}`}>
                    {t("Chưa ai chạm ·")} {gioCho >= 24 ? `${Math.floor(gioCho / 24)} ngày` : `${gioCho}h`}{cs.sale ? ` · giao ${cs.sale}` : ""}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{t("Chưa vào máy chia")}</span>
                )}
                {phanHoiCuoi && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${PHAN_HOI.find((p) => p.ma === phanHoiCuoi.phanHoi)?.cls || "text-gray-600 bg-gray-50 border-gray-200"}`}>
                    {nhanPhanHoi(phanHoiCuoi.phanHoi) || phanHoiCuoi.phanHoi}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2.5">
              {l.phone && <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5"><Phone size={14} /> {l.phone}</a>}
              {l.phone && <a href={`https://zalo.me/${normPhone(l.phone)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-2.5 py-1.5">Zalo</a>}
              {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5"><Mail size={14} /> {l.email}</a>}
            </div>

            <ChamSocBox phone={l.phone} ten={l.name} nhatKy={nk} />

            <div className="flex flex-wrap gap-1.5 mt-3">
              {weak.length === 0 && <span className="text-xs text-emerald-600">{t("Các chỉ số đều đang ổn.")}</span>}
              {weak.map((d) => (
                <span key={d} className={`text-xs font-semibold px-2 py-1 rounded-full ${bandCls[band(l.dims[d])]}`}>{t(DIMS[d]) || d}: {l.dims[d]} · {bandLabel(l.dims[d])}</span>
              ))}
            </div>

            {l.pkg && (
              <div className="mt-3 text-sm flex items-center gap-2 text-gray-700"><Gift size={15} className="text-emerald-600" /> {t("Gói khách quan tâm:")} <b>{l.pkg}</b>
                {l.vat?.taxCode && <span className="text-xs text-gray-500">{t("· cần VAT:")} {l.vat.company} ({l.vat.taxCode})</span>}
              </div>
            )}

            {s && (
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3.5 text-[13.5px] leading-relaxed text-gray-700 space-y-1.5">
                <div><b className="text-gray-900">{t("Ăn uống:")}</b> {s.mealFocus}</div>
                <div><b className="text-gray-900">{t("Sản phẩm đồng hành:")}</b> {s.sanPham}</div>
                <div><b className="text-gray-900">{t("Trong gói trọn:")}</b> {s.comboTrongGoi}</div>
                <div><b className="text-gray-900">App NOVA:</b> {s.appNova}</div>
                <div className="text-gray-500"><b>{t("Buổi tư vấn 30′:")}</b> {s.tuVan30.join(" → ")}</div>
              </div>
            )}

            {s && (
              <button onClick={() => copy(l.id, buildScript(l, s))}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl px-3.5 py-2">
                {copied === l.id ? <><Check size={15} /> {t("Đã copy")}</> : <><Copy size={15} /> {t("Copy tin nhắn tư vấn")}</>}
              </button>
            )}

            {mp && (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/40">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <button onClick={() => setOpenMeal((c) => (c === l.id ? null : l.id))}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                    <UtensilsCrossed size={15} /> {t("Thực đơn 14 ngày (")}{t(mp.ten)})
                    {mealOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button onClick={() => copy(l.id + ":meal", mealPlanText(l.name, mp))}
                    className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5">
                    {copied === l.id + ":meal" ? <><Check size={14} /> {t("Đã copy")}</> : <><Copy size={14} /> {t("Copy thực đơn gửi khách")}</>}
                  </button>
                </div>
                {mealOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {mp.nguyenTac && <div className="text-[13px] text-gray-600"><b>{t("Nguyên tắc:")}</b> {mp.nguyenTac}</div>}
                    <div className="space-y-1.5">
                      {mp.ngay.map((x) => (
                        <div key={x.d} className="text-[13px] leading-relaxed bg-white border border-gray-100 rounded-lg p-2.5">
                          <div className="font-semibold text-gray-900">{t("Ngày")} {x.d}</div>
                          <div className="text-gray-700"><b>{t("Sáng:")}</b> {x.sang}</div>
                          <div className="text-gray-700"><b>{t("Trưa:")}</b> {x.trua}</div>
                          <div className="text-gray-700"><b>{t("Tối:")}</b> {x.toi}</div>
                          {x.phu && <div className="text-gray-500"><b>{t("Phụ:")}</b> {x.phu}</div>}
                        </div>
                      ))}
                    </div>
                    {luuYText(mp.luuY) && <div className="text-[13px] text-amber-700"><b>{t("Lưu ý:")}</b> {luuYText(mp.luuY)}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
