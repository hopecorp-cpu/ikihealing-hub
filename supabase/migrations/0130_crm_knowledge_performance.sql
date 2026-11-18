

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigner_id UUID REFERENCES users(id),
  assignee_id UUID REFERENCES users(id),
  related_to TEXT,
  related_id UUID,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo','doing','blocked','review','done','cancelled')),
  due_date DATE,
  due_at TIMESTAMPTZ,
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  blocker_reason TEXT,
  attachments JSONB,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date) WHERE status NOT IN ('done','cancelled');

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_comments ON task_comments(task_id);

CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  report_date DATE NOT NULL,
  yesterday_done TEXT,
  today_plan TEXT,
  blockers TEXT,
  mood TEXT CHECK (mood IN ('great','good','ok','tired','stressed')),
  energy_level INT CHECK (energy_level BETWEEN 1 AND 5),
  customer_interactions INT DEFAULT 0,
  calls_made INT DEFAULT 0,
  orders_closed INT DEFAULT 0,
  revenue_today NUMERIC(15,0) DEFAULT 0,
  hours_worked NUMERIC(4,1),
  highlights TEXT,
  learnings TEXT,
  manager_comment TEXT,
  manager_seen BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft','submitted','reviewed')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_user_date ON daily_reports(user_id, report_date DESC);

CREATE TABLE IF NOT EXISTS kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INT DEFAULT 0,
  parent_id UUID REFERENCES kb_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category_id UUID REFERENCES kb_categories(id),
  content TEXT NOT NULL,
  excerpt TEXT,
  tags TEXT[],
  author_id UUID REFERENCES users(id),
  required_for_roles TEXT[],
  is_must_read BOOLEAN DEFAULT FALSE,
  view_count INT DEFAULT 0,
  published BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 1,
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_cat ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_tags ON kb_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_kb_search ON kb_articles USING GIN(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')));

CREATE TABLE IF NOT EXISTS kb_read_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  article_id UUID REFERENCES kb_articles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_days INT DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  step_order INT DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  step_type TEXT CHECK (step_type IN ('read_article','watch_video','meeting','task','quiz','submit')),
  resource_url TEXT,
  article_id UUID REFERENCES kb_articles(id),
  estimated_minutes INT,
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_template_day ON onboarding_steps(template_id, day_number);

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES onboarding_templates(id),
  start_date DATE NOT NULL,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('not_started','in_progress','completed','paused')),
  buddy_id UUID REFERENCES users(id),
  completion_percent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS onboarding_step_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id UUID REFERENCES onboarding_progress(id) ON DELETE CASCADE,
  step_id UUID REFERENCES onboarding_steps(id),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(progress_id, step_id)
);

CREATE TABLE IF NOT EXISTS playbook_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL CHECK (stage IN ('intro','discovery','presentation','objection','closing','followup','referral')),
  scenario TEXT NOT NULL,
  script_text TEXT NOT NULL,
  product_category TEXT,
  key_points TEXT[],
  tonality TEXT,
  do_say TEXT[],
  dont_say TEXT[],
  example_dialogues JSONB,
  proof_links TEXT[],
  use_count INT DEFAULT 0,
  effectiveness_rating NUMERIC(2,1),
  tags TEXT[],
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playbook_stage ON playbook_items(stage);
CREATE INDEX IF NOT EXISTS idx_playbook_search ON playbook_items USING GIN(to_tsvector('simple', coalesce(scenario,'') || ' ' || coalesce(script_text,'')));

CREATE TABLE IF NOT EXISTS playbook_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  item_id UUID REFERENCES playbook_items(id) ON DELETE CASCADE,
  outcome TEXT CHECK (outcome IN ('closed','progressed','rejected','no_response')),
  customer_response TEXT,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS one_on_ones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES users(id),
  employee_id UUID REFERENCES users(id),
  meeting_date DATE NOT NULL,
  agenda TEXT,
  employee_notes TEXT,
  manager_notes TEXT,
  action_items JSONB,
  next_meeting_date DATE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oneonone_pair ON one_on_ones(manager_id, employee_id);

INSERT INTO kb_categories (slug, name, description, icon, color, sort_order) VALUES
  ('welcome',       '👋 Chào mừng',        'Văn hoá ACME, giá trị cốt lõi, intro sếp/đồng nghiệp', '🏛️', '#F5C518', 1),
  ('product',       '📦 Sản phẩm',         'Đạm Mẫu, NOVA Detox, khoá học mẫu', '📦', '#10B981', 2),
  ('sales',         '💼 Sales',            'Quy trình bán hàng, scripts, đối tượng KH', '💰', '#3B82F6', 3),
  ('marketing',     '📢 Marketing',        'Brand voice, content rules, kênh phân phối', '🎨', '#EC4899', 4),
  ('process',       '⚙️ Quy trình',        'Chấm công, xin nghỉ, ứng lương, báo cáo', '📋', '#8B5CF6', 5),
  ('tools',         '🛠️ Công cụ',          'Pancake, Misa, Acme IKIHEALING Hub, Zalo OA', '🔧', '#06B6D4', 6),
  ('customer',      '👤 Khách hàng',       'Persona, pain points, customer journey', '❤️', '#EF4444', 7),
  ('legal',         '⚖️ Pháp lý',          'BHXH, thuế TNCN, NQ 110/2025, luật lao động', '📜', '#6B7280', 8)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO kb_articles (slug, title, category_id, content, excerpt, is_must_read, tags) VALUES
('welcome-to-acme',
 '👋 Chào mừng bạn đến ACME Corp',
 (SELECT id FROM kb_categories WHERE slug='welcome'),
 '# Chào mừng bạn đến ACME Corp! 🎉

## Chúng tôi là ai?
ACME Corp là doanh nghiệp **Empire**, hoạt động ở giao điểm của 3 ngành lớn:
- 🌱 **Đạm Mẫu** — thực phẩm bổ sung từ thực vật
- 🌿 **NOVA Detox** — sản phẩm thanh lọc cơ thể
- 🎓 **Khoá học GS. Trần Văn Bình** — kiến thức dinh dưỡng tự nhiên

## 5 Giá trị cốt lõi
1. **Sức khoẻ là số 1** — chúng tôi tin rằng sức khoẻ tự nhiên là quyền của mỗi người.
2. **Khách hàng là gia đình** — không bán "hàng" mà trao "giải pháp".
3. **Trung thực không khoan nhượng** — sai thì nhận, đúng thì giữ.
4. **Học mỗi ngày** — Empire Daily, 10 Tuyên Bố mỗi sáng.
5. **Empire Mindset** — không an phận, không "đủ rồi", luôn nâng cấp.

## Đội ngũ
- **CEO** — (mẫu) người đứng đầu công ty.
- **Leader Sale** — (mẫu) quản lý team Sale.
- **Trưởng MKT** — (mẫu) quản lý team Content + Marketing.

Bạn vào ACME không phải để "đi làm" — bạn vào ACME để **xây Empire của bạn cùng chúng tôi**.',
 'Giới thiệu văn hoá, giá trị cốt lõi và đội ngũ ACME Corp', TRUE, ARRAY['onboarding','văn hoá']),

('product-san-pham-a',
 '🌱 Sản phẩm Đạm Mẫu — kiến thức cơ bản',
 (SELECT id FROM kb_categories WHERE slug='product'),
 '# Đạm Mẫu — Sản phẩm chiến lược

## Định vị
Đạm Mẫu là **thực phẩm bổ sung 100% từ thực vật**, không hoá chất, không phụ gia, đặt niềm tin vào dinh dưỡng tự nhiên.

> ⚠️ **LƯU Ý PHÁP LÝ — BẮT BUỘC tuân thủ khi tư vấn / đăng bài / livestream:**
>
> - Đạm Mẫu là **THỰC PHẨM BỔ SUNG**. **TUYỆT ĐỐI KHÔNG** gọi là "TPCN", "thực phẩm chức năng" hay "thực phẩm bảo vệ sức khoẻ" — ACME **chưa** đăng ký các nhóm này.
> - **KHÔNG** dùng từ: *chữa, trị, điều trị, đặc trị, khỏi bệnh, thay thế thuốc, cam kết khỏi…* với bất kỳ bệnh nào.
> - **KHÔNG** nói sản phẩm "thải độc gan/thận", "trị mất ngủ", "trị tiêu hoá", "giảm cân"… (claim công dụng = vi phạm Luật Quảng cáo & Nghị định 15/2018).
> - **KHÔNG** dùng từ tuyệt đối: *số 1, tốt nhất, duy nhất…* nếu không có bằng chứng hợp pháp.
> - Chỉ nói **"bổ sung dinh dưỡng / hỗ trợ"** và luôn kèm: *"Thực phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh."*

## Phân khúc
- **Đối tượng chính:** phụ nữ 30-55, có gia đình, quan tâm sức khoẻ, thu nhập (mẫu)
- **Mối quan tâm thường gặp của khách (để THẤU HIỂU, không phải để hứa công dụng):** muốn ăn uống lành mạnh hơn, bổ sung dinh dưỡng từ thực vật, chăm sóc sức khoẻ gia đình

## Dòng sản phẩm chính
- **Trà thảo mộc** — đồ uống thảo mộc từ thực vật
- **Bột dinh dưỡng thực vật** — bổ sung dinh dưỡng hằng ngày
- **Viên uống bổ sung** — bổ sung dinh dưỡng từ thực vật

## USP (Unique Selling Proposition)
1. 100% nguyên liệu Việt, có chứng nhận hữu cơ
2. Đồng hành cùng GS. Trần Văn Bình — chuyên gia dinh dưỡng uy tín
3. Cam kết hoàn tiền 100% nếu không hài lòng sau 30 ngày
4. Cộng đồng học viên (mẫu)

## Mức giá tham khảo
- Combo basic (mẫu): 100.000đ - 200.000đ
- Combo VIP (mẫu): 500.000đ - 1.000.000đ
- Liệu trình toàn diện (mẫu): 1.000.000đ - 2.000.000đ

## Khi nào nói "không"?
- KH có bệnh mãn tính nặng (ung thư, tim mạch) → khuyên gặp bác sĩ, **KHÔNG** tư vấn sản phẩm như giải pháp điều trị
- KH muốn "giảm 10kg trong 1 tuần" → không phù hợp, từ chối thẳng
- KH yêu cầu cam kết "khỏi bệnh" → giải thích đây là thực phẩm bổ sung, không phải thuốc',
 'Định vị, phân khúc, USP và mức giá tham khảo của Đạm Mẫu', TRUE, ARRAY['Sản phẩm A','sản phẩm','sale']),

('process-cham-cong',
 '⚙️ Quy trình chấm công + xin nghỉ',
 (SELECT id FROM kb_categories WHERE slug='process'),
 '# Quy trình chấm công + xin nghỉ ACME

## Giờ làm chuẩn
- **Sáng:** 08:00 – 12:00
- **Chiều:** 13:30 – 17:30
- **Tổng:** 8h/ngày · 26 ngày/tháng · grace 5 phút

## Chấm công Face ID
1. Vào `ikihealing-hub.example.com/cham-cong` trên điện thoại
2. Bấm **SCAN FACE — CHECK-IN** khi đến VP (yêu cầu GPS 150m)
3. Cuối ngày bấm **SCAN FACE — CHECK-OUT** trước khi về
4. Nếu làm **remote**, admin set work_mode = remote → không cần GPS

## ⚠️ Phạt
- Quên check-in: **(mẫu) 10.000đ/lần**
- Quên check-out: **(mẫu) 10.000đ/lần**
- Muộn > 30 phút: **(mẫu) 20.000đ/lần**
- Vắng không xin phép: **(mẫu) 100.000đ/lần**

Nếu quên do lý do chính đáng → bấm **"Xin sửa chấm công"** ở góc phải → admin duyệt sẽ miễn phạt.

## Xin nghỉ
1. Vào `/xin-nghi` → bấm "+ Đơn nghỉ mới"
2. Chọn loại: phép năm, ốm, không lương
3. Đệ trình trước **2 ngày làm việc** (trừ trường hợp ốm/khẩn cấp)
4. Manager duyệt → đơn được auto cộng vào leave_balance',
 'Quy định chấm công, phạt quên Face ID và quy trình xin nghỉ', TRUE, ARRAY['chấm công','xin nghỉ','quy trình']),

('sales-discovery-questions',
 '🎯 10 câu hỏi discovery để hiểu khách',
 (SELECT id FROM kb_categories WHERE slug='sales'),
 '# 10 câu hỏi vàng khi tư vấn KH

## Trước khi bán → phải HIỂU
"Người bán giỏi không nói nhiều — họ hỏi đúng."

### 1. Câu mở đầu (ấm)
> "Cảm ơn chị đã quan tâm tới ACME. Em là [tên], tư vấn viên. Chị tên là gì để em xưng hô cho thuận ạ?"

### 2. Câu định danh pain point
> "Hiện tại chị đang gặp vấn đề gì về sức khoẻ mà chị muốn cải thiện nhất? (mệt mỏi / mất ngủ / tiêu hoá / da)"

### 3. Câu đào sâu mức độ
> "Vấn đề này kéo dài bao lâu rồi chị? Đã ảnh hưởng tới công việc/cuộc sống thế nào?"

### 4. Câu thử các giải pháp đã làm
> "Trước đây chị đã thử cách nào để cải thiện chưa ạ? Kết quả thế nào?"

### 5. Câu xác định ngân sách
> "Chị có ngân sách dự kiến cho việc chăm sóc sức khoẻ tháng này khoảng bao nhiêu để em tư vấn combo phù hợp ạ?"

### 6. Câu vai trò quyết định
> "Quyết định mua hàng có cần bàn với ai khác trong gia đình không ạ?" (chồng/con)

### 7. Câu khám phá motivation
> "Khi sức khoẻ tốt hơn, chị mong điều gì đầu tiên xảy ra trong cuộc sống?"

### 8. Câu khám phá trust
> "Chị biết ACME qua kênh nào? Đã có ai dùng và recommend chị chưa?"

### 9. Câu xác định timeline
> "Chị muốn bắt đầu cải thiện ngay tuần này hay đợi sau Tết / dịp nào đó?"

### 10. Câu chốt commit
> "Nếu em demo cho chị một liệu trình phù hợp ngay bây giờ và chị thấy ổn, chị có sẵn sàng bắt đầu hôm nay luôn không?"

## Lưu ý
- KHÔNG nói về sản phẩm trước khi hỏi đủ 3-5 câu đầu
- Tốc độ nói **chậm hơn bình thường 20%**
- Lắng nghe → ghi chú → quote lại lời KH ("Anh chị vừa nói là ...")',
 '10 câu hỏi discovery chuẩn để hiểu pain point + ra deal', TRUE, ARRAY['sale','discovery','script']);

INSERT INTO playbook_items (stage, scenario, script_text, product_category, key_points, tonality, do_say, dont_say) VALUES
('objection', 'Khách nói giá cao',
 'Em hiểu cảm giác của chị. Thực ra khi chị so sánh, chị đang nhìn vào CON SỐ — còn em xin phép chị nhìn vào GIÁ TRỊ.\n\nLiệu trình 1.000.000đ này (giá mẫu) tương đương khoảng 33.000đ/ngày trong 1 tháng. Chị nghĩ xem, mỗi sáng chị uống 1 ly cafe 50k, ly trà sữa 60k — vậy mà sức khoẻ — thứ quý nhất — chị chỉ cần đầu tư khoảng 33k/ngày để có 1 cơ thể nhẹ nhõm, ngủ ngon, da đẹp.\n\nQuan trọng hơn — ACME bảo hành KẾT QUẢ. Nếu sau 30 ngày chị không hài lòng, em hoàn 100%. Vậy thực ra chị có RỦI RO gì không ạ?',
 'san_pham_a',
 ARRAY['Re-frame: con số → giá trị', 'So sánh với chi tiêu daily', 'Risk reversal với guarantee 30 ngày'],
 'empathetic',
 ARRAY['Em hiểu cảm giác của chị', 'Bảo hành kết quả 100%', 'Quy đổi giá theo ngày'],
 ARRAY['Không, không cao đâu', 'Sản phẩm em rẻ nhất', 'Của em là tốt nhất']),

('objection', 'Khách so sánh với Vinamilk / sản phẩm khác',
 'Cảm ơn chị đã so sánh — em không trách. Vinamilk hay [đối thủ] là thương hiệu lớn, nhưng họ làm ĐẠI TRÀ. ACME chúng em làm CHUYÊN BIỆT cho người cần CẢI THIỆN sức khoẻ thật sự — không phải uống cho "có dinh dưỡng cơ bản".\n\n3 điểm khác biệt:\n1. **Cố vấn GS. Trần Văn Bình** — 30 năm nghiên cứu dinh dưỡng tự nhiên VN\n2. **100% thực vật, không phụ gia** — Vinamilk vẫn có sữa động vật + phụ gia\n3. **Có cộng đồng học viên** (mẫu)\n\nChị có thể vào group cộng đồng (mẫu) trên Facebook để xem chia sẻ.',
 'san_pham_a',
 ARRAY['Không bash đối thủ', 'Pivot từ size sang specialty', 'Social proof cụ thể'],
 'confident',
 ARRAY['ACME chuyên biệt, không đại trà', 'Cố vấn GS Trần Văn Bình', 'Cộng đồng học viên (mẫu)'],
 ARRAY['Vinamilk dở lắm', 'Bên kia toàn dùng hoá chất']),

('closing', 'Khách đã hỏi đủ thông tin nhưng chưa chốt',
 'Chị ơi, em thấy chị đang phân vân giữa combo A và combo B đúng không ạ?\n\nEm xin tóm tắt 3 điều chị cần quyết:\n1. ✅ Chị đã thấy SP phù hợp pain point của chị (mệt + mất ngủ)\n2. ✅ Chị đã có ngân sách trong tầm\n3. ✅ Chị đã có cam kết bảo hành 30 ngày\n\nVậy thực sự điều gì còn khiến chị chưa quyết ạ? Em xin chị 1 phút trả lời thật để em hỗ trợ chị đúng nhất.',
 NULL,
 ARRAY['Tóm tắt 3 điểm đã đồng ý', 'Question close — bóc rào cản thật', 'Tạo cảm giác đã gần xong'],
 'consultative',
 ARRAY['Chị đang phân vân giữa A và B đúng không', 'Em xin chị 1 phút trả lời thật'],
 ARRAY['Chị mua đi mà', 'Hôm nay khuyến mãi cuối']),

('intro', 'Cold call lần đầu — khách inbox Pancake',
 'Em chào chị! Em là [tên] từ ACME Corp. Em vừa nhận inbox của chị về [sản phẩm chị hỏi]. Để em hỗ trợ tốt nhất, chị có rảnh 5 phút để em hỏi vài câu về nhu cầu cụ thể của chị không ạ? (Nếu chị bận em sẽ nhắn nội dung text qua cho chị đọc khi rảnh nhé)',
 NULL,
 ARRAY['Xin permission trước khi đào sâu', 'Cho lựa chọn (text vs call) — KH cảm giác kiểm soát'],
 'consultative',
 ARRAY['Chị có rảnh 5 phút không', 'Em sẽ nhắn text nếu chị bận'],
 ARRAY['Em gọi tư vấn cho chị nhé', 'Bên em đang khuyến mãi'])
ON CONFLICT DO NOTHING;

WITH t AS (
  INSERT INTO onboarding_templates (role, name, description, total_days)
  VALUES ('sale', 'Onboarding Sale — 30 ngày', 'Lộ trình 30 ngày cho Sale mới: hiểu sản phẩm → master scripts → ra deal đầu tiên', 30)
  RETURNING id
)
INSERT INTO onboarding_steps (template_id, day_number, step_order, title, description, step_type, estimated_minutes, is_required) VALUES
((SELECT id FROM t), 1, 1, '👋 Đọc bài "Chào mừng đến ACME Corp"', 'Hiểu văn hoá + giá trị cốt lõi trước', 'read_article', 15, TRUE),
((SELECT id FROM t), 1, 2, '🌱 Đọc bài "Sản phẩm Đạm Mẫu — kiến thức cơ bản"', 'Nắm chắc sản phẩm chính trước khi học script', 'read_article', 30, TRUE),
((SELECT id FROM t), 1, 3, '⚙️ Đọc quy trình chấm công + xin nghỉ', 'Biết phải làm gì ngày 1, ngày 2', 'read_article', 15, TRUE),
((SELECT id FROM t), 1, 4, '🤝 Meeting 30 phút với Leader Sale', 'Intro 1-1, hiểu kỳ vọng tháng đầu', 'meeting', 30, TRUE),
((SELECT id FROM t), 1, 5, '📝 Submit Daily Report đầu tiên', 'Cuối ngày 1: học được gì, cảm thấy thế nào', 'submit', 10, TRUE),
((SELECT id FROM t), 2, 1, '🎯 Đọc 10 câu hỏi discovery', 'Khung discovery — cốt lõi cách ACME bán', 'read_article', 30, TRUE),
((SELECT id FROM t), 2, 2, '📚 Đọc 4 playbook objection chính', 'Học cách trả lời khi KH nói "giá cao", so sánh', 'read_article', 45, TRUE),
((SELECT id FROM t), 3, 1, '👂 Listen 5 cuộc gọi shadowing với senior sale', 'Quan sát senior sale gọi → ghi chú style', 'task', 120, TRUE),
((SELECT id FROM t), 5, 1, '📞 Role-play 3 scenarios với senior', 'Diễn lại discovery + 1 objection', 'task', 60, TRUE),
((SELECT id FROM t), 7, 1, '✅ Quiz kiểm tra kiến thức tuần 1', '20 câu về sản phẩm + script', 'quiz', 30, TRUE),
((SELECT id FROM t), 10, 1, '☎️ Tự gọi 5 KH đầu tiên', 'Có Leader Sale ngồi cạnh', 'task', 180, TRUE),
((SELECT id FROM t), 15, 1, '🎯 Mục tiêu: chốt deal đầu tiên', 'Đơn đầu tiên tự chốt được', 'task', NULL, TRUE),
((SELECT id FROM t), 30, 1, '📊 Review tháng đầu với Leader + CEO', 'Đánh giá: tiếp tục Probation hay kết thúc', 'meeting', 60, TRUE)
ON CONFLICT DO NOTHING;

WITH t AS (
  INSERT INTO onboarding_templates (role, name, description, total_days)
  VALUES ('content', 'Onboarding Content — 30 ngày', 'Lộ trình cho Content/Marketing mới: hiểu brand → write first piece → master KPI', 30)
  RETURNING id
)
INSERT INTO onboarding_steps (template_id, day_number, step_order, title, description, step_type, estimated_minutes, is_required) VALUES
((SELECT id FROM t), 1, 1, '👋 Đọc bài "Chào mừng đến ACME Corp"', '', 'read_article', 15, TRUE),
((SELECT id FROM t), 1, 2, '🌱 Đọc bài sản phẩm Đạm Mẫu', '', 'read_article', 30, TRUE),
((SELECT id FROM t), 1, 3, '🤝 Meeting với Trưởng MKT', 'Hiểu kỳ vọng tháng đầu', 'meeting', 30, TRUE),
((SELECT id FROM t), 2, 1, '🎨 Đọc Brand voice guideline ACME', '', 'read_article', 45, TRUE),
((SELECT id FROM t), 3, 1, '✍️ Write 3 caption Facebook đầu tiên', 'Có Team Lead MKT review', 'task', 90, TRUE),
((SELECT id FROM t), 7, 1, '📊 Quiz kiến thức brand + sản phẩm', '', 'quiz', 30, TRUE),
((SELECT id FROM t), 15, 1, '🚀 Publish content đầu tiên độc lập', '', 'task', 60, TRUE),
((SELECT id FROM t), 30, 1, '📊 Review tháng với Trưởng MKT', '', 'meeting', 60, TRUE)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_kb_must_read ON kb_articles(is_must_read) WHERE is_must_read = TRUE;

COMMENT ON TABLE tasks IS 'Giao việc có audit trail — assigner, assignee, ack, status, due';
COMMENT ON TABLE daily_reports IS 'Báo cáo cuối ngày — yesterday/today/blockers + sale metrics';
COMMENT ON TABLE kb_articles IS 'Knowledge base nội bộ ACME — must-read cho Day 1';
COMMENT ON TABLE onboarding_templates IS 'Lộ trình 30-60-90 chuẩn cho từng role';
COMMENT ON TABLE playbook_items IS 'Sales scripts đồng nhất — Sale dùng để chốt đơn';
