export function chuanHoaChu(s: string): string {
  return (s || "").normalize("NFKC").replace(/\p{Cf}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function khongDau(s: string): string {
  return chuanHoaChu(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}&]+/gu, " ")
    .trim();
}

const PII_RE =
  /(số\s*(điện\s*thoại|đt|phone|đthoại)|sđt|sdt|phone\s*number|điện\s*thoại\s*(của|khách|người)|địa\s*chỉ|đ\/c|email\s*(của|khách)|họ\s*tên|tên\s*(và|kèm|cùng)\s*(số|sđt|sdt|địa)|tên\s*(đầy\s*đủ|thật|khách|người\s*(mua|đặt)|lead)|thông\s*tin\s*(liên\s*hệ|cá\s*nhân|khách)|liên\s*hệ\s*của|danh\s*sách\s*(khách|lead|người\s*mua)|số\s*zalo|nick\s*zalo)/iu;

const KHACH_RE =
  /(khách|khach|người\s*(mua|đặt|nhận)|lead|đặt\s*đơn|đơn\s*(hàng|gần|lớn|mới|vừa)|mua\s*(nhiều|hàng|đơn|gần)|ctv|cộng\s*tác\s*viên|đại\s*lý|học\s*viên)/iu;

const PII_KD_RE =
  /\b(so (dien thoai|dt|phone|dthoai)|sdt|phone number|dien thoai (cua|khach|nguoi)|dia chi|email (cua|khach)|ho ten|ten (va|kem|cung) (so|sdt|dia)|ten (day du|that|khach|nguoi (mua|dat)|lead)|thong tin (lien he|ca nhan|khach)|lien he cua|danh sach (khach|lead|nguoi mua)|so zalo|nick zalo)\b/;
const KHACH_KD_RE =
  /\b(khach|nguoi (mua|dat|nhan)|lead|dat don|don (hang|gan|lon|moi|vua)|mua (nhieu|hang|don|gan)|ctv|cong tac vien|dai ly|hoc vien)\b/;

export function laCauHoiPII(cau: string): boolean {
  const t = chuanHoaChu(cau);
  if (!t) return false;
  const kd = khongDau(t);
  return (PII_RE.test(t) || PII_KD_RE.test(kd)) && (KHACH_RE.test(t) || KHACH_KD_RE.test(kd));
}

const TAI_CHINH_NHAY_RE =
  /(tiền\s*mặt|số\s*dư|trong\s*két|két\s*tiền|quỹ\s*tiền|công\s*nợ|nợ\s*(phải|vay|ngân|cá\s*nhân|gốc|xấu)|dư\s*nợ|khoản\s*vay|đi\s*vay|vay\s*(thêm|ngân|bao|tiền|vốn|nợ)|lãi\s*(vay|suất|ròng|gộp|lỗ)|lời\s*lỗ|lãi\s*lỗ|lỗ\s*(bao|nặng|không|chưa)|lợi\s*nhuận|p&l|pnl|dòng\s*tiền|runway|hòa\s*vốn|hoà\s*vốn|chi\s*phí\s*(lương|vận\s*hành|cố\s*định)|bảng\s*lương|biên\s*(gộp|lợi)|cân\s*đối\s*(tài|kế)|ngân\s*hàng|sao\s*kê)/iu;

const TAI_CHINH_NHAY_KD_RE =
  /\b(tien mat|so du|ket tien|ket sat|quy tien|cong no|no (vay|ngan hang|ca nhan|goc|xau)|du no (vay|ngan|hien|con|bao|cua)|khoan vay|di vay|vay (them|ngan|bao|tien|von|no)|lai (vay|suat|rong|gop)|loi lo|loi nhuan|p&l|pnl|dong tien|runway|hoa von|chi phi (luong|van hanh|co dinh)|bang luong|bien (gop|loi nhuan)|can doi (tai|ke)|ngan hang|sao ke|lo (nang|bao nhieu))\b/;

export function laCauTaiChinhNhay(cau: string): boolean {
  const t = chuanHoaChu(cau);
  if (!t) return false;
  return TAI_CHINH_NHAY_RE.test(t) || TAI_CHINH_NHAY_KD_RE.test(khongDau(t));
}

const MAU_INJECTION_KD_RE = new RegExp(
  [

    "\\b(ignore|disregard|forget|override|bypass)( all| any| the| your| my| of)*( previous| prior| above| earlier| preceding| former| original| system| safety)* (instructions?|rules?|prompts?|directions?|guidelines?|messages?|context)\\b",
    "\\b(ignore|disregard) (all|previous|prior|above|everything)\\b",
    "\\bforget (everything|all)\\b",
    "\\bsystem prompt\\b",
    "\\b(new|updated) instructions?\\b",
    "\\byou are now\\b",
    "\\bfrom now on\\b",
    "\\b(act as|pretend (to be|you are)|roleplay as)\\b",
    "\\b(developer mode|jailbreak)\\b",

    "\\b(bo qua|phot lo|lo di|xoa bo|vut bo)( di| het| moi| cac| tat ca| nhung| toan bo)* (quy tac|huong dan|chi dan|chi thi|menh lenh|lenh|yeu cau|luat|rang buoc|dieu (o )?(tren|truoc))\\b",

    "\\bquen( di| het| moi| cac| tat ca| nhung| toan bo)+ (quy tac|huong dan|chi dan|chi thi|menh lenh|lenh|yeu cau|luat|rang buoc|dieu (o )?(tren|truoc))\\b",
    "\\b(chi dan|huong dan|chi thi|quy tac) (truoc|phia tren|ben tren|cu)( do| day)? (khong con|het) (gia tri|hieu luc)\\b",
    "\\b(lenh|chi dan|loi nhac) he thong\\b",
    "\\b(dong|nhap) vai(?! tro)\\b",
    "\\b(tu gio|tu nay|ke tu bay gio|bat dau tu bay gio)( tro di)?( ban| em| may| ai)? (hay|chi duoc)\\b",
    "\\b(ban|em|may) bay gio la\\b",

    "\\bchuyen (tien|khoan)\\b",
    "\\b(so tai khoan|tai khoan so)\\b",
    "\\bclick vao link\\b",
    "\\btai (file|ve)\\b",
    "\\bnhap (mat khau|ma otp|otp)\\b",
  ].join("|")
);

export function nghiInjection(s: string): boolean {
  const kd = khongDau(s);
  return !!kd && MAU_INJECTION_KD_RE.test(kd);
}

export const TU_CHOI_PII =
  "Em không cung cấp tên, số điện thoại, địa chỉ hay thông tin liên hệ của khách qua chat — kể cả " +
  "chat riêng, vì tin nhắn có thể bị chuyển tiếp hoặc lưu ở nơi không kiểm soát được. " +
  "Anh/chị xem trực tiếp ở trang Khách 360 của ops-hub (có đăng nhập, phân quyền): {LINK}\n" +
  "Em vẫn giúp được các câu KHÔNG định danh: số khách, tỉ lệ mua lại, nhóm khách theo giá trị, " +
  "khách nào đang chờ trả lời (đếm), kịch bản chăm sóc.";

export const TU_CHOI_NOI_BO =
  "Trong nhóm này em chỉ trả lời về luật, chính sách, kịch bản bán hàng và tri thức nội bộ. " +
  "Số tiền mặt, công nợ, vay, lãi, lời lỗ (P&L) em chỉ nói ở chat riêng CEO hoặc nhóm " +
  "Ban điều hành / BOD / Kế toán.";
