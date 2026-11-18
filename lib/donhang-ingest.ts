const KEY = "tg_donhang_raw";
const TIEN_TO = "tg_donhang_msg_";
const GIU_NGAY = 120;

export type TinDonHang = {
  id: number;
  at: string;
  tu: string;
  text: string;
  anh: boolean;
  file: boolean;
};

async function doc(sb: any, key: string): Promise<string | null> {
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function idNhomDonHang(sb: any): Promise<string | null> {
  try {
    const raw = await doc(sb, "tg_donhang_chat");
    if (!raw) return null;
    const j = typeof raw === "string" ? JSON.parse(raw) : raw;
    return j?.id ? String(j.id) : null;
  } catch { return null; }
}

export async function luuTinNhomDonHang(sb: any, msg: any): Promise<boolean> {
  try {
    if (!msg?.chat?.id) return false;
    const idNhom = await idNhomDonHang(sb);
    if (!idNhom || String(msg.chat.id) !== idNhom) return false;

    const tin: TinDonHang = {
      id: Number(msg.message_id || 0),
      at: new Date((Number(msg.date) || 0) * 1000).toISOString(),
      tu: String(msg.from?.first_name || msg.from?.username || "?"),
      text: String(msg.text || msg.caption || ""),
      anh: Array.isArray(msg.photo) && msg.photo.length > 0,
      file: !!msg.document,
    };
    if (!tin.text && !tin.anh && !tin.file) return false;

    const ngay = tin.at.slice(0, 10).replace(/-/g, "");
    const { error } = await sb.from("config").insert({
      key: `${TIEN_TO}${ngay}_${tin.id}`,
      value: JSON.stringify(tin),
      description: "Tin nhóm Đơn Hàng (Telegram)",
    });

    if (error && !String(error.code || "") .includes("23505")) return false;

    if (tin.id % 200 === 0) {
      const cut = new Date(Date.now() - GIU_NGAY * 864e5).toISOString().slice(0, 10).replace(/-/g, "");
      await sb.from("config").delete().like("key", `${TIEN_TO}%`).lt("key", `${TIEN_TO}${cut}_`);
    }
    return true;
  } catch {
    return false;
  }
}

export async function docKhoTinDonHang(sb: any): Promise<TinDonHang[]> {
  const gop = new Map<number, TinDonHang>();
  try {
    const cu: TinDonHang[] = JSON.parse((await doc(sb, KEY)) || "[]");
    for (const t of cu) if (t?.id) gop.set(t.id, t);
  } catch { }
  try {
    const { data } = await sb.from("config").select("value").like("key", `${TIEN_TO}%`).limit(20000);
    for (const r of (data || [])) {
      try { const t = JSON.parse(r.value); if (t?.id) gop.set(t.id, t); } catch { }
    }
  } catch { }
  return [...gop.values()].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id));
}
