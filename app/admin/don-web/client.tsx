"use client";
import { useLang } from "@/components/lang-provider";
import { useMemo, useState, useTransition } from "react";
import { Phone, MapPin, BookCheck, Save } from "lucide-react";
import type { QuizOrder, XuLyDon } from "@/lib/payos";
import { luuXuLy, chotVaoSo } from "./actions";

const XU_LY: Record<XuLyDon, { ten: string; mau: string }> = {
  moi: { ten: "Mới", mau: "bg-amber-100 text-amber-800" },
  da_xac_nhan: { ten: "Đã xác nhận", mau: "bg-sky-100 text-sky-800" },
  dang_giao: { ten: "Đang giao", mau: "bg-indigo-100 text-indigo-800" },
  da_giao: { ten: "Đã giao", mau: "bg-emerald-100 text-emerald-800" },
  huy: { ten: "Huỷ", mau: "bg-gray-200 text-gray-600" },
};
const TIEN: Record<string, string> = { paid: "Đã CK", cod: "COD", pending: "Chờ CK" };
const tien = (n: number) => (n || 0).toLocaleString("vi-VN") + "đ";
const ngay = (t: number) => new Date(t).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function DonWebClient({ ds, daVaoSo }: { ds: QuizOrder[]; daVaoSo: Record<string, string> }) {
  const { t: tDich } = useLang();
  const [loc, setLoc] = useState<"tat_ca" | XuLyDon>("tat_ca");
  const [tim, setTim] = useState("");
  const [mo, setMo] = useState<number | null>(null);
  const [bao, setBao] = useState<Record<number, string>>({});
  const [dang, startT] = useTransition();

  const dem = useMemo(() => {
    const d: Record<string, number> = { tat_ca: ds.length };
    for (const o of ds) d[o.xuLy || "moi"] = (d[o.xuLy || "moi"] || 0) + 1;
    return d;
  }, [ds]);
  const hien = ds.filter((o) => {
    if (loc !== "tat_ca" && (o.xuLy || "moi") !== loc) return false;
    const q = tim.trim().toLowerCase();
    if (!q) return true;
    return [o.name, o.phone, o.product, o.pkg, String(o.orderCode), o.maVanDon].some((x) => String(x || "").toLowerCase().includes(q));
  });

  const chay = (ma: number, f: () => Promise<{ ok: boolean; loi: string; canLyDo?: boolean }>, ok: string) => startT(async () => {
    const kq = await f();
    setBao((b) => ({ ...b, [ma]: kq.ok ? ok : kq.loi }));
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {(["tat_ca", "moi", "da_xac_nhan", "dang_giao", "da_giao", "huy"] as const).map((k) => (
          <button key={k} onClick={() => setLoc(k)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${loc === k ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
            {k === "tat_ca" ? tDich("Tất cả") : tDich(XU_LY[k].ten)} ({dem[k] || 0})
          </button>
        ))}
        <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder={tDich("Tìm tên, SĐT, mã đơn, vận đơn...")}
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-1.5 text-sm" />
      </div>

      {!hien.length && <p className="text-gray-500 text-sm bg-white border rounded-xl p-6 text-center">{tDich("Không có đơn nào.")}</p>}

      <div className="space-y-2">
        {hien.map((o) => {
  const { t: tDich } = useLang();
          const xl = (o.xuLy || "moi") as XuLyDon;
          const trongSo = !!daVaoSo[String(o.orderCode)];
          const dangMo = mo === o.orderCode;
          return (
            <div key={o.orderCode} className="bg-white border rounded-xl">
              <button onClick={() => setMo(dangMo ? null : o.orderCode)} className="w-full text-left p-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`text-xs px-2 py-0.5 rounded ${XU_LY[xl].mau}`}>{tDich(XU_LY[xl].ten)}</span>
                <span className="font-medium">{o.name || tDich("(không tên)")}</span>
                <span className="text-sm text-gray-500">{o.phone}</span>
                <span className="text-sm">{o.product || o.pkg || "-"}{o.qty && o.qty > 1 ? ` × ${o.qty}` : ""}</span>
                <span className="text-sm font-semibold ml-auto">{tien(o.amount)}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{tDich(TIEN[o.status]) || o.status}</span>
                <span className={`text-xs ${trongSo ? "text-emerald-700" : "text-gray-400"}`}>{trongSo ? tDich("đã vào sổ") + (daVaoSo[String(o.orderCode)] !== "web:nova" ? tDich(" (dòng nhóm)") : "") : tDich("chưa vào sổ")}</span>
                <span className="text-xs text-gray-400 w-full sm:w-auto">{ngay(o.createdAt)} · {o.source === "shop" ? "/shop" : "/" + (o.source || "quiz")} {tDich("· mã")} {o.orderCode}</span>
              </button>
              {dangMo && <ChiTiet o={o} trongSo={trongSo} dang={dang} bao={bao[o.orderCode]}
                onLuu={(p) => chay(o.orderCode, () => luuXuLy(o.orderCode, p), tDich("Đã lưu"))}
                onChot={() => chay(o.orderCode, async () => {
                  const r = await chotVaoSo(o.orderCode);

                  if (r.ok || !r.canLyDo) return r;
                  const lyDo = window.prompt(tDich("Đơn dưới sàn giá v4 — nhập LÝ DO ghi đè (bắt buộc, ít nhất 10 ký tự):\n") + r.loi, "") || "";
                  if (!lyDo.trim()) return { ok: false, loi: r.loi };
                  return chotVaoSo(o.orderCode, lyDo.trim());
                }, tDich("Đã ghi vào sổ doanh thu"))} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChiTiet({ o, trongSo, dang, bao, onLuu, onChot }: {
  o: QuizOrder; trongSo: boolean; dang: boolean; bao?: string;
  onLuu: (p: { xuLy?: XuLyDon; maVanDon?: string; ghiChuNoiBo?: string }) => void; onChot: () => void;
}) {
  const { t: tDich } = useLang();
  const [xuLy, setXuLy] = useState<XuLyDon>((o.xuLy || "moi") as XuLyDon);
  const [vd, setVd] = useState(o.maVanDon || "");
  const [gc, setGc] = useState(o.ghiChuNoiBo || "");
  return (
    <div className="border-t p-3 grid gap-3 sm:grid-cols-2 text-sm">
      <div className="space-y-1">
        <p className="flex items-center gap-1"><Phone size={14} /> <a className="text-emerald-700" href={`tel:${o.phone}`}>{o.phone}</a>{o.email ? ` · ${o.email}` : ""}</p>
        <p className="flex items-start gap-1"><MapPin size={14} className="mt-0.5" /> {o.address || <span className="text-red-600">{tDich("Chưa có địa chỉ — gọi khách xin trước khi đóng hàng")}</span>}</p>
        {tDich(o.note) && <p>{tDich("Khách ghi:")} {tDich(o.note)}</p>}
        {o.profile && <p>{tDich("Thể trạng quiz:")} {o.profile}</p>}
        {o.status === "paid" && <p className="text-emerald-700">{tDich("Đã chuyển khoản")}{o.paidAt ? tDich(" lúc ") + ngay(o.paidAt) : ""}{o.reference ? " · " + o.reference : ""}</p>}
        {!!o.xuLyLog?.length && (
          <div className="text-xs text-gray-500 pt-1">
            {o.xuLyLog.slice(-5).reverse().map((l, i) => <div key={i}>{ngay(l.luc)} · {l.ai}: {l.viec}</div>)}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <select value={xuLy} onChange={(e) => setXuLy(e.target.value as XuLyDon)} className="w-full border rounded-lg px-2.5 py-1.5">
          {(Object.keys(XU_LY) as XuLyDon[]).map((k) => <option key={k} value={k}>{tDich(XU_LY[k].ten)}</option>)}
        </select>
        <input value={vd} onChange={(e) => setVd(e.target.value)} placeholder={tDich("Mã vận đơn J&T")} className="w-full border rounded-lg px-2.5 py-1.5" />
        <textarea value={gc} onChange={(e) => setGc(e.target.value)} placeholder={tDich("Ghi chú nội bộ (khách không thấy)")} rows={2} className="w-full border rounded-lg px-2.5 py-1.5" />
        {xuLy === "huy" && trongSo && <p className="text-amber-700 text-xs">{tDich("Đơn này đã vào sổ doanh thu. Huỷ ở đây không tự xoá dòng sổ — báo kế toán gỡ dòng mã")} {o.orderCode}.</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={dang} onClick={() => onLuu({ xuLy, maVanDon: vd, ghiChuNoiBo: gc })}
            className="inline-flex items-center gap-1 bg-emerald-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-40"><Save size={15} />{tDich("Lưu")}</button>
          {!trongSo && o.status !== "pending" && xuLy !== "huy" && (
            <button disabled={dang} onClick={onChot}
              className="inline-flex items-center gap-1 border border-emerald-700 text-emerald-700 rounded-lg px-3 py-1.5 disabled:opacity-40"><BookCheck size={15} />{tDich("Chốt vào sổ")}</button>
          )}
        </div>
        {bao && <p className="text-xs">{bao}</p>}
      </div>
    </div>
  );
}
