

CREATE TABLE IF NOT EXISTS dong_y_du_lieu (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  phone       text,
  email       text,
  ten         text,
  kenh        text NOT NULL,
  nguon       text,
  muc_dich    text[] NOT NULL,
  van_ban     text NOT NULL,
  phien_ban   text,
  ip          text,
  ua          text,
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS dong_y_du_lieu_phone_idx ON dong_y_du_lieu (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS dong_y_du_lieu_email_idx ON dong_y_du_lieu (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS dong_y_du_lieu_created_idx ON dong_y_du_lieu (created_at DESC);

CREATE TABLE IF NOT EXISTS tu_choi_lien_he (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  phone        text,
  email        text,
  zalo_uid     text,
  kenh         text NOT NULL,
  ly_do        text,
  nguon        text,
  tin_goc      text,
  da_xac_nhan  boolean NOT NULL DEFAULT false,
  meta         jsonb
);
CREATE INDEX IF NOT EXISTS tu_choi_lien_he_phone_idx ON tu_choi_lien_he (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS tu_choi_lien_he_email_idx ON tu_choi_lien_he (email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS yeu_cau_du_lieu (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  loai          text NOT NULL,
  phone         text,
  email         text,
  ten           text,
  noi_dung      text,
  kenh          text,
  trang_thai    text NOT NULL DEFAULT 'moi',
  han_xac_nhan  timestamptz,
  han_xu_ly     timestamptz,
  xu_ly_luc     timestamptz,
  xu_ly_boi     text,
  ghi_chu       text,
  meta          jsonb
);
CREATE INDEX IF NOT EXISTS yeu_cau_du_lieu_trang_thai_idx ON yeu_cau_du_lieu (trang_thai, created_at DESC);

ALTER TABLE dong_y_du_lieu ENABLE ROW LEVEL SECURITY;
ALTER TABLE tu_choi_lien_he ENABLE ROW LEVEL SECURITY;
ALTER TABLE yeu_cau_du_lieu ENABLE ROW LEVEL SECURITY;

