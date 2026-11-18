"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Pencil, Check, X, Target as TargetIcon, TrendingUp, Mountain, Compass, Rocket } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui/kit";
import type { StrategyMapData, ScoredObjective } from "@/lib/strategy-map";
import { saveObjective, saveFixedCost } from "./actions";

const LIGHT: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  green: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "#10B981", label: "Đạt" },
  yellow: { bg: "bg-amber-50", text: "text-amber-700", dot: "#F59E0B", label: "Cận" },
  red: { bg: "bg-rose-50", text: "text-rose-700", dot: "#EF4444", label: "Chưa đạt" },
  gray: { bg: "bg-gray-50", text: "text-gray-500", dot: "#9CA3AF", label: "Nhập tay" },
};

function fmt(n: number | null, unit: string) {
  if (n == null) return "—";
  const v = unit === "%" || unit === "/10" ? n : n.toLocaleString("vi");
  return `${v}${unit === "/10" ? "/10" : unit === "%" ? "%" : ""}`;
}

function ObjRow({ o, canEdit }: { o: ScoredObjective; canEdit: boolean }) {
  const { t: t } = useLang();
  const L = LIGHT[o.light];
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const [target, setTarget] = useState(String(o.target));
  const [current, setCurrent] = useState(o.current != null ? String(o.current) : "");
  const [initiative, setInitiative] = useState(o.initiative);
  const [owner, setOwner] = useState(o.owner);

  const save = () => start(async () => {
    await saveObjective(o.key, {
      target: Number(target) || 0,
      initiative,
      owner,
      ...(!o.live && current !== "" ? { current: Number(current) || 0 } : {}),
    });
    setEdit(false);
  });

  return (
    <div className={`rounded-xl border border-gray-100 ${L.bg} p-3`}>
      <div className="flex items-start gap-2">
        <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: L.dot }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-semibold text-gray-800">{t(o.title)}</span>
            {o.link && (
              <Link href={o.link} className="text-gray-400 hover:text-emerald-600 transition" title={t("Mở chi tiết")}>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-lg font-bold ${L.text}`}>{fmt(o.current, o.unit)}</span>
            <span className="text-[11px] text-gray-400">/ mục tiêu {fmt(o.target, o.unit)}</span>
            {o.live && <span className="text-[10px] text-gray-400">{t("· tự động")}</span>}
          </div>
          {(o.owner || o.initiative) && !edit && (
            <div className="mt-1 text-[11px] text-gray-500 space-y-0.5">
              {o.owner && <div>{o.owner}</div>}
              {o.initiative && <div>{o.initiative}</div>}
            </div>
          )}
          {edit && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <label className="text-[11px] text-gray-500">{t("Mục tiêu")}
                  <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric"
                    className="ml-1 w-20 px-2 py-0.5 rounded border border-gray-200 text-xs" />
                </label>
                {!o.live && (
                  <label className="text-[11px] text-gray-500">{t("Hiện tại")}
                    <input value={current} onChange={(e) => setCurrent(e.target.value)} inputMode="numeric"
                      className="ml-1 w-20 px-2 py-0.5 rounded border border-gray-200 text-xs" />
                  </label>
                )}
              </div>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder={t("Người phụ trách")}
                className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
              <input value={initiative} onChange={(e) => setInitiative(e.target.value)} placeholder={t("Sáng kiến / hành động chính")}
                className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
              <div className="flex gap-2">
                <button onClick={save} disabled={pending} className="text-[11px] px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-emerald-700"><Check className="w-3 h-3" />{t("Lưu")}</button>
                <button onClick={() => setEdit(false)} className="text-[11px] px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg inline-flex items-center gap-1"><X className="w-3 h-3" />{t("Huỷ")}</button>
              </div>
            </div>
          )}
        </div>
        {canEdit && !edit && (
          <button onClick={() => setEdit(true)} className="text-gray-300 hover:text-gray-600 transition p-1" title={t("Sửa mục tiêu")}><Pencil className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </div>
  );
}

function FixedCostEditor({ fixedCost }: { fixedCost: number }) {
  const { t: t } = useLang();
  const [v, setV] = useState(fixedCost ? String(fixedCost) : "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex items-center gap-2 text-[12px] text-gray-600">
      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
      <span>{t("Chi phí cố định tháng (để tính BEP):")}</span>
      <input value={v} onChange={(e) => { setV(e.target.value); setSaved(false); }} inputMode="numeric" placeholder="vd 300000000"
        className="w-36 px-2 py-1 rounded border border-gray-200 text-xs" />
      <button onClick={() => start(async () => { await saveFixedCost(Number(v) || 0); setSaved(true); })}
        disabled={pending} className="text-[11px] px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">{t("Lưu")}</button>
      {saved && <span className="text-emerald-600 text-[11px]">{t("✓ đã lưu · tải lại trang")}</span>}
    </div>
  );
}

export default function StrategyMapClient({ data, intro, canEdit, fixedCost }: { data: StrategyMapData; intro: string; canEdit: boolean; fixedCost: number }) {
  const { t: t } = useLang();
  const scoreLight = data.overall.scorePct >= 80 ? "green" : data.overall.scorePct >= 55 ? "yellow" : "red";
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={t("Bản đồ chiến lược")}
        subtitle={t("Balanced Scorecard — Bước ② trong hệ thống quản trị 6 bước")}
        icon={TargetIcon}
        actions={
          <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${LIGHT[scoreLight].bg} ${t(LIGHT[scoreLight].text)}`}>
            {t("Sức khoẻ chiến lược")} {data.overall.scorePct}%
          </div>
        }
      />
      <p className="text-[13px] text-gray-500">{intro}</p>
      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <Badge tone="green" dot>{data.overall.green} {t("đạt")}</Badge>
        <Badge tone="yellow" dot>{data.overall.yellow} {t("cận")}</Badge>
        <Badge tone="red" dot>{data.overall.red} {t("chưa đạt")}</Badge>
        <span className="text-gray-400">{t("· tháng")} {data.month}</span>
        {data.updatedAt && <span className="text-gray-400">{t("· cập nhật")} {data.updatedAt.slice(0, 10)}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.perspectives.map((p, idx) => (
          <div key={p.key} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between" style={{ background: `${p.color}0D` }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{p.icon}</span>
                <div>
                  <div className="text-sm font-bold text-gray-800">{t(p.title)}</div>
                  <div className="text-[10px] text-gray-400">{t(p.desc)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold" style={{ color: p.color }}>{p.score}%</div>
                <div className="text-[9px] text-gray-400">{t("Khía cạnh")} {idx + 1}/4</div>
              </div>
            </div>
            <div className="p-3 space-y-2 flex-1">
              {p.objectives.map((o) => <ObjRow key={o.key} o={o} canEdit={canEdit} />)}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-gray-800">{t("Bản đồ 3 chân trời — đường tới 1000 tỷ trước 2031")}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-700"><TrendingUp className="w-3.5 h-3.5" />{t("H1 — Lõi hiện tại (nuôi tiền, 70% sức)")}</div>
            <ul className="mt-1.5 text-[12px] text-gray-600 space-y-1 list-disc pl-4">
              <li>{t("Bán lẻ + combo qua Zalo, sale page, fanpage — 3 sale chính, mục tiêu 500tr/tháng, vượt hòa vốn 318tr")}</li>
              <li>{t("Khách đặt lại theo chu kỳ 30-45 ngày (máy nhắc tự chạy) + xả tồn kho đọng thành quà")}</li>
            </ul>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-sky-700"><Compass className="w-3.5 h-3.5" />{t("H2 — Mở rộng (nuôi đà, 20% sức)")}</div>
            <ul className="mt-1.5 text-[12px] text-gray-600 space-y-1 list-disc pl-4">
              <li>{t("Chi nhánh Hà Nội + kênh đại lý / B2B / sàn với một mặt tiền giá")}</li>
              <li>{t("Thẻ thành viên 3 hạng + gói dài ngày (Sống Nhẹ 90) khóa chân khách")}</li>
            </ul>
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-violet-700"><Rocket className="w-3.5 h-3.5" />{t("H3 — Đặt cược (nuôi tương lai, 10% sức)")}</div>
            <ul className="mt-1.5 text-[12px] text-gray-600 space-y-1 list-disc pl-4">
              <li>{t("NOVA app ra thị trường Nhật / toàn cầu (blog EN-JA, GTM đang dựng)")}</li>
              <li>{t("Giáo dục — khóa học kinh doanh, học viện 7 ngày; hệ điều hành AI thành tài sản")}</li>
            </ul>
          </div>
        </div>
        <p className="text-[11px] text-gray-400">
          {t("Luật phân sức 70/20/10: không rút người của H1 đi nuôi H3 khi H1 chưa vượt hòa vốn; H2 chỉ mở khi H1 có lãi 2 tháng liền (kho rủi ro — vá lu trước khi đổ nước).")}
        </p>
      </div>

      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-gray-400">
          {t("Nhân–quả BSC: đầu tư")} <b>{t("Học hỏi &amp; Phát triển")}</b> {t("→ chuẩn hoá")} <b>{t("Quy trình")}</b> {t("→ làm hài lòng")} <b>{t("Khách hàng")}</b> {t("→ ra kết quả")} <b>{t("Tài chính")}</b>{t(".\n          Ô \"tự động\" lấy số trực tiếp từ hệ thống; ô còn lại BGĐ tự nhập.")}
        </p>
        {canEdit && <FixedCostEditor fixedCost={fixedCost} />}
      </div>
    </div>
  );
}
