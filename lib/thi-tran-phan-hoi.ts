export const KHOA_PHAN_HOI = "thi_tran_phan_hoi";

export type HanhDong = "giao" | "chay-lai" | "de-sau" | "bo-qua";
export type PhanHoi = { hanhDong: HanhDong; luc: string; boi: string; taskId?: string };
export type SoPhanHoi = Record<string, PhanHoi>;

export type ViecCC = { id: string; status: string; result?: string };

export type MayDut = { key: string; ten: string; phong: string; ghiChu: string; cachSua: string; chayLaiDuoc: boolean; lenhTay?: string };

export type TrangThaiVong =
  | "can-anh"
  | "cho-duyet"
  | "dang-sua"
  | "xong-van-dut"
  | "giao-hong"
  | "cho-chay-lai"
  | "chay-lai-van-dut"
  | "de-sau"
  | "qua-han"
  | "da-gat";

export type DeXuat = {
  id: string;
  phong: string;
  may: MayDut[];
  cachSua: string;
  lyDo: string;
  trangThai: TrangThaiVong;
  canAnh: boolean;
  chuTrangThai: string;
  phanHoi: PhanHoi | null;
  taskId: string | null;
  viecGoiY: string;
};

export type DaSua = { key: string; luc: string; hanhDong: HanhDong };

const GIO = 3600_000;
export const HAN = { deSau: 24 * GIO, gat: 7 * 24 * GIO, chayLai: 2 * GIO, giuDaSua: 48 * GIO, giuSo: 14 * 24 * GIO };

export function gomNhom(may: MayDut[]): MayDut[][] {
  const nhom = new Map<string, MayDut[]>();
  for (const m of may) {
    const k = (m.cachSua || m.key).replace(/\s+/g, " ").trim().toLowerCase().slice(0, 90);
    const ds = nhom.get(k);
    if (ds) ds.push(m); else nhom.set(k, [m]);
  }
  return [...nhom.values()];
}

export function viecGoiY(ds: MayDut[]): string {
  const ten = ds.map((m) => m.ten).join("; ");
  const lyDo = ds.map((m) => m.ghiChu).filter(Boolean)[0] || "đứt";
  const cach = ds[0].cachSua ? ` Gợi ý cách sửa: ${ds[0].cachSua}.` : "";
  return `Sửa máy đứt: ${ten}. Đang báo: ${lyDo}.${cach} Sửa xong chạy lại máy và xác nhận watchdog hết báo đứt.`.slice(0, 480);
}

export function trangThaiNhom(ph: PhanHoi | null, viec: ViecCC | null, bayGio: number): { tt: TrangThaiVong; chu: string } {
  if (!ph) return { tt: "can-anh", chu: "Chưa ai xử lý" };
  const tuoi = bayGio - Date.parse(ph.luc);
  switch (ph.hanhDong) {
    case "giao": {
      if (!viec) return { tt: "giao-hong", chu: "Mất dấu việc đã giao, anh giao lại giúp em" };
      if (viec.status === "pending") return { tt: "cho-duyet", chu: `Chờ anh /duyet ${viec.id} trên Telegram` };
      if (viec.status === "approved" || viec.status === "running") return { tt: "dang-sua", chu: viec.status === "running" ? "Claude đang sửa" : "Đã duyệt, chờ Claude nhận" };
      if (viec.status === "done") return { tt: "xong-van-dut", chu: "Claude báo xong nhưng máy vẫn đứt" };
      return { tt: "giao-hong", chu: viec.status === "rejected" ? "Anh đã từ chối việc này" : "Claude sửa không được" };
    }
    case "chay-lai":
      return tuoi < HAN.chayLai ? { tt: "cho-chay-lai", chu: "Vừa chạy lại, chờ máy báo" } : { tt: "chay-lai-van-dut", chu: "Đã chạy lại mà vẫn đứt" };
    case "de-sau":
      return tuoi < HAN.deSau ? { tt: "de-sau", chu: `Anh hẹn lại, nhắc sau ${Math.ceil((HAN.deSau - tuoi) / GIO)} giờ` } : { tt: "qua-han", chu: "Quá hạn để sau" };
    case "bo-qua":
      return tuoi < HAN.gat ? { tt: "da-gat", chu: `Anh đã gạt, xem lại sau ${Math.ceil((HAN.gat - tuoi) / (24 * GIO))} ngày` } : { tt: "qua-han", chu: "Gạt đã hơn 7 ngày, máy vẫn đứt" };
  }
}

const CAN_ANH = new Set<TrangThaiVong>(["can-anh", "xong-van-dut", "giao-hong", "chay-lai-van-dut", "qua-han"]);
const THU_TU: Record<TrangThaiVong, number> = {
  "xong-van-dut": 0, "chay-lai-van-dut": 1, "giao-hong": 2, "qua-han": 3, "can-anh": 4,
  "cho-duyet": 5, "dang-sua": 6, "cho-chay-lai": 7, "de-sau": 8, "da-gat": 9,
};

export function tinhVong(dut: MayDut[], so: SoPhanHoi, viec: ViecCC[], bayGio = Date.now()): { deXuat: DeXuat[]; daSua: DaSua[] } {
  const theoId = new Map(viec.map((v) => [v.id, v]));
  const deXuat = gomNhom(dut).map((ds) => {

    const ph = ds.map((m) => so[m.key]).filter(Boolean).sort((a, b) => Date.parse(b.luc) - Date.parse(a.luc))[0] ?? null;
    const v = ph?.taskId ? theoId.get(ph.taskId) ?? null : null;
    const { tt, chu } = trangThaiNhom(ph, v, bayGio);
    return {
      id: ds[0].key, phong: ds[0].phong, may: ds, cachSua: ds[0].cachSua,
      lyDo: ds.map((m) => m.ghiChu).filter(Boolean)[0] || "",
      trangThai: tt, canAnh: CAN_ANH.has(tt), chuTrangThai: chu, phanHoi: ph, taskId: ph?.taskId ?? null, viecGoiY: viecGoiY(ds),
    };
  }).sort((a, b) => THU_TU[a.trangThai] - THU_TU[b.trangThai] || b.may.length - a.may.length);

  const dangDut = new Set(dut.map((m) => m.key));
  const daSua = Object.entries(so)
    .filter(([k, ph]) => !dangDut.has(k) && bayGio - Date.parse(ph.luc) < HAN.giuDaSua && (ph.hanhDong === "giao" || ph.hanhDong === "chay-lai"))
    .map(([key, ph]) => ({ key, luc: ph.luc, hanhDong: ph.hanhDong }));
  return { deXuat, daSua };
}

export function donSo(so: SoPhanHoi, dangDut: Set<string>, bayGio = Date.now()): SoPhanHoi {
  const ra: SoPhanHoi = {};
  for (const [k, ph] of Object.entries(so)) {
    const tuoi = bayGio - Date.parse(ph.luc);
    if (!isFinite(tuoi) || tuoi > HAN.giuSo) continue;
    if (!dangDut.has(k) && tuoi > HAN.giuDaSua) continue;
    ra[k] = ph;
  }
  return ra;
}

export function docSo(raw: string | null): SoPhanHoi {
  try {
    const j = JSON.parse(raw || "{}");
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    const ra: SoPhanHoi = {};
    for (const [k, v] of Object.entries(j as Record<string, any>)) {
      if (v && ["giao", "chay-lai", "de-sau", "bo-qua"].includes(v.hanhDong) && typeof v.luc === "string") {
        ra[k] = { hanhDong: v.hanhDong, luc: v.luc, boi: String(v.boi ?? ""), ...(v.taskId ? { taskId: String(v.taskId) } : {}) };
      }
    }
    return ra;
  } catch { return {}; }
}
