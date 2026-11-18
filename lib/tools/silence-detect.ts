"use client";

export type SilenceRange = { start: number; end: number };
export type KeepRange = { start: number; end: number };

export type SilenceOptions = {

  threshold?: number;

  minSilence?: number;

  pad?: number;

  windowSec?: number;
};

export async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    ctx.close();
  }
}

export function detectSilenceRanges(buf: AudioBuffer, opts: SilenceOptions = {}): SilenceRange[] {
  const threshold = opts.threshold ?? 0.012;
  const minSilence = opts.minSilence ?? 0.6;
  const windowSec = opts.windowSec ?? 0.04;

  const sr = buf.sampleRate;
  const winSize = Math.max(1, Math.floor(sr * windowSec));
  const ch0 = buf.getChannelData(0);

  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;

  const numWin = Math.floor(buf.length / winSize);
  const isQuiet: boolean[] = new Array(numWin);
  for (let w = 0; w < numWin; w++) {
    let sum = 0;
    const base = w * winSize;
    for (let i = 0; i < winSize; i++) {
      const s = ch1 ? (ch0[base + i] + ch1[base + i]) * 0.5 : ch0[base + i];
      sum += s * s;
    }
    const rms = Math.sqrt(sum / winSize);
    isQuiet[w] = rms < threshold;
  }

  const ranges: SilenceRange[] = [];
  let i = 0;
  while (i < numWin) {
    if (!isQuiet[i]) { i++; continue; }
    let j = i;
    while (j < numWin && isQuiet[j]) j++;
    const start = (i * winSize) / sr;
    const end = (j * winSize) / sr;
    if (end - start >= minSilence) ranges.push({ start, end });
    i = j;
  }
  return ranges;
}

export function buildKeepRanges(
  silences: SilenceRange[],
  duration: number,
  pad: number = 0.1,
): KeepRange[] {
  const keep: KeepRange[] = [];
  let cursor = 0;
  for (const s of silences) {
    const start = cursor;
    const end = Math.max(start, s.start + pad);
    if (end > start + 0.05) keep.push({ start, end });
    cursor = Math.max(cursor, s.end - pad);
    if (cursor < 0) cursor = 0;
  }
  if (cursor < duration - 0.05) keep.push({ start: cursor, end: duration });
  return keep;
}
