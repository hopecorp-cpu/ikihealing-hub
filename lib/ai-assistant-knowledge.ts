export type Intent = {
  id: string;
  keywords: string[];
  title: string;
  answer: string;
  forRoles?: ("admin" | "manager" | "employee")[];
  forPaths?: string[];
  quickActions?: { label: string; href: string }[];
};

export const INTENTS: Intent[] = [

  {
    id: "cham-cong-basic",
    keywords: ["chấm công", "face id", "cham cong", "scan face", "check-in", "check in", "check out"],
    title: "Chấm công Face ID",
    answer: `Cách chấm công hàng ngày:

1. Mở app trên điện thoại → vào "Chấm công Face ID"
2. Cấp quyền **camera + GPS** (cho phép truy cập)
3. Bấm nút vàng **SCAN FACE — CHECK-IN** khi đến VP
4. Cuối ngày bấm **SCAN FACE — CHECK-OUT** trước khi về

**Lưu ý:**
- Phải trong bán kính 150m văn phòng (ACME)
- Nếu làm remote: admin set work_mode = "remote"
- Giờ chuẩn: 8:00-12:00 + 13:30-17:30 (grace 5 phút)`,
    forPaths: ["/cham-cong", "/"],
    quickActions: [
      { label: "Mở chấm công", href: "/cham-cong" }
    ]
  },
  {
    id: "quen-cham-cong",
    keywords: ["quên", "phạt", "50k", "quên check", "quên face id", "không chấm", "miễn phạt"],
    title: "Quên chấm công — bị phạt 50k?",
    answer: `Quy định phạt:
- **Quên check-in:** 50.000đ/lần
- **Quên check-out:** 50.000đ/lần
- **Muộn >30 phút:** 100.000đ/lần
- **Vắng không xin phép:** 500.000đ/lần

**Cách xin miễn phạt** nếu quên vì lý do hợp lệ:
1. Vào trang "Chấm công Face ID"
2. Bấm nút **"Xin sửa chấm công"** ở góc phải
3. Chọn ngày + loại (quên CI/CO/sai giờ)
4. Ghi rõ lý do (VD: "Em họp khách rồi đi luôn")
5. Submit → admin duyệt sẽ miễn phạt`,
    quickActions: [
      { label: "Xin sửa chấm công", href: "/cham-cong" }
    ]
  },

  {
    id: "xin-nghi",
    keywords: ["nghỉ phép", "xin nghỉ", "ốm", "đám cưới", "leave", "phép năm"],
    title: "Xin nghỉ phép",
    answer: `Cách xin nghỉ:

1. Vào "Xin nghỉ phép"
2. Bấm **+ Đơn nghỉ mới**
3. Chọn loại: Phép năm / Ốm / Không lương / Hiếu hỉ
4. Chọn ngày bắt đầu → kết thúc
5. Ghi lý do (chi tiết để manager duyệt nhanh)
6. Submit → Manager nhận noti

**Lưu ý:**
- Phải đệ trình **trước 2 ngày làm việc** (trừ ốm/khẩn)
- Phép năm cộng dồn 1 ngày/tháng — xem tại "Phiếu lương"`,
    quickActions: [
      { label: "Xin nghỉ ngay", href: "/xin-nghi" }
    ]
  },

  {
    id: "phieu-luong",
    keywords: ["lương", "phiếu lương", "thực lĩnh", "khi nào nhận lương", "trả lương"],
    title: "Xem phiếu lương",
    answer: `Cách xem lương:

1. Vào "Phiếu lương" (sidebar trái)
2. Chọn tháng → xem chi tiết
3. Bảng hiển thị:
   - Lương Gross / NC thực tế / Thưởng KPI / Thực lĩnh
   - BHXH (10.5%) / Giảm trừ bản thân + NPT / Thuế TNCN (5 bậc 2026)
   - Tổng CP doanh nghiệp

**Lương được chốt cuối tháng** sau khi admin chạy "Tính lương tự động".`,
    forRoles: ["employee", "manager"],
    quickActions: [{ label: "Xem phiếu lương", href: "/phieu-luong" }]
  },
  {
    id: "tinh-luong-admin",
    keywords: ["tính lương", "chạy lương", "commit lương", "bonus", "thưởng sale"],
    title: "Tính lương tự động cuối tháng",
    answer: `Quy trình chốt lương tháng (admin only):

1. Vào **Tính lương tự động** (sidebar Admin)
2. Chọn tháng → hệ thống tự:
   - Pull tất cả orders → tính DT net mỗi NV
   - Apply bậc thưởng (1.5/2.5/3/5/6%)
   - Tính BHXH + thuế + thực lĩnh
   - Check group bonus team ≥300M
3. Anh review bảng preview — có thể **edit từng dòng** (bắt buộc gõ lý do)
4. Bấm **COMMIT** → lương vào DB, NV xem được ở /phieu-luong

**Sửa bậc thưởng:** vào "Cấu hình bậc thưởng" — không cần dev`,
    forRoles: ["admin"],
    quickActions: [
      { label: "Tính lương", href: "/bang-luong/run" },
      { label: "Cấu hình bậc", href: "/admin/bonus-rules" }
    ]
  },

  {
    id: "kpi",
    keywords: ["kpi", "mục tiêu", "okr", "đặt mục tiêu"],
    title: "KPI cá nhân",
    answer: `Xem & cập nhật KPI:

1. Vào "KPI cá nhân"
2. Xem các KPI đang active + % hoàn thành
3. Bấm **+ Đề xuất KPI mới** để tự đặt mục tiêu
4. Cập nhật số liệu hiện tại để track tiến độ
5. KPI link với chu kỳ (tháng/quý/năm) — chu kỳ active mới được tính bonus`,
    quickActions: [{ label: "KPI của tôi", href: "/kpi" }]
  },

  {
    id: "tasks",
    keywords: ["task", "việc", "giao việc", "to-do", "deadline"],
    title: "Task & giao việc",
    answer: `Task Board:

**Nếu bạn là NV:**
- Xem task được giao → bấm **"✓ Đã đọc"**
- Khi bắt đầu làm → bấm **▶ Bắt đầu** (chuyển sang ĐANG LÀM)
- Vướng gì → bấm **Vướng** + ghi rõ
- Xong → bấm **✓ Hoàn thành**

**Nếu bạn là Manager/Admin:**
- Bấm **+ Giao việc mới** (góc phải)
- Chọn NV, ưu tiên, deadline
- Tự track ai đã đọc, ai chưa start`,
    quickActions: [{ label: "Task Board", href: "/tasks" }]
  },

  {
    id: "daily-report",
    keywords: ["báo cáo", "daily report", "cuối ngày", "eod", "standup"],
    title: "Báo cáo cuối ngày",
    answer: `Daily Report (5 phút mỗi ngày trước 18:00):

1. Vào "Báo cáo cuối ngày"
2. Điền:
   - Hôm nay làm được gì (3-5 việc cụ thể)
   - Ngày mai plan gì
   - Vướng mắc (manager sẽ hỗ trợ)
   - Mood + Energy 1-5
   - Nếu là Sale: số KH / cuộc gọi / đơn chốt / DT
3. Submit → manager review + comment

**Lưu ý quan trọng:** Quên submit daily report cuối ngày sẽ bị nhắc.`,
    quickActions: [{ label: "Submit report", href: "/daily-report" }]
  },

  {
    id: "knowledge-base",
    keywords: ["kb", "knowledge", "tài liệu", "hướng dẫn", "thông tin", "đọc gì", "wiki"],
    title: "Knowledge Base — Wiki nội bộ",
    answer: `KB là kho kiến thức nội bộ ACME:

- **8 categories**: Welcome, Sản phẩm, Sales, Marketing, Quy trình, Tools, Khách hàng, Pháp lý
- Bài **must-read** (ngôi sao vàng) — phải đọc Day 1
- Search tiếng Việt full-text
- Sau khi đọc → bấm **"✓ Tôi đã đọc"** để admin track

**Tip:** Tìm trong KB trước khi hỏi đồng nghiệp — tiết kiệm thời gian cả 2`,
    quickActions: [{ label: "Mở KB", href: "/kb" }]
  },

  {
    id: "playbook",
    keywords: ["playbook", "script", "kịch bản", "chốt đơn", "xử lý phản đối", "objection", "giá cao"],
    title: "Sales Playbook — Scripts chuẩn",
    answer: `Scripts đã được Sơn/Tâm chuẩn hoá:

**7 stage:** Intro → Discovery → Presentation → Objection → Closing → Follow-up → Referral

**Đã có sẵn:**
- "Giá cao" → Re-frame con số → giá trị + bảo hành 30 ngày
- "So sánh Vinamilk" → Pivot size → specialty
- "Cold call inbox Pancake" → Permission-based
- "Đã hỏi đủ nhưng chưa chốt" → Question close

**Khi dùng script → cuối tuần feedback** để team biết script nào hiệu quả.`,
    forRoles: ["employee", "manager"],
    quickActions: [{ label: "Mở Playbook", href: "/playbook" }]
  },

  {
    id: "onboarding",
    keywords: ["onboarding", "mới vào", "ngày 1", "day 1", "lộ trình", "training"],
    title: "Onboarding 30 ngày cho NV mới",
    answer: `Lộ trình 30 ngày:

- Ngày 1: đọc 3 bài must-read + meeting với leader
- Ngày 2-3: Học scripts + shadowing senior sale
- Ngày 7: Quiz kiểm tra kiến thức
- Ngày 10: Tự gọi 5 KH đầu tiên (có leader cạnh)
- Ngày 15: Mục tiêu chốt deal đầu tiên
- Ngày 30: Review tháng đầu với leader + CEO

Tự động track progress %. Buddy mentor sẽ kèm 1-1.`,
    quickActions: [{ label: "Mở lộ trình", href: "/onboarding" }]
  },

  {
    id: "dashboard-bi",
    keywords: ["dashboard", "bi", "biểu đồ", "chart", "đo lường", "report tổng"],
    title: "Dashboard BI",
    answer: `Dashboard Power BI-style:

- Filter: Hôm nay / 7 ngày / 30 ngày / Tháng / Quý / YTD
- Lọc theo kênh (Pancake/Shopee/...)
- 6 KPI tile có delta % vs kỳ trước
- 6 charts: trend DT, channel donut, top sản phẩm, BXH sale, funnel tuyển, attendance heatmap
- HR pulse + bonus + KPI status`,
    forRoles: ["admin", "manager"],
    quickActions: [{ label: "Mở Dashboard", href: "/dashboard" }]
  },

  {
    id: "them-nhan-vien",
    keywords: ["thêm nv", "tạo tài khoản", "nhân sự mới", "add employee"],
    title: "Thêm nhân viên mới",
    answer: `Tạo tài khoản NV mới (admin only):

1. Vào "Nhân sự"
2. Bấm **+ Thêm nhân sự** (góc phải)
3. Điền: email, mật khẩu tạm, full_name, role, position, contract_type, lương, BH
4. Chọn phòng ban → Lưu
5. Gửi email + password cho NV qua Zalo (bảo mật!)
6. Set **work_mode** nếu remote/hybrid`,
    forRoles: ["admin"],
    quickActions: [{ label: "Nhân sự", href: "/nhan-su" }]
  },
  {
    id: "change-my-password",
    keywords: ["đổi mật khẩu", "đổi pass", "change password", "mật khẩu mới"],
    title: "Tự đổi mật khẩu của tôi",
    answer: `Cách tự đổi mật khẩu:

1. Bấm icon **chìa khoá** ở góc phải trên (cạnh nút Logout)
2. Hoặc vào trực tiếp: /change-password
3. Nhập:
   - Mật khẩu hiện tại
   - Mật khẩu mới (≥6 ký tự, nên có chữ HOA + số + ký tự đặc biệt)
   - Xác nhận lại
4. Bấm "Đổi mật khẩu ngay"

**Tip:** lưu pass mới vào Google Password / iCloud Keychain ngay để không quên`,
    quickActions: [{ label: "Đổi mật khẩu", href: "/change-password" }]
  },
  {
    id: "reset-password",
    keywords: ["quên pass", "quên mật khẩu", "reset password", "không vào được", "forgot password"],
    title: "Quên mật khẩu",
    answer: `Cách reset khi quên:

**Nếu là NV:**
- Liên hệ admin (CEO) qua Zalo
- Admin sẽ reset trong 1 phút, gửi pass tạm qua Zalo
- Sau đó vào /change-password đổi sang pass mình nhớ

**Nếu là admin:**
1. Vào "Nhân sự" → tìm NV
2. Bấm icon (Sửa)
3. Tab **Reset password**
4. Gõ mật khẩu mới ≥6 ký tự → Reset
5. Gửi pass mới cho NV qua Zalo`,
    quickActions: [
      { label: "Đổi pass của tôi", href: "/change-password" },
      { label: "Quản lý NV", href: "/nhan-su" }
    ]
  },

  {
    id: "ke-toan-bank",
    keywords: ["kế toán", "bank", "sao kê", "đối soát", "chi phí", "doanh thu thật"],
    title: "Đối soát Bank + Chi phí",
    answer: `Upload sao kê ngân hàng:

1. Export CSV từ Internet Banking (VCB / MB / TCB / ACB ...)
2. Vào "Kế toán + Bank"
3. Chọn ngân hàng → Upload file
4. Hệ thống tự:
   - Parse từng giao dịch
   - Phân loại (revenue / marketing / lương / shipping ...)
   - So sánh DT bank với DT trong DB → phát hiện chênh lệch
   - Match từng GD với order tương ứng

**Kết quả:** thấy ngay đơn nào chưa nhập + chi phí nào kế toán quên`,
    forRoles: ["admin"],
    quickActions: [{ label: "Kế toán + Bank", href: "/admin/ke-toan" }]
  },

  {
    id: "empire-declarations",
    keywords: ["tuyên bố", "declaration", "empire", "affirmation", "đọc sáng"],
    title: "10 Tuyên Bố hàng ngày",
    answer: `10 Tuyên Bố ACME:

Mỗi sáng đọc to 10 câu khẳng định để **rèn Empire Mindset**:
1. Vào "10 Tuyên Bố"
2. Đọc to + lớn, không vội
3. Bấm tick **"Đã đọc hôm nay"** để track streak

**Tip:** đọc trước khi check-in chấm công — set energy cho cả ngày.`,
    quickActions: []
  },

  {
    id: "install-app",
    keywords: ["app", "cài app", "home screen", "icon", "pwa"],
    title: "Cài ACME thành app trên điện thoại",
    answer: `Để dùng như native app:

**iPhone (Safari):**
1. Mở https://ikihealing-hub.example.com
2. Bấm nút **Share** (mũi tên lên)
3. Chọn **"Add to Home Screen"**
4. Đặt tên "ACME" → Add

**Android (Chrome):**
1. Mở https://ikihealing-hub.example.com
2. Bấm 3 chấm ⋮ → **"Cài đặt ứng dụng"**
3. Confirm → biểu tượng ACME xuất hiện

Sau đó mở từ home screen — không cần browser, dùng như app thường.`
  },

  {
    id: "help-general-employee",
    keywords: ["help", "hướng dẫn", "không biết", "làm sao", "cần giúp", "stuck"],
    title: "Hướng dẫn chung",
    forRoles: ["employee"],
    answer: `Tôi có thể giúp bạn:

- **Chấm công** Face ID, GPS, sửa khi quên
- **Xin nghỉ** phép năm, ốm
- **Phiếu lương** xem chi tiết tháng
- **Task của tôi** ack, hoàn thành, vướng
- **Báo cáo cuối ngày** nộp trước khi check-out
- **KB / Playbook** tìm tài liệu, scripts
- **Lộ trình 30 ngày** onboarding`
  },

  {
    id: "help-general",
    keywords: ["help", "hướng dẫn", "không biết", "làm sao", "cần giúp", "stuck"],
    title: "Hướng dẫn chung",
    forRoles: ["admin", "manager"],
    answer: `Tôi có thể giúp bạn:

- **Chấm công** Face ID, GPS, remote, sửa khi quên
- **Xin nghỉ** phép năm, ốm
- **Lương** xem phiếu, hiểu công thức tính
- **Task** giao việc, ack, blocker
- **Daily Report** cuối ngày
- **KB / Playbook** tìm tài liệu, scripts
- **Onboarding** lộ trình 30 ngày
- **Dashboard BI** đo lường
- **Admin**: nhân sự, kế toán, MISA, tính lương

Hỏi cụ thể đi (VD: "cách chấm công", "phạt 50k là gì")`
  }
];

export function matchIntents(query: string, currentPath: string, role: string, limit = 3): Intent[] {
  const q = query.toLowerCase().trim();
  if (!q) {

    return INTENTS
      .filter(i => i.forPaths?.some(p => currentPath.startsWith(p)) || i.id === "help-general")
      .filter(i => !i.forRoles || i.forRoles.includes(role as any))
      .slice(0, limit);
  }

  const scored: { intent: Intent; score: number }[] = [];
  for (const i of INTENTS) {
    if (i.forRoles && !i.forRoles.includes(role as any)) continue;
    let s = 0;
    for (const k of i.keywords) {
      if (q.includes(k.toLowerCase())) s += k.length;
    }
    if (q.includes(i.title.toLowerCase())) s += 20;
    if (s > 0) scored.push({ intent: i, score: s });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.intent);
}

export function getSuggestionsForPage(path: string, role: string): Intent[] {
  return INTENTS
    .filter(i => i.forPaths?.some(p => path.startsWith(p)))
    .filter(i => !i.forRoles || i.forRoles.includes(role as any))
    .slice(0, 4);
}
