"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { danhDauDaCham, danhDauBoQua } from "./actions";
import type { ViecItem } from "@/lib/today-work";

const Ico = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden>
    <path d={d} />
  </svg>
);
const I_OPEN = "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3";
const I_CHECK = "M20 6 9 17l-5-5";
const I_X = "M18 6 6 18M6 6l12 12";
const I_FLAME = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

export default function ViecClient({ items, daXong }: { items: ViecItem[]; daXong: number }) {
  const { t: t } = useLang();
  const [xong, setXong] = useState<Record<string, "cham" | "bo">>({});
  const [loi, setLoi] = useState("");
  const [pending, start] = useTransition();

  const lam = (id: string, kieu: "cham" | "bo") => {
    setLoi("");
    start(async () => {
      const r = kieu === "cham" ? await danhDauDaCham(id) : await danhDauBoQua(id);
      if (r.ok) setXong((p) => ({ ...p, [id]: kieu }));
      else setLoi(r.error || "không lưu được");
    });
  };

  const conLai = items.filter((i) => !xong[i.id]).length;

  return (
    <div className="vhn">
      <div className="vhn-top">
        <div>
          <div className="vhn-big">{conLai}</div>
          <div className="vhn-sub">{t("khách cần chạm hôm nay")}</div>
        </div>
        {daXong > 0 && (
          <div className="vhn-done">
            <Ico d={I_CHECK} size={16} /> {t("đã chạm")} {daXong} {t("khách hôm nay")}
          </div>
        )}
      </div>

      {loi && <div className="vhn-loi">{loi}</div>}

      {conLai === 0 ? (
        <div className="vhn-het">
          <Ico d={I_CHECK} size={22} />
          <div>{t("Hết việc hôm nay. Ngày mai hệ thống rót tiếp.")}</div>
        </div>
      ) : (
        <ul className="vhn-list">
          {items.filter((i) => !xong[i.id]).map((it) => (
            <li key={it.id} className={`vhn-row${it.nong ? " nong" : ""}`}>
              <div className="vhn-info">
                <div className="vhn-name">
                  {it.nong && <span className="vhn-tag"><Ico d={I_FLAME} size={12} /> {t("vừa nhắn")}</span>}
                  {it.customer_name || t("(không tên)")}
                  {!it.nong && it.tuoiNgay < 900 && <span className="vhn-age">{t("nhắn")} {it.tuoiNgay} {t("ngày trước")}</span>}
                </div>
                {t(it.note) && <div className="vhn-note">“{t(it.note)}”</div>}
              </div>
              <div className="vhn-act">
                {it.pancake_link && (
                  <a className="vhn-btn open" href={it.pancake_link} target="_blank" rel="noreferrer">
                    <Ico d={I_OPEN} /> {t("Mở hội thoại")}
                  </a>
                )}
                <button className="vhn-btn ok" disabled={pending} onClick={() => lam(it.id, "cham")}>
                  <Ico d={I_CHECK} /> {t("Đã nhắn")}
                </button>
                <button className="vhn-btn no" disabled={pending} onClick={() => lam(it.id, "bo")} title={t("Không quan tâm / sai số")}>
                  <Ico d={I_X} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .vhn { max-width: 860px; }
        .vhn-top { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:18px; }
        .vhn-big { font-size:40px; font-weight:700; line-height:1; letter-spacing:-1px; }
        .vhn-sub { color:var(--muted,#8b93a1); font-size:13px; margin-top:4px; }
        .vhn-done { display:flex; align-items:center; gap:6px; color:#16a34a; font-size:13px; font-weight:600; }
        .vhn-loi { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:8px; padding:8px 12px; font-size:13px; margin-bottom:12px; }
        .vhn-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
        .vhn-row { display:flex; align-items:center; justify-content:space-between; gap:14px;
          border:1px solid var(--border,#e5e7eb); border-radius:10px; padding:11px 14px; background:var(--card,#fff); }
        .vhn-row.nong { border-color:#fdba74; background:#fff7ed; }
        .vhn-info { min-width:0; flex:1; }
        .vhn-name { font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .vhn-tag { display:inline-flex; align-items:center; gap:3px; background:#ea580c; color:#fff;
          font-size:10px; font-weight:600; padding:2px 6px; border-radius:5px; }
        .vhn-age { color:var(--muted,#8b93a1); font-size:11px; font-weight:400; }
        .vhn-note { color:var(--muted,#6b7280); font-size:12.5px; margin-top:3px; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap; }
        .vhn-act { display:flex; align-items:center; gap:6px; flex-shrink:0; }
        .vhn-btn { display:inline-flex; align-items:center; gap:5px; border-radius:7px; font-size:12.5px;
          font-weight:600; padding:6px 10px; cursor:pointer; border:1px solid var(--border,#e5e7eb);
          background:var(--card,#fff); color:inherit; text-decoration:none; }
        .vhn-btn:disabled { opacity:.5; cursor:default; }
        .vhn-btn.open { color:#2563eb; border-color:#bfdbfe; }
        .vhn-btn.ok { background:#16a34a; border-color:#16a34a; color:#fff; }
        .vhn-btn.no { color:#9ca3af; padding:6px 8px; }
        .vhn-het { display:flex; flex-direction:column; align-items:center; gap:10px; color:#16a34a;
          padding:48px 0; font-size:14px; }
        @media (max-width:640px) {
          .vhn-row { flex-direction:column; align-items:stretch; }
          .vhn-act { justify-content:flex-end; }
          .vhn-note { white-space:normal; }
        }
      `}</style>
    </div>
  );
}
