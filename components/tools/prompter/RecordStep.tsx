"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Circle, Square, Camera, CameraOff, Mic, MicOff, SwitchCamera, ChevronDown } from "lucide-react";
import Teleprompter from "./Teleprompter";
import { useLang } from "@/components/lang-provider";

type Facing = "user" | "environment" | "unknown";

const LIMITS = [10, 20, 30, 60] as const;
type Limit = (typeof LIMITS)[number];
const bitrateFor = (min: Limit) => (min <= 20 ? 5_000_000 : min <= 30 ? 4_000_000 : 3_000_000);

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export default function RecordStep({
  script, onDone, onBack,
}: { script: string; onDone: (blob: Blob) => void; onBack: () => void }) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const wakeLockRef = useRef<any>(null);

  const [permission, setPermission] = useState<"idle" | "granted" | "denied">("idle");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPrompter, setShowPrompter] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [limitMin, setLimitMin] = useState<Limit>(10);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("rec_limit_min"));
      if ((LIMITS as readonly number[]).includes(v)) setLimitMin(v as Limit);
    } catch {}
  }, []);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    init();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wakeLockRef.current?.release?.().catch?.(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const savedFacing = (typeof localStorage !== "undefined" ? localStorage.getItem("rec_facing") : null) as Facing | null;
    const savedDeviceId = typeof localStorage !== "undefined" ? localStorage.getItem("rec_deviceId") : null;
    await requestMedia({ deviceId: savedDeviceId || undefined, facingMode: savedFacing || "user" });
    await enumerateCameras();
  }

  async function enumerateCameras() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setCameras(all.filter((d) => d.kind === "videoinput"));
    } catch {}
  }

  async function requestMedia(opts: { deviceId?: string; facingMode?: Facing }) {
    try {

      streamRef.current?.getTracks().forEach((t) => t.stop());

      const video: MediaTrackConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      };
      if (opts.deviceId) video.deviceId = { exact: opts.deviceId };
      else if (opts.facingMode && opts.facingMode !== "unknown") video.facingMode = { ideal: opts.facingMode };

      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermission("granted");

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      const deviceId = settings?.deviceId || null;
      const fm = (settings?.facingMode as Facing) || opts.facingMode || "unknown";
      setCurrentCameraId(deviceId);
      setFacing(fm);

      if (typeof localStorage !== "undefined") {
        if (deviceId) localStorage.setItem("rec_deviceId", deviceId);
        localStorage.setItem("rec_facing", fm);
      }

      stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
      stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
    } catch (e: any) {
      setPermission("denied");
      setError(e.message || t("Không truy cập được camera/mic"));
    }
  }

  async function switchCamera(deviceId: string) {
    if (recording) return;
    setSwitching(true);
    setPickerOpen(false);
    await requestMedia({ deviceId });
    await enumerateCameras();
    setSwitching(false);
  }

  async function flipCamera() {
    if (recording || switching) return;
    setSwitching(true);
    const next: Facing = facing === "environment" ? "user" : "environment";
    await requestMedia({ facingMode: next });
    await enumerateCameras();
    setSwitching(false);
  }

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(s);
      if (s >= limitMin * 60) stopRecording();
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, limitMin]);

  function toggleTrack(kind: "video" | "audio", on: boolean) {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((t) => {
      if (t.kind === kind) t.enabled = on;
    });
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    setError(null);
    chunksRef.current = [];
    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: bitrateFor(limitMin),
      audioBitsPerSecond: 128_000,

      videoKeyFrameIntervalDuration: 2000,
    } as MediaRecorderOptions);
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      wakeLockRef.current?.release?.().catch?.(() => {});
      wakeLockRef.current = null;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
      chunksRef.current = [];
      onDone(blob);
    };
    rec.start(1000);
    recorderRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setRecording(true);

    (navigator as any).wakeLock?.request?.("screen").then((l: any) => { wakeLockRef.current = l; }).catch(() => {});
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const remaining = limitMin * 60 - elapsed;
  const estMB = Math.round(((bitrateFor(limitMin) + 128_000) * limitMin * 60) / 8 / 1024 / 1024);

  const mirror = facing === "user";

  const hasMultiple = cameras.length > 1;
  const currentLabel = (() => {
    const cur = cameras.find((c) => c.deviceId === currentCameraId);
    if (cur?.label) return cur.label.length > 28 ? cur.label.slice(0, 28) + "…" : cur.label;
    if (facing === "user") return t("Camera trước");
    if (facing === "environment") return t("Camera sau");
    return t("Camera mặc định");
  })();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5 font-medium">
          <ArrowLeft className="w-4 h-4" /> {t("Quay lại kịch bản")}
        </button>

        <div className="flex items-center gap-3">
          {hasMultiple && !recording && (
            <div className="relative">
              <button
                onClick={() => setPickerOpen((o) => !o)}
                disabled={switching}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-700">{currentLabel}</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
              {pickerOpen && (
                <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-40 py-1 max-h-64 overflow-auto">
                  {cameras.map((c, i) => (
                    <button
                      key={c.deviceId || i}
                      onClick={() => switchCamera(c.deviceId)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                        c.deviceId === currentCameraId ? "text-brand-700 bg-brand-50 font-medium" : "text-gray-700"
                      }`}
                    >
                      {tDich(c.label) || `${t("Camera")} ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <label className="text-sm flex items-center gap-2 text-gray-700 font-medium">
            {t("Quay tối đa")}
            <select
              value={limitMin}
              disabled={recording}
              onChange={(e) => {
                const v = Number(e.target.value) as Limit;
                setLimitMin(v);
                try { localStorage.setItem("rec_limit_min", String(v)); } catch {}
              }}
              className="text-sm px-2 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-50"
            >
              {LIMITS.map((m) => <option key={m} value={m}>{m} {t("phút")}</option>)}
            </select>
          </label>
          <label className="text-sm flex items-center gap-2 text-gray-700 font-medium">
            <input
              type="checkbox" checked={showPrompter}
              onChange={(e) => setShowPrompter(e.target.checked)}
              className="accent-brand-600 w-4 h-4"
            />
            {t("Hiện teleprompter")}
          </label>
        </div>
      </div>

      <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-gray-200 shadow-sm">
        <video
          ref={videoRef}
          autoPlay muted playsInline
          className={`absolute inset-0 w-full h-full object-cover ${mirror ? "scale-x-[-1]" : ""}`}
        />
        {showPrompter && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/55">
            <Teleprompter script={script} autoStart={recording} />
          </div>
        )}
        {permission === "denied" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-center p-6 text-white">
            <div>
              <p className="font-semibold mb-2">{t("Cần quyền truy cập camera & micro")}</p>
              <p className="text-white/60 text-sm mb-4">{error}</p>
              <button onClick={() => requestMedia({ facingMode: "user" })} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
                {t("Thử lại")}
              </button>
            </div>
          </div>
        )}
        {switching && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-sm text-white">
            {t("Đang đổi camera...")}
          </div>
        )}
        {recording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full text-sm text-white shadow-md">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            REC {mm}:{ss} <span className="opacity-75">/ {limitMin}:00</span>
          </div>
        )}
        {recording && remaining <= 60 && remaining > 0 && (
          <div className="absolute top-4 right-4 bg-black/75 px-3 py-1 rounded-lg text-sm text-white">
            {t("Còn")} {remaining}s {t("sẽ tự dừng")}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { setCamOn((v) => { toggleTrack("video", !v); return !v; }); }}
            className="w-11 h-11 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition"
            aria-label={t("Bật/tắt camera")}
          >
            {camOn ? <Camera className="w-5 h-5 text-gray-700" /> : <CameraOff className="w-5 h-5 text-red-500" />}
          </button>

          {hasMultiple && !recording && (
            <button
              onClick={flipCamera}
              disabled={switching}
              className="w-11 h-11 rounded-full border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center transition"
              aria-label={t("Đổi camera trước/sau")}
              title={t("Đổi camera trước/sau")}
            >
              <SwitchCamera className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {!recording ? (
            <button
              onClick={startRecording}
              disabled={permission !== "granted" || switching}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-40 flex items-center justify-center shadow-md shadow-red-200 transition"
              aria-label={t("Bắt đầu quay")}
            >
              <Circle className="w-7 h-7 fill-white text-white" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-gray-900 hover:bg-black text-white flex items-center justify-center shadow-md transition"
              aria-label={t("Dừng quay")}
            >
              <Square className="w-6 h-6 fill-white text-white" />
            </button>
          )}

          <button
            onClick={() => { setMicOn((v) => { toggleTrack("audio", !v); return !v; }); }}
            className="w-11 h-11 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition"
            aria-label={t("Bật/tắt mic")}
          >
            {micOn ? <Mic className="w-5 h-5 text-gray-700" /> : <MicOff className="w-5 h-5 text-red-500" />}
          </button>
        </div>

        <p className="text-center text-gray-500 text-sm mt-3">
          {recording
            ? t("Đang quay — bấm vuông để dừng")
            : facing === "environment"
            ? t("Đang dùng camera sau — bạn cần thấy màn hình để đọc teleprompter")
            : t("Bấm nút đỏ để bắt đầu quay")}
        </p>
        {!recording && (
          <p className="text-center text-gray-400 text-xs mt-1">
            {t("Tự dừng sau")} {limitMin} {t("phút")} · {t("file tối đa khoảng")} {estMB} MB · {t("giữ tab này mở suốt lúc quay")}
          </p>
        )}
      </div>
    </div>
  );
}
