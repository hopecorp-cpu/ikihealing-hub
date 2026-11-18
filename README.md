# IKIHEALING Hub

Hệ điều hành nội bộ cho doanh nghiệp kinh doanh, từ đội vài người tới công ty hàng nghìn nhân sự. Một chỗ gom chấm công, lương, KPI, việc, khách, đơn hàng, nội dung, quảng cáo, báo cáo và một đội trợ lý AI chạy nền.

Phần mềm được tách ra từ hệ thống một công ty đang vận hành thật. Toàn bộ dữ liệu, tên người, giá bán và cấu hình riêng đã được thay bằng dữ liệu mẫu. Công ty mẫu trong code tên là **ACME Corp**, thương hiệu bán lẻ là **NOVA**, sản phẩm là **Sản phẩm A, B, C**. Bạn đổi các tên này thành của mình.

Trang giới thiệu bằng hình ảnh: https://hopecorp-cpu.github.io/ikihealing-hub/

Sơ đồ đội AI agent theo từng phòng: https://hopecorp-cpu.github.io/ikihealing-hub/so-do-ai-agent.html

English: [README.en.md](README.en.md)

- Sơ đồ vận hành: [docs/SO-DO-VAN-HANH.md](docs/SO-DO-VAN-HANH.md)
- Góp ý tính năng, báo lỗi: mở [Issue](../../issues/new/choose)
- Cách đóng góp code: [CONTRIBUTING.md](CONTRIBUTING.md)

## Có gì bên trong

| Khối | Chức năng chính |
|---|---|
| Việc hằng ngày | Việc hôm nay, bảng công việc kéo thả, kế hoạch ngày, chấm công GPS, xin nghỉ có duyệt |
| Bán hàng và khách | Chia lead tự động, khách 360 và RFM, tệp khách theo sản phẩm, gán đơn cho sale, hộp thư Zalo gộp |
| Marketing và nội dung | Điều phối trợ lý AI viết bài, lịch chiến dịch, tuyến bài theo phễu, theo dõi quảng cáo có trần ngân sách |
| Điều hành và tài chính | Trung tâm chỉ huy, vòng lặp doanh thu, bản đồ chiến lược, dòng tiền, đối soát vận chuyển và sàn |
| Nhân sự và thu nhập | Bảng lương (bảo hiểm, thuế thu nhập cá nhân theo luật Việt Nam), KPI, thi đua, tuyển dụng, lọc CV bằng AI |
| Kiến thức và quy trình | SOP, kho kiến thức có bài kiểm tra, tuân thủ pháp lý nội dung |
| Quản trị hệ thống | Watchdog canh nguồn dữ liệu chết, nhật ký máy, két mã hoá khoá API |

Khoảng 170 màn hình, 87 tác vụ hẹn giờ và 110 bảng dữ liệu. Chi tiết ở [sơ đồ vận hành](docs/SO-DO-VAN-HANH.md).

## Công nghệ

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres, phân quyền theo dòng, pgvector) · Vercel Cron · Telegram Bot API · Zalo OA · Meta Graph API · Claude và Gemini.

Chạy được trên gói miễn phí của Vercel và Supabase (gói miễn phí của Vercel chỉ cho tác vụ hẹn giờ chạy ngày một lần, xem mục Đưa lên Vercel).

## Chạy thử trên máy (khoảng 15 phút)

Cần: Node.js 20, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone https://github.com/hopecorp-cpu/ikihealing-hub.git
cd ikihealing-hub
npm install
supabase init            # bỏ qua nếu đã có supabase/config.toml
supabase start           # dựng Postgres + Auth cục bộ, in ra URL và các khoá
supabase db reset        # chạy toàn bộ supabase/migrations rồi supabase/seed.sql
cp .env.example .env.local
```

Mở `.env.local`, điền `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` từ kết quả `supabase start`, và đặt `CRON_SECRET`, `SECRET_VAULT_KEY` bằng chuỗi ngẫu nhiên.

```bash
npm run dev
```

Mở http://localhost:3000 và đăng nhập bằng tài khoản mẫu:

| Email | Vai trò |
|---|---|
| `admin@example.com` | Quản trị, xem được mọi trang |
| `son@example.com` | Trưởng nhóm sale |
| `cuc@example.com`, `dao@example.com` | Sale |
| `hang@example.com` | Marketing |
| `lan@example.com` | Kế toán |

Mật khẩu chung: `matkhau-demo`.

### Dữ liệu mẫu

`supabase db reset` nạp sẵn một công ty giả trong `supabase/seed.sql`: 6 nhân viên, 120 khách, 200 lead, khoảng 450 đơn trong 90 ngày gần nhất, việc, chấm công và KPI tháng. Ngày tháng tính theo ngày bạn chạy lệnh, nên mở app là thấy số của tháng hiện tại.

Dữ liệu mẫu chỉ nạp khi chạy trên máy. Lên Supabase thật bằng `supabase db push` thì không nạp, bạn bắt đầu với hệ thống trống.

### Tạo tài khoản thật

App không có trang đăng ký, nhân sự do quản trị cấp tài khoản.

1. Tạo người dùng trong Supabase Studio: Authentication, Add user. Một dòng tương ứng tự sinh ra trong bảng `users`.
2. Trong bảng `users`, sửa dòng vừa tạo: `role` = `admin` (hoặc `manager`, `employee`), điền `full_name`, `department_id`.
3. Tải lại app. Từ tài khoản admin, thêm nhân viên khác ở trang Nhân sự.

Tài khoản `admin` xem được mọi trang. Muốn mở trang tài chính, doanh thu, kho tài khoản cho người không phải admin, điền email của họ vào `NEXT_PUBLIC_BOD_EMAILS`, `NEXT_PUBLIC_ACCOUNTANT_EMAILS`, `ACCOUNTS_VAULT_EMAILS` (phân cách bằng dấu phẩy).

Migration cuối `9990_grants_api.sql` bật phân quyền theo dòng (RLS) cho mọi bảng còn thiếu và cấp quyền cho các vai API của Supabase. Bản Supabase mới không tự cấp quyền bảng, thiếu file này thì app báo lỗi quyền.

## Tính năng nào cần khoá nào

Chỉ 4 biến đầu trong `.env.example` là bắt buộc. Các tính năng khác bật khi bạn điền khoá, thiếu khoá thì tính năng đó tự tắt, phần còn lại vẫn chạy.

| Tính năng | Biến môi trường | Ghi chú |
|---|---|---|
| Việc, chấm công, lương, KPI, khách, lead, báo cáo | Supabase, `CRON_SECRET` | Chạy ngay, không cần dịch vụ ngoài |
| Trợ lý AI, cố vấn, viết bài, lọc CV | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Có thể chỉ dùng một trong hai |
| Giọng nói, dịch họp | `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` | ElevenLabs không bắt buộc |
| Bản tin, nhắc việc, bot ghi đơn | `TELEGRAM_*`, `COVAN_*` | Đơn gõ vào nhóm Telegram được AI bóc thành đơn |
| Hộp thư Zalo, chăm sóc khách | `ZALO_*` | Cần Zalo Official Account |
| Lead và quảng cáo Facebook | `FB_*`, `META_CAPI_TOKEN` | Trần ngân sách khoá cứng, tự lái mặc định tắt |
| Google Analytics, Search Console, Gmail, YouTube | `GOOGLE_*`, `GA4_PROPERTY_ID`, `GSC_SITE`, `GMAIL_*` | Dùng service account hoặc OAuth |
| Gửi email | `RESEND_*` | |
| Thanh toán | `PAYOS_*`, `ZALOPAY_KEY2` | |
| Sàn TikTok Shop | `TTS_*` | Mặc định tắt |
| Phân quyền theo email | `NEXT_PUBLIC_BOD_EMAILS`, `NEXT_PUBLIC_ACCOUNTANT_EMAILS`, `ACCOUNTS_VAULT_EMAILS` | Admin luôn xem được mọi trang |

Các tích hợp Zalo, J&T, MISA, Shopee, TikTok Shop, payOS là dịch vụ ở Việt Nam. Bạn ở nơi khác thì bỏ qua các biến này, hoặc viết module thay thế trong `lib/`.

## Đưa lên Vercel

1. Tạo project Supabase, chạy các file trong `supabase/migrations` theo thứ tự tên (hoặc `supabase link` rồi `supabase db push`).
2. Import repo vào Vercel, dán các biến môi trường từ `.env.local` (đổi URL và khoá sang project Supabase thật).
3. Lịch chạy nền nằm trong `vercel.json` (87 tác vụ, nhiều tác vụ chạy vài phút một lần, cần gói Pro). Dùng gói miễn phí thì thay bằng bản chỉ gồm 63 tác vụ chạy ngày một lần trước khi deploy:

   ```bash
   cp vercel.hobby.json vercel.json
   ```

   Khi đó các việc cần chạy dày (chia lại lead quá hạn, bóc đơn từ nhóm chat, trả lời nhóm Zalo) sẽ không tự chạy. Bạn có thể gọi chúng từ một dịch vụ hẹn giờ ngoài, đường dẫn dạng `/api/cron/<tên>?key=<CRON_SECRET>`.

## Cấu trúc thư mục

```
app/            màn hình và API (mỗi thư mục là một trang)
app/api/cron/   các tác vụ hẹn giờ
components/     thành phần giao diện dùng chung
lib/            nghiệp vụ: lương, doanh thu, watchdog, trợ lý AI, tích hợp
lib/covan/      bộ não cố vấn AI (kho kiến thức mẫu, RAG, định tuyến model)
data/           dữ liệu mẫu cho các trang cẩm nang, playbook
supabase/       migration và seed
docs/           sơ đồ vận hành
```

## Những gì cần tự thay

- Tên công ty, thương hiệu, sản phẩm: tìm `ACME`, `NOVA`, `Sản phẩm A`.
- Bảng giá và chính sách đại lý: `lib/gia-v4.ts`.
- Hồ sơ thương hiệu và luật pháp lý nội dung cho AI: `lib/brand-dna.ts`, `lib/banned-words.ts`.
- Kho kiến thức cố vấn: `lib/covan/knowledge*.ts` (đang là khung mẫu).
- Dữ liệu mẫu các trang cẩm nang: `data/*.json`.

## Lưu ý

- Một số module tích hợp dịch vụ bên thứ ba qua phiên đăng nhập trình duyệt (cào dữ liệu hãng vận chuyển, Zalo cá nhân). Kiểm tra điều khoản của dịch vụ đó trước khi dùng.
- Các script chạy trên máy văn phòng (cào dữ liệu, đăng bài) của hệ thống gốc không nằm trong repo này.
- Code vốn là hệ thống nội bộ một công ty, nên còn nhiều chỗ đặc thù. Gặp chỗ khó hiểu, mở Issue để hỏi.
- `npm run typecheck` hiện còn khoảng 80 lỗi kiểu dữ liệu, nên `next.config` đang bật bỏ qua lỗi kiểu khi build. App vẫn chạy bình thường; sửa dần các lỗi này là một chỗ đóng góp tốt.

## Giấy phép

MIT. Xem [LICENSE](LICENSE).
