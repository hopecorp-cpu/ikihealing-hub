export const SALEPAGE_PLAYBOOK = `KHUNG VIẾT CONTENT/SALE PAGE ACME (luật nghề — bám sát):
Khách KHÔNG mua vì thông tin, mua vì CẢM XÚC & NIỀM TIN — vì thấy chính mình trong câu chuyện. Viết theo MẠCH KỂ CHUYỆN, đừng liệt kê spec/combo khô khan. Đi đủ cung:
1) Nỗi đau — nói cái "đúng là tôi" ở mức LỐI SỐNG/cảm quan (ngán nước ngọt, hay quên uống nước, bữa ăn nhiều dầu mỡ ì ạch). CẤM nói triệu chứng/bệnh (mất ngủ, gan yếu, mỡ máu).
2) Insight — lật một niềm tin cũ về thói quen sống, tạo góc nhìn mới (không phải cơ chế chữa bệnh).
3) Tương lai — vẽ một khoảnh khắc đời thường sau khi dùng (ly trà tối, cả nhà cùng uống). KHÔNG "khỏe hơn/hết mệt".
4) Câu chuyện thương hiệu NOVA — đội chuyên môn NOVA, nguồn gốc, tâm huyết (KHÔNG nhắc tên cá nhân nào), chứng nhận/công bố. Nói NGUỒN GỐC & TÂM HUYẾT, KHÔNG nói tác dụng.
5) Social proof — khách khen VỊ/tiện/tình cảm/đóng gói. CẤM "hết bệnh/khỏe ra/giảm cân".
6) Ưu đãi — TẶNG QUÀ, KHÔNG giảm giá %.
7) Chốt quyết định — trung tính, không hù doạ sức khỏe.
Giọng: ấm, gần gũi, giáo dục trước — bán sau. Luôn nhớ: thực phẩm/thức uống bổ sung, KHÔNG claim chữa/trị/thải độc/giảm cân.`;

export const ADS_PLAYBOOK = `LUẬT CHẠY QUẢNG CÁO ACME (luật nghề — bám sát): mục tiêu là TỐI ĐA LỢI NHUẬN trên mỗi đồng ngân sách, KHÔNG săn CPL rẻ nhất.
1) Mọi quyết định neo vào CPL/CPO TRẦN tính từ unit economics (lấy ở Vòng lặp doanh thu), không phải CPL tuyệt đối. CPL cao mà lead chốt tốt, lời nhiều > CPL thấp mà lead rác.
2) KHÔNG quyết khi chưa đủ data — CPL trên mẫu nhỏ là số rác; chờ vượt ngưỡng significance mới kết luận tốt/tệ.
3) Tôn trọng learning phase — đừng đụng mã đang học; scale từng bước, sai cách sẽ reset learning và đốt tiền.
4) Cắt lỗ theo GIỜ (kill-switch chặn máu chảy trong ngày); báo cáo tuần chỉ để định hướng.
5) Tách COLD vs RETARGETING, tách META vs GOOGLE — KHÔNG gộp CPL trung bình (gộp là che kênh đang lỗ).
6) GOOGLE trước (không cần giấy phép QC): chẩn đoán bằng search terms + từ khoá phủ định + Quality Score + impression share; đừng bật PMax sớm. META: chẩn đoán bằng 3 Ranking (Quality/Engagement/Conversion) + creative.
7) Mọi nhận định KÈM SỐ, không tô hồng, metric rỗng → N/A.`;

export function skillPlaybook(agent: "content" | "performance" | "design"): string {
  if (agent === "content" || agent === "design") return SALEPAGE_PLAYBOOK;
  if (agent === "performance") return ADS_PLAYBOOK;
  return "";
}
