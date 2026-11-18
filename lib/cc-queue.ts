import { getServiceClient } from "@/lib/supabase-server";
import { sendBrainTelegram, tgEscape } from "@/lib/telegram";

export type CCStatus = "pending" | "approved" | "running" | "done" | "failed" | "rejected";
export type CCTask = {
  id: string; task: string; project: string;
  byChat: string; byName: string;
  status: CCStatus; createdAt: string;
  result?: string; needsDeploy?: boolean;

  approvedAt?: string;
  startedAt?: string;

  finishedAt?: string;

  tienDo?: number;

  buoc?: string;

  tuDuyet?: boolean;
};

const KEY = "cc_queue";

export const KHOA_NHIP_RUNNER = "cc_worker_last";

const HAN_CHO_PHUT = 45;

const HAN_NHIP_PHUT = 20;

const HAN_DANG_LAM_PHUT = 30;
const getSb = () => getServiceClient();
async function load(): Promise<CCTask[]> {
  try { const v = (await getSb().from("config").select("value").eq("key", KEY).maybeSingle()).data?.value; const j = JSON.parse(v || "{}"); return Array.isArray(j.items) ? j.items : []; } catch { return []; }
}
async function save(items: CCTask[]) { await getSb().from("config").upsert({ key: KEY, value: JSON.stringify({ items: items.slice(-100) }) }, { onConflict: "key" }); }

const shortId = () => (globalThis.crypto?.randomUUID?.() || String(Date.now())).replace(/-/g, "").slice(0, 6);
const ceoChat = () => (process.env.TELEGRAM_CHAT_ID || "").trim();

const tenTho = (t: CCTask) => (String(t.project || "").toLowerCase() === "tieu-my" ? "Trợ lý Mac" : "Claude Code");

export async function addTask(task: string, project: string, byChat: string, byName: string, opts: { tuDuyet?: boolean; thayTheTag?: string } = {}): Promise<CCTask> {
  const items = await load();
  const now = new Date().toISOString();

  if (opts.thayTheTag) {
    const cu = items.filter((x) => x.status === "pending" && x.byName === byName && x.task.startsWith(opts.thayTheTag + ":"));
    const giong = cu.find((x) => x.task.trim() === task.trim());
    if (giong) return giong;
    for (const x of cu) { x.status = "rejected"; x.result = "Thay bằng bản nhắc mới hơn"; x.finishedAt = now; }
  }
  const t: CCTask = { id: shortId(), task: task.trim(), project: (project || "").trim(), byChat, byName, status: opts.tuDuyet ? "approved" : "pending", createdAt: now };
  if (opts.tuDuyet) { t.approvedAt = now; t.tuDuyet = true; t.tienDo = 0; }
  items.push(t); await save(items);
  const ceo = ceoChat();
  if (ceo && opts.tuDuyet) {
    await sendBrainTelegram(ceo, `\u{1F4E5} <b>Đã chuyển ${tenTho(t)} việc ${t.byChat === ceo ? "anh" : tgEscape(byName)} giao</b> (mã ${t.id})\n“${tgEscape(t.task.slice(0, 200))}”\n\n${tgEscape(await loiHuaThat())}`);
  } else if (ceo) {
    await sendBrainTelegram(ceo, `\u{1F4E5} <b>Việc mới cần anh duyệt</b>\nNgười giao: <b>${tgEscape(byName)}</b>${t.project ? ` · dự án: ${tgEscape(t.project)}` : ""}\n\n“${tgEscape(t.task)}”\n\nDuyệt: <code>/duyet ${t.id}</code> · Từ chối: <code>/tuchoi ${t.id}</code>`);
  }
  return t;
}

export async function listOpen(): Promise<CCTask[]> {
  return (await load()).filter((t) => ["pending", "approved", "running"].includes(t.status));
}

export async function listAll(): Promise<CCTask[]> {
  return load();
}
export async function getTask(id: string): Promise<CCTask | null> {
  return (await load()).find((t) => t.id === id) || null;
}

export async function approve(id: string): Promise<CCTask | null> {
  const items = await load(); const t = items.find((x) => x.id === id && x.status === "pending"); if (!t) return null;
  t.status = "approved"; t.approvedAt = new Date().toISOString(); await save(items);
  if (t.byChat && t.byChat !== ceoChat()) await sendBrainTelegram(t.byChat, `\u{2713} Việc “${tgEscape(t.task.slice(0, 60))}” đã được duyệt — ${tenTho(t)} sẽ bắt tay làm.`);
  return t;
}
export async function reject(id: string): Promise<CCTask | null> {
  const items = await load(); const t = items.find((x) => x.id === id && x.status === "pending"); if (!t) return null;
  t.status = "rejected"; await save(items);
  if (t.byChat && t.byChat !== ceoChat()) await sendBrainTelegram(t.byChat, `Việc “${tgEscape(t.task.slice(0, 60))}” chưa được duyệt lần này.`);
  return t;
}

export async function listApproved(): Promise<CCTask[]> {
  return (await load()).filter((x) => x.status === "approved");
}

export async function progress(id: string, note: string): Promise<boolean> {
  const items = await load(); const t = items.find((x) => x.id === id); if (!t) return false;
  const msg = `\u{1F6E0} <b>${tenTho(t)} — việc ${id}</b>\n“${tgEscape(t.task.slice(0, 80))}”\n${tgEscape((note || "").slice(0, 600))}`;
  const targets = new Set([t.byChat, ceoChat()].filter(Boolean));
  for (const c of targets) await sendBrainTelegram(c, msg);
  return true;
}

export async function capNhatTienDo(id: string, tienDo: number, buoc?: string): Promise<boolean> {
  const items = await load(); const t = items.find((x) => x.id === id); if (!t) return false;
  t.tienDo = Math.max(0, Math.min(99, Math.round(tienDo)));
  if (buoc) t.buoc = buoc.slice(0, 160);
  await save(items);
  await dongBoViecBang(t, "doing");
  return true;
}

export const maTheCC = (id: string) => `[CC:${id}]`;

async function dongBoViecBang(t: CCTask, status: "doing" | "done" | "blocked") {
  try {
    const sb = getSb();
    const { data } = await sb.from("tasks").select("id, status").ilike("description", `%${maTheCC(t.id)}%`).limit(1);
    const row = data?.[0];
    if (!row || row.status === status || row.status === "done" || row.status === "cancelled") return;
    const sua: Record<string, unknown> = { status };
    if (status === "done") sua.completed_at = new Date().toISOString();
    if (status === "blocked") sua.blocker_reason = "Claude Code gặp trục trặc — xem báo cáo Telegram";
    await sb.from("tasks").update(sua).eq("id", row.id);
  } catch {  }
}

export async function claim(id: string): Promise<CCTask | null> {
  const items = await load(); const t = items.find((x) => x.id === id && x.status === "approved"); if (!t) return null;
  t.status = "running"; t.startedAt = new Date().toISOString(); await save(items);
  return t;
}

export async function report(id: string, result: string, ok: boolean, needsDeploy?: boolean): Promise<boolean> {
  const items = await load(); const t = items.find((x) => x.id === id); if (!t) return false;
  t.status = ok ? "done" : "failed"; t.result = (result || "").slice(0, 3000); t.needsDeploy = !!needsDeploy;
  t.finishedAt = new Date().toISOString();
  if (ok) t.tienDo = 100;
  await save(items);
  await dongBoViecBang(t, ok ? "done" : "blocked");
  const head = ok ? `\u{2705} <b>${tenTho(t)} đã xong việc</b>` : `\u{26A0} <b>${tenTho(t)} gặp trục trặc</b>`;
  const deployLine = needsDeploy ? `\n\n\u{1F680} Việc này cần <b>deploy</b> để lên thật — anh duyệt: <code>/deploy ${t.id}</code>` : "";
  const msg = `${head}\n“${tgEscape(t.task.slice(0, 80))}”\n\n${tgEscape((result || "").slice(0, 1500))}${deployLine}`;
  const targets = new Set([t.byChat, ceoChat()].filter(Boolean));
  for (const c of targets) await sendBrainTelegram(c, msg);
  return true;
}

const phutTu = (iso?: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
};

export type NhipRunner = { coNhip: boolean; phut: number | null; song: boolean };

export async function nhipRunner(): Promise<NhipRunner> {
  try {
    const v = (await getSb().from("config").select("value").eq("key", KHOA_NHIP_RUNNER).maybeSingle()).data?.value;
    const j = JSON.parse(v || "{}");
    const phut = phutTu(j?.at || j?.luc || null);
    return { coNhip: phut != null, phut, song: phut != null && phut <= HAN_NHIP_PHUT };
  } catch { return { coNhip: false, phut: null, song: false }; }
}

export async function loiHuaThat(): Promise<string> {
  const n = await nhipRunner();
  if (n.song) return "Máy làm việc đang chạy — Claude Code sẽ nhận trong ~2 phút.";
  if (!n.coNhip) return "LƯU Ý: máy làm việc CHƯA từng báo nhịp — việc sẽ nằm chờ tới khi bật. Trên máy Mac: launchctl list | grep cc-worker (hoặc chạy tay: node scripts/cc-worker.mjs).";
  return `LƯU Ý: máy làm việc đang TẮT (nhịp cuối ${n.phut} phút trước) — việc sẽ nằm chờ. Trên máy Mac: launchctl list | grep cc-worker (hoặc chạy tay: node scripts/cc-worker.mjs).`;
}

export type TinhTrangHangDoi = {
  choDuyet: number; daDuyetChoLam: number; dangLam: number;
  lauNhatPhut: number | null; nhip: NhipRunner;
};

export async function tinhTrangHangDoi(): Promise<TinhTrangHangDoi> {
  const items = await load();
  const cho = items.filter((t) => t.status === "approved");
  const phut = cho.map((t) => phutTu(t.approvedAt || t.createdAt)).filter((p): p is number => p != null);
  return {
    choDuyet: items.filter((t) => t.status === "pending").length,
    daDuyetChoLam: cho.length,
    dangLam: items.filter((t) => t.status === "running").length,
    lauNhatPhut: phut.length ? Math.max(...phut) : null,
    nhip: await nhipRunner(),
  };
}

export async function goViecKet(): Promise<number> {
  const items = await load();
  let n = 0;
  for (const t of items) {
    if (t.status !== "running") continue;
    const p = phutTu(t.startedAt);
    if (p != null && p > HAN_DANG_LAM_PHUT) { t.status = "approved"; delete t.startedAt; n++; }
  }
  if (n) await save(items);
  return n;
}

export async function doHangDoiDuyet(): Promise<{ key: string; label: string; note: string; fix: string }[]> {
  const out: { key: string; label: string; note: string; fix: string }[] = [];
  const items = await load();
  const cho = items.filter((t) => t.status === "approved");
  const dangLam = items.filter((t) => t.status === "running");
  if (!cho.length && !dangLam.length) return out;

  const n = await nhipRunner();
  const treo = cho
    .map((t) => ({ t, phut: phutTu(t.approvedAt || t.createdAt) }))
    .filter((x) => x.phut != null && x.phut > HAN_CHO_PHUT)
    .sort((a, b) => (b.phut || 0) - (a.phut || 0));

  if (treo.length) {
    const lauNhat = treo[0];
    const gio = Math.round((lauNhat.phut || 0) / 60 * 10) / 10;
    out.push({
      key: "viec_duyet_khong_troi",
      label: "Việc ĐÃ DUYỆT mà không ai làm",
      note: `${treo.length} việc đã được duyệt nhưng nằm chờ quá ${HAN_CHO_PHUT} phút — lâu nhất ${gio}h ("${(lauNhat.t.task || "").slice(0, 60)}"). Máy làm việc ${n.song ? `còn nhịp ${n.phut} phút trước nhưng không kéo việc` : n.coNhip ? `đang TẮT (nhịp cuối ${n.phut} phút trước)` : "CHƯA từng báo nhịp"}.`,
      fix: n.song
        ? "Runner còn thở mà việc không trôi — xem log /tmp/acme-cc-worker.log trên máy Mac, thường là `claude` lỗi quyền hoặc sai thư mục dự án."
        : "Bật máy Mac rồi: launchctl list | grep cc-worker (chạy tay: node scripts/cc-worker.mjs). Duyệt việc mà không có máy làm thì việc chỉ nằm im.",
    });
  }

  const ket = dangLam
    .map((t) => ({ t, phut: phutTu(t.startedAt) }))
    .filter((x) => x.phut != null && x.phut > HAN_DANG_LAM_PHUT);
  if (ket.length) {
    out.push({
      key: "viec_dang_lam_bi_ket",
      label: "Việc kẹt giữa chừng",
      note: `${ket.length} việc đứng ở trạng thái "đang làm" quá ${HAN_DANG_LAM_PHUT} phút — worker nhận rồi chết giữa chừng.`,
      fix: "Lượt cc-worker kế tiếp sẽ tự trả chúng về hàng đợi (goViecKet). Còn kẹt sau đó thì xem log /tmp/acme-cc-worker.log.",
    });
  }
  return out;
}

export async function anhChupHangDoi(): Promise<CCTask[]> {
  const items = await load();
  const moc = Date.now() - 24 * 3600_000;
  return items.filter((t) => ["approved", "running"].includes(t.status) || (t.finishedAt && Date.parse(t.finishedAt) > moc));
}
