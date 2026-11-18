import { layBanDoMay, type MayChay } from "@/lib/may-chay-ngam";
import { listChoDuyetMay, listViecMay, tomTatMay } from "@/lib/viec-may";
import { listAll, tinhTrangHangDoi } from "@/lib/cc-queue";
import { getConfigValue } from "@/lib/app-config";
import { docLuu, type TrangThai as TrangThaiGrok } from "@/lib/bang-viec";
import { BO_PHAN, MOI_PHONG, phongCuaDuAn, phongCuaMay, phongCuaViecGrok, type MaPhong } from "@/lib/thi-tran";
import { KHOA_PHAN_HOI, docSo, tinhVong, type DaSua, type DeXuat, type MayDut } from "@/lib/thi-tran-phan-hoi";

export type ViecGrok = { ma: string; trangThai: TrangThaiGrok; moTa: string; luc: string; link: string | null };
export type ViecDaGiao = { id: string; viec: string; trangThai: string; luc: string };
export type BoPhanLive = { ten: string; ban: string; may: MayChay[] };
export type PhongLive = {
  id: MaPhong;
  boPhan: BoPhanLive[];
  viecGrok: ViecGrok[];
  daGiao: ViecDaGiao[];
  dem: { may: number; chay: number; dut: number; grokChoAnh: number; grokKet: number; grokDangChay: number };
};
export type TongQuanThiTran = {
  luotHomNay: number;
  choDuyet: number;
  choDuyetDs: { id: number; ai: string; viec: string; luc: string }[];
  vuaLam: { id: number; ai: string; viec: string; luc: string; hong: boolean }[];
  claude: { choDuyet: number; choLam: number; dangLam: number; song: boolean } | null;
  grokCapNhat: string | null;
};
export type ThiTranData = {
  phong: PhongLive[];
  dem: { tong: number; chay: number; chet: number; chuaRo: number; tat: number };
  nhipMac: { song: boolean; gio: number | null };
  tongQuan: TongQuanThiTran;

  vong: { deXuat: DeXuat[]; daSua: (DaSua & { ten: string })[] };
};

export async function layThiTran(): Promise<ThiTranData | null> {
  const [banDo, tomTat, choDuyet, vuaLam, hangDoi, bangViecRaw, moiViec, soRaw] = await Promise.all([
    layBanDoMay().catch(() => null),
    tomTatMay(1).catch(() => null),
    listChoDuyetMay(200).catch(() => []),
    listViecMay({ limit: 6 }).catch(() => []),
    tinhTrangHangDoi().catch(() => null),
    getConfigValue("bang_viec").catch(() => null),
    listAll().catch(() => []),
    getConfigValue(KHOA_PHAN_HOI).catch(() => null),
  ]);
  const mo = moiViec.filter((t) => ["pending", "approved", "running"].includes(t.status));
  if (!banDo) return null;
  const bangViec = docLuu(bangViecRaw);

  const phong: PhongLive[] = MOI_PHONG.map((p) => ({
    id: p.id,
    boPhan: BO_PHAN[p.id].map((b) => ({ ten: b.ten, ban: b.ban, may: [] as MayChay[] })),
    viecGrok: [],
    daGiao: [],
    dem: { may: 0, chay: 0, dut: 0, grokChoAnh: 0, grokKet: 0, grokDangChay: 0 },
  }));
  const theoId = new Map(phong.map((p) => [p.id, p]));

  for (const c of banDo.chuoi) {
    for (const m of c.may) {
      const { phong: pid, boPhan } = phongCuaMay(m.key, c.ma);
      const p = theoId.get(pid)!;
      let b = p.boPhan.find((x) => x.ten === boPhan);
      if (!b) { b = { ten: boPhan, ban: "may-tinh", may: [] }; p.boPhan.push(b); }
      b.may.push(m);
    }
  }

  for (const v of bangViec?.viec ?? []) {
    const p = theoId.get(phongCuaViecGrok(v.ma, v.mo_ta, v.phong))!;
    p.viecGrok.push({ ma: v.ma, trangThai: v.trang_thai, moTa: v.mo_ta, luc: v.luc, link: v.la_url ? v.link : null });
  }
  const thuTu: Record<TrangThaiGrok, number> = { "cho-anh": 0, ket: 1, "dang-chay": 2, xong: 3 };
  for (const p of phong) p.viecGrok.sort((a, b) => thuTu[a.trangThai] - thuTu[b.trangThai] || Date.parse(b.luc) - Date.parse(a.luc));

  for (const t of mo) {
    const pid = phongCuaDuAn(t.project);
    if (!pid) continue;
    theoId.get(pid)!.daGiao.push({ id: t.id, viec: t.task, trangThai: t.status, luc: t.createdAt });
  }

  for (const p of phong) {
    p.boPhan = p.boPhan.filter((b) => b.may.length > 0 || BO_PHAN[p.id].some((x) => x.ten === b.ten));
    const may = p.boPhan.flatMap((b) => b.may);
    p.dem = {
      may: may.length,
      chay: may.filter((m) => m.trangThai === "chay").length,
      dut: may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao).length,
      grokChoAnh: p.viecGrok.filter((v) => v.trangThai === "cho-anh").length,
      grokKet: p.viecGrok.filter((v) => v.trangThai === "ket").length,
      grokDangChay: p.viecGrok.filter((v) => v.trangThai === "dang-chay").length,
    };
  }

  const tenMay = new Map<string, string>();
  const dut: MayDut[] = [];
  for (const p of phong) for (const b of p.boPhan) for (const m of b.may) {
    tenMay.set(m.key, m.ten);
    if (m.trangThai === "chet" && !m.chiThamKhao) {
      dut.push({ key: m.key, ten: m.ten, phong: p.id, ghiChu: m.ghiChu || "", cachSua: m.cachSua || "", chayLaiDuoc: m.chayLai.kieu !== "nguoi", lenhTay: m.chayLai.kieu === "nguoi" ? m.chayLai.lenh : undefined });
    }
  }
  const vongTho = tinhVong(dut, docSo(soRaw), moiViec.map((t) => ({ id: t.id, status: t.status })));
  const vong = { deXuat: vongTho.deXuat, daSua: vongTho.daSua.map((x) => ({ ...x, ten: tenMay.get(x.key) || x.key })) };

  return {
    phong,
    vong,
    dem: { tong: banDo.dem.tong, chay: banDo.dem.chay, chet: banDo.dem.chet, chuaRo: banDo.dem.chuaRo, tat: banDo.dem.tat },
    nhipMac: banDo.nhipMac,
    tongQuan: {
      luotHomNay: tomTat?.tongLuot ?? 0,

      choDuyet: choDuyet.length,
      choDuyetDs: choDuyet.slice(0, 6).map((v) => ({ id: v.id, ai: v.agent_ten || v.agent, viec: v.viec, luc: v.created_at })),
      vuaLam: vuaLam.map((v) => ({ id: v.id, ai: v.agent_ten || v.agent, viec: v.viec, luc: v.created_at, hong: v.trang_thai === "hong" })),
      claude: hangDoi ? { choDuyet: hangDoi.choDuyet, choLam: hangDoi.daDuyetChoLam, dangLam: hangDoi.dangLam, song: hangDoi.nhip.song } : null,
      grokCapNhat: bangViec?.cap_nhat ?? null,
    },
  };
}

export function moTaPhongChoAI(d: ThiTranData, pid: MaPhong): string {
  const p = d.phong.find((x) => x.id === pid);
  const info = MOI_PHONG.find((x) => x.id === pid);
  if (!p || !info) return "";
  const dong: string[] = [];
  dong.push(`PHÒNG: ${info.ten}. Việc thường kỳ: ${info.moTa}`);
  dong.push(`Máy của phòng: ${p.dem.may} máy, ${p.dem.chay} đang chạy, ${p.dem.dut} đứt.`);
  for (const b of p.boPhan) {
    if (!b.may.length) continue;
    dong.push(`- Bộ phận ${b.ten}:`);
    for (const m of b.may) {
      const tt = m.trangThai === "chay" ? "chạy" : m.trangThai === "chet" ? "ĐỨT" : m.trangThai === "tat" ? "tắt theo lệnh" : "chưa ghi mốc";
      dong.push(`  · ${m.ten} [${tt}] ${String(m.ghiChu || "").slice(0, 140)}${m.trangThai === "chet" && m.cachSua ? ` | cách sửa: ${String(m.cachSua).slice(0, 140)}` : ""}`);
    }
  }
  if (p.viecGrok.length) {
    dong.push(`Việc MausBot đã giao phòng này (bảng việc iMac, cập nhật ${d.tongQuan.grokCapNhat ?? "?"}):`);
    for (const v of p.viecGrok.slice(0, 12)) dong.push(`  · ${v.ma} [${v.trangThai}] ${v.moTa.slice(0, 140)}`);
  } else dong.push("Việc MausBot: bảng việc iMac chưa có việc nào của phòng này.");
  const dx = d.vong.deXuat.filter((x) => x.phong === pid);
  if (dx.length) {
    dong.push("Đề xuất sửa chỗ đứt và anh đã trả lời gì (vòng phản hồi):");
    for (const x of dx) dong.push(`  · ${x.may.map((m) => m.ten).join("; ")} → ${x.chuTrangThai}${x.canAnh ? " (CẦN ANH)" : ""}`);
  }
  if (p.daGiao.length) {
    dong.push("Việc anh đã giao từ thị trấn (hàng việc Claude Code):");
    for (const v of p.daGiao.slice(0, 8)) dong.push(`  · [${v.trangThai}] ${v.viec.slice(0, 140)}`);
  }
  return dong.join("\n");
}
