export const CHU_KY_NGAY = 27;

export type SoKhach = {

  ngayTuDonCuoi: number;

  soLanMua: number;

  tongNet: number;
};

export type DiemRFM = { R: 1 | 2 | 3 | 4 | 5; F: 1 | 2 | 3 | 4 | 5; M: 1 | 2 | 3 | 4 | 5 };

export function diemR(ngay: number): DiemRFM["R"] {
  if (ngay <= CHU_KY_NGAY) return 5;
  if (ngay <= CHU_KY_NGAY * 2) return 4;
  if (ngay <= CHU_KY_NGAY * 3) return 3;
  if (ngay <= CHU_KY_NGAY * 6) return 2;
  return 1;
}

export function diemF(lan: number): DiemRFM["F"] {
  if (lan >= 5) return 5;
  if (lan >= 4) return 4;
  if (lan >= 3) return 3;
  if (lan >= 2) return 2;
  return 1;
}

export type MocM = [number, number, number, number];

export function dungMocM(dsNet: number[]): MocM | null {
  const v = dsNet.filter((n) => n > 0).sort((a, b) => a - b);
  if (v.length < 20) return null;
  const pv = (q: number) => v[Math.min(v.length - 1, Math.floor(q * v.length))];
  return [pv(0.2), pv(0.4), pv(0.6), pv(0.8)];
}

export function diemM(net: number, moc: MocM | null): DiemRFM["M"] {
  if (!moc) return 3;
  if (net <= moc[0]) return 1;
  if (net <= moc[1]) return 2;
  if (net <= moc[2]) return 3;
  if (net <= moc[3]) return 4;
  return 5;
}

export type MaPhanKhuc =
  | "khach-ruot" | "trung-thanh-moi" | "khach-moi" | "sap-het-hang"
  | "can-giu-gap" | "dang-nguoi" | "sap-mat" | "da-mat" | "mua-mot-lan";

export type PhanKhuc = {
  ma: MaPhanKhuc;
  ten: string;

  viec: string;

  mau: string;

  uuTien: number;
};

export const PHAN_KHUC: Record<MaPhanKhuc, PhanKhuc> = {
  "sap-het-hang": {
    ma: "sap-het-hang", ten: "Sắp hết hàng", uuTien: 1, mau: "bg-amber-100 text-amber-800",
    viec: "Nhắn ngay trong tuần này — khách vừa dùng hết, đây là cửa sổ dễ chốt nhất. Hỏi dùng thấy ổn không rồi mời lấy tiếp.",
  },
  "can-giu-gap": {
    ma: "can-giu-gap", ten: "Cần giữ gấp", uuTien: 2, mau: "bg-rose-100 text-rose-800",
    viec: "Khách to đang nguội — GỌI ĐIỆN, đừng nhắn. Hỏi thẳng vì sao ngừng dùng và ghi lại câu trả lời.",
  },
  "khach-moi": {
    ma: "khach-moi", ten: "Khách mới", uuTien: 3, mau: "bg-sky-100 text-sky-800",
    viec: "Chăm đúng mốc ngày 24 để có lần mua thứ hai — đây là chỗ rò lớn nhất của cả tệp.",
  },
  "khach-ruot": {
    ma: "khach-ruot", ten: "Khách ruột", uuTien: 4, mau: "bg-emerald-100 text-emerald-800",
    viec: "Tặng quà tri ân KHÔNG điều kiện, mời giới thiệu người quen. Đừng bán thêm ở lần chạm này.",
  },
  "trung-thanh-moi": {
    ma: "trung-thanh-moi", ten: "Đang thành khách ruột", uuTien: 5, mau: "bg-teal-100 text-teal-800",
    viec: "Mời lên combo hoặc thùng — khách đã tin, mua lẻ nhiều lần thì gợi gói lớn hơn cho tiện.",
  },
  "dang-nguoi": {
    ma: "dang-nguoi", ten: "Đang nguội", uuTien: 6, mau: "bg-orange-100 text-orange-800",
    viec: "Đã bỏ lỡ một chu kỳ. Nhắn hỏi thăm kèm quà nhỏ, chưa chào hàng ngay.",
  },
  "sap-mat": {
    ma: "sap-mat", ten: "Sắp mất", uuTien: 7, mau: "bg-yellow-100 text-yellow-800",
    viec: "Cần một CỚ để gọi lại (sản phẩm mới, đợt tặng quà). Không nhắc chuyện mua ở tin đầu.",
  },
  "mua-mot-lan": {
    ma: "mua-mot-lan", ten: "Mua một lần rồi đi", uuTien: 8, mau: "bg-slate-100 text-slate-700",
    viec: "Tệp lớn nhất và ít ai chạm. Hỏi LÝ DO không quay lại, ghi vào sổ chăm — câu trả lời đáng hơn một đơn.",
  },
  "da-mat": {
    ma: "da-mat", ten: "Đã mất", uuTien: 9, mau: "bg-gray-100 text-gray-600",
    viec: "Chỉ đưa vào chiến dịch đánh thức theo ĐỢT, đừng nhắc hằng ngày — nhắc dày là bị chặn.",
  },
};

export function ganPhanKhuc(d: DiemRFM): PhanKhuc {
  const { R, F, M } = d;
  if (R <= 3 && F >= 3 && M >= 4) return PHAN_KHUC["can-giu-gap"];
  if (R >= 4 && F >= 4) return PHAN_KHUC["khach-ruot"];
  if (R === 4) return PHAN_KHUC["sap-het-hang"];
  if (R === 5 && F >= 2) return PHAN_KHUC["trung-thanh-moi"];
  if (R === 5) return PHAN_KHUC["khach-moi"];
  if (R === 1) return PHAN_KHUC["da-mat"];
  if (F === 1 && R <= 2) return PHAN_KHUC["mua-mot-lan"];
  if (R === 2) return PHAN_KHUC["sap-mat"];
  return PHAN_KHUC["dang-nguoi"];
}

export type KhachRFM = SoKhach & { diem: DiemRFM; khuc: PhanKhuc };

export function chamTep(ds: SoKhach[]): KhachRFM[] {
  const moc = dungMocM(ds.map((k) => k.tongNet));
  return ds.map((k) => {
    const diem: DiemRFM = { R: diemR(k.ngayTuDonCuoi), F: diemF(k.soLanMua), M: diemM(k.tongNet, moc) };
    return { ...k, diem, khuc: ganPhanKhuc(diem) };
  });
}

export function demTheoKhuc(ds: KhachRFM[]): Array<{ khuc: PhanKhuc; so: number; net: number }> {
  const m = new Map<MaPhanKhuc, { khuc: PhanKhuc; so: number; net: number }>();
  for (const k of ds) {
    const o = m.get(k.khuc.ma) ?? { khuc: k.khuc, so: 0, net: 0 };
    o.so++; o.net += k.tongNet; m.set(k.khuc.ma, o);
  }
  return [...m.values()].sort((a, b) => a.khuc.uuTien - b.khuc.uuTien);
}
