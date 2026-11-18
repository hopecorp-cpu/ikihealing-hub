"use client";
import { useLang } from "@/components/lang-provider";

import { useState, useTransition } from "react";
import { Target, AlertTriangle, Send, Check, Users } from "lucide-react";
import type { BanRaChienDich } from "@/lib/bo-chien-dich";
import { giaoChienDich } from "./actions";

type PhongBan = { id: string; name: string; members: { id: string; full_name: string; position?: string }[] };

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
const trieu = (n: number) => (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr";

function cuoiThang(thang: string) {
  const [y, m] = thang.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export default function Client({ ban, phongBan, mucTieu, thang }: {
  ban: BanRaChienDich | null; phongBan: PhongBan[]; mucTieu: number; thang: string;
}) {
  const { t: t } = useLang();
  const [tien, setTien] = useState(mucTieu ? String(mucTieu / 1e6) : "600");
  const [thg, setThg] = useState(thang);
  const [chon, setChon] = useState<Record<string, string[]>>(() => {
    const o: Record<string, string[]> = {};
    for (const g of ban?.goi ?? []) {
      o[g.phong] = (phongBan.find((p) => p.name === g.phong)?.members ?? []).map((m) => m.id);
    }
    return o;
  });
  const [pending, start] = useTransition();
  const [ketQua, setKetQua] = useState<{ phong: string; ok: boolean; soNguoi: number; loi?: string }[] | null>(null);

  function giao() {
    if (!ban) return;
    start(async () => {
      const r = await giaoChienDich({
        tenChienDich: ban.ten,
        hanChot: cuoiThang(ban.thang),
        goi: ban.goi.map((g) => ({ phong: g.phong, tieuDe: g.tieuDe, chiTieu: g.chiTieu, viec: g.viec, memberIds: chon[g.phong] ?? [] })),
      });
      setKetQua(r.ketQua ?? null);
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5 text-gray-900">
          <span className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center"><Target className="w-5 h-5 text-brand-600" /></span>
          {t("Bổ chiến dịch")}
        </h1>
        <p className="text-sm text-gray-500 mt-1 ml-[46px]">
          {t("Áp một con số doanh thu, máy rã thành chỉ tiêu và đầu việc cho từng phòng ban. Máy ra bản nháp — anh xem rồi mới giao.")}
        </p>
      </div>

      <form className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("Doanh thu mục tiêu")}</label>
          <div className="flex items-center gap-2">
            <input name="mucTieu" type="hidden" value={Math.round(Number(tien || 0) * 1e6)} />
            <input value={tien} onChange={(e) => setTien(e.target.value)} inputMode="decimal"
              className="w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm" />
            <span className="text-sm text-gray-500">{t("triệu / tháng")}</span>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("Tháng")}</label>
          <input name="thang" value={thg} onChange={(e) => setThg(e.target.value)} placeholder="2026-09"
            className="w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm" />
        </div>
        <button className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700">
          {t("Rã chiến dịch")}
        </button>
        <p className="text-xs text-gray-400 w-full">
          {t("Tham chiếu: T7/2026 tự chạy 452,9tr khi không có chiến dịch lớn. Trần hợp lý cho một tháng có 3 chiến dịch là 600-700tr.")}
        </p>
      </form>

      {!ban && (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          {t("Nhập con số rồi bấm &quot;Rã chiến dịch&quot;.")}
        </div>
      )}

      {ban && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <O l={t("DOANH THU / NGÀY")} v={trieu(ban.doanhThuNgay)} />
            <O l={t("ĐƠN CẦN / THÁNG")} v={Math.round(ban.donCanThang).toLocaleString("vi-VN")} p={`${ban.donCanNgay.toFixed(1)} đơn/ngày`} />
            <O l={t("LEAD CẦN / THÁNG")} v={Math.round(ban.leadCanThang).toLocaleString("vi-VN")} p={`CPL trần ${vnd(ban.cplTran)}`} />
            <O l={t("NGÂN SÁCH ADS TRẦN")} v={trieu(ban.tranAdsThang)} p={`CPO trần ${vnd(ban.cpoTran)}`} />
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5">
            {t("Tính trên giỏ trung bình")} <strong>{vnd(ban.gioTB)}</strong> {t("(số nền nhóm Đơn Hàng T7, không dùng AOV của MISA vì thấp hơn thật 20%)")}
            {" · "}{t("đội sale thật")} <strong>{ban.soSaleThat} {t("người")}</strong>{t(", mỗi người")} <strong>{ban.donMoiSaleNgay.toFixed(1)} {t("đơn/ngày")}</strong>.
          </div>

          {ban.canhBao.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">{t("Đọc trước khi giao")}</span>
              </div>
              <ul className="space-y-1.5">
                {ban.canhBao.map((c, i) => <li key={i} className="text-sm text-amber-900 leading-snug">— {c}</li>)}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {ban.goi.map((g) => {
              const p = phongBan.find((x) => x.name === g.phong);
              const ds = p?.members ?? [];
              const tick = chon[g.phong] ?? [];
              const kq = ketQua?.find((k) => k.phong === g.phong);
              return (
                <div key={g.phong} className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{g.phong}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          t(g.vaiTro) === "truc-tiep" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {t(g.vaiTro) === "truc-tiep" ? "Ra doanh thu" : t("Hỗ trợ")}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 mt-1">{t(g.tieuDe)}</div>
                      <div className="text-xs text-brand-700 font-semibold mt-1">{g.chiTieu}</div>
                    </div>
                    {kq && (
                      <span className={`text-xs font-semibold ${kq.ok ? "text-emerald-700" : "text-red-700"}`}>
                        {kq.ok ? `Đã giao cho ${kq.soNguoi} người` : kq.loi}
                      </span>
                    )}
                  </div>

                  <ul className="mt-2.5 space-y-1">
                    {g.viec.map((v, i) => <li key={i} className="text-sm text-gray-600 leading-snug">— {v}</li>)}
                  </ul>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      <Users className="w-3.5 h-3.5" /> {t("Ai nhận việc")}
                    </div>
                    {ds.length === 0 ? (
                      <p className="text-xs text-red-600">{t("Phòng này chưa có nhân sự nào trong hệ thống — không giao được.")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {ds.map((m) => {
                          const on = tick.includes(m.id);
                          return (
                            <button key={m.id} type="button"
                              onClick={() => setChon((s) => ({ ...s, [g.phong]: on ? tick.filter((x) => x !== m.id) : [...tick, m.id] }))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition inline-flex items-center gap-1 ${
                                on ? "bg-brand-50 border-brand-300 text-brand-800" : "bg-white border-gray-200 text-gray-500"}`}>
                              {on && <Check className="w-3 h-3" />}{m.full_name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={giao} disabled={pending}
              className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 inline-flex items-center gap-2">
              <Send className="w-4 h-4" />{pending ? t("Đang giao...") : t("Giao xuống phòng ban")}
            </button>
            <span className="text-xs text-gray-500">
              {t("Tạo một thẻ cha mỗi phòng + một thẻ con cho mỗi người được tick, hạn")} {cuoiThang(ban.thang)}{t(". Xem lại ở /tasks.")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function O({ l, v, p }: { l: string; v: string; p?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide">{l}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{v}</div>
      {p && <div className="text-[11px] text-gray-400 mt-0.5">{p}</div>}
    </div>
  );
}
