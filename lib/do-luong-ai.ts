import { getServiceClient } from "@/lib/supabase-server";
import { tongNhatKyAI, type Dem } from "@/lib/ai-nhat-ky";
import { PRICE, USD_VND } from "@/lib/covan/cost";
import baseline from "@/data/baseline-quy-trinh.json";

export const BO_EVAL = [
  { key: "covan_eval_history", ten: "Cố vấn Cố vấn AI", soCa: "22 ca: số liệu, pháp lý, chính sách, hùa theo, PII" },
  { key: "eval_history_chia_lead", ten: "Máy chia lead", soCa: "16 ca: không giành khách, chủ hội thoại Zalo, tỉ trọng" },
  { key: "eval_history_tra_loi_zalo", ten: "Máy trả lời Zalo", soCa: "15 ca: từ cấm, chiết khấu, giá, PII" },
  { key: "eval_history_cham_sale", ten: "Máy chấm sale", soCa: "13 ca: vi phạm, giỏi, yếu, lời gợi ý" },
] as const;

export type DiemEval = { at: string; diem: number; tong: number };
export type BoEvalLive = { key: string; ten: string; soCa: string; lichSu: DiemEval[]; chu: string | null };
export type QuyTrinhBaseline = (typeof baseline)["quyTrinh"][number];

export type LaiCache = { tiLeDoc: number; laiRongVnd: number };
export function laiCache(model: string, d: Dem): LaiCache {
  const doc = d.cacheDoc || 0, ghi = d.cacheGhi || 0;
  const tong = d.inTok + doc + ghi;
  const p = PRICE.find((x) => model.includes(x.match));
  const laiUsd = p ? ((doc * 0.9 - ghi * 0.25) / 1e6) * p.inUsd : 0;
  return { tiLeDoc: tong ? doc / tong : 0, laiRongVnd: Math.round(laiUsd * USD_VND) };
}

export async function docDoLuongAi(): Promise<{
  evals: BoEvalLive[];
  nhatKy: { tong: Dem; theoModel: { model: string; dem: Dem; cache: LaiCache }[]; tuNgay: string; denNgay: string } | null;
  baseline: QuyTrinhBaseline[];
}> {
  const sb = getServiceClient();
  const keys = [...BO_EVAL.map((b) => b.key), "nguoi_giu"];
  const { data } = await sb.from("config").select("key,value").in("key", keys);
  const map = new Map((data || []).map((r: any) => [r.key, r.value as string]));
  let nguoiGiu: Record<string, string> = {};
  try { nguoiGiu = JSON.parse(map.get("nguoi_giu") || "{}"); } catch {  }

  const evals = BO_EVAL.map((b) => {
    let lichSu: DiemEval[] = [];
    try {
      const arr = JSON.parse(map.get(b.key) || "[]");
      if (Array.isArray(arr)) lichSu = arr.map((x: any) => ({ at: String(x.at || ""), diem: Number(x.diem) || 0, tong: Number(x.tong) || 0 })).filter((x) => x.tong > 0);
    } catch {  }
    const ten = nguoiGiu[`eval:${b.key}`];
    return { ...b, lichSu, chu: typeof ten === "string" && ten.trim() ? ten.trim() : null };
  });

  let nhatKy = null;
  try {
    const t = await tongNhatKyAI(7);
    const theoModel = new Map<string, Dem>();
    for (const [k, d] of Object.entries(t.theo)) {
      const model = k.split("|")[1] || "?";
      const cur = theoModel.get(model) || { goi: 0, loi: 0, inTok: 0, outTok: 0, ms: 0, cacheDoc: 0, cacheGhi: 0 };
      theoModel.set(model, {
        goi: cur.goi + d.goi, loi: cur.loi + d.loi, inTok: cur.inTok + d.inTok, outTok: cur.outTok + d.outTok, ms: cur.ms + d.ms,
        cacheDoc: (cur.cacheDoc || 0) + (d.cacheDoc || 0), cacheGhi: (cur.cacheGhi || 0) + (d.cacheGhi || 0),
      });
    }
    nhatKy = {
      tong: t.tong, tuNgay: t.tuNgay, denNgay: t.denNgay,
      theoModel: [...theoModel].map(([model, dem]) => ({ model, dem, cache: laiCache(model, dem) })).sort((a, b) => b.dem.goi - a.dem.goi),
    };
  } catch {  }

  return { evals, nhatKy, baseline: baseline.quyTrinh };
}
