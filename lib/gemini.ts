export function geminiKey() {
  return (process.env.GEMINI_API_KEY_BRAIN || process.env.GEMINI_API_KEY || "").trim();
}
export function geminiConfigured() {
  return !!geminiKey();
}

export async function embedText(
  text: string,
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_QUERY"
): Promise<number[] | null> {
  const key = geminiKey();
  if (!key || !text.trim()) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType,
          outputDimensionality: 768,
        }),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => ({}));
    const v = j?.embedding?.values;
    return Array.isArray(v) && v.length ? v : null;
  } catch {
    return null;
  }
}

type Turn = { role: "user" | "model"; text: string };

/**
 * @param opts.maxOutputTokens nới trần chữ cho việc viết dài (mặc định 1200 đủ cho chat Telegram,
 *        nhưng Nhà máy Content viết nhiều bài thì cụt giữa chừng → truyền số lớn hơn).
 */
/**
 * @param opts.thinkingBudget trần token model được phép SUY NGHĨ nội bộ. MẶC ĐỊNH 0 (tắt).
 *        Vì sao tắt: maxOutputTokens tính CẢ token suy nghĩ, mà mọi chỗ gọi hàm này đều đặt
 *        trần chữ từ thời model chưa có thinking. Đo thật 02/08: nhà máy content cấp 2200 thì
 *        suy nghĩ nuốt 1801, JSON bài cụt giữa chừng -> "AI trả về không đúng định dạng";
 *        cửa QA giọng brand cấp 300 thì suy nghĩ nuốt 288, còn 8 token -> luôn rơi về "tạm cho
 *        qua"; phân loại bình luận cấp 10 token thì trả về RỖNG mọi lần. Chỗ nào thật sự cần
 *        model nghĩ thì tự truyền budget VÀ nới trần chữ cho đủ chỗ.
 */
export async function askGemini(
  system: string,
  history: Turn[],
  userText: string,
  opts?: { maxOutputTokens?: number; temperature?: number; json?: boolean; schema?: any; model?: string; thinkingBudget?: number }
) {
  const key = geminiKey();
  const model = (opts?.model || process.env.GEMINI_MODEL || "gemini-3.5-flash").trim();
  if (!key) return { ok: false as const, text: "", error: "missing_key" };

  const contents = [
    ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: "user" as const, parts: [{ text: userText }] },
  ];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: {
            temperature: opts?.temperature ?? 0.7,
            maxOutputTokens: opts?.maxOutputTokens ?? 1200,
            topP: 0.95,

            ...(opts?.json ? { responseMimeType: "application/json" } : {}),
            ...(opts?.schema ? { responseSchema: opts.schema } : {}),
            thinkingConfig: { thinkingBudget: opts?.thinkingBudget ?? 0 },
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
        cache: "no-store",
      }
    );
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false as const, text: "", error: j?.error?.message || `HTTP ${res.status}` };
    }
    const text =
      j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("").trim() || "";
    const finishReason = j?.candidates?.[0]?.finishReason || null;
    if (!text) {
      const block = j?.promptFeedback?.blockReason || finishReason || "empty";
      return { ok: false as const, text: "", error: `no_text:${block}` };
    }

    return { ok: true as const, text, finishReason };
  } catch (e: any) {
    return { ok: false as const, text: "", error: String(e?.message || e) };
  }
}

export async function geminiImage(prompt: string): Promise<{ ok: boolean; dataB64?: string; mime?: string; error?: string }> {
  const key = geminiKey();
  if (!key) return { ok: false, error: "missing_key" };
  const model = (process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image").trim();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        cache: "no-store",
      }
    );
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j?.error?.message || `HTTP ${res.status}` };
    const parts = j?.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data);
    const inline = img?.inlineData || img?.inline_data;
    if (!inline?.data) {
      const block = j?.promptFeedback?.blockReason || j?.candidates?.[0]?.finishReason || "no_image";
      return { ok: false, error: `no_image:${block}` };
    }
    return { ok: true, dataB64: inline.data, mime: inline.mimeType || inline.mime_type || "image/png" };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function locLoSuyNghi(s: string): string {

  const lo = /^\s*[•\-*]?\s*(let['’]?s|i (will|should|need to|['’]ll)|now i|okay,? (i|let)|calling)\b.*\b(call|invoke|use|function|tool)\b/i;
  return s.split("\n").filter((d) => !lo.test(d)).join("\n").trim();
}

export async function askGeminiTools(
  system: string,
  history: Turn[],
  userText: string,
  functionDeclarations: any[],
  modelOverride?: string,
  opts?: { thinkingBudget?: number; maxOutputTokens?: number }
) {
  const key = geminiKey();
  const model = (modelOverride || process.env.GEMINI_MODEL || "gemini-3.5-flash").trim();
  if (!key) return { ok: false as const, text: "", calls: [] as any[], error: "missing_key" };
  const contents = [
    ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: "user" as const, parts: [{ text: userText }] },
  ];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        tools: [{ function_declarations: functionDeclarations }],

        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: opts?.maxOutputTokens ?? 2000,
          thinkingConfig: { thinkingBudget: opts?.thinkingBudget ?? 512 },
        },
      }), cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, text: "", calls: [], error: j?.error?.message || `HTTP ${res.status}` };
    const parts: any[] = j?.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));

    const text = parts.filter((p) => !p?.thought).map((p) => p?.text || "").join("").trim();
    return { ok: true as const, text: locLoSuyNghi(text), calls };
  } catch (e: any) { return { ok: false as const, text: "", calls: [], error: String(e?.message || e) }; }
}

export async function geminiSearch(query: string, opts?: { maxOutputTokens?: number; temperature?: number; thinkingBudget?: number }) {
  const key = geminiKey();
  const model = (process.env.GEMINI_MODEL || "gemini-3.5-flash").trim();
  if (!key) return { ok: false as const, text: "", error: "missing_key" };
  try {

    const genCfg: any = { temperature: opts?.temperature ?? 0.4, maxOutputTokens: opts?.maxOutputTokens ?? 900 };
    if (opts?.thinkingBudget != null) genCfg.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
    const call = (cfg: any) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: query }] }], tools: [{ google_search: {} }], generationConfig: cfg }),
      cache: "no-store",
    });
    let res = await call(genCfg);
    let j: any = await res.json().catch(() => ({}));

    if (!res.ok && genCfg.thinkingConfig && /think/i.test(j?.error?.message || "")) {
      const { thinkingConfig, ...noThink } = genCfg;
      res = await call(noThink); j = await res.json().catch(() => ({}));
    }
    if (!res.ok) return { ok: false as const, text: "", error: j?.error?.message || `HTTP ${res.status}` };

    const cands: any[] = j?.candidates || [];
    const text = cands
      .flatMap((c: any) => (c?.content?.parts || []).filter((p: any) => p && !p.thought).map((p: any) => p?.text || ""))
      .join("").trim();
    const finishReason = cands[0]?.finishReason || null;
    if (!text) return { ok: false as const, text: "", error: `rỗng (finishReason=${finishReason || "?"})` };
    return { ok: true as const, text, finishReason };
  } catch (e: any) { return { ok: false as const, text: "", error: String(e?.message || e) }; }
}

export async function askGeminiPdf(
  base64: string,
  mimeType: string,
  system: string,
  userText: string,
  schema: any,
  opts?: { maxOutputTokens?: number }
): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const key = geminiKey();
  const model = (process.env.GEMINI_MODEL || "gemini-3.5-flash").trim();
  if (!key) return { ok: false, error: "missing_key" };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: userText }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: opts?.maxOutputTokens ?? 2000,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j?.error?.message || `HTTP ${res.status}` };
    const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("").trim() || "";
    if (!text) return { ok: false, error: "empty" };
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, error: "bad_json" };
    }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function ngheGemini(
  base64: string,
  mimeType: string,
  tuRieng = ""
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = geminiKey();
  const model = (process.env.GEMINI_MODEL || "gemini-3.5-flash").trim();
  if (!key) return { ok: false, error: "missing_key" };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: `Chép NGUYÊN VĂN lời nói tiếng Việt trong đoạn ghi âm (có thể xen tiếng Anh). Chỉ trả về câu đã chép, không giải thích. Không nghe được gì thì trả về chuỗi rỗng.${tuRieng ? ` Tên riêng có thể xuất hiện: ${tuRieng}.` : ""}` }] },
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: "Chép lại lời nói." }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 500 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j?.error?.message || `HTTP ${res.status}` };
    const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("").trim() || "";
    return { ok: true, text };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
