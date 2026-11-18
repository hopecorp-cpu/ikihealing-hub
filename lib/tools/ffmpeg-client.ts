"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

export async function getFfmpeg(onLog?: (msg: string) => void, onProgress?: (p: number) => void) {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const ff = new FFmpeg();
    if (onLog) ff.on("log", ({ message }) => onLog(message));
    if (onProgress) ff.on("progress", ({ progress }) => onProgress(Math.max(0, Math.min(1, progress))));
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();
  return loadPromise;
}

export type Segment = { start: number; end: number };

export async function trimVideo(blob: Blob, start: number, end: number, onProgress?: (p: number) => void): Promise<Blob> {
  const ff = await getFfmpeg(undefined, onProgress);
  const inputName = "in.webm";
  const outputName = "out.webm";
  await ff.writeFile(inputName, await fetchFile(blob));
  await ff.exec([
    "-i", inputName,
    "-ss", String(start),
    "-to", String(end),
    "-c:v", "libvpx", "-b:v", "1M",
    "-c:a", "libopus", "-b:a", "128k",
    "-y", outputName,
  ]);
  const data = await ff.readFile(outputName);
  try { await ff.deleteFile(inputName); } catch {}
  try { await ff.deleteFile(outputName); } catch {}
  // @ts-ignore — Uint8Array buffer
  return new Blob([data.buffer], { type: "video/webm" });
}

export async function cutAndConcat(
  blob: Blob,
  keepSegments: Segment[],
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const ff = await getFfmpeg(undefined, onProgress);
  if (keepSegments.length === 0) throw new Error("Không còn đoạn nào để giữ lại");

  const inputName = "in.webm";
  await ff.writeFile(inputName, await fetchFile(blob));

  const partFiles: string[] = [];
  for (let i = 0; i < keepSegments.length; i++) {
    const { start, end } = keepSegments[i];
    if (end - start < 0.05) continue;
    const partName = `part_${i}.webm`;
    await ff.exec([
      "-i", inputName,
      "-ss", String(start),
      "-to", String(end),
      "-c:v", "libvpx", "-b:v", "1M",
      "-c:a", "libopus", "-b:a", "128k",
      "-y", partName,
    ]);
    partFiles.push(partName);
  }
  if (partFiles.length === 0) throw new Error("Tất cả đoạn quá ngắn để cắt");

  const listText = partFiles.map((p) => `file '${p}'`).join("\n");
  await ff.writeFile("list.txt", new TextEncoder().encode(listText));

  const outputName = "out.webm";
  await ff.exec([
    "-f", "concat",
    "-safe", "0",
    "-i", "list.txt",
    "-c", "copy",
    "-y", outputName,
  ]);

  const data = await ff.readFile(outputName);

  try { await ff.deleteFile(inputName); } catch {}
  try { await ff.deleteFile("list.txt"); } catch {}
  try { await ff.deleteFile(outputName); } catch {}
  for (const p of partFiles) { try { await ff.deleteFile(p); } catch {} }

  // @ts-ignore
  return new Blob([data.buffer], { type: "video/webm" });
}

export async function transcodeToMp4(blob: Blob, onProgress?: (p: number) => void): Promise<Blob> {
  const ff = await getFfmpeg(undefined, onProgress);
  const inputName = "in.webm";
  const outputName = "out.mp4";
  await ff.writeFile(inputName, await fetchFile(blob));
  await ff.exec([
    "-i", inputName,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    "-y", outputName,
  ]);
  const data = await ff.readFile(outputName);
  try { await ff.deleteFile(inputName); } catch {}
  try { await ff.deleteFile(outputName); } catch {}
  // @ts-ignore
  return new Blob([data.buffer], { type: "video/mp4" });
}
