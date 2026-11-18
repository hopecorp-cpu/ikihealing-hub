"use client";
import { useLang } from "@/components/lang-provider";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, XCircle, ClipboardCheck, RotateCcw, Sparkles, Settings2, Loader2 } from "lucide-react";
import { layDeBai, nopBai, maySoanDeNhap, catDatQuiz, layDeDayDu, suaCau } from "./quiz-actions";

type De = Awaited<ReturnType<typeof layDeBai>>;
type KQ = Extract<Awaited<ReturnType<typeof nopBai>>, { ok: true }>;

export default function QuizBlock({ articleId, laQuanLy }: { articleId: string; laQuanLy: boolean }) {
  const { t: t } = useLang();
  const [de, setDe] = useState<De | null>(null);
  const [chon, setChon] = useState<number[]>([]);
  const [kq, setKq] = useState<KQ | null>(null);
  const [batDau, setBatDau] = useState<number>(0);
  const [pending, start] = useTransition();
  const [loi, setLoi] = useState("");
  const [moQuanLy, setMoQuanLy] = useState(false);

  const taiDe = () => start(async () => {
    const d = await layDeBai(articleId);
    setDe(d);
    if (d.ok && d.cauHoi) { setChon(Array(d.cauHoi.length).fill(-1)); setKq(null); setBatDau(Date.now()); }
  });
  useEffect(() => { taiDe(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [articleId]);

  if (!de || !de.ok) return null;
  const quiz = de.quiz;

  if (!quiz || !de.cauHoi.length) {
    if (!laQuanLy) return null;
    return (
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">{t("Bài này chưa có bài kiểm tra.")}</p>
        <QuanLy articleId={articleId} onXong={taiDe} />
      </div>
    );
  }

  const chuaChon = chon.filter((c) => c < 0).length;
  const nop = () => start(async () => {
    setLoi("");
    const r = await nopBai(quiz.id, chon, Math.round((Date.now() - batDau) / 1000));
    if (!r.ok) { setLoi(r.error); return; }
    setKq(r);
  });

  return (
    <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <ClipboardCheck className="h-5 w-5 text-emerald-600" /> {t(quiz.title) || t("Kiểm tra hiểu bài")}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>{t("Đạt từ")} {quiz.passPct}%</span>
          {de.lanLam > 0 && <span>{t("· đã làm")} {de.lanLam} {t("lần · cao nhất")} {de.diemCaoNhat}%</span>}
          {de.daDat && <span className="rounded-full bg-emerald-600 px-2 py-0.5 font-semibold text-white">{t("ĐÃ ĐẠT")}</span>}
          {laQuanLy && (
            <button onClick={() => setMoQuanLy((v) => !v)} className="ml-2 inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1 hover:bg-gray-50">
              <Settings2 className="h-3.5 w-3.5" /> {t("Quản lý đề")}
            </button>
          )}
        </div>
      </div>

      {laQuanLy && moQuanLy && <QuanLy articleId={articleId} onXong={() => { setMoQuanLy(false); taiDe(); }} />}

      <ol className="space-y-4">
        {de.cauHoi.map((c, i) => {
  const { t: t } = useLang();
          const ct = kq?.chiTiet[i];
          return (
            <li key={c.id} className="rounded-xl border bg-white p-4">
              <p className="mb-2 text-sm font-medium text-gray-800"><span className="mr-1 text-gray-400">{i + 1}.</span>{c.question}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {c.choices.map((lc, j) => {
                  const dangChon = chon[i] === j;
                  let cls = "border-gray-200 bg-white hover:bg-gray-50";
                  if (kq && ct) {
                    if (j === ct.dapAn) cls = "border-emerald-400 bg-emerald-50 font-medium";
                    else if (dangChon && !ct.dung) cls = "border-red-300 bg-red-50";
                  } else if (dangChon) cls = "border-emerald-500 bg-emerald-50 font-medium";
                  return (
                    <button key={j} disabled={!!kq} onClick={() => setChon((cu) => { const m = [...cu]; m[i] = j; return m; })}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-default ${cls}`}>
                      <span className="mr-1.5 text-gray-400">{String.fromCharCode(65 + j)}.</span>{lc}
                    </button>
                  );
                })}
              </div>
              {kq && ct && (
                <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${ct.dung ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                  {ct.dung ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>{t(ct.giaiThich) || (ct.dung ? t("Đúng.") : t("Chưa đúng — xem lại đáp án được tô xanh."))}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {loi && <p className="mt-3 text-sm text-red-600">{loi}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!kq ? (
          <>
            <button onClick={nop} disabled={pending || chuaChon > 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {pending ? t("Đang chấm...") : t("Nộp bài")}
            </button>
            {chuaChon > 0 && <span className="text-xs text-gray-500">{t("Còn")} {chuaChon} {t("câu chưa chọn")}</span>}
          </>
        ) : (
          <>
            <div className={`rounded-xl px-4 py-2 text-sm font-semibold ${kq.passed ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900"}`}>
              {kq.scorePct}% — {kq.passed ? t("Đạt. Bài này đã được đánh dấu đã đọc và hiểu.") : `Chưa đạt (cần ${kq.passPct}%). Đọc lại phần giải thích rồi làm lại.`}
            </div>
            <button onClick={taiDe} className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50">
              <RotateCcw className="h-4 w-4" /> {t("Làm lại")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function QuanLy({ articleId, onXong }: { articleId: string; onXong: () => void }) {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [tb, setTb] = useState("");
  const [de, setDe] = useState<Awaited<ReturnType<typeof layDeDayDu>> | null>(null);
  const [soCau, setSoCau] = useState(5);

  const tai = () => start(async () => { const d = await layDeDayDu(articleId); setDe(d); });
  useEffect(() => { tai(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [articleId]);

  const soan = () => start(async () => {
    setTb("Máy đang đọc bài và soạn đề...");
    const r = await maySoanDeNhap(articleId, soCau);
    setTb(r.ok ? `Đã soạn ${r.soCau} câu NHÁP. Đọc kỹ từng câu, sửa chỗ sai, rồi mới bật cho nhân viên.` : r.error);
    tai();
  });
  const bat = (active: boolean) => start(async () => {
    if (!de?.ok || !de.quiz) return;
    const r = await catDatQuiz(de.quiz.id, { active });
    setTb(r.ok ? (active ? "Đã BẬT — nhân viên thấy bài kiểm tra ở cuối bài." : "Đã tắt.") : r.error);
    tai(); onXong();
  });
  const doiNguong = (v: number) => start(async () => {
    if (!de?.ok || !de.quiz) return;
    await catDatQuiz(de.quiz.id, { passPct: v }); tai();
  });
  const doiDapAn = (cauId: string, idx: number) => start(async () => { await suaCau(cauId, { correct_idx: idx }); tai(); });

  const quiz = de?.ok ? de.quiz : null;
  const cauHoi = de?.ok ? de.cauHoi : [];

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-gray-600">{t("Số câu")}
          <input type="number" min={3} max={10} value={soCau} onChange={(e) => setSoCau(Number(e.target.value) || 5)} className="w-14 rounded border px-1.5 py-1" />
        </label>
        <button onClick={soan} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {t("Máy soạn đề nháp")}
        </button>
        {quiz && (
          <>
            <label className="flex items-center gap-1 text-xs text-gray-600">{t("Ngưỡng đạt")}
              <input type="number" min={1} max={100} defaultValue={quiz.pass_pct} onBlur={(e) => doiNguong(Number(e.target.value))} className="w-14 rounded border px-1.5 py-1" />%
            </label>
            {quiz.active
              ? <button onClick={() => bat(false)} className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50">{t("Tắt bài kiểm tra")}</button>
              : <button onClick={() => bat(true)} disabled={!cauHoi.length} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{t("Bật cho nhân viên")}</button>}
            <span className={`text-xs ${quiz.active ? "text-emerald-700" : "text-amber-700"}`}>{quiz.active ? t("đang bật") : t("đang NHÁP — nhân viên chưa thấy")}</span>
          </>
        )}
      </div>
      {tb && <p className="text-xs text-gray-700">{tb}</p>}
      {cauHoi.length > 0 && (
        <ol className="space-y-2">
          {cauHoi.map((c, i) => (
            <li key={c.id} className="rounded-lg border bg-white p-3">
              <p className="mb-1 font-medium text-gray-800">{i + 1}. {c.question}</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {c.choices.map((lc, j) => (
                  <button key={j} onClick={() => c.id && doiDapAn(c.id, j)} title={t("Bấm để đặt làm đáp án đúng")}
                    className={`rounded border px-2 py-1 text-left text-xs ${j === c.correct_idx ? "border-emerald-500 bg-emerald-50 font-semibold" : "border-gray-200 hover:bg-gray-50"}`}>
                    {String.fromCharCode(65 + j)}. {lc}
                  </button>
                ))}
              </div>
              {c.explanation && <p className="mt-1 text-xs text-gray-500">{t("Giải thích:")} {c.explanation}</p>}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[11px] text-gray-500">{t("Đề máy soạn là NHÁP. Đề sai còn hại hơn không có đề, vì nó dạy sai mà lại đóng dấu &quot;đạt&quot;. Đọc từng câu rồi mới bật.")}</p>
    </div>
  );
}
