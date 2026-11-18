

CREATE TABLE IF NOT EXISTS kb_quizzes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   UUID NOT NULL UNIQUE REFERENCES kb_articles(id) ON DELETE CASCADE,
  title        TEXT,
  pass_pct     INT NOT NULL DEFAULT 80 CHECK (pass_pct BETWEEN 1 AND 100),
  time_limit_s INT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_quiz_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID NOT NULL REFERENCES kb_quizzes(id) ON DELETE CASCADE,
  sort_order   INT NOT NULL DEFAULT 0,
  question     TEXT NOT NULL,
  choices      JSONB NOT NULL,
  correct_idx  INT NOT NULL,
  explanation  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kbq_quiz ON kb_quiz_questions (quiz_id, sort_order);

CREATE TABLE IF NOT EXISTS kb_quiz_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID NOT NULL REFERENCES kb_quizzes(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL,
  score_pct    INT NOT NULL,
  passed       BOOLEAN NOT NULL,
  duration_s   INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kbqa_user ON kb_quiz_attempts (user_id, quiz_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kbqa_quiz ON kb_quiz_attempts (quiz_id, created_at DESC);

ALTER TABLE kb_quizzes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_quiz_attempts  ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE kb_quizzes        IS 'Bài kiểm tra tự chấm gắn vào một bài KB — ngưỡng đạt riêng từng bài';
COMMENT ON TABLE kb_quiz_questions IS 'Câu trắc nghiệm; correct_idx KHÔNG bao giờ gửi xuống client';
COMMENT ON TABLE kb_quiz_attempts  IS 'Mỗi lượt làm một dòng, giữ hết — số lần làm lại là tín hiệu bài viết khó hiểu';
