

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  total_spent NUMERIC DEFAULT 0,
  total_orders INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  unit_price NUMERIC NOT NULL,
  vat_rate NUMERIC DEFAULT 0.08,
  in_commission_scope BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  salesperson_id UUID REFERENCES users(id),
  channel TEXT,
  sub_channel TEXT,
  gross_revenue NUMERIC NOT NULL DEFAULT 0,
  discount_value NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  net_revenue NUMERIC GENERATED ALWAYS AS (gross_revenue - discount_value) STORED,
  final_revenue NUMERIC GENERATED ALWAYS AS (gross_revenue - discount_value - shipping_cost) STORED,
  quantity INT DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipping','delivered','cancelled','refunded')),
  order_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sale ON orders(salesperson_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  duration_days INT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  course_id UUID REFERENCES courses(id),
  enrolled_at DATE DEFAULT CURRENT_DATE,
  paid_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'lead' CHECK (status IN ('lead','contacted','enrolled','learning','completed','dropped','refunded')),
  source TEXT,
  consultant_id UUID REFERENCES users(id),
  progress_percent INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status, enrolled_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);

CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  type TEXT,
  content_brief TEXT,
  author_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea','draft','review','scheduled','published','archived')),
  publish_date TIMESTAMPTZ,
  published_url TEXT,

  reach INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  related_campaign TEXT,
  related_product TEXT,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_status ON content_items(status, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_content_author ON content_items(author_id);

CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  description TEXT,
  salary_range TEXT,
  required_count INT DEFAULT 1,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','paused','closed','filled')),
  opened_at DATE DEFAULT CURRENT_DATE,
  closed_at DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES job_postings(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position_applying TEXT,
  source TEXT,
  cv_url TEXT,
  experience_years NUMERIC,
  expected_salary NUMERIC,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','screening','interview','offer','hired','rejected','withdrawn')),
  interviewer_id UUID REFERENCES users(id),
  interview_date TIMESTAMPTZ,
  interview_score INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_id);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id),
  department_id UUID REFERENCES departments(id),
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning','active','paused','done','cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  start_date DATE,
  due_date DATE,
  progress_percent INT DEFAULT 0,
  budget NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo','doing','review','done','blocked')),
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON project_tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks(project_id, status);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['customers','products','orders','order_items','courses','students','content_items','job_postings','candidates','projects','project_tasks']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_all ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

INSERT INTO products (sku, name, category, unit_price, in_commission_scope) VALUES
  ('SP-A', 'Sản phẩm A', 'Nhóm A', 500000, true),
  ('SP-B', 'Sản phẩm B', 'Nhóm B', 200000, true)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO courses (code, name, price, duration_days) VALUES
  ('KH-MAU', 'Khoá học mẫu', 1000000, 30)
ON CONFLICT (code) DO NOTHING;
