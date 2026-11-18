import { getServiceClient } from "@/lib/supabase-server";
import { handleInboundMessage } from "@/lib/zalo-agent";
import { findBanned } from "@/lib/banned-words";
import { agentLearningBrief } from "@/lib/agent-learning";

const KEY = "ca_truc_ai";

export const VO_NGHIA = /^(\[[^\]]{0,30}\]|v[aâ]ng( [aạ])?|d[aạ]( v[aâ]ng)?|[oó]k(e|ie)?|uh+|hi+|hello|:v|:d|\s*)$/i;
export const CHI_KY_TU_LA = /^[^\p{L}\p{N}]+$/u;

function cauKhoiLai(ten: string, ngay: number): string {
  const xung = ten && ten !== "Khách" ? ten.split(" ").slice(-1)[0] : "mình";
  return `Chào ${xung}, bên em là NOVA by ACME Corp ạ. `
    + `Em thấy ${ngay >= 2 ? `${ngay} ngày trước` : "hôm trước"} mình có nhắn cho bên em mà em trả lời muộn, em xin lỗi ${xung} nhé. `
    + `Hiện mình đang quan tâm điều gì để em tư vấn đúng cho mình ạ?`;
}

export type BanNhap = {
  ten: string;
  kenh: "facebook" | "lead" | "zalo";
  trang?: string;
  cauHoi: string;
  traLoi: string;
  nong: boolean;
  benh: boolean;
  choGio: number;
  loai: "tra-loi" | "khoi-lai";
  link: string;
  phone: string;
};

export type KetQuaCaTruc = {
  at: string;
  soan: number;
  khoiLai: number;
  boVìTuCam: number;
  hong: number;
  ds: BanNhap[];
};

async function cfg(sb: any, key: string): Promise<any> {
  try {
    const v = (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value;
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

function hangChoFacebook(fb: any): Array<Omit<BanNhap, "traLoi" | "nong" | "benh">> {
  const items = Array.isArray(fb?.items) ? fb.items : [];
  return items
    .filter((i: any) => String(i?.snippet || "").trim().length >= 3)
    .map((i: any) => ({
      ten: String(i.name || "Khách"),
      kenh: "facebook" as const,
      trang: String(i.page || ""),
      cauHoi: String(i.snippet || "").trim().slice(0, 400),
      choGio: Math.round(Number(i.hours || 0)),
      link: String(i.link || ""),

      phone: typeof i.phone === "string" ? i.phone : String(i.phone?.captured || ""),
    }))
    .sort((a: any, b: any) => b.choGio - a.choGio);
}

function hangChoZalo(z: any): Array<Omit<BanNhap, "traLoi" | "nong" | "benh">> {
  const items = Array.isArray(z?.items) ? z.items : [];
  return items
    .filter((i: any) => String(i?.cau || "").trim().length >= 2)
    .map((i: any) => ({
      ten: String(i.ten || "Khách"),
      kenh: "zalo" as const,
      trang: String(i.sale || ""),
      cauHoi: String(i.cau).trim().slice(0, 400),
      choGio: Math.round(Number(i.choGio || 0)),
      link: i.phone ? `https://zalo.me/${String(i.phone).replace(/\D/g, "")}` : "",
      phone: String(i.phone || ""),
    }));
}

async function hangChoLead(sb: any, tu: string): Promise<Array<Omit<BanNhap, "traLoi" | "nong" | "benh">>> {
  const { data } = await sb
    .from("leads")
    .select("customer_name, phone, note, pancake_link, created_at, first_contact_at")
    .gte("created_at", tu)
    .is("first_contact_at", null)
    .not("note", "is", null)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data || [])
    .filter((l: any) => String(l.note || "").trim().length >= 8)
    .map((l: any) => ({
      ten: String(l.customer_name || "Khách"),
      kenh: "lead" as const,
      cauHoi: String(l.note).trim().slice(0, 400),
      choGio: Math.round((Date.now() - new Date(l.created_at).getTime()) / 3600e3),
      link: String(l.pancake_link || ""),
      phone: String(l.phone || ""),
    }));
}

export async function soanCaTruc(gioiHan = 20): Promise<KetQuaCaTruc> {
  const sb = getServiceClient();
  const fb = await cfg(sb, "fb_unreplied");
  const zl = await cfg(sb, "sale_unreplied");
  const tu = new Date(Date.now() - 72 * 3600e3).toISOString();

  const cho = [...hangChoZalo(zl), ...hangChoFacebook(fb), ...(await hangChoLead(sb, tu).catch(() => []))]
    .sort((a, b) => b.choGio - a.choGio)
    .slice(0, Math.max(1, Math.min(gioiHan, 60)));

  const hoc = await agentLearningBrief("may-truc").catch(() => "");
  const ds: BanNhap[] = [];
  let boVìTuCam = 0, hong = 0, khoiLai = 0;

  for (const k of cho) {

    if (VO_NGHIA.test(k.cauHoi.trim()) || CHI_KY_TU_LA.test(k.cauHoi.trim())) {
      ds.push({ ...k, traLoi: cauKhoiLai(k.ten, Math.round(k.choGio / 24)), nong: false, benh: false, loai: "khoi-lai" });
      khoiLai++;
      continue;
    }
    try {
      const r = await handleInboundMessage(k.cauHoi, [], hoc, k.kenh === "facebook" ? "facebook" : "zalo");
      const traLoi = String(r?.reply || "").trim();
      if (!traLoi) { hong++; continue; }

      const dinh = findBanned(traLoi);
      if (dinh.length) { boVìTuCam++; continue; }
      ds.push({ ...k, traLoi, nong: !!r?.hot, benh: !!r?.medical, loai: "tra-loi" });
    } catch { hong++; }
  }

  ds.sort((a, b) => (a.nong === b.nong ? b.choGio - a.choGio : a.nong ? -1 : 1));

  const kq: KetQuaCaTruc = { at: new Date().toISOString(), soan: ds.length, khoiLai, boVìTuCam, hong, ds };
  await sb.from("config").upsert(
    { key: KEY, value: JSON.stringify(kq), description: "Câu trả lời AI soạn sẵn cho hàng chờ (người gửi)" },
    { onConflict: "key" },
  );
  return kq;
}

export async function docCaTruc(): Promise<KetQuaCaTruc | null> {
  return cfg(getServiceClient(), KEY);
}
