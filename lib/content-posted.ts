import { getServiceClient } from "@/lib/supabase-server";

export type Nhom = "noi-dung" | "ads" | "ceo";
export type LuotDang = { name: string; at: string; nhom: Nhom; title?: string; channel?: string };
type Kho = Record<string, LuotDang>;

const KEY = "content_posted_by";

export const TEN_NHOM: Record<Nhom, string> = {
  "noi-dung": "Nhóm Nội dung",
  "ads": "Nhóm Ads / Sale",
  "ceo": "CEO duyệt thẳng",
};

async function doc(): Promise<Kho> {
  const sb = getServiceClient();
  try {
    const v = (await sb.from("config").select("value").eq("key", KEY).maybeSingle()).data?.value;
    const j = JSON.parse(v || "{}");
    return j && typeof j === "object" ? j : {};
  } catch { return {}; }
}

export async function ghiLuotDang(itemId: string, luot: LuotDang): Promise<void> {
  const sb = getServiceClient();
  const kho = await doc();
  kho[itemId] = luot;

  const ids = Object.keys(kho);
  if (ids.length > 400) {
    const bo = ids
      .map((id) => [id, Date.parse(kho[id]?.at || "") || 0] as const)
      .sort((a, b) => a[1] - b[1])
      .slice(0, ids.length - 400);
    for (const [id] of bo) delete kho[id];
  }
  await sb.from("config").upsert({
    key: KEY, value: JSON.stringify(kho),
    description: "Ai đăng bài nào, đăng từ nhóm nào (nút Đã đăng trên Telegram) — dùng cho /bao-cao-mkt",
  }, { onConflict: "key" });
}

export type ThongKeNhom = { nhom: Nhom; tenNhom: string; tong: number; theoNguoi: { ten: string; so: number }[] };

export async function thongKeDang(tu: string, den: string): Promise<{ nhoms: ThongKeNhom[]; tong: number }> {
  const kho = await doc();
  const trongKhoang = Object.values(kho).filter((l) => {
    const ngay = ngayVN(l.at);
    return ngay >= tu && ngay <= den;
  });
  const gom: Record<string, ThongKeNhom> = {};
  for (const l of trongKhoang) {
    const n = (l.nhom || "ceo") as Nhom;
    gom[n] ||= { nhom: n, tenNhom: TEN_NHOM[n] || n, tong: 0, theoNguoi: [] };
    gom[n].tong++;
    const ng = gom[n].theoNguoi.find((x) => x.ten === l.name);
    if (ng) ng.so++; else gom[n].theoNguoi.push({ ten: l.name || "?", so: 1 });
  }
  const nhoms = Object.values(gom).sort((a, b) => b.tong - a.tong);
  for (const n of nhoms) n.theoNguoi.sort((a, b) => b.so - a.so);
  return { nhoms, tong: trongKhoang.length };
}

function ngayVN(iso: string): string {
  try { return new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10); }
  catch { return ""; }
}
