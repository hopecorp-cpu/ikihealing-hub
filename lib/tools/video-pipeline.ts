"use client";

import {
  Input, Output, BlobSource, ALL_FORMATS, Conversion,
  VideoSampleSink, AudioSampleSink, VideoSampleSource, AudioSampleSource,
  Mp4OutputFormat, BufferTarget, StreamTarget, Quality,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
} from "mediabunny";

export type Range = { start: number; end: number };

function openInput(blob: Blob) {
  return new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
}

export async function probeDuration(blob: Blob): Promise<number> {
  const input = openInput(blob);
  try {
    return await input.computeDuration();
  } finally {
    input.dispose();
  }
}

export async function detectSilenceStream(
  blob: Blob,
  opts: { threshold?: number; minSilence?: number; windowSec?: number } = {},
  onProgress?: (p: number) => void,
): Promise<Range[]> {
  const threshold = opts.threshold ?? 0.012;
  const minSilence = opts.minSilence ?? 0.6;
  const windowSec = opts.windowSec ?? 0.04;

  const input = openInput(blob);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("Video không có tiếng");
    if (!(await track.canDecode())) throw new Error("Trình duyệt không giải mã được âm thanh của video này");
    const duration = await input.computeDuration();
    const sink = new AudioSampleSink(track);

    const ranges: Range[] = [];
    let winSize = 0;
    let sumSq = 0;
    let count = 0;
    let winStartT = -1;
    let quietStart = -1;
    let buf = new Float32Array(0);
    let mix = new Float32Array(0);

    const closeWindow = (tEnd: number) => {
      const quiet = Math.sqrt(sumSq / count) < threshold;
      if (quiet && quietStart < 0) quietStart = winStartT;
      if (!quiet && quietStart >= 0) {
        if (winStartT - quietStart >= minSilence) ranges.push({ start: quietStart, end: winStartT });
        quietStart = -1;
      }
      sumSq = 0;
      count = 0;
      winStartT = tEnd;
    };

    for await (const s of sink.samples()) {
      const n = s.numberOfFrames;
      const ch = s.numberOfChannels;
      if (!winSize) winSize = Math.max(1, Math.floor(s.sampleRate * windowSec));
      if (winStartT < 0) winStartT = s.timestamp;
      if (buf.length < n) { buf = new Float32Array(n); mix = new Float32Array(n); }
      mix.fill(0, 0, n);
      for (let c = 0; c < ch; c++) {
        s.copyTo(buf, { planeIndex: c, format: "f32-planar", frameCount: n });
        for (let i = 0; i < n; i++) mix[i] += buf[i] / ch;
      }
      for (let i = 0; i < n; i++) {
        sumSq += mix[i] * mix[i];
        if (++count >= winSize) closeWindow(s.timestamp + (i + 1) / s.sampleRate);
      }
      if (duration > 0) onProgress?.(Math.min(1, s.timestamp / duration));
      s.close();
    }
    if (quietStart >= 0 && duration - quietStart >= minSilence) ranges.push({ start: quietStart, end: duration });
    return ranges;
  } finally {
    input.dispose();
  }
}

export function buildKeepRanges(silences: Range[], trimStart: number, trimEnd: number, pad = 0.1): Range[] {
  const keep: Range[] = [];
  let cursor = trimStart;
  for (const s of silences) {
    const cutFrom = Math.max(trimStart, s.start + pad);
    const cutTo = Math.min(trimEnd, s.end - pad);
    if (cutTo - cutFrom < 0.05) continue;
    if (cutFrom - cursor > 0.05) keep.push({ start: cursor, end: cutFrom });
    cursor = Math.max(cursor, cutTo);
  }
  if (trimEnd - cursor > 0.05) keep.push({ start: cursor, end: trimEnd });
  return keep;
}

export type ExportPreset = "cao" | "vua" | "nhe";

const PRESETS: Record<ExportPreset, { height: number; bitrate: number }> = {
  cao: { height: 1080, bitrate: 4_500_000 },
  vua: { height: 720, bitrate: 2_500_000 },
  nhe: { height: 720, bitrate: 1_200_000 },
};

export function estimateSizeMB(seconds: number, preset: ExportPreset) {
  return ((PRESETS[preset].bitrate + 128_000) * seconds) / 8 / 1024 / 1024;
}

export type ExportResult = { blob: Blob | null; size: number };

export async function exportMp4(
  blob: Blob,
  keep: Range[],
  preset: ExportPreset,
  onProgress?: (p: number) => void,
  file?: FileSystemWritableFileStream,
  signal?: AbortSignal,
): Promise<ExportResult> {
  if (!keep.length) throw new Error("Không còn đoạn nào để giữ lại");
  const { height: maxH, bitrate } = PRESETS[preset];

  const input = openInput(blob);
  const target = file ? new StreamTarget(file as unknown as WritableStream, { chunked: true }) : new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: file ? false : "in-memory" }),
    target,
  });
  let size = 0;
  output.target.on("write", ({ end }) => { size = Math.max(size, end); });

  const onAbort = () => { output.cancel().catch(() => {}); };
  signal?.addEventListener("abort", onAbort);

  try {
    const vTrack = await input.getPrimaryVideoTrack();
    const aTrack = await input.getPrimaryAudioTrack();
    if (!vTrack) throw new Error("Không đọc được hình trong video");
    if (!(await vTrack.canDecode())) throw new Error("Trình duyệt không giải mã được video này");
    const srcH = await vTrack.getDisplayHeight();
    const outH = Math.min(srcH, maxH);
    const vCodec = await getFirstEncodableVideoCodec(["avc", "hevc", "vp9"], { height: outH, bitrate });
    if (!vCodec) throw new Error("Máy không mã hoá được H.264");
    const aCodec = aTrack && (await aTrack.canDecode())
      ? await getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: aTrack.numberOfChannels, sampleRate: aTrack.sampleRate })
      : null;

    if (keep.length === 1) {
      const duration = await input.computeDuration();
      const whole = keep[0].start <= 0.05 && keep[0].end >= duration - 0.05;

      const copy = whole && preset === "cao" && srcH <= maxH && (await vTrack.getCodec()) === "avc";
      const conv = await Conversion.init({
        input, output,
        ...(whole ? {} : { trim: { start: keep[0].start, end: keep[0].end } }),
        video: copy
          ? { codec: "avc" }
          : { codec: vCodec, height: outH, quality: new Quality({ bitrate }), keyFrameInterval: 2 },
        audio: aCodec
          ? (copy ? { codec: aCodec } : { codec: aCodec, quality: new Quality({ bitrate: 128_000 }) })
          : { discard: true },
      });
      if (!conv.isValid) throw new Error("Không chuyển được video sang MP4");
      conv.onProgress = (p) => onProgress?.(p);
      await conv.execute();
      return { blob: target instanceof BufferTarget ? new Blob([target.buffer!], { type: "video/mp4" }) : null, size };
    }

    const offsets: number[] = [];
    let acc = 0;
    for (const r of keep) { offsets.push(acc - r.start); acc += r.end - r.start; }
    const total = acc;
    const from = keep[0].start;
    const to = keep[keep.length - 1].end;

    const videoSource = new VideoSampleSource({
      codec: vCodec,
      quality: new Quality({ bitrate }),
      keyFrameInterval: 2,
      transform: { height: outH },
      sizeChangeBehavior: "contain",
    });
    output.addVideoTrack(videoSource);

    let audioSource: AudioSampleSource | null = null;
    if (aCodec) {
      audioSource = new AudioSampleSource({ codec: aCodec, quality: new Quality({ bitrate: 128_000 }) });
      output.addAudioTrack(audioSource);
    }

    await output.start();

    const mapper = () => {
      let i = 0;
      return (t: number): number | null => {
        while (i < keep.length && t >= keep[i].end) i++;
        if (i >= keep.length || t < keep[i].start) return null;
        return t + offsets[i];
      };
    };

    const runVideo = async () => {
      const map = mapper();
      const sink = new VideoSampleSink(vTrack);
      for await (const s of sink.samples(from, to)) {
        if (signal?.aborted) { s.close(); break; }
        const nt = map(s.timestamp);
        if (nt !== null) {
          s.setTimestamp(nt);
          await videoSource.add(s);
          onProgress?.(Math.min(1, nt / total));
        }
        s.close();
      }
      videoSource.close();
    };

    const runAudio = async () => {
      if (!audioSource || !aTrack) return;
      const map = mapper();
      const sink = new AudioSampleSink(aTrack);
      let last = -1;
      for await (const s of sink.samples(from, to)) {
        if (signal?.aborted) { s.close(); break; }
        const nt = map(s.timestamp + s.duration / 2);
        if (nt !== null) {
          const ts = Math.max(last, nt - s.duration / 2, 0);
          s.setTimestamp(ts);
          last = ts;
          await audioSource.add(s);
        }
        s.close();
      }
      audioSource.close();
    };

    await Promise.all([runVideo(), runAudio()]);
    if (signal?.aborted) throw new Error("Đã huỷ xuất video");
    await output.finalize();
    onProgress?.(1);
    return { blob: target instanceof BufferTarget ? new Blob([target.buffer!], { type: "video/mp4" }) : null, size };
  } catch (e) {
    if (output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => {});
    throw e;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    input.dispose();
  }
}

export async function pickSaveFile(suggestedName: string): Promise<FileSystemWritableFileStream | null | "cancel"> {
  const w = window as any;
  if (typeof w.showSaveFilePicker !== "function") return null;
  try {
    const handle = await w.showSaveFilePicker({
      suggestedName,
      types: [{ description: "Video MP4", accept: { "video/mp4": [".mp4"] } }],
    });
    return await handle.createWritable();
  } catch (e: any) {
    if (e?.name === "AbortError") return "cancel";
    return null;
  }
}
