# Góp ý và đóng góp

Cảm ơn bạn đã dùng thử Ops Hub.

## Góp ý tính năng hoặc báo lỗi

Mở [Issue mới](../../issues/new/choose) và chọn mẫu:

- **Góp ý tính năng**: bạn cần gì, đang làm tay thế nào, làm xong thì đỡ được việc gì.
- **Báo lỗi**: bước tái hiện, kết quả mong đợi, kết quả thực tế, ảnh chụp nếu có.

Đừng dán khoá API, mật khẩu hay dữ liệu khách hàng thật vào Issue.

## Gửi code

1. Fork repo, tạo nhánh từ `main`.
2. Sửa nhỏ và đúng một việc mỗi pull request.
3. Chạy `npm run build` trước khi gửi.
4. Mô tả trong pull request: vấn đề, cách sửa, cách bạn đã kiểm tra.

## Quy ước

- Chữ trên giao diện viết tiếng Việt.
- Tích hợp bên ngoài phải tự tắt êm khi thiếu khoá trong biến môi trường.
- Mọi thao tác đụng tới tiền hoặc gửi tin cho khách phải có bước người bấm duyệt.
- Không đưa dữ liệu thật của doanh nghiệp vào repo: dùng `data/*.json` hoặc `supabase/seed.sql` với dữ liệu mẫu.
