import { getServiceClient } from "@/lib/supabase-server";
import { embedText } from "@/lib/gemini";

export async function storeLesson(recId: number, content: string): Promise<boolean> {
  const text = (content || "").trim();
  if (!text) return false;
  const emb = await embedText(text, "RETRIEVAL_DOCUMENT");
  if (!emb) return false;
  try {
    const sb = getServiceClient();
    const { error } = await sb
      .from("covan_knowledge")
      .upsert(
        { source: "baihoc", chunk_index: recId, content: text, embedding: emb },
        { onConflict: "source,chunk_index" }
      );
    return !error;
  } catch {
    return false;
  }
}

export const KHO_RIENG_CEO = [
  "taichinhcanhan",
  "goivon",
  "hdqt",
  "tochuc",
  "phapnhan",
  "nhacungcap",
  "cochethuong",
  "driveceo",
  "vaultwikiceo",
  "docsceo",
  "sotayceo",
  "phongbanceo",
  "notionceo",
];

const NGUON_THO = ["drive", "driveceo", "manguon", "web", "vaultwiki", "vaultwikiceo", "docs", "docsceo", "sotay", "sotayceo", "phongban", "phongbanceo", "khoahocngoai", "notion", "notionceo"];

export function locKhoRiengCeo(doan: string[]): string[] {
  return (doan || []).filter((d) => !KHO_RIENG_CEO.some((k) => d.startsWith(`[${k}]`)));
}

export async function retrieveKnowledge(question: string, k = 8): Promise<string[]> {
  const emb = await embedText(question);
  if (!emb) return [];
  const suatTho = Math.max(1, Math.round(k / 8));
  try {
    const sb = getServiceClient();

    const [rChat, rTho] = await Promise.all([
      sb.rpc("match_covan_knowledge_nguon", {
        query_embedding: emb,
        match_count: k,
        nguon_gom: null,
        nguon_tru: NGUON_THO,
      }),
      sb
        .rpc("match_covan_knowledge_tho", {
          query_embedding: emb,
          match_count: suatTho,
          nguon_gom: NGUON_THO,
        })
        .then((r) =>
          r.error
            ? sb.rpc("match_covan_knowledge_nguon", {
                query_embedding: emb,
                match_count: suatTho,
                nguon_gom: NGUON_THO,
                nguon_tru: null,
              })
            : r
        ),
    ]);

    if (!rChat.error && Array.isArray(rChat.data)) {
      type Doan = { source?: string; content?: string; similarity?: number };
      const doanTho = !rTho.error && Array.isArray(rTho.data) ? (rTho.data as Doan[]) : [];
      const gop = [...(rChat.data as Doan[]), ...doanTho]
        .filter((r) => r && typeof r.content === "string")
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
      if (gop.length) return gop.map((r) => `[${r.source || "kho"}] ${r.content}`);
    }

    const { data, error } = await sb.rpc("match_covan_knowledge", {
      query_embedding: emb,
      match_count: k * 4,
    });
    if (error || !Array.isArray(data)) return [];
    const rows = (data as Array<{ source?: string; content?: string }>)
      .filter((r) => r && typeof r.content === "string")
      .map((r) => ({ source: r.source || "kho", content: r.content as string }));

    const tho = rows.filter((r) => NGUON_THO.includes(r.source));
    const chat = rows.filter((r) => !NGUON_THO.includes(r.source));
    const chon = [...chat.slice(0, k), ...tho.slice(0, suatTho)];
    if (!chon.length) return [];

    return rows.filter((r) => chon.includes(r)).map((r) => `[${r.source}] ${r.content}`);
  } catch {
    return [];
  }
}
