"use client";

import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, HelpCircle, PowerOff, Server, Laptop, RotateCw, UserCog, Loader2, ChevronRight } from "lucide-react";
import type { DayChuyen, MayChay } from "@/lib/may-chay-ngam";

export default function BanDoMay({ chuoi, nhipMac }: { chuoi: DayChuyen[]; nhipMac: { song: boolean; gio: number | null } }) {
  const [mo, setMo] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState<string | null>(null);
  const [ketQua, setKetQua] = useState<Record<string, { ok: boolean | null; chu: string }>>({});

  async function chayLai(m: MayChay) {
    setDangChay(m.key);
    try {
      const r = await fetch("/api/may/chay-lai", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: m.key }),
      });
      const j = await r.json();
      setKetQua((k) => ({ ...k, [m.key]: { ok: j.ok ?? (j.chay ? null : false), chu: j.thongBao || j.loi || "Không rõ kết quả" } }));
    } catch (e: any) {
      setKetQua((k) => ({ ...k, [m.key]: { ok: false, chu: `Gọi hỏng: ${String(e?.message || e).slice(0, 120)}` } }));
    } finally { setDangChay(null); }
  }

  return (
    <div className="space-y-3">
      {chuoi.map((c) => {
  const { t: t } = useLang();
        const chet = c.may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao).length;
        return (
          <div key={c.ma} className={`rounded-2xl border p-3.5 ${chet ? "border-rose-100 bg-rose-50/40" : "border-gray-100 bg-white"} shadow-sm`}>
            <div className="flex items-baseline gap-2 flex-wrap mb-2">
              <span className="text-[13.5px] font-bold text-gray-800">{t(c.ten)}</span>
              <span className="text-[11.5px] text-gray-400">{t(c.moTa)}</span>
              {chet > 0 && <span className="text-[11px] font-semibold text-rose-700 bg-rose-100 border border-rose-200 rounded px-1.5 py-0.5">{t("đứt")} {chet}</span>}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {c.may.map((m, i) => (
                <Chip key={m.key} m={m} dauTien={i === 0} dangMo={mo === m.key} onClick={() => setMo(mo === m.key ? null : m.key)} />
              ))}
            </div>

            {c.may.filter((m) => mo === m.key).map((m) => (
              <ChiTiet
                key={m.key} m={m} nhipMac={nhipMac}
                dangChay={dangChay === m.key} ketQua={ketQua[m.key]}
                onChay={() => chayLai(m)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ m, dauTien, dangMo, onClick }: { m: MayChay; dauTien: boolean; dangMo: boolean; onClick: () => void }) {
  const { t: t } = useLang();
  const chet = m.trangThai === "chet" && !m.chiThamKhao;
  const tone = chet
    ? "border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200"
    : m.trangThai === "chay"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
      : m.trangThai === "tat"
        ? "border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-200"
        : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100";

  const Icon = chet ? AlertTriangle : m.trangThai === "chay" ? CheckCircle2 : m.trangThai === "tat" ? PowerOff : HelpCircle;
  return (
    <>
      {!dauTien && <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />}
      <button
        type="button" onClick={onClick}
        title={`${t(m.ten)} — ${t(m.ghiChu)}`}
        className={`text-[11.5px] rounded-lg border px-2 py-1 inline-flex items-center gap-1 transition ${tone} ${dangMo ? "ring-2 ring-offset-1 ring-gray-300" : ""}`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span className="max-w-[190px] truncate font-medium">{t(m.ten)}</span>
        {m.noiChay === "mac" ? <Laptop className="w-3 h-3 opacity-50 shrink-0" /> : <Server className="w-3 h-3 opacity-50 shrink-0" />}
      </button>
    </>
  );
}

function ChiTiet({ m, nhipMac, dangChay, ketQua, onChay }: {
  m: MayChay; nhipMac: { song: boolean; gio: number | null };
  dangChay: boolean; ketQua?: { ok: boolean | null; chu: string }; onChay: () => void;
}) {
  const { t: t } = useLang();
  const canNguoi = m.chayLai.kieu === "nguoi";
  return (
    <div className="mt-2.5 rounded-xl border border-gray-200 bg-white p-3 text-[12.5px] text-gray-700 space-y-1.5">
      <div>
        <b>{t(m.ten)}</b> — {t(m.ghiChu)}
        {m.tuoiGio !== null && <span className="text-gray-400"> {t("(trần")} {m.tranGio}h)</span>}
        {m.chiThamKhao && <span className="text-gray-400"> {t("· chỉ tham khảo, không kêu")}</span>}
      </div>
      <div className="text-gray-500">{t("Cách sửa:")} {t(m.cachSua)}</div>

      {canNguoi ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[12px] text-amber-900">
          <span className="inline-flex items-center gap-1 font-semibold"><UserCog className="w-3.5 h-3.5" />{t("Máy này không tự chạy lại")}</span>
          <div className="mt-0.5">{(m.chayLai as any).lenh}</div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button" onClick={onChay} disabled={dangChay}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold px-2.5 py-1.5 disabled:opacity-50"
          >
            {dangChay ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            {dangChay ? t("Đang chạy lại...") : t("Chạy lại ngay")}
          </button>
          <span className="text-[11.5px] text-gray-400">
            {m.chayLai.kieu === "cron"
              ? `chạy trên máy chủ · ${(m.chayLai as any).route}`
              : nhipMac.song
                ? t("xếp hàng cho máy văn phòng · nhận trong 30 phút")
                : t("máy văn phòng đang TẮT — việc sẽ nằm chờ")}
          </span>
        </div>
      )}

      {ketQua && (
        <div className={`text-[12px] rounded-lg border p-2 ${ketQua.ok === false ? "border-rose-200 bg-rose-50 text-rose-800" : ketQua.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
          {ketQua.chu}
        </div>
      )}
    </div>
  );
}
