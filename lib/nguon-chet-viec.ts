import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";
import type { SourceHealth } from "@/lib/watchdog";

export const THE_NGUON_CHET = "nguon-chet";
const KHOA_LICH_SU = "nguon_chet_lich_su";

const KHOA_CHU_NGUON = "nguon_chet_chu";

const KHOA_NGUOI_GIU = "nguoi_giu";
const CEO = "Nguyễn Văn An";

const NGAY_LEO_THANG = 3;

export type LichSu = Record<string, { tuNgay: string; lanCuoi: string }>;

export type ViecDangMo = { id: string; key: string; title: string; priority: string | null; description: string | null };

export type QuyetDinh = {
  mo: { s: SourceHealth; ngayChet: number }[];
  leoThang: { id: string; s: SourceHealth; ngayChet: number }[];
  dong: ViecDangMo[];
  lichSu: LichSu;
};

export type KetQuaDongBo = {
  taoMoi: { key: string; label: string; nguoi: string }[];
  dong: { key: string; label: string }[];
  leoThang: { key: string; label: string; soNgay: number }[];
  loi?: string;
};

const doc = async <T,>(k: string, mac: T): Promise<T> => {
  try { const v = await getConfigValue(k); return v ? (JSON.parse(v) as T) : mac; } catch { return mac; }
};

const soNgay = (tu: string, den: string): number => {
  const a = Date.parse(`${tu}T00:00:00+07:00`);
  const b = Date.parse(`${den}T00:00:00+07:00`);
  return isFinite(a) && isFinite(b) ? Math.max(0, Math.round((b - a) / 86400e3)) : 0;
};

export const NHOM_NGUYEN_NHAN: Record<string, string[]> = {
  jt_session: ["jt_waybills", "jt_waybills_moi", "jt_canh_bao_last", "jt_reconcile"],
  ad_scout_status: ["ad_library_scout"],
  salework_session_status: ["sale_unreplied", "salework_status", "salework_dacham_status", "zalo_unreplied"],
};

export function gomNguyenNhan(sources: SourceHealth[]): { sources: SourceHealth[]; keoTheo: Record<string, string[]> } {
  const chet = new Set(sources.filter((s) => !s.ok && !s.chiThamKhao).map((s) => s.key));
  const bo = new Map<string, string>();
  const keoTheo: Record<string, string[]> = {};
  for (const [goc, nhanh] of Object.entries(NHOM_NGUYEN_NHAN)) {
    if (!chet.has(goc)) continue;
    for (const k of nhanh) if (chet.has(k) && !bo.has(k)) bo.set(k, goc);
  }
  for (const s of sources) { const g = bo.get(s.key); if (g) (keoTheo[g] ??= []).push(s.label); }
  return { sources: sources.filter((s) => !bo.has(s.key)), keoTheo };
}

function moTa(s: SourceHealth, ngayChet: number, keoTheo: string[] = [], chuaAiNhan = false): string {
  const tuoi = s.ageHours == null ? "không đo được tuổi" : `dữ liệu mới nhất cách đây ${s.ageHours}h`;
  const dong = [
    `Nguồn dữ liệu "${s.label}" đang NGỦ/CHẾT — ${s.note} (${tuoi}; ngưỡng ${s.maxHours}h).`,
    ``,
    `CÁCH CHỮA (watchdog gợi ý): ${s.fix}`,
    ...(keoTheo.length ? [``, `KÉO THEO ${keoTheo.length} nguồn phụ thuộc (tự sống lại khi sửa xong nguồn này): ${keoTheo.join(" · ")}`] : []),
    ``,
    `Việc này do AI Canh Gác tự mở. Nguồn sống lại thì máy TỰ ĐÓNG việc, không cần bấm xong.`,
    `Xem toàn bộ nguồn: /may-chay-ngam`,
  ];

  if (chuaAiNhan) dong.splice(1, 0,
    ``,
    `CHƯA AI NHẬN NGUỒN NÀY nên việc rơi về CEO. Khai người giữ: config "nguoi_giu", khoá "nguon:${s.key}".`,
  );
  if (ngayChet >= NGAY_LEO_THANG) {
    dong.splice(3, 0,
      `ĐÃ CHẾT ${ngayChet} NGÀY. Đến mức này thì thứ cần quyết KHÔNG còn là câu lệnh nữa:`,
      `  · còn dùng số của nguồn này → sửa dứt điểm hôm nay, vì mọi báo cáo đang chạy bằng số cũ;`,
      `  · không dùng nữa → chốt bỏ hẳn (gắn cờ chiThamKhao trong lib/watchdog.ts) để nó thôi kêu.`,
      `  Để lửng lơ là tệ nhất: báo động đỏ mỗi ngày sẽ làm cả nhóm chai với màu đỏ.`,
      ``,
    );
  }
  return dong.join("\n");
}

export function quyetDinhViec(
  sources: SourceHealth[],
  viecDangMo: ViecDangMo[],
  lichSuCu: LichSu,
  homNay: string,
): QuyetDinh {
  const kq: QuyetDinh = { mo: [], leoThang: [], dong: [], lichSu: {} };
  const chet = sources.filter((s) => !s.ok && !s.chiThamKhao);
  const chetTheoKey = new Map(chet.map((s) => [s.key, s]));
  const viecTheoKey = new Map(viecDangMo.map((v) => [v.key, v]));

  for (const s of chet) {
    const tuNgay = lichSuCu[s.key]?.tuNgay || homNay;
    kq.lichSu[s.key] = { tuNgay, lanCuoi: new Date().toISOString() };
    const ngayChet = soNgay(tuNgay, homNay);
    const gap = viecTheoKey.get(s.key);
    if (!gap) { kq.mo.push({ s, ngayChet }); continue; }

    if (ngayChet >= NGAY_LEO_THANG && gap.priority !== "urgent") kq.leoThang.push({ id: gap.id, s, ngayChet });
  }

  for (const v of viecDangMo) {
    if (chetTheoKey.has(v.key)) continue;
    kq.dong.push(v);
  }
  return kq;
}

export async function dongBoViecNguonChet(sourcesTho: SourceHealth[]): Promise<KetQuaDongBo> {
  const { sources, keoTheo } = gomNguyenNhan(sourcesTho);
  const kq: KetQuaDongBo = { taoMoi: [], dong: [], leoThang: [] };
  try {
    const sb = getServiceClient();
    const homNay = vnDateStr();

    const { data: dangMo, error: loiDoc } = await sb
      .from("tasks")
      .select("id,title,tags,priority,description")
      .contains("tags", [THE_NGUON_CHET])
      .in("status", ["todo", "doing", "review", "blocked"])
      .limit(200);

    if (loiDoc) { kq.loi = `không đọc được việc đang mở: ${loiDoc.message}`; return kq; }
    const mo = (dangMo ?? []) as { id: string; title: string; tags: string[] | null; priority: string | null; description: string | null }[];
    const viecDangMo: ViecDangMo[] = [];
    for (const t of mo) {
      const the = (t.tags ?? []).find((x) => x.startsWith("nguon:"));
      if (the) viecDangMo.push({ id: t.id, key: the.slice(6), title: t.title, priority: t.priority, description: t.description });
    }

    const lichSuCu = await doc<LichSu>(KHOA_LICH_SU, {});
    const soGiu = await doc<Record<string, string>>(KHOA_NGUOI_GIU, {});
    const chuNguon = await doc<Record<string, string>>(KHOA_CHU_NGUON, {});
    const chuCua = (key: string) => soGiu[`nguon:${key}`] || chuNguon[key] || null;
    const qd = quyetDinhViec(sources, viecDangMo, lichSuCu, homNay);

    const { data: users } = await sb.from("users").select("id,full_name").eq("active", true);
    const dsUser = (users ?? []) as { id: string; full_name: string }[];
    const timNguoi = (ten: string) => dsUser.find((u) => u.full_name === ten);
    const ceo = timNguoi(CEO);

    for (const { s, ngayChet } of qd.mo) {
      const tenChu = chuCua(s.key);
      const nguoi = (tenChu ? timNguoi(tenChu) : null) || ceo;
      const { error } = await sb.from("tasks").insert({
        title: `[Nguồn chết] ${s.label}`.slice(0, 200),
        description: moTa(s, ngayChet, keoTheo[s.key] ?? [], !tenChu),
        assigner_id: ceo?.id ?? null,
        assignee_id: nguoi?.id ?? null,
        priority: ngayChet >= NGAY_LEO_THANG ? "urgent" : "high",
        status: "todo",

        due_date: homNay,
        tags: [THE_NGUON_CHET, `nguon:${s.key}`],
      });
      if (!error) kq.taoMoi.push({ key: s.key, label: s.label, nguoi: nguoi?.full_name || "chưa gán" });
    }

    for (const { id, s, ngayChet } of qd.leoThang) {
      const { error } = await sb.from("tasks")
        .update({ priority: "urgent", description: moTa(s, ngayChet, keoTheo[s.key] ?? []) })
        .eq("id", id);
      if (!error) kq.leoThang.push({ key: s.key, label: s.label, soNgay: ngayChet });
    }

    for (const t of qd.dong) {
      const { error } = await sb.from("tasks")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          description: `${t.description || ""}\n\n[AI Canh Gác] Nguồn đã sống lại lúc ${new Date().toISOString()} — việc tự đóng.`.slice(0, 4000),
        })
        .eq("id", t.id);
      if (!error) { kq.dong.push({ key: t.key, label: t.title }); delete qd.lichSu[t.key]; }
    }

    await setConfigValue(KHOA_LICH_SU, JSON.stringify(qd.lichSu),
      "Nguồn nào chết từ ngày nào (AI Canh Gác dùng để leo thang mức ưu tiên)");
  } catch (e: any) {

    kq.loi = String(e?.message || e);
  }
  return kq;
}

export function tomTatDongBo(kq: KetQuaDongBo): string {
  const p: string[] = [];
  if (kq.taoMoi.length) p.push(`đã mở ${kq.taoMoi.length} việc trong /tasks (giao ${[...new Set(kq.taoMoi.map((x) => x.nguoi))].join(", ")})`);
  if (kq.leoThang.length) p.push(`${kq.leoThang.length} việc nâng lên KHẨN (chết ${Math.max(...kq.leoThang.map((x) => x.soNgay))} ngày)`);
  if (kq.dong.length) p.push(`tự đóng ${kq.dong.length} việc do nguồn đã sống lại`);
  if (kq.loi) p.push(`GHI VIỆC HỎNG: ${kq.loi}`);
  return p.length ? `Việc đã giao: ${p.join(" · ")}.` : "";
}
