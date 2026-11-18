export const GOI_Y_NHOM = {
  D: {
    ten: "Quyết đoán",
    giao: "Giao KẾT QUẢ và hạn, đừng giao cách làm. Cho quyền quyết trong phạm vi rõ.",
    gopY: "Nói thẳng, ngắn, một lần. Đi vào việc, không vòng.",
    thuong: "Gắn thẳng với số, tính ra được ngay, trả nhanh. Họ cần thấy công thức, không cần lễ trao.",
    tatDien: "Bị quản từng bước, họp dài không ra quyết định.",
  },
  I: {
    ten: "Sôi nổi",
    giao: "Giao kèm người cùng làm, nói rõ việc này ảnh hưởng tới ai.",
    gopY: "Khen trước mặt mọi người, góp ý riêng. Không bao giờ chê nơi đông người.",
    thuong: "Cần được ghi nhận CÔNG KHAI — gọi tên trong nhóm, trong buổi họp.",
    tatDien: "Làm một mình lâu ngày, không ai ghi nhận.",
  },
  S: {
    ten: "Ôn hoà",
    giao: "Giao kèm trình tự và mẫu. Báo trước khi có thay đổi.",
    gopY: "Nhẹ, cụ thể, hỏi lại xem họ có thật sự đồng ý không — họ hay gật cho xong.",
    thuong: "Cần LỘ TRÌNH RÕ và sự ổn định, biết ba tháng nữa mình ở đâu.",
    tatDien: "Đổi việc đột ngột, bị hối, môi trường xung đột.",
  },
  C: {
    ten: "Cẩn trọng",
    giao: "Giao kèm tiêu chí ĐO ĐƯỢC thế nào là xong và nguồn số liệu.",
    gopY: "Đưa bằng chứng cụ thể, tránh nhận xét cảm tính.",
    thuong: "Cần TIÊU CHÍ MINH BẠCH, không cảm tính. Họ sẽ tự tính lại phần của mình.",
    tatDien: "Bị bảo làm cho nhanh rồi sửa sau, tiêu chí đổi giữa chừng.",
  },
} as const;

export type NhomTinhCach = keyof typeof GOI_Y_NHOM;

export const KHOA_DISC_NHAN_SU = "nhan_su_disc";

export const DUNG_NGUOI = `# DÙNG NGƯỜI VÀ TUYỂN NGƯỜI THEO NHÓM TÍNH CÁCH

(Kho kiến thức mẫu. Thay phần này bằng tri thức, quy trình và số liệu của doanh nghiệp bạn; sửa xong chạy lại bước nhúng vector để cố vấn AI đọc được.)

- Nguyên tắc 1: viết ngắn, mỗi ý một dòng, có ví dụ cụ thể.
- Nguyên tắc 2: ghi rõ ngưỡng và con số dùng để ra quyết định.
- Nguyên tắc 3: ghi nguồn và ngày cập nhật cho mỗi mục.`;
