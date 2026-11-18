export type MaNhom = "D" | "I" | "S" | "C";

export type Nhom = {
  ma: MaNhom;
  ten: string;
  nhanDien: string;
  manh: string;
  deHut: string;
  noiChuyen: string;
  mau: string;
};

export const NHOM: Record<MaNhom, Nhom> = {
  D: {
    ma: "D", ten: "Quyết đoán", mau: "#DC2626",
    nhanDien: "Nói ngắn, hỏi kết quả và hạn, sốt ruột với giải thích dài.",
    manh: "Ra quyết định nhanh, dám nhận việc khó, kéo việc về đích.",
    deHut: "Bỏ qua chi tiết, hối người khác quá tay, ít hỏi ý kiến trước khi chốt.",
    noiChuyen: "Vào thẳng kết quả và hạn. Nói hậu quả và phương án trước, nguyên nhân sau.",
  },
  I: {
    ma: "I", ten: "Sôi nổi", mau: "#F59E0B",
    nhanDien: "Nói nhiều, thích bàn miệng hơn viết, dễ hào hứng và cũng dễ nguội.",
    manh: "Mở lời với người lạ dễ, tạo không khí, kéo người khác vào cuộc.",
    deHut: "Tản mạn, bỏ dở việc dài hơi, nhớ việc theo cảm hứng.",
    noiChuyen: "Gọi điện thay vì chỉ nhắn. Ghi nhận công của họ trước khi góp ý.",
  },
  S: {
    ma: "S", ten: "Ôn hoà", mau: "#10B981",
    nhanDien: "Ít nói trong họp, gật cho xong rồi mới nêu lo ngại riêng, ghét thay đổi gấp.",
    manh: "Bền, giữ được quan hệ lâu dài, người khác tin và dễ nhờ vả.",
    deHut: "Ngại va chạm nên chậm nói ra vấn đề; ôm việc của người khác.",
    noiChuyen: "Báo trước khi đổi, cho biết ai chịu phần nào. Hỏi lại riêng sau họp.",
  },
  C: {
    ma: "C", ten: "Cẩn trọng", mau: "#3B82F6",
    nhanDien: "Hỏi số liệu và quy trình, không chịu làm khi chưa rõ, bắt lỗi nhanh.",
    manh: "Ít sai, giữ được chuẩn, phát hiện lỗ hổng sớm.",
    deHut: "Chậm khi thiếu dữ liệu, cầu toàn quá mức, khó chấp nhận làm thử.",
    noiChuyen: "Đưa số cụ thể và mốc thời gian. Nói ước chừng là mất tin cậy.",
  },
};

export type NhomTu = { tu: [string, string, string, string] };

export const CAU_HOI: NhomTu[] = [
  { tu: ["Quyết đoán", "Sôi nổi", "Điềm đạm", "Kỹ lưỡng"] },
  { tu: ["Thẳng thắn", "Cởi mở", "Kiên nhẫn", "Chính xác"] },
  { tu: ["Thích cạnh tranh", "Thích giao lưu", "Thích ổn định", "Thích đúng chuẩn"] },
  { tu: ["Nói ngắn gọn", "Nói có duyên", "Nói nhẹ nhàng", "Nói có dẫn chứng"] },
  { tu: ["Dám mạo hiểm", "Lạc quan", "Đáng tin cậy", "Cân nhắc kỹ"] },
  { tu: ["Chủ động giành việc", "Truyền cảm hứng", "Hỗ trợ người khác", "Rà soát lỗi"] },
  { tu: ["Ghét lòng vòng", "Ghét tẻ nhạt", "Ghét xung đột", "Ghét làm ẩu"] },
  { tu: ["Tập trung kết quả", "Tập trung con người", "Tập trung hoà khí", "Tập trung quy trình"] },
  { tu: ["Ra quyết định nhanh", "Quyết theo cảm nhận", "Quyết sau khi hỏi ý", "Quyết sau khi có số"] },
  { tu: ["Chịu áp lực tốt", "Xoay chuyển linh hoạt", "Bền bỉ đường dài", "Cẩn thận từng bước"] },
  { tu: ["Dẫn dắt nhóm", "Kết nối mọi người", "Giữ nhịp cho nhóm", "Giữ chuẩn cho nhóm"] },
  { tu: ["Nóng ruột khi chậm", "Chán khi lặp lại", "Khó chịu khi bị hối", "Khó chịu khi thiếu dữ liệu"] },
];

const MA: MaNhom[] = ["D", "I", "S", "C"];

export type KetQuaNhom = {
  diem: Record<MaNhom, number>;
  phanTram: Record<MaNhom, number>;
  troi: MaNhom;
  phu: MaNhom | null;
  moTa: string;
  canhBao: string[];
};

export function chamNhom(chon: Array<number | undefined>): KetQuaNhom {
  const diem: Record<MaNhom, number> = { D: 0, I: 0, S: 0, C: 0 };
  let daLam = 0;
  for (const c of chon) {
    if (c == null || c < 0 || c > 3) continue;
    diem[MA[c]]++;
    daLam++;
  }
  const tong = daLam || 1;
  const phanTram = MA.reduce((o, m) => { o[m] = Math.round((diem[m] / tong) * 100); return o; }, {} as Record<MaNhom, number>);
  const xep = [...MA].sort((a, b) => diem[b] - diem[a]);
  const troi = xep[0];
  const phu = diem[xep[0]] - diem[xep[1]] <= 2 && diem[xep[1]] > 0 ? xep[1] : null;

  const canhBao: string[] = [];
  if (daLam < CAU_HOI.length) canhBao.push(`Mới chọn ${daLam}/${CAU_HOI.length} nhóm từ — kết quả còn mỏng, làm nốt cho chắc.`);

  if (diem[xep[0]] - diem[xep[3]] <= 2) canhBao.push("Bốn nhóm gần bằng nhau — bài này KHÔNG kết luận được, đừng gán nhãn. Quan sát cách làm việc thật rồi hẵng nói.");

  const moTa = phu
    ? `${NHOM[troi].ten} pha ${NHOM[phu].ten.toLowerCase()}`
    : NHOM[troi].ten;
  return { diem, phanTram, troi, phu, moTa, canhBao };
}

export function boDau(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

const GIA_TRI: Record<string, number> = {
  A: 1, J: 1, S: 1, B: 2, K: 2, T: 2, C: 3, L: 3, U: 3, D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5, F: 6, O: 6, X: 6, G: 7, P: 7, Y: 7, H: 8, Q: 8, Z: 8, I: 9, R: 9,
};
const NGUYEN_AM = new Set(["A", "E", "I", "O", "U", "Y"]);

export function rutGon(n: number): number {
  while (n > 9 && n !== 11 && n !== 22) n = String(n).split("").reduce((s, c) => s + Number(c), 0);
  return n;
}

const congChu = (s: string, loc?: (c: string) => boolean) =>
  boDau(s).toUpperCase().split("").filter((c) => GIA_TRI[c] && (!loc || loc(c))).reduce((t, c) => t + GIA_TRI[c], 0);

export type SoNghia = { manh: string; deHut: string; hopViec: string };

export const SO_NGHIA: Record<number, SoNghia> = {
  1: { manh: "Chủ động, thích dẫn đầu, quyết nhanh.", deHut: "Khó nhận góp ý, hay ôm việc.", hopViec: "Mở đường, khởi động cái mới, chịu trách nhiệm một mảng." },
  2: { manh: "Nhạy với người khác, hoà giải tốt, làm việc theo cặp hiệu quả hơn một mình.", deHut: "Ngại va chạm nên chậm ra quyết định.", hopViec: "Chăm sóc, phối hợp, giữ quan hệ." },
  3: { manh: "Diễn đạt tốt, nhiều ý tưởng, tạo không khí.", deHut: "Tản mạn, bỏ dở việc dài hơi.", hopViec: "Nội dung, truyền thông, đứng trước đám đông." },
  4: { manh: "Kỷ luật, làm theo quy trình, đáng tin về hạn.", deHut: "Cứng nhắc, chậm thích nghi khi đổi cách làm.", hopViec: "Vận hành, kho, sổ sách, kiểm soát chất lượng." },
  5: { manh: "Linh hoạt, thích cái mới, chịu được thay đổi.", deHut: "Mau chán, khó ngồi yên với việc lặp.", hopViec: "Mở kênh mới, thử nghiệm, đối ngoại." },
  6: { manh: "Chăm lo người khác, có trách nhiệm với tập thể.", deHut: "Ôm việc của người khác rồi quá tải.", hopViec: "Chăm sóc khách, đào tạo, giữ đội." },
  7: { manh: "Phân tích sâu, thích hiểu tận gốc, làm việc độc lập tốt.", deHut: "Ít chia sẻ, dễ tách khỏi đội.", hopViec: "Nghiên cứu, số liệu, kiểm định." },
  8: { manh: "Nhìn được bức tranh tiền bạc, tổ chức nguồn lực, chịu áp lực chỉ tiêu.", deHut: "Đặt kết quả trên cảm xúc người khác.", hopViec: "Điều hành, kinh doanh, quản lý mục tiêu." },
  9: { manh: "Nhìn xa, quan tâm ý nghĩa việc mình làm, truyền được niềm tin.", deHut: "Lý tưởng quá nên xa rời chi tiết.", hopViec: "Thương hiệu, cộng đồng, định hướng." },
  11: { manh: "Nhạy bén và truyền cảm hứng mạnh (bản nâng của số 2).", deHut: "Kỳ vọng cao nên dễ căng và tự áp lực.", hopViec: "Dẫn dắt tinh thần đội, đào tạo, truyền thông giá trị." },
  22: { manh: "Biến ý tưởng lớn thành hệ thống chạy được (bản nâng của số 4).", deHut: "Ôm việc quá tầm rồi kiệt sức.", hopViec: "Xây hệ thống, quy trình, dự án dài hơi." },
};

export type KetQuaThanSo = {
  chuDao: number;
  suMenh: number;
  linhHon: number;
  nhanCach: number;
  canhBao: string[];
};

export function tinhThanSo(hoTen: string, ngaySinh: string): KetQuaThanSo | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngaySinh)) return null;
  const soNgay = ngaySinh.replace(/\D/g, "").split("").reduce((s, c) => s + Number(c), 0);
  const ten = (hoTen || "").trim();
  return {
    chuDao: rutGon(soNgay),
    suMenh: rutGon(congChu(ten)),
    linhHon: rutGon(congChu(ten, (c) => NGUYEN_AM.has(c))),
    nhanCach: rutGon(congChu(ten, (c) => !NGUYEN_AM.has(c))),
    canhBao: ten ? [] : ["Chưa nhập họ tên — chỉ tính được số chủ đạo từ ngày sinh."],
  };
}

const GHE: Array<{ ten: string; hopNhom: MaNhom[]; hopSo: number[]; vi: string }> = [
  { ten: "Bán hàng / Sale", hopNhom: ["D", "I"], hopSo: [1, 3, 5, 8], vi: "Cần chủ động mở lời và chịu được áp lực chỉ tiêu." },
  { ten: "Chăm sóc khách", hopNhom: ["S", "I"], hopSo: [2, 6, 9], vi: "Cần kiên nhẫn với khách đang bực và giữ được quan hệ dài." },
  { ten: "Marketing / Nội dung", hopNhom: ["I", "C"], hopSo: [3, 5, 9, 11], vi: "Cần diễn đạt tốt, và cần cả người soi số liệu cho bài." },
  { ten: "Kho vận", hopNhom: ["S", "C"], hopSo: [4, 7, 22], vi: "Cần đúng quy trình và báo sớm khi chưa chắc." },
  { ten: "Kế toán / Tài chính", hopNhom: ["C"], hopSo: [4, 7, 8], vi: "Cần chính xác và giữ chuẩn, không nói ước chừng." },
  { ten: "Nhân sự / Hành chính", hopNhom: ["S", "I"], hopSo: [2, 6, 9], vi: "Cần đọc được người và giữ hoà khí giữa các phòng." },
  { ten: "Điều hành / Quản lý", hopNhom: ["D", "C"], hopSo: [1, 8, 22], vi: "Cần quyết được và nhìn được bức tranh nguồn lực." },
];

export type DeXuat = { ten: string; diem: number; vi: string; hopNhom: boolean; hopSo: boolean };

export function deXuatGhe(nhom: KetQuaNhom | null, thanSo: KetQuaThanSo | null): DeXuat[] {
  const cacNhom = nhom ? [nhom.troi, ...(nhom.phu ? [nhom.phu] : [])] : [];
  const cacSo = thanSo ? [thanSo.chuDao, thanSo.suMenh] : [];
  return GHE.map((g) => {
    const hopNhom = cacNhom.some((m) => g.hopNhom.includes(m));
    const hopSo = cacSo.some((s) => g.hopSo.includes(s));

    return { ten: g.ten, vi: g.vi, hopNhom, hopSo, diem: (hopNhom ? 2 : 0) + (hopSo ? 1 : 0) };
  }).sort((a, b) => b.diem - a.diem);
}

export const RAO = [
  "Đây là công cụ THAM KHẢO để hiểu nhau và chọn cách nói cho hợp — không phải kết luận về con người.",
  "KHÔNG dùng để loại ứng viên hay cho ai nghỉ việc. Chỉ dùng để đề xuất ghế phù hợp hơn.",
  "KHÔNG dùng làm căn cứ tính lương, thưởng, tăng hay giảm thu nhập.",
  "Thần số học không kiểm chứng được bằng thực nghiệm; bốn nhóm tính cách thì ít nhất còn quan sát được qua hành vi. Đừng đặt hai thứ ngang hàng nhau.",
  "Khi nói với chính người đó, đừng phán 'anh số 8 nên anh mới thế'. Nói theo kiểu quan sát và hỏi lại, để họ có chỗ phản bác.",
];
