import { getServiceClient } from "@/lib/supabase-server";

export const KHOA_CAI_DAT = "zalo_nhom_cai_dat";
export const KHOA_LENH = "zalo_nhom_lenh";

export const maNhom = (ownId: string, uid: string) => `${ownId}|${uid}`;

export type CaiDatNhom = {

  chatbot: boolean;

  khoaGui: boolean;

  khoaGuiCho?: boolean | null;

  khoaGuiLoi?: string | null;
  ten?: string;
  boi?: string;
  luc?: string;
};

export type LenhNhom = {
  own: string;
  gid: string;

  lockSendMsg?: boolean;
  ten?: string;
  boi?: string;
  luc: string;
};

async function docConfig<T>(key: string): Promise<T> {
  const sb = getServiceClient();
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  try { return JSON.parse(data?.value || "{}") as T; } catch { return {} as T; }
}

export async function docCaiDatNhom(): Promise<Record<string, CaiDatNhom>> {
  return docConfig<Record<string, CaiDatNhom>>(KHOA_CAI_DAT);
}

export const MAC_DINH: CaiDatNhom = { chatbot: false, khoaGui: false, khoaGuiCho: null };

export async function datChatbot(ma: string, bat: boolean, boi: string, ten?: string) {
  const sb = getServiceClient();
  const all = await docCaiDatNhom();
  const cu = all[ma] || { ...MAC_DINH };
  all[ma] = { ...cu, chatbot: bat, ...(ten ? { ten } : {}), boi, luc: new Date().toISOString() };
  const { error } = await sb.from("config").upsert(
    { key: KHOA_CAI_DAT, value: JSON.stringify(all), description: "Công tắc chatbot + khoá nhắn của từng nhóm Zalo" },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return all[ma];
}

export async function xinDoiKhoaGui(ma: string, khoa: boolean, boi: string, ten?: string) {
  const sb = getServiceClient();
  const [own, gid] = ma.split("|");
  if (!own || !gid) throw new Error("mã nhóm sai dạng (phải là <nick>|<mã nhóm>)");

  const all = await docCaiDatNhom();
  const cu = all[ma] || { ...MAC_DINH };
  all[ma] = { ...cu, khoaGuiCho: khoa, khoaGuiLoi: null, ...(ten ? { ten } : {}), boi, luc: new Date().toISOString() };

  const hang = await docConfig<Record<string, LenhNhom>>(KHOA_LENH);
  hang[`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`] = {
    own, gid, lockSendMsg: khoa, ten, boi, luc: new Date().toISOString(),
  };

  for (const [key, value, mo] of [
    [KHOA_CAI_DAT, JSON.stringify(all), "Công tắc chatbot + khoá nhắn của từng nhóm Zalo"],
    [KHOA_LENH, JSON.stringify(hang), "Hàng đợi lệnh đổi cài đặt nhóm Zalo (cầu nối trên máy CEO kéo về làm)"],
  ] as const) {
    const { error } = await sb.from("config").upsert({ key, value, description: mo }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  }
  return all[ma];
}
