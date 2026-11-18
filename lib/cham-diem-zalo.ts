export const NGUONG = {
  phanHoiNhanhPhut: 10,
  tinDaiKyTu: 50,
  imLangNguoiNgay: 30,
  imLangTroLaiNgay: 14,
  saleBoRoiGio: 24,
  broadcastNguongThread: 5,
  ySoMuaNgay: 21,
};

export type TinNhan = { direction: string; content: string | null; sent_at?: string | null; created_at: string; thread_id?: string | null };
export type LienHe = {
  zalo_uid: string; display_name?: string | null; phone_norm?: string | null;

  thread_type?: string | null;
  last_in_at?: string | null; last_out_at?: string | null; msg_count?: number | null;
  unreplied?: boolean | null; nhan_sale?: string | null;
};

export type TinHieu = { ma: string; nhan: string; diem: number; lyDo: string };
export type KetQuaCham = {
  zalo_uid: string; ten: string; sdt: string | null; sale: string | null;
  diem: number; bac: "nong" | "am" | "nguoi" | "lanh";
  tinHieu: TinHieu[];
  loiCuaMinh: boolean;
  ngayImLang: number | null;
};

const TU_KHOA: { ma: string; nhan: string; diem: number; tu: RegExp }[] = [
  { ma: "hoi-gia", nhan: "Hỏi giá", diem: 18,
    tu: /\b(bao nhiêu|nhiêu tiền|giá (bao|thế nào|sao)|mấy tiền|giá cả)\b/i },
  { ma: "hoi-thanh-toan", nhan: "Hỏi cách trả tiền", diem: 22,
    tu: /\b(chuyển khoản|số tài khoản|stk|thanh toán|ship cod|nhận hàng trả tiền|cọc)\b/i },
  { ma: "hoi-dat", nhan: "Đòi đặt hàng", diem: 25,
    tu: /\b(đặt (hàng|cho|giúp|1|một|2|hai)|lấy (cho|giúp) (em|chị|anh|mình)|chốt đơn|mua (1|2|một|hai|luôn))\b/i },
  { ma: "hoi-dung", nhan: "Hỏi cách dùng", diem: 14,
    tu: /\b(uống (thế nào|sao|lúc nào|mấy)|dùng (thế nào|sao|mấy)|liều|mấy gói|sáng hay tối|trước hay sau ăn)\b/i },
  { ma: "hoi-hop", nhan: "Hỏi có hợp mình không", diem: 12,
    tu: /\b(có hợp|hợp không|dùng được không|(em|chị|anh|mình|mẹ|bố) (bị|đang)|người (già|gầy|béo)|có thai|cho con bú)\b/i },
  { ma: "hoi-qua", nhan: "Hỏi ưu đãi / quà", diem: 10,
    tu: /\b(ưu đãi|khuyến mãi|km|tặng gì|có quà|combo|giảm)\b/i },
  { ma: "mua-them", nhan: "Hết hàng, muốn mua thêm", diem: 30,
    tu: /\b(hết (rồi|hàng)|mua thêm|đặt (thêm|tiếp)|lấy tiếp|còn hàng không|order tiếp)\b/i },
];

const DA_XONG = /\b(đã|rồi|xong|hôm qua|hôm trước|tuần trước|nhận được)\b/i;
const CAU_HOI = /\b(không|chưa|nào|sao|thế nào|bao nhiêu|nhiêu|mấy|gì|ạ\?)|\?/i;

function laDaXong(cau: string): boolean {
  return DA_XONG.test(cau) && !CAU_HOI.test(cau);
}

function tachCau(s: string): string[] {
  return s.split(/[.!?;\n]+/).map((x) => x.trim()).filter((x) => x.length > 2);
}

const gio = (a?: string | null, b?: string | null) =>
  a && b ? Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 36e5 : null;
const ngayTu = (t?: string | null) =>
  t ? Math.floor((Date.now() - new Date(t).getTime()) / 864e5) : null;

export function locBroadcast(tins: TinNhan[]): Set<string> {
  const theoNoiDung = new Map<string, Set<string>>();
  for (const t of tins) {
    const noi = chuanNoiDung(t.content);
    if (noi.length < 25) continue;
    const thread = t.thread_id || "";
    if (!theoNoiDung.has(noi)) theoNoiDung.set(noi, new Set());
    theoNoiDung.get(noi)!.add(thread);
  }
  const bo = new Set<string>();
  for (const [noi, threads] of theoNoiDung)
    if (threads.size >= NGUONG.broadcastNguongThread) bo.add(noi);
  return bo;
}

const chuanNoiDung = (s?: string | null) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 60);

const laMedia = (s?: string | null) => /^\[(Hình ảnh|Video|Sticker|Ghi âm|Tin đính kèm|Tệp)/i.test(String(s || "").trim());

export function chamMotKhach(
  lh: LienHe,
  tins: TinNhan[],
  opt: { boQua: Set<string>; soLanMua?: number } = { boQua: new Set() }
): KetQuaCham {
  const th: TinHieu[] = [];
  const den = tins.filter((t) => t.direction === "in" && !opt.boQua.has(chuanNoiDung(t.content)));
  const di = tins.filter((t) => t.direction === "out");

  const imLang = ngayTu(lh.last_in_at);
  if (imLang !== null && imLang <= 7) th.push({ ma: "moi-nhan", nhan: "Mới nhắn trong 7 ngày", diem: 15, lyDo: `khách nhắn cách đây ${imLang} ngày` });

  const tinDai = den.filter((t) => !laMedia(t.content) && String(t.content || "").length > NGUONG.tinDaiKyTu).length;
  if (tinDai) th.push({ ma: "tin-dai", nhan: "Nhắn tin dài", diem: Math.min(12, tinDai * 4), lyDo: `${tinDai} tin dài trên ${NGUONG.tinDaiKyTu} ký tự` });

  const ghiAm = den.filter((t) => /^\[(Ghi âm|Video)/i.test(String(t.content || ""))).length;
  if (ghiAm) th.push({ ma: "ghi-am", nhan: "Gửi ghi âm / video", diem: 14, lyDo: `${ghiAm} lần — chịu bỏ công hơn gõ chữ` });

  let nhanh = 0;
  for (let i = 1; i < tins.length; i++) {
    if (tins[i].direction === "in" && tins[i - 1].direction === "out") {
      const g = gio(tins[i].sent_at || tins[i].created_at, tins[i - 1].sent_at || tins[i - 1].created_at);
      if (g !== null && g * 60 <= NGUONG.phanHoiNhanhPhut) nhanh++;
    }
  }
  if (nhanh) th.push({ ma: "rep-nhanh", nhan: "Phản hồi nhanh", diem: Math.min(12, nhanh * 3), lyDo: `${nhanh} lần rep dưới ${NGUONG.phanHoiNhanhPhut} phút` });

  for (let i = 1; i < den.length; i++) {
    const g = gio(den[i].sent_at || den[i].created_at, den[i - 1].sent_at || den[i - 1].created_at);
    if (g !== null && g / 24 >= NGUONG.imLangTroLaiNgay) {
      th.push({ ma: "quay-lai", nhan: "Im lâu rồi tự nhắn lại", diem: 20, lyDo: `nghỉ ${Math.round(g / 24)} ngày rồi chủ động nhắn` });
      break;
    }
  }

  const moc = Date.now() - NGUONG.ySoMuaNgay * 864e5;
  const cauGanDay = den
    .filter((t) => !laMedia(t.content) && new Date(t.sent_at || t.created_at).getTime() >= moc)
    .flatMap((t) => tachCau(String(t.content || "")))
    .filter((c) => !laDaXong(c));
  for (const k of TU_KHOA) {
    const hit = cauGanDay.find((c) => k.tu.test(c));
    if (hit) th.push({ ma: k.ma, nhan: k.nhan, diem: k.diem, lyDo: `khách nói: "${hit.slice(0, 45)}"` });
  }

  const lan = opt.soLanMua || 0;

  if (lan === 1) th.push({ ma: "da-mua", nhan: "Đã từng mua", diem: 10, lyDo: "có đơn trong sổ" });
  if (lan >= 2) th.push({ ma: "mua-lai", nhan: "Khách quay lại", diem: 18, lyDo: `${lan} đơn — tệp đáng chăm nhất` });

  if (imLang !== null && imLang > NGUONG.imLangNguoiNgay)
    th.push({ ma: "im-lang", nhan: "Nguội", diem: -Math.min(25, Math.floor(imLang / 10) * 5), lyDo: `khách im ${imLang} ngày` });

  const choMinh = lh.last_in_at && (!lh.last_out_at || lh.last_in_at > lh.last_out_at)
    ? gio(new Date().toISOString(), lh.last_in_at) : null;
  const loiCuaMinh = choMinh !== null && choMinh > NGUONG.saleBoRoiGio;
  if (loiCuaMinh)
    th.push({ ma: "minh-bo-roi", nhan: "MÌNH chưa trả lời", diem: -10, lyDo: `khách chờ ${Math.round(choMinh!)} giờ — lỗi thuộc về mình, không phải khách nguội` });

  const diem = Math.max(0, Math.min(100, th.reduce((s, x) => s + x.diem, 0)));
  const bac = diem >= 70 ? "nong" : diem >= 45 ? "am" : diem >= 20 ? "nguoi" : "lanh";
  return {
    zalo_uid: lh.zalo_uid,
    ten: lh.display_name || "(chưa có tên)",
    sdt: lh.phone_norm || null,
    sale: lh.nhan_sale || null,
    diem, bac, tinHieu: th, loiCuaMinh, ngayImLang: imLang,
  };
}

export function giaiThich(kq: KetQuaCham): string {
  const duong = kq.tinHieu.filter((t) => t.diem > 0).map((t) => t.nhan);
  const am = kq.tinHieu.filter((t) => t.diem < 0).map((t) => t.nhan);
  return `${kq.ten} — ${kq.diem} điểm (${kq.bac})`
    + (duong.length ? ` · ${duong.join(", ")}` : "")
    + (am.length ? ` · trừ: ${am.join(", ")}` : "");
}
