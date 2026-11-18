export const TU_CHOI_CHAT_LA =
  "Chat này chưa được cấp quyền dùng cố vấn. Anh/chị báo CEO cấp quyền nếu hợp lệ. Em sẽ không nhắc lại.";

export function tinTuChoi(laNhom: boolean): string | null {
  return laNhom ? null : TU_CHOI_CHAT_LA;
}

const laId = (v: unknown): v is string | number =>
  (typeof v === "string" && v.trim() !== "") || (typeof v === "number" && Number.isFinite(v));

export function docDaTuChoi(raw: unknown): Set<string> {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try { v = JSON.parse(raw); } catch { v = null; }
  }
  const out = new Set<string>();
  const them = (x: unknown) => {
    if (laId(x)) out.add(String(x).trim());
    else if (x && typeof x === "object") {
      const o = x as { id?: unknown; chat_id?: unknown };
      if (laId(o.id)) out.add(String(o.id).trim());
      else if (laId(o.chat_id)) out.add(String(o.chat_id).trim());
    }
  };
  if (Array.isArray(v)) v.forEach(them);
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const ds = o.ids ?? o.chat_ids ?? o.danh_sach;
    if (Array.isArray(ds)) ds.forEach(them);
    else Object.keys(o).forEach((k) => { if (/^-?\d+$/.test(k.trim())) out.add(k.trim()); });
  }
  return out;
}

export function themDaTuChoi(raw: unknown, chatId: string | number): string[] {
  const s = docDaTuChoi(raw);
  s.add(String(chatId).trim());
  return [...s].slice(-100);
}
