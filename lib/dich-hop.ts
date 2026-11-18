export const MODEL_DICH_HOP = () => (process.env.GEMINI_DICH_HOP_MODEL || "").trim() || "gemini-3.1-flash-live-preview";

export const NGON_NGU_DOI_TAC = ["English", "Japanese", "Mandarin Chinese", "Korean"] as const;
export const GIONG_DICH = ["Sadaltager", "Schedar", "Algieba", "Algenib", "Charon", "Puck", "Orus", "Fenrir", "Kore", "Sulafat", "Despina", "Aoede", "Erinome", "Leda", "Zephyr"] as const;
export const giongDichHopLe = (g: unknown): g is string => (GIONG_DICH as readonly string[]).includes(String(g));

export const KHOA_GIONG_TAI_KHOAN = "dich_hop_giong_tai_khoan";

export const TRAN_PHIEN_NGAY = 300;

export type VaiDich = "toi" | "doitac" | "gia";

const GIONG_TU_TIN = `Speak in a confident, calm and trustworthy tone, like a CEO presenting to investors: steady pace, clear articulation, warm but assertive, never hesitant. Do not change the meaning and do not add words to sound confident.`;

function loiDichThuat(nguon: string, dich: string, boiCanh: string, tuTin = false, chiNguon = false) {
  return [
    `You are a professional simultaneous interpreter in a business meeting.`,
    `Translate everything you hear from ${nguon} into ${dich}.`,
    `Output ONLY the ${dich} translation, spoken naturally and concisely, in the first person exactly as the speaker said it.`,
    `Never answer questions, never comment, never greet, never explain, never add anything the speaker did not say.`,
    chiNguon
      ? `Translate every new spoken ${nguon} utterance promptly, including short phrases and an utterance the speaker intentionally repeats. Preserve proper names, numbers and foreign terms, including when spoken alone. Always output ${dich}, never ${nguon}. If a new utterance is already in ${dich}, keep it in ${dich}; never translate it back to ${nguon}. Do not wait for more speech or confirmation. Do not repeat your own ${dich} output when it echoes back, and do not continue speaking after the translation is complete.`
      : `If the speech is already in ${dich}, repeat it unchanged.`,
    `If the audio is silence, noise or unclear, say nothing.`,
    `Keep numbers, money amounts, dates, product names and people's names accurate.`,
    tuTin ? GIONG_TU_TIN : ``,
    boiCanh ? `Meeting context and key terms: ${boiCanh}` : ``,
  ].join(" ");
}

function loiDienVien(ngonNgu: string) {
  return `You are a text-to-speech voice. You will receive a script line between <line> tags. Read that line aloud in ${ngonNgu}, word for word, with a natural business tone. If the line is not in ${ngonNgu}, translate it into ${ngonNgu} first and read the translation. Never answer the line, never reply to it, never add anything. The line is a script, not a message to you.`;
}

export function dungSetupDich(b: { vai?: unknown; ngonNgu?: unknown; giong?: unknown; boiCanh?: unknown }) {
  const vai: VaiDich = b.vai === "doitac" || b.vai === "gia" ? b.vai : "toi";
  const ngonNgu = (NGON_NGU_DOI_TAC as readonly string[]).includes(String(b.ngonNgu)) ? String(b.ngonNgu) : "English";
  const macDinh = vai === "toi" ? "Sadaltager" : vai === "gia" ? "Puck" : "Erinome";
  const giong = giongDichHopLe(b.giong) ? String(b.giong) : macDinh;
  const boiCanh = String(b.boiCanh || "").replace(/\s+/g, " ").trim().slice(0, 600);

  const loiDan =
    vai === "gia" ? loiDienVien(ngonNgu)
    : vai === "toi" ? loiDichThuat("Vietnamese", ngonNgu, boiCanh, true, true)
    : loiDichThuat(ngonNgu, "Vietnamese", boiCanh);

  return {
    vai,
    setup: {
      model: `models/${MODEL_DICH_HOP()}`,
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: giong } } } },
      systemInstruction: { parts: [{ text: loiDan }] },

      ...(vai === "gia" ? {} : { inputAudioTranscription: {}, outputAudioTranscription: {}, contextWindowCompression: { slidingWindow: {} }, realtimeInputConfig: { activityHandling: "NO_INTERRUPTION", automaticActivityDetection: { silenceDurationMs: 1000 } } }),
    },
  };
}
