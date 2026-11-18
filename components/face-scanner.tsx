"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RotateCw, X, FlipHorizontal, SwitchCamera } from "lucide-react";
import { useLang } from "@/components/lang-provider";

type Status = "idle" | "starting" | "ready" | "scanning" | "captured" | "error";
type FacingMode = "user" | "environment";

const LS_FACING = "acme-face-facing";
const LS_MIRROR = "acme-face-mirror";

export function FaceScanner({ onCapture, onCancel, mode = "check-in" }: {
  onCapture: (photoBase64: string) => void;
  onCancel: () => void;
  mode?: "check-in" | "check-out";
}) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>(() => {
    if (typeof window === "undefined") return "user";
    return (localStorage.getItem(LS_FACING) as FacingMode) || "user";
  });

  const [mirror, setMirror] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(LS_MIRROR);
    return v === null ? true : v === "1";
  });
  const [availableCameras, setAvailableCameras] = useState<number>(0);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then(list => {
      setAvailableCameras(list.filter(d => d.kind === "videoinput").length);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let stopped = false;
    setStatus("starting");
    setError("");
    (async () => {

      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;

      const tryConstraints = async (constraints: MediaStreamConstraints) => {
        return navigator.mediaDevices.getUserMedia(constraints);
      };

      try {
        let stream: MediaStream;
        try {

          stream = await tryConstraints({
            video: { facingMode: { ideal: facing }, width: { ideal: 720 }, height: { ideal: 720 } },
            audio: false
          });
        } catch {

          stream = await tryConstraints({ video: true, audio: false });
        }
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
      } catch (e: any) {
        setError(e?.message || t("Không truy cập được camera. Hãy cấp quyền Camera trong cài đặt trình duyệt."));
        setStatus("error");
      }
    })();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [facing]);

  const switchCamera = () => {
    const next: FacingMode = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (typeof window !== "undefined") localStorage.setItem(LS_FACING, next);
  };

  const toggleMirror = () => {
    const next = !mirror;
    setMirror(next);
    if (typeof window !== "undefined") localStorage.setItem(LS_MIRROR, next ? "1" : "0");
  };

  const startScan = async () => {
    setStatus("scanning");
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 700));
    }
    setCountdown(0);
    capture();
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = 480;
    c.height = 480;
    const ctx = c.getContext("2d")!;

    ctx.save();
    if (mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    const size = Math.min(v.videoWidth || 480, v.videoHeight || 480);
    const sx = ((v.videoWidth || 480) - size) / 2;
    const sy = ((v.videoHeight || 480) - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, c.width, c.height);
    ctx.restore();
    const dataUrl = c.toDataURL("image/jpeg", 0.75);
    setPreview(dataUrl);
    setStatus("captured");
  };

  const retake = () => {
    setPreview(null);
    setStatus("ready");
  };

  const confirm = () => {
    if (!preview) return;
    onCapture(preview);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <button onClick={onCancel} className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-md z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="bg-gradient-to-br from-[#0B1F14] to-[#143020] rounded-3xl p-6 text-white">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">
              {mode === "check-in" ? t("Face ID — Check In") : t("Face ID — Check Out")}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {status === "starting" && t("Đang khởi động camera...")}
              {status === "ready" && t("Đặt mặt vào khung tròn, bấm nút Scan")}
              {status === "scanning" && `${t("Đang chụp trong")} ${countdown || "..."}`}
              {status === "captured" && t("Ảnh đã chụp — confirm để chấm công")}
              {status === "error" && t("Lỗi camera")}
            </p>
          </div>

          <div className="relative aspect-square rounded-full overflow-hidden bg-black border-4 border-[#F5C518] shadow-2xl">
            {status !== "captured" ? (
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${mirror ? "scale-x-[-1]" : ""}`}
                playsInline
                muted
                autoPlay
              />
            ) : preview ? (
              <img src={preview} alt="Captured" className="w-full h-full object-cover" />
            ) : null}
            <canvas ref={canvasRef} className="hidden" />

            {status === "scanning" && countdown > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="text-7xl font-bold text-[#F5C518] animate-pulse">{countdown}</div>
              </div>
            )}

            {status === "scanning" && countdown === 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#F5C518] to-transparent animate-scan" />
              </div>
            )}

            {status === "captured" && (
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                <CheckCircle2 className="w-24 h-24 text-green-400 drop-shadow-lg" />
              </div>
            )}

            {(status === "ready" || status === "scanning") && (
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                {availableCameras > 1 && (
                  <button
                    onClick={switchCamera}
                    title={facing === "user" ? t("Chuyển camera sau") : t("Chuyển camera trước")}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-md text-white backdrop-blur"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={toggleMirror}
                  title={mirror ? t("Tắt lật ngang (ảnh sẽ đúng chiều thật)") : t("Bật lật ngang (selfie)")}
                  className={`p-2 rounded-md text-white backdrop-blur ${mirror ? "bg-[#F5C518]/30 ring-1 ring-[#F5C518]" : "bg-black/50 hover:bg-black/70"}`}
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {(status === "ready" || status === "scanning") && (
            <div className="mt-2 text-center text-[11px] text-gray-400">
              {facing === "user" ? t("Camera trước") : t("Camera sau")}
              {" · "}
              {mirror ? t("lật ngang (selfie)") : t("không lật")}
              {availableCameras > 1 || true ? ` ${t("— bấm icon góc trên để đổi")}` : ""}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 text-red-200 rounded-lg text-sm">
              {error}
              <div className="text-xs mt-2 text-red-100/80">
                {t("iPhone: Cài đặt → Safari → Camera → Cho phép. Sau đó tải lại trang.")}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            {status === "ready" && (
              <button onClick={startScan}
                className="px-8 py-3 bg-[#F5C518] text-[#0B1F14] rounded-md font-bold flex items-center gap-2 hover:bg-[#FFD93D] shadow-lg">
                <Camera className="w-5 h-5" /> {t("Scan Face")}
              </button>
            )}
            {status === "captured" && (
              <>
                <button onClick={retake} className="px-5 py-3 border-2 border-white/30 text-white rounded-md font-semibold flex items-center gap-2 hover:bg-white/10">
                  <RotateCw className="w-4 h-4" /> {t("Chụp lại")}
                </button>
                <button onClick={confirm} className="px-8 py-3 bg-green-500 text-white rounded-md font-bold flex items-center gap-2 hover:bg-green-600 shadow-lg">
                  <CheckCircle2 className="w-5 h-5" /> {t("Xác nhận")}
                </button>
              </>
            )}
            {status === "error" && (
              <button onClick={onCancel} className="px-6 py-2 bg-white/10 text-white rounded-md">{t("Đóng")}</button>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            {t("Ảnh chỉ dùng để xác minh chấm công, lưu trữ riêng tư trong ACME Storage")}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(calc(100vw)); }
          100% { transform: translateY(0); }
        }
        :global(.animate-scan) {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
