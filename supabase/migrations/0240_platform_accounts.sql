
CREATE TABLE IF NOT EXISTS platform_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text NOT NULL DEFAULT 'Khác',
  platform    text NOT NULL,
  label       text,
  url         text,
  username    text,
  password    text,
  two_fa      text,
  notes       text,
  sort        int DEFAULT 100,
  updated_by  uuid,
  updated_at  timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

INSERT INTO platform_accounts (category, platform, label, url, sort) VALUES
  ('Mạng xã hội','Facebook Fanpage','Fanpage chính','https://facebook.com',10),
  ('Mạng xã hội','Facebook Fanpage','Fanpage phụ','https://facebook.com',11),
  ('Mạng xã hội','Facebook Business / Ads','Trình quản lý quảng cáo Meta','https://business.facebook.com',12),
  ('Mạng xã hội','Instagram',NULL,'https://instagram.com',13),
  ('Mạng xã hội','TikTok',NULL,'https://tiktok.com',14),
  ('Mạng xã hội','YouTube',NULL,'https://studio.youtube.com',15),
  ('Mạng xã hội','Zalo OA',NULL,'https://oa.zalo.me',16),
  ('Mạng xã hội','Threads',NULL,'https://threads.net',17),
  ('Sàn TMĐT','Shopee',NULL,'https://banhang.shopee.vn',20),
  ('Sàn TMĐT','TikTok Shop',NULL,'https://seller.tiktok.com',21),
  ('Sàn TMĐT','Lazada',NULL,'https://sellercenter.lazada.vn',22),
  ('Sàn TMĐT','Haravan (Website)',NULL,'https://acme.haravan.com',23),
  ('Công cụ','CapCut',NULL,'https://capcut.com',30),
  ('Công cụ','Canva',NULL,'https://canva.com',31),
  ('Công cụ','Google Workspace','Gmail / Drive công ty','https://google.com',32),
  ('Công cụ','ChatGPT / Claude',NULL,NULL,33),
  ('Khác','Tên miền / Hosting',NULL,NULL,40),
  ('Khác','Email công ty',NULL,NULL,41);
