import { randomUUID } from "crypto";

export type KetQuaXep = { ok: true; id: string; luc: string } | { ok: false; loi: string };

export async function xepHangGuiZalo(
  sb: any,
  t: { own: string; uid: string; kieu?: string; noiDung: string; boi: string }
): Promise<KetQuaXep> {
  const id = randomUUID();
  const luc = new Date().toISOString();
  const kieu = t.kieu || "user";

  const { error: e1 } = await sb.from("zalo_bridge_messages").insert({
    msg_id: `app-cho:${id}`, own_id: t.own, thread_id: t.uid, thread_type: kieu,
    direction: "out", content: t.noiDung, sent_at: luc,
  });
  if (e1) return { ok: false, loi: e1.message };

  await sb.from("zalo_bridge_contacts").update({
    last_out_at: luc, last_msg_at: luc, unreplied: false,
    last_content: t.noiDung, last_type: "text", updated_at: luc,
  }).eq("own_id", t.own).eq("zalo_uid", t.uid);

  try {
    const { data: cfg } = await sb.from("config").select("value").eq("key", "zalo_gui_cho").maybeSingle();
    const hang: Record<string, any> = (() => { try { return JSON.parse(cfg?.value || "{}"); } catch { return {}; } })();
    hang[id] = { own: t.own, uid: t.uid, kieu, noiDung: t.noiDung, boi: t.boi, luc };
    await sb.from("config").upsert({ key: "zalo_gui_cho", value: JSON.stringify(hang) }, { onConflict: "key" });
  } catch (e: any) {

    await sb.from("zalo_bridge_messages").update({ msg_id: `app-loi:${id}` }).eq("msg_id", `app-cho:${id}`);
    return { ok: false, loi: "Không xếp được vào hàng đợi gửi: " + String(e?.message || e) };
  }
  return { ok: true, id: `app-cho:${id}`, luc };
}
