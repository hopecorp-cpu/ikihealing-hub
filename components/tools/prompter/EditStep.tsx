"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Download, RefreshCw, Captions, Scissors, Mic, Eye, Wand2,
  Settings, AlertCircle, CheckCircle2, Loader2, FileVideo, X,
} from "lucide-react";
import {
  probeDuration, detectSilenceStream, buildKeepRanges, exportMp4, pickSaveFile, estimateSizeMB,
  type Range as SilenceRange, type ExportPreset,
} from "@/lib/tools/video-pipeline";
import { useLang } from "@/components/lang-provider";

type Caption = { start: number; end: number; text: string };

export default function EditStep({
  blob: initialBlob, script, transcript, setTranscript, onBack, onRetake,
}: {
  blob: Blob; script: string; transcript: string; setTranscript: (s: string) => void;
  onBack: () => void; onRetake: () => void;
}) {
  const { t: tDich } = useLang();
  const { t } = useLang();

  const [blob, setBlob] = useState<Blob>(initialBlob);
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);

  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [silences, setSilences] = useState<SilenceRange[]>([]);
  const [cutSilence, setCutSilence] = useState(true);

  const [preset, setPreset] = useState<ExportPreset>("cao");
  const abortRef = useRef<AbortController | null>(null);
  const [eta, setEta] = useState<string>("");

  const [sieveOpen, setSieveOpen] = useState(false);
  const [sieveKey, setSieveKey] = useState("");
  const [sieveFn, setSieveFn] = useState("sieve/eye-contact-correction");

  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    const k = localStorage.getItem("sieve_key") || "";
    const fn = localStorage.getItem("sieve_fn") || "sieve/eye-contact-correction";
    setSieveKey(k);
    setSieveFn(fn);
  }, []);

  useEffect(() => {
    if (!transcript.trim() && script.trim()) setTranscript(script.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setCurrentTime(0);
    setSilences([]);
    let cancelled = false;
    const setD = (d: number) => { if (!cancelled && isFinite(d) && d > 0) { setDuration(d); setTrimEnd(d); } };
    const onMeta = () => { if (isFinite(v.duration) && v.duration > 0) setD(v.duration); };
    v.addEventListener("loadedmetadata", onMeta);

    probeDuration(blob).then(setD).catch(() => {});
    return () => { cancelled = true; v.removeEventListener("loadedmetadata", onMeta); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const keepRanges = useMemo(
    () => (duration ? buildKeepRanges(cutSilence ? silences : [], trimStart, trimEnd || duration, 0.1) : []),
    [silences, cutSilence, trimStart, trimEnd, duration],
  );
  const keptSeconds = keepRanges.reduce((a, r) => a + (r.end - r.start), 0);

  const captions: Caption[] = useMemo(() => {
    if (!transcript.trim() || !duration) return [];
    const sentences = transcript
      .split(/(?<=[.!?…\n])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!sentences.length) return [];
    const totalLen = sentences.reduce((a, s) => a + s.length, 0);
    let t = 0;
    return sentences.map((s) => {
      const dur = (s.length / totalLen) * duration;
      const c = { start: t, end: t + dur, text: s };
      t += dur;
      return c;
    });
  }, [transcript, duration]);

  const activeCaption = captions.find((c) => currentTime >= c.start && currentTime < c.end);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);

    if (!v.paused && keepRanges.length && (cutSilence && silences.length || previewingTrim)) {
      const t = v.currentTime;
      const inKeep = keepRanges.some((r) => t >= r.start - 0.02 && t < r.end);
      if (!inKeep) {
        const next = keepRanges.find((r) => r.start > t);
        if (next) v.currentTime = next.start;
        else { v.pause(); setPreviewingTrim(false); }
        return;
      }
    }
    if (previewingTrim) {
      if (v.currentTime < trimStart) v.currentTime = trimStart;
      if (v.currentTime >= trimEnd) {
        v.pause();
        v.currentTime = trimEnd;
        setPreviewingTrim(false);
      }
    }
  }

  const [previewingTrim, setPreviewingTrim] = useState(false);

  async function previewTrim() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = trimStart;
    setPreviewingTrim(true);
    try { await v.play(); } catch {}
  }

  function flashError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 6000);
  }
  function flashInfo(msg: string) {
    setInfo(msg);
    setTimeout(() => setInfo(null), 6000);
  }

  async function analyzeSilence() {
    setBusy(t("Đang phân tích âm thanh..."));
    setProgress(0);
    setError(null);
    try {
      const ranges = await detectSilenceStream(blob, { threshold: 0.012, minSilence: 0.6 }, setProgress);
      setSilences(ranges);
      setCutSilence(true);
      const totalCut = ranges.reduce((a, r) => a + (r.end - r.start), 0);
      if (!ranges.length) flashInfo(t("Không phát hiện đoạn im lặng nào (>0.6s)."));
      else flashInfo(`${t("Tìm thấy")} ${ranges.length} ${t("đoạn ngừng, tổng ~")}${totalCut.toFixed(1)}s. ${t("Bấm phát để nghe thử — đoạn ngừng được bỏ qua.")}`);
    } catch (e: any) {
      flashError(e.message || t("Lỗi giải mã audio"));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  const ext = (blob.type || "").includes("mp4") ? "mp4" : "webm";
  async function downloadOriginal() {
    const a = document.createElement("a");
    a.href = url; a.download = `prompter-goc-${Date.now()}.${ext}`; a.click();
  }

  async function downloadMp4() {
    if (!keepRanges.length) { flashError(t("Không còn đoạn nào để giữ lại")); return; }
    const name = `prompter-${Date.now()}.mp4`;

    const file = await pickSaveFile(name);
    if (file === "cancel") return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(t("Đang cắt + nén + xuất MP4..."));
    setProgress(0); setEta(""); setError(null);
    const t0 = Date.now();
    try {
      const res = await exportMp4(blob, keepRanges, preset, (p) => {
        setProgress(p);
        const sec = (Date.now() - t0) / 1000;
        if (p > 0.02 && sec > 2) {
          const left = Math.max(0, Math.round(sec / p - sec));
          setEta(left >= 60 ? `${Math.floor(left / 60)} ${t("phút")} ${left % 60}s` : `${left}s`);
        }
      }, file ?? undefined, ctrl.signal);
      if (res.blob) {
        const u = URL.createObjectURL(res.blob);
        const a = document.createElement("a");
        a.href = u; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(u), 60_000);
      }
      const took = Math.round((Date.now() - t0) / 1000);
      flashInfo(`MP4 ${(res.size / 1024 / 1024).toFixed(1)} MB · ${fmt(keptSeconds)} · ${t("xong sau")} ${took}s — ${file ? t("đã lưu vào máy.") : t("đã tải về.")}`);
    } catch (e: any) {
      flashError(ctrl.signal.aborted ? t("Đã huỷ xuất video.") : (e.message || t("Lỗi xuất MP4")));
    } finally {
      abortRef.current = null;
      setBusy(null);
      setProgress(0);
      setEta("");
    }
  }

  function downloadSrt() {
    if (!captions.length) { flashError(t("Chưa có phụ đề.")); return; }
    const srt = captions.map((c, i) =>
      `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.text}\n`
    ).join("\n");
    const b = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `captions-${Date.now()}.srt`;
    a.click();
  }

  async function transcribeLive() {
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) { flashError(t("Trình duyệt không hỗ trợ Web Speech. Dùng Chrome.")); return; }
    const v = videoRef.current; if (!v) return;
    setTranscribing(true);
    setTranscript("");
    const rec = new SR();
    rec.lang = "vi-VN"; rec.continuous = true; rec.interimResults = true;
    let final = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += txt + " ";
        else interim += txt;
      }
      setTranscript((final + interim).trim());
    };
    rec.onend = () => setTranscribing(false);
    rec.onerror = () => setTranscribing(false);
    v.currentTime = trimStart; v.muted = false; v.volume = 1;
    await v.play();
    rec.start();
    const stop = () => {
      rec.stop();
      v.removeEventListener("pause", stop);
      v.removeEventListener("ended", stop);
    };
    v.addEventListener("pause", stop);
    v.addEventListener("ended", stop);
  }

  function saveSieveSettings() {
    localStorage.setItem("sieve_key", sieveKey);
    localStorage.setItem("sieve_fn", sieveFn);
    flashInfo(t("Đã lưu Sieve settings vào trình duyệt."));
    setSieveOpen(false);
  }

  async function runSieveEyeFix() {
    if (!sieveKey.trim()) { setSieveOpen(true); flashError(t("Cần nhập Sieve API key trước.")); return; }
    setBusy(t("Đang upload video lên Sieve..."));
    setProgress(0); setError(null);
    try {

      const fd = new FormData();
      fd.append("file", new File([blob], "input.webm", { type: blob.type || "video/webm" }));
      fd.append("function", sieveFn);
      const submit = await fetch("/api/tools/sieve/push", {
        method: "POST",
        headers: { "x-sieve-key": sieveKey },
        body: fd,
      });
      const submitJson = await submit.json();
      if (!submit.ok) throw new Error(submitJson.error || t("Upload thất bại"));
      const { jobId } = submitJson;
      setBusy(`${t("Đang xử lý AI fix mắt... (job")} ${jobId.slice(0, 8)}...)`);

      let outputUrl: string | null = null;
      const start = Date.now();
      while (true) {
        await new Promise((r) => setTimeout(r, 3000));
        if (Date.now() - start > 10 * 60 * 1000) throw new Error(t("Hết thời gian chờ (10 phút)."));
        const st = await fetch(`/api/tools/sieve/status?id=${encodeURIComponent(jobId)}`, {
          headers: { "x-sieve-key": sieveKey },
        });
        const stJson = await st.json();
        if (!st.ok) throw new Error(stJson.error || t("Lỗi status"));
        if (stJson.status === "finished") { outputUrl = stJson.outputUrl; break; }
        if (stJson.status === "error") throw new Error(stJson.raw?.error || "Sieve job error");

      }
      if (!outputUrl) throw new Error(t("Không có URL output từ Sieve"));

      setBusy(t("Đang tải video đã sửa..."));
      const r = await fetch(outputUrl);
      if (!r.ok) throw new Error(`${t("Tải output thất bại:")} ${r.status}`);
      const out = await r.blob();
      setBlob(out);
      flashInfo(`${t("AI fix mắt xong. Kích thước:")} ${(out.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e: any) {
      flashError(e.message || t("Lỗi Sieve"));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5 font-medium">
            <ArrowLeft className="w-4 h-4" /> {t("Quay lại")}
          </button>
          <span className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{(blob.size / 1024 / 1024).toFixed(1)} MB</span> · {fmt(duration)}
          </span>
        </div>

        <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-gray-200 shadow-sm">
          <video
            ref={videoRef}
            src={url}
            controls
            onTimeUpdate={onTimeUpdate}
            className="absolute inset-0 w-full h-full"
          />
          {showCaptions && activeCaption && (
            <div className="pointer-events-none absolute inset-x-6 bottom-16 text-center">
              <span className="inline-block px-4 py-2 rounded-lg bg-black/75 text-white text-xl font-medium leading-snug">
                {activeCaption.text}
              </span>
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 bg-black/75 flex items-center justify-center backdrop-blur-sm">
              <div className="text-center max-w-sm px-6 text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-400" />
                <p className="text-sm font-medium">{busy}</p>
                {progress > 0 && (
                  <>
                    <div className="mt-3 h-1.5 bg-white/15 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-white/70 tabular-nums">
                      {Math.round(progress * 100)}%{eta ? ` · ${t("còn khoảng")} ${eta}` : ""}
                    </p>
                  </>
                )}
                {abortRef.current && (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    className="mt-3 px-3 py-1.5 rounded-lg border border-white/30 hover:bg-white/10 text-xs inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> {t("Huỷ")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {(error || info) && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${error ? "bg-red-50 border border-red-200 text-red-700" : "bg-brand-50 border border-brand-200 text-brand-700"}`}>
            {error ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{error || info}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t("Cắt video")}</h3>
            <span className="text-xs text-gray-500 ml-auto tabular-nums">
              {fmt(trimStart, true)} → {fmt(trimEnd, true)} · {t("giữ")} <span className="font-semibold text-gray-700">{fmt(Math.max(0, trimEnd - trimStart), true)}</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            <strong className="text-gray-700">{t("Cách dùng:")}</strong> {t("kéo 2 thanh chọn đoạn muốn giữ → bấm")} <em>{t("Xem trước")}</em> {t("kiểm tra. Phần ngoài 2 thanh bị bỏ khi bấm")} <em>{t("Xuất MP4")}</em> {t("— cắt, bỏ im lặng và nén làm chung một lượt.")}
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs text-gray-600 font-medium">{t("Bắt đầu:")} <span className="text-gray-900 font-semibold">{fmt(trimStart, true)}</span></label>
              <input
                type="range" min={0} max={duration || 0.01} step={0.05} value={trimStart}
                onChange={(e) => {
                  const v = Math.min(+e.target.value, trimEnd - 0.1);
                  setTrimStart(v);
                  if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = v; }
                  setPreviewingTrim(false);
                }}
                className="w-full accent-brand-600 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium">{t("Kết thúc:")} <span className="text-gray-900 font-semibold">{fmt(trimEnd, true)}</span></label>
              <input
                type="range" min={0} max={duration || 0.01} step={0.05} value={trimEnd}
                onChange={(e) => {
                  const v = Math.max(+e.target.value, trimStart + 0.1);
                  setTrimEnd(v);
                  if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = v; }
                  setPreviewingTrim(false);
                }}
                className="w-full accent-brand-600 mt-1"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={previewTrim}
                disabled={!!busy || !duration}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm text-gray-700 flex items-center gap-1.5"
              >
                {t("▶ Xem trước đoạn cắt")}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <Wand2 className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t("Tự cắt đoạn im lặng / ngừng")}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={analyzeSilence}
              disabled={!!busy}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm text-gray-700"
            >
              {t("Phân tích âm thanh")}
            </button>
            {silences.length > 0 && (
              <label className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 flex items-center gap-2">
                <input
                  type="checkbox" checked={cutSilence}
                  onChange={(e) => setCutSilence(e.target.checked)}
                  className="accent-brand-600 w-4 h-4"
                />
                {t("Bỏ")} {silences.length} {t("đoạn im lặng khi xuất")}
              </label>
            )}
          </div>
          {silences.length > 0 && (
            <div className="mt-3 text-xs text-gray-600 max-h-32 overflow-auto space-y-0.5 bg-gray-50 rounded-lg p-2">
              {silences.map((s, i) => (
                <div key={i} className="flex items-center justify-between tabular-nums">
                  <span>#{i + 1}: {fmt(s.start)} → {fmt(s.end)}</span>
                  <span className="text-red-600 font-semibold">−{(s.end - s.start).toFixed(1)}s</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            {t("Phát hiện đoạn ngừng > 0.6s. Sau khi cắt, video sẽ liền mạch hơn.")}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <Eye className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t("AI sửa mắt nhìn camera")}</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Cloud</span>
            <button
              onClick={() => setSieveOpen((o) => !o)}
              className="ml-auto p-1.5 rounded hover:bg-gray-100"
              aria-label={t("Settings")}
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {sieveOpen && (
            <div className="mb-3 space-y-2 text-sm bg-gray-50 -mx-2 px-3 py-3 rounded-lg">
              <label className="text-xs text-gray-600 font-medium">{t("Sieve API key")}</label>
              <input
                type="password" value={sieveKey} onChange={(e) => setSieveKey(e.target.value)}
                placeholder="sieve_..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
              <label className="text-xs text-gray-600 font-medium">{t("Function slug")}</label>
              <input
                value={sieveFn} onChange={(e) => setSieveFn(e.target.value)}
                placeholder="sieve/eye-contact-correction"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
              <div className="flex gap-2">
                <button onClick={saveSieveSettings} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">{t("Lưu")}</button>
                <a href="https://www.sieve.com/explore" target="_blank" className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700">{t("Lấy key")}</a>
              </div>
              <p className="text-[11px] text-gray-500">
                {t("Key lưu trong trình duyệt. Video sẽ được upload qua proxy server đến Sieve.")}
              </p>
            </div>
          )}
          <button
            onClick={runSieveEyeFix}
            disabled={!!busy}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-sm font-medium text-white flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            {t("Sửa mắt nhìn camera (Sieve AI)")}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            {t("Tốn ~$0.03/phút video. Job chạy 1-3 phút tuỳ độ dài.")}
          </p>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <Captions className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t("Phụ đề")}</h3>
            <label className="ml-auto text-xs flex items-center gap-1.5 text-gray-700">
              <input type="checkbox" checked={showCaptions} onChange={(e) => setShowCaptions(e.target.checked)} className="accent-brand-600 w-3.5 h-3.5" />
              {t("Overlay")}
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            {transcript.trim() === script.trim() && script.trim()
              ? t("✓ Đang dùng kịch bản gốc làm phụ đề.")
              : t("Phụ đề tự chia câu theo dấu chấm, canh theo độ dài video.")}
          </p>
          <textarea
            value={transcript} onChange={(e) => setTranscript(e.target.value)}
            placeholder={t("Phụ đề...")}
            className="w-full h-40 p-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm leading-relaxed text-gray-800"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setTranscript(script.trim())}
              disabled={!script.trim() || transcript.trim() === script.trim()}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm text-gray-700"
            >
              {t("Dùng kịch bản")}
            </button>
            <button onClick={transcribeLive} disabled={transcribing}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm text-gray-700">
              <Mic className="w-4 h-4" />{transcribing ? t("Đang nghe...") : t("Tự nghe")}
            </button>
            <button onClick={downloadSrt} disabled={!captions.length}
              className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm text-gray-700">
              {t("Tải .srt (")}{captions.length} {t("dòng)")}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <h3 className="font-semibold text-gray-900 mb-2 text-sm">{t("Xuất video")}</h3>
          <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 space-y-1 tabular-nums">
            <div className="flex justify-between"><span>{t("Video gốc")}</span><span>{fmt(duration)}</span></div>
            <div className="flex justify-between font-medium text-gray-800"><span>{t("Sau khi cắt")}</span><span>{fmt(keptSeconds)} · {keepRanges.length} {t("đoạn")}</span></div>
          </div>
          <label className="text-xs text-gray-600 font-medium block">{t("Chất lượng")}</label>
          <select
            value={preset} onChange={(e) => setPreset(e.target.value as ExportPreset)} disabled={!!busy}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white"
          >
            <option value="cao">{t("Cao — 1080p, đăng Reels/YouTube")} (~{Math.round(estimateSizeMB(keptSeconds, "cao"))} MB)</option>
            <option value="vua">{t("Vừa — 720p, gửi Zalo/Messenger")} (~{Math.round(estimateSizeMB(keptSeconds, "vua"))} MB)</option>
            <option value="nhe">{t("Nhẹ — 720p, file nhỏ nhất")} (~{Math.round(estimateSizeMB(keptSeconds, "nhe"))} MB)</option>
          </select>
          <button onClick={downloadMp4} disabled={!!busy || !keepRanges.length}
            className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 font-medium text-sm">
            <FileVideo className="w-4 h-4" /> {t("Xuất MP4 (đã cắt + nén)")}
          </button>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {t("Dùng chip đồ hoạ của máy nên nhanh hơn nhiều lần bản cũ. Chrome sẽ hỏi chỗ lưu file và ghi thẳng vào máy, video 60 phút cũng không bị đầy bộ nhớ.")}
          </p>
          <button onClick={downloadOriginal} disabled={!!busy}
            className="w-full py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2 font-medium text-sm text-gray-700">
            <Download className="w-4 h-4" /> {t("Tải bản gốc")} ({ext.toUpperCase()}, {(blob.size / 1024 / 1024).toFixed(0)} MB)
          </button>
          <button onClick={onRetake}
            className="w-full py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm text-gray-500">
            <RefreshCw className="w-4 h-4" /> {t("Quay lại lần nữa")}
          </button>
        </div>
      </aside>
    </div>
  );
}

function fmt(t: number, withDecimal = false) {
  if (!isFinite(t)) return withDecimal ? "0:00.0" : "0:00";
  const totalSec = Math.max(0, t);
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  if (withDecimal) {
    return `${m}:${(s < 10 ? "0" : "") + s.toFixed(1)}`;
  }
  return `${m}:${String(Math.floor(s)).padStart(2, "0")}`;
}
function fmtSrt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const ms = Math.floor((t % 1) * 1000);
  const s = Math.floor(t) % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
