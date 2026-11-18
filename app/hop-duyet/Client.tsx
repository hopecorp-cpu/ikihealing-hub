"use client";

import { useLang } from "@/components/lang-provider";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, History, Loader2, Power, ShieldAlert } from "lucide-react";
import type { MucDuyet, NhomMuc } from "@/lib/hop-duyet-core";
import { NHOM_DUNG, type NhatKyDung, type NhomDung, type TrangThaiDung } from "@/lib/dung-khan-cap-core";
import { bamDungKhanCap } from "./actions";

type Muc = MucDuyet & { tuoi: number; quaHan: boolean };
const NHOM_MUC: NhomMuc[] = ["Nhân sự", "Tài chính", "Nội dung", "Bán hàng", "Vận hành"];
const RR = {
  cao: { ten: "Rủi ro cao", cls: "bg-red-50 text-red-700 border-red-200" },
  vua: { ten: "Rủi ro vừa", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  thap: { ten: "Rủi ro thấp", cls: "bg-gray-50 text-gray-600 border-gray-200" },
} as const;

function tuoiChu(gio: number) {
  if (gio < 1) return `${Math.max(1, Math.round(gio * 60))} phút`;
  if (gio < 48) return `${Math.round(gio)} giờ`;
  return `${Math.round(gio / 24)} ngày`;
}
const lucChu = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

export default function HopDuyetClient({ muc, nguonHong, dung, nhatKy, coTheDung, coTheMo }: {
  muc: Muc[]; nguonHong: string[]; dung: TrangThaiDung; nhatKy: NhatKyDung[]; coTheDung: boolean; coTheMo: boolean;
}) {
  const { t: tDich } = useLang();
  const [loc, setLoc] = useState<"tat_ca" | "qua_han" | NhomMuc>("tat_ca");
  const dem = useMemo(() => {
    const d: Record<string, number> = { tat_ca: muc.length, qua_han: muc.filter((m) => m.quaHan).length };
    for (const n of NHOM_MUC) d[n] = muc.filter((m) => m.nhom === n).length;
    return d;
  }, [muc]);
  const hien = muc.filter((m) => loc === "tat_ca" ? true : loc === "qua_han" ? m.quaHan : m.nhom === loc);
  const tabs = (["tat_ca", "qua_han", ...NHOM_MUC] as const).filter((t) => t === "tat_ca" || dem[t] > 0);

  return (
    <div className="space-y-5">
      {coTheDung && <BangDung dung={dung} nhatKy={nhatKy} coTheMo={coTheMo} />}

      {nguonHong.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{tDich("Không đọc được:")} <b>{nguonHong.join(", ")}</b>{tDich(". Mục của các nguồn này có thể đang thiếu, mở trang gốc để kiểm.")}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="flex flex-wrap gap-1 border-b border-gray-100 px-3 pt-3">
          {tabs.map((t) => (
            <button key={t} onClick={() => setLoc(t)}
              className={`px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px ${loc === t ? "border-brand-600 text-brand-700 font-semibold" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              {t === "tat_ca" ? tDich("Tất cả") : t === "qua_han" ? tDich("Quá hạn") : t}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-md ${t === "qua_han" && dem[t] ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{dem[t]}</span>
            </button>
          ))}
        </div>

        {hien.length === 0 ? (
          <div className="py-14 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-brand-500" />
            <p className="mt-3 font-semibold text-gray-800">{muc.length ? tDich("Không có mục nào trong nhóm này") : tDich("Không còn gì chờ bạn duyệt")}</p>
            <p className="text-sm text-gray-500 mt-1">{tDich("Mục mới vào hàng chờ sẽ hiện ở đây.")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {hien.map((m) => (
              <li key={m.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 ${m.quaHan ? "bg-red-50/40" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-medium text-gray-500">{m.nguon}</span>
                    <span className={`px-1.5 py-0.5 rounded-md border ${RR[m.ruiRo].cls}`}>{tDich(RR[m.ruiRo].ten)}</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${m.quaHan ? "bg-red-100 text-red-700 font-semibold" : "text-gray-500"}`}>
                      <Clock className="w-3 h-3" />
                      {tDich("chờ")} {tuoiChu(m.tuoi)}{m.quaHan ? ` · quá hạn ${m.hanGio} giờ` : ""}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-gray-900 break-words">{tDich(m.tieuDe)}</p>
                  {m.chiTiet && <p className="text-sm text-gray-500 break-words">{m.chiTiet}</p>}
                </div>
                <Link href={m.link}
                  className="inline-flex items-center justify-center gap-1.5 shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">
                  {tDich("Mở để duyệt")} <ArrowRight className="w-4 h-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BangDung({ dung, nhatKy, coTheMo }: { dung: TrangThaiDung; nhatKy: NhatKyDung[]; coTheMo: boolean }) {
  const { t: tDich } = useLang();
  const [dang, setDang] = useState<{ nhom: NhomDung; dung: boolean } | null>(null);
  const [lyDo, setLyDo] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [xemNk, setXemNk] = useState(false);
  const [pending, start] = useTransition();
  const coDung = NHOM_DUNG.some((n) => dung[n.ma]);

  const xacNhan = () => {
    if (!dang) return;
    setLoi(null);
    start(async () => {
      const r = await bamDungKhanCap(dang.nhom, dang.dung, lyDo);
      if (r.ok) { setDang(null); setLyDo(""); location.reload(); } else setLoi(r.error || "Lỗi");
    });
  };

  return (
    <section className={`rounded-xl border p-4 ${coDung ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-gray-900">
          <ShieldAlert className={`w-5 h-5 ${coDung ? "text-red-600" : "text-gray-500"}`} />
          {tDich("Dừng khẩn cấp")}
          {coDung && <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-600 text-white">{tDich("ĐANG DỪNG")}</span>}
        </h2>
        {nhatKy.length > 0 && (
          <button onClick={() => setXemNk(!xemNk)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <History className="w-4 h-4" /> {tDich("Nhật ký (")}{nhatKy.length})
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600 mt-1">
        {tDich("Hãm ngay việc máy làm ra bên ngoài khi thấy bất thường. Quản lý bấm dừng được; chỉ CEO/admin mở lại. Mỗi lần bấm báo vào chat riêng CEO.")}
      </p>

      <div className="grid sm:grid-cols-2 gap-2 mt-3">
        {NHOM_DUNG.map((n) => {
          const lan = dung[n.ma];
          const boiToanHe = !lan && n.ma !== "toan_he" && dung.toan_he;
          return (
            <div key={n.ma} className={`rounded-lg border px-3 py-2.5 ${lan ? "border-red-300 bg-white" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{tDich(n.ten)}</p>
                  <p className="text-xs text-gray-500">{tDich(n.moTa)}</p>
                </div>
                {lan ? (
                  coTheMo && <button onClick={() => { setDang({ nhom: n.ma, dung: false }); setLoi(null); }}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">{tDich("Mở lại")}</button>
                ) : (
                  <button onClick={() => { setDang({ nhom: n.ma, dung: true }); setLoi(null); }}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700">
                    <Power className="w-3.5 h-3.5" /> {tDich("Dừng")}
                  </button>
                )}
              </div>
              {lan && <p className="mt-1.5 text-xs text-red-700">{tDich("Dừng lúc")} {lucChu(lan.luc)} {tDich("bởi")} {lan.boi}: {lan.lyDo}</p>}
              {boiToanHe && <p className="mt-1.5 text-xs text-red-700">{tDich("Đang dừng theo \"Toàn hệ thống\".")}</p>}
            </div>
          );
        })}
      </div>

      {dang && (
        <div className="mt-3 rounded-lg border border-gray-300 bg-white p-3">
          <p className="text-sm font-semibold text-gray-900">
            {dang.dung ? tDich("Dừng") : tDich("Mở lại")} {tDich("nhóm \"")}{tDich(NHOM_DUNG.find((n) => n.ma === tDich(dang.nhom))?.ten)}{tDich("\". Lý do?")}
          </p>
          <textarea value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={2} maxLength={300} autoFocus
            placeholder={dang.dung ? tDich("Ví dụ: bot trả lời sai giá cho khách") : tDich("Ví dụ: đã sửa xong lỗi trả lời sai giá")}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          {loi && <p className="mt-1 text-sm text-red-600">{loi}</p>}
          <div className="mt-2 flex gap-2 justify-end">
            <button onClick={() => { setDang(null); setLyDo(""); setLoi(null); }} disabled={pending}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">{tDich("Huỷ")}</button>
            <button onClick={xacNhan} disabled={pending || lyDo.trim().length < 5}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${dang.dung ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"}`}>
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {dang.dung ? tDich("Xác nhận dừng") : tDich("Xác nhận mở lại")}
            </button>
          </div>
        </div>
      )}

      {xemNk && (
        <ul className="mt-3 space-y-1 text-xs text-gray-600 max-h-56 overflow-auto">
          {nhatKy.map((k, i) => (
            <li key={i}>
              <span className="text-gray-400">{lucChu(k.luc)}</span>{" · "}
              <b className={k.viec === "dung" ? "text-red-700" : "text-brand-700"}>{k.viec === "dung" ? tDich("Dừng") : tDich("Mở lại")}</b>{" "}
              {tDich(NHOM_DUNG.find((n) => n.ma === tDich(k.nhom))?.ten)} · {k.boi}: {k.lyDo}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
