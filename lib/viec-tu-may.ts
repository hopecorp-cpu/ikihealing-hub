import { vnDateStr } from "@/lib/payroll";

const CON_MO = ["todo", "doing", "review", "blocked"];

export type UuTien = "low" | "medium" | "high" | "urgent";

export type ViecCan = {

  khoa: string;
  tieuDe: string;
  moTa?: string;

  nguoi?: string;
  uuTien?: UuTien;

  han?: string;
};

export type KetQuaViec = {
  taoMoi: { khoa: string; tieuDe: string; nguoi: string }[];
  capNhat: { khoa: string; tieuDe: string }[];
  dong: { khoa: string; tieuDe: string }[];
  leoThang: { khoa: string; tieuDe: string; soNgay: number }[];
  loi?: string;

  loiGhi?: string[];
};

export type TuyChon = {

  the: string;
  cans: ViecCan[];

  nguoiMacDinh?: string;

  ngayLeoThang?: number;

  lyDoDong?: string;

  tuDong?: boolean;
};

const CEO = "Nguyễn Văn An";

export async function dongBoViec(sb: any, opt: TuyChon): Promise<KetQuaViec> {
  const kq: KetQuaViec = { taoMoi: [], capNhat: [], dong: [], leoThang: [] };
  const the = opt.the;
  const tienTo = `${the}:`;
  const homNay = vnDateStr();
  const ngayLeo = opt.ngayLeoThang ?? 0;

  const { data: mo, error: loiDoc } = await sb.from("tasks")
    .select("id,title,tags,priority,description,created_at")
    .contains("tags", [the])
    .in("status", CON_MO)
    .limit(300);

  if (loiDoc) { kq.loi = `không đọc được việc đang mở: ${loiDoc.message}`; return kq; }

  const dangMo = new Map<string, { id: string; title: string; priority: string | null; description: string | null; created_at: string }>();
  for (const t of (mo ?? []) as any[]) {
    const the2 = (t.tags ?? []).find((x: string) => x.startsWith(tienTo));
    if (the2) dangMo.set(the2.slice(tienTo.length), t);
  }

  const { data: users } = await sb.from("users").select("id,full_name").eq("active", true);
  const ds = (users ?? []) as { id: string; full_name: string }[];
  const tim = (ten?: string) => (ten ? ds.find((u) => u.full_name === ten) : undefined);
  const macDinh = tim(opt.nguoiMacDinh || CEO) || tim(CEO);

  for (const v of opt.cans) {
    const cu = dangMo.get(v.khoa);
    if (cu) {

      if (v.moTa && v.moTa !== cu.description) {
        const { error } = await sb.from("tasks").update({ description: v.moTa.slice(0, 4000) }).eq("id", cu.id);
        if (!error) kq.capNhat.push({ khoa: v.khoa, tieuDe: cu.title });
      }

      if (ngayLeo > 0 && cu.priority !== "urgent") {
        const tuoi = Math.floor((Date.now() - new Date(cu.created_at).getTime()) / 864e5);
        if (tuoi >= ngayLeo) {
          const { error } = await sb.from("tasks").update({ priority: "urgent" }).eq("id", cu.id);
          if (!error) kq.leoThang.push({ khoa: v.khoa, tieuDe: cu.title, soNgay: tuoi });
        }
      }
      continue;
    }
    const nguoi = tim(v.nguoi) || macDinh;
    const { error } = await sb.from("tasks").insert({
      title: v.tieuDe.slice(0, 200),
      description: (v.moTa || "").slice(0, 4000),
      assigner_id: macDinh?.id ?? null,
      assignee_id: nguoi?.id ?? null,
      priority: v.uuTien || "medium",
      status: "todo",
      due_date: v.han || homNay,
      tags: [the, `${tienTo}${v.khoa}`],
    });
    if (!error) kq.taoMoi.push({ khoa: v.khoa, tieuDe: v.tieuDe, nguoi: nguoi?.full_name || "chưa gán" });

    else (kq.loiGhi ||= []).push(`${v.khoa}: ${error.message.slice(0, 100)}`);
  }

  if (opt.tuDong === false) return kq;
  const conCan = new Set(opt.cans.map((v) => v.khoa));
  for (const [khoa, t] of dangMo) {
    if (conCan.has(khoa)) continue;
    const { error } = await sb.from("tasks").update({
      status: "done",
      completed_at: new Date().toISOString(),
      description: `${t.description || ""}\n\n[Máy tự đóng ${new Date().toISOString()}] ${opt.lyDoDong || "Lý do mở việc không còn nữa."}`.slice(0, 4000),
    }).eq("id", t.id);
    if (!error) kq.dong.push({ khoa, tieuDe: t.title });
  }

  return kq;
}

export function tomTat(kq: KetQuaViec): string {
  if (kq.loi) return `sổ việc: ${kq.loi}`;
  const p: string[] = [];
  if (kq.taoMoi.length) p.push(`mở ${kq.taoMoi.length} việc`);
  if (kq.leoThang.length) p.push(`nâng khẩn ${kq.leoThang.length}`);
  if (kq.dong.length) p.push(`đóng ${kq.dong.length}`);
  if (kq.loiGhi?.length) p.push(`KHÔNG MỞ ĐƯỢC ${kq.loiGhi.length}: ${kq.loiGhi[0]}`);
  return p.length ? `sổ việc: ${p.join(" · ")}` : "sổ việc: không đổi";
}
