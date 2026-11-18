import { taoPopup, chonSlugSanPham } from "./popup-thu-email";

export const SITE = "https://example.com";

export const CATEGORIES = {
  "dinh-duong": { hub: "blog/danh-muc-dinh-duong.html", label: "Dinh dưỡng & ăn uống" },
  "thoi-quen": { hub: "blog/danh-muc-thoi-quen.html", label: "Thói quen & lối sống" },
  "thuc-pham": { hub: "blog/danh-muc-thuc-pham.html", label: "Kiến thức thực phẩm" },
  "cam-nang": { hub: "blog/danh-muc-cam-nang-suc-khoe.html", label: "Cẩm nang sức khoẻ" },
} as const;
export type CategoryKey = keyof typeof CATEGORIES;

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  categoryKey: CategoryKey;
  answerBox: string;
  bodyHtml: string;
  faq: Array<{ q: string; a: string }>;
  related: Array<{ slug: string; title: string }>;
  heroAlt: string;
  readMinutes: number;
  date: string;

  lamNgay?: string[];
};

export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonLd(obj: unknown): string {
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n  </script>`;
}

export function renderArticleHtml(post: BlogPost): string {
  const url = `${SITE}/blog/${post.slug}.html`;
  const heroUrl = `${SITE}/assets/blog/${post.slug}-hero.jpg`;
  const cat = CATEGORIES[post.categoryKey];
  const t = escapeHtml(post.title);
  const d = escapeHtml(post.description);

  const ldOrganization = jsonLd({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NOVA — by ACME Corp",
    alternateName: ["NOVA", "example", "NOVA"],
    url: SITE,
    logo: `${SITE}/nova-logo-1024.jpg`,
    parentOrganization: {
      "@type": "Organization",
      name: "Công ty Cổ phần ACME",
      taxID: "0100000000",
    },
    sameAs: [
      "https://www.facebook.com/example/",
      "https://www.facebook.com/example/",
      "https://example.com",
      "https://tra.example.com",
      "https://tra-b.example.com",
      "https://example.com",
      "https://apps.apple.com/vn/app/nova-beauty-wellness/id0000000000",
    ],
  });

  const ldArticle = jsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: [heroUrl],
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "Đội ngũ Health Coach NOVA", url: SITE },
    publisher: {
      "@type": "Organization",
      name: "NOVA — by ACME Corp",
      logo: { "@type": "ImageObject", url: `${SITE}/nova-logo-1024.jpg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "vi-VN",
  });

  const ldBreadcrumb = jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog/` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  });

  const ldFaq = jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });

  const faqHtml = post.faq
    .map(
      (f) =>
        `<details class="faq-item"><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>`
    )
    .join("");

  const relatedHtml = post.related
    .map((r) => `<li><a href="${r.slug}.html">${escapeHtml(r.title)}</a></li>`)
    .join("");

  const CUA_QUIZ: Array<[string, RegExp]> = [
    ["tieu-hoa", /tiêu hoá|tiêu hóa|táo bón|đầy hơi|đầy bụng|dạ dày|đường ruột|khó tiêu|đại tràng/i],
    ["an-chay", /ăn chay|thuần chay|đạm thực vật|protein|thiếu đạm|thực dưỡng/i],
    ["nang-ne", /gan|rượu|bia|dầu mỡ|chiên rán|nặng nề|ì ạch|mỡ máu|tiếp khách/i],
  ];
  const khop = `${post.title} ${post.slug}`;
  const cuaQuiz = (CUA_QUIZ.find(([, re]) => re.test(khop)) || [""])[0];
  const linkQuiz = cuaQuiz ? `?nhom=${cuaQuiz}` : "";

  const viec = (post.lamNgay || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
  const lamNgayHtml = viec.length
    ? `        <section class="lam-ngay" aria-label="Việc làm được ngay hôm nay">
          <h2 id="lam-ngay">Làm ngay hôm nay</h2>
          <ol>${viec.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ol>
        </section>
`
    : "";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <!-- Google tag: GA4 + Google Ads (remarketing) -->
  <script id="nova-consent-default">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});</script>
  <script src="/assets/dong-y-cookie.js" defer data-lang="vi"></script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XXXXXXXXXX');gtag('config','AW-18332022859');</script>
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests; base-uri 'self'; object-src 'none'; form-action 'self' https://formsubmit.co https://formspree.io https://ops-hub.example.com;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="vi" href="${url}" />
  <link rel="alternate" hreflang="x-default" href="${url}" />

  <meta property="og:type" content="article" />
  <meta property="og:locale" content="vi_VN" />
  <meta property="og:site_name" content="NOVA — by ACME Corp" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${heroUrl}" />
  <meta property="article:published_time" content="${post.date}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${heroUrl}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap" rel="stylesheet" />
  <link rel="icon" type="image/jpeg" href="../nova-logo-256.jpg" />
  <link rel="stylesheet" href="../styles.css" />
  <script src="../script.js" defer></script>

  ${ldOrganization}
  ${ldArticle}
  ${ldBreadcrumb}
  ${ldFaq}

  <style>
    .post-wrap{max-width:760px;margin:0 auto;padding:0 20px}
    .post-hero{max-width:1000px;margin:0 auto;padding:0 20px}
    .post-hero-img{width:100%;aspect-ratio:16/8;object-fit:cover;border-radius:18px;margin-top:16px}
    .post-eyebrow{display:inline-block;font-family:var(--font-sans,'Manrope');font-weight:700;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--nova-teal-deep,#2E8975)}
    .post-title{font-family:var(--font-display,'Cormorant Garamond');font-weight:700;font-size:clamp(1.9rem,4.4vw,3rem);line-height:1.12;margin:.4rem 0 .6rem}
    .post-meta{font-size:.9rem;color:#667085;display:flex;gap:14px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #eef0f3;padding-bottom:18px;margin-bottom:8px}
    .answer-box{background:linear-gradient(135deg,#f2f9ef,#eafaf5);border:1px solid #cdebdf;border-left:4px solid var(--nova-teal,#4BC0AB);border-radius:14px;padding:18px 22px;margin:26px 0}
    .answer-box .ab-label{font-weight:700;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:var(--nova-teal-deep,#2E8975);margin-bottom:6px}
    .answer-box p{margin:0;font-size:1.06rem;line-height:1.6}
    .post-body{font-family:var(--font-sans,'Manrope');font-size:1.09rem;line-height:1.78;color:#1d2430}
    .post-body h2{font-family:var(--font-display,'Cormorant Garamond');font-weight:700;font-size:clamp(1.5rem,3vw,2.1rem);margin:2.2rem 0 .8rem;scroll-margin-top:90px}
    .post-body p{margin:0 0 1.1rem} .post-body ul,.post-body ol{margin:0 0 1.1rem;padding-left:24px} .post-body li{margin:.35rem 0}
    .post-body a{color:var(--nova-teal-deep,#2E8975);font-weight:600}
    .post-body blockquote{margin:1.4rem 0;padding:.6rem 0 .6rem 20px;border-left:4px solid var(--nova-lime,#A8D254);color:#475467;font-style:italic}
    /* Bảng so sánh/số liệu. Bài chỉ có ĐÚNG một ảnh
       hero nên bảng là cách duy nhất hiện có để nội dung NHÌN được chứ không chỉ đọc được.
       Bọc overflow-x ngay trên chính bảng: màn hình điện thoại hẹp hơn bảng 4 cột, không có dòng
       này thì bảng đẩy ngang cả trang bài. */
    .post-body table{display:block;overflow-x:auto;width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:.98rem}
    .post-body thead th{background:#F4F8EC;text-align:left;font-weight:700;color:#1d2430}
    .post-body th,.post-body td{border:1px solid #e3e8ef;padding:9px 12px;vertical-align:top}
    .post-body tbody tr:nth-child(even){background:#fafbfc}
    .lam-ngay{background:#F4F8EC;border-left:5px solid var(--nova-lime,#A8D254);border-radius:14px;padding:22px 24px;margin:34px 0}
    .lam-ngay h2{font-family:var(--font-display,'Cormorant Garamond');font-size:1.45rem;margin:0 0 12px}
    .lam-ngay ol{margin:0;padding-left:20px}
    .lam-ngay li{margin:0 0 8px;line-height:1.65}
    .post-cta{background:var(--nova-gradient,linear-gradient(135deg,#A8D254,#4BC0AB));border-radius:18px;padding:30px 26px;margin:34px 0;text-align:center;color:#fff}
    .post-cta h3{font-family:var(--font-display,'Cormorant Garamond');font-size:1.6rem;margin:0 0 8px;color:#fff}
    .post-cta p{margin:0 0 16px;opacity:.95}
    .post-faq{margin:34px 0} .post-faq h2{font-family:var(--font-display,'Cormorant Garamond');font-size:1.7rem;margin-bottom:12px}
    .post-related{margin:30px 0;border-top:1px solid #eef0f3;padding-top:22px} .post-related ul{padding-left:20px}
    .brand-box{margin:30px 0;background:linear-gradient(135deg,#f2f9ef,#eafaf5);border:1px solid #cdebdf;border-radius:16px;padding:20px 24px}
    .brand-box h2{font-family:var(--font-display,'Cormorant Garamond');font-size:1.5rem;margin:0 0 10px}
    .brand-box ul{margin:0;padding-left:20px} .brand-box li{margin:.4rem 0;color:#344054} .brand-box a{color:var(--nova-teal-deep,#2E8975);font-weight:700}
    .lead-cta{margin:30px 0}
    .lead-inner{background:linear-gradient(135deg,#12261f,#1c3a30);border-radius:20px;padding:32px 24px;text-align:center;color:#fff}
    .lead-cta .lead-tag{color:var(--nova-lime,#A8D254);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}
    .lead-cta h2{font-family:var(--font-display,'Cormorant Garamond');font-size:1.7rem;margin:8px 0 6px;color:#fff}
    .lead-cta p{color:rgba(255,255,255,.82);margin:0 auto 18px;max-width:520px;font-size:1rem}
    .lead-row{display:flex;gap:10px;max-width:480px;margin:0 auto;flex-wrap:wrap}
    .lead-row input[type=email]{flex:1;min-width:200px;border:none;border-radius:12px;padding:13px 16px;font-size:1rem;font-family:inherit}
    .lead-phone{display:block;width:100%;max-width:480px;margin:10px auto 0;border:none;border-radius:12px;padding:11px 16px;font-size:.95rem;font-family:inherit}
    .lead-row button{border:none;border-radius:12px;padding:13px 22px;font-weight:700;font-size:1rem;color:#fff;background:var(--nova-gradient,linear-gradient(135deg,#A8D254,#4BC0AB));cursor:pointer;font-family:inherit}
    .lead-consent{display:block;margin-top:12px;color:rgba(255,255,255,.6);font-size:.78rem} .lead-consent input{margin-right:6px}
    .post-disclaimer{font-size:.86rem;color:#667085;background:#fafbfc;border:1px solid #eef0f3;border-radius:12px;padding:14px 18px;margin:26px 0}
    @media(max-width:640px){.post-hero-img{aspect-ratio:4/3}}
  </style>
<script src="/assets/js/nguon.js" defer></script>
</head>
<body>
  <div class="announcement-bar">
    App NOVA — <a href="../app.html">iOS &amp; Android</a>. AI Coach Đông Y cá nhân hoá theo thể tạng.
  </div>

  <header class="site-header" id="site-header">
    <nav class="nav">
      <a class="brand" href="../index.html" aria-label="NOVA Trang chủ">
        <img class="brand-logo" src="../nova-logo-256.jpg" alt="NOVA logo" />
        <span>NOVA <span class="brand-sub">By ACME Corp</span></span>
      </a>
      <button class="nav-toggle" type="button" aria-label="Mở menu" aria-expanded="false" aria-controls="primary-nav">
        <svg class="icon-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        <svg class="icon-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <ul class="nav-links" id="primary-nav">
        <li><a href="../index.html">Trang chủ</a></li>
        <li><a href="../hoc-vien.html">Học Viện</a></li>
        <li><a href="index.html" class="active">Blog</a></li>
        <li><a href="../cong-dong.html">Cộng đồng</a></li>
        <li><a href="https://example.com/shop/">Sản phẩm</a></li>
        <li><a href="../app.html">Ứng dụng</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <article>
      <div class="post-hero">
        <div style="max-width:760px;margin:0 auto">
          <span class="post-eyebrow">${escapeHtml(cat.label)}</span>
          <h1 class="post-title">${t}</h1>
          <div class="post-meta">
            <span>Đội ngũ Health Coach NOVA</span><span>·</span>
            <span>Cập nhật ${post.date}</span><span>·</span>
            <span>${post.readMinutes} phút đọc</span>
          </div>
        </div>
        <img class="post-hero-img" src="../assets/blog/${post.slug}-hero.jpg" alt="${escapeHtml(post.heroAlt)}" />
      </div>

      <div class="post-wrap">

        <div class="answer-box"><div class="ab-label">Trả lời nhanh</div><p>${escapeHtml(post.answerBox)}</p></div>

        <div class="post-body">
${post.bodyHtml}
        </div>

${lamNgayHtml}
        <div class="post-cta">
          <h3>Đo trước khi chăm — bài đọc thể trạng miễn phí</h3>
          <p>13 câu, khoảng 3 phút. Bạn nhận 6 chỉ số lối sống của riêng mình kèm thực đơn 14 ngày phù hợp — biết mình đang ở đâu rồi hãy chọn cách chăm.</p>
          <a class="btn btn-primary" href="../quiz/${linkQuiz}">Làm bài đọc thể trạng →</a>
        </div>

        <section class="post-faq" aria-label="Câu hỏi thường gặp"><h2 id="faq">Câu hỏi thường gặp</h2>${faqHtml}</section>

        <section class="lead-cta" aria-label="Nhận cẩm nang miễn phí">
    <div class="lead-inner">
      <span class="lead-tag">Miễn phí</span>
      <h2>Nhận cẩm nang chăm sóc sức khoẻ chủ động</h2>
      <p>Cẩm nang PDF hướng dẫn lộ trình 6 chặng theo thể tạng — gửi ngay vào email của bạn.</p>
      <form class="signup-form lead-form" action="https://ops-hub.example.com/api/blog-lead" method="POST" novalidate>
        <input type="hidden" name="source" value="blog:article:${post.slug}" />
        <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" />
        <div class="lead-row">
          <input type="email" name="email" placeholder="Email của bạn..." required aria-label="Email" />
          <button type="submit">Nhận ngay →</button>
        </div>
        <input type="tel" name="phone" class="lead-phone" placeholder="Số điện thoại (không bắt buộc — để được tư vấn thêm)" aria-label="Số điện thoại" />
        <label class="lead-consent"><input type="checkbox" name="consent" /> Tôi muốn nhận thêm bài viết, thực đơn và ưu đãi từ NOVA qua email/Zalo. Có thể ngừng bất cứ lúc nào.</label>
        <p class="lead-consent" style="font-size:12px;color:#667085">Khi bấm nhận, bạn đồng ý để NOVA (Công ty CP TMDV ACME) dùng email/số điện thoại để gửi cẩm nang này theo <a href="https://example.com/chinh-sach-bao-mat.html" target="_blank" rel="noopener">Chính sách dữ liệu</a>.</p>
        <input type="hidden" name="dongY_vanBan" value="[x] Khi bấm nhận, bạn đồng ý để NOVA (Công ty CP TMDV ACME) dùng email/số điện thoại để gửi cẩm nang này theo Chính sách dữ liệu. | [tick nếu chọn] Tôi muốn nhận thêm bài viết, thực đơn và ưu đãi từ NOVA qua email/Zalo. Có thể ngừng bất cứ lúc nào." />
        <input type="hidden" name="dongY_phienBan" value="v1-2026-09-04" />
      </form>
    </div>
  </section>

        <section class="brand-box" aria-label="Sản phẩm và công cụ NOVA">
          <h2>Sản phẩm &amp; công cụ NOVA</h2>
          <ul>
            <li><a href="../app.html">App NOVA</a> — AI Coach Đông y cá nhân hoá theo thể tạng, nhật ký sức khoẻ 30 giây mỗi ngày.</li>
            <li><a href="../hoc-vien.html">Học Viện NOVA</a> — khoá học chăm sóc sức khoẻ chủ động (3 Ngày Reset · 7 Ngày Detox).</li>
            <li><strong>Thực phẩm bổ sung NOVA:</strong> <a href="https://tra.example.com" target="_blank" rel="noopener noreferrer">Trà Mẫu A</a> · <a href="https://tra-b.example.com" target="_blank" rel="noopener noreferrer">Trà Mẫu B</a> · <a href="https://example.com" target="_blank" rel="noopener noreferrer">Đạm thực vật Đạm Mẫu Protein</a>.</li>
          </ul>
        </section>

        <section class="post-related" aria-label="Bài liên quan"><h2>Đọc thêm</h2><ul>${relatedHtml}</ul></section>

        <div class="post-disclaimer">
          Nội dung mang tính chia sẻ kiến thức chăm sóc sức khoẻ chủ động, không thay thế chẩn đoán hoặc tư vấn y khoa. Các sản phẩm NOVA gồm <strong>thực phẩm bổ sung</strong> và <strong>trà thảo mộc</strong>, không phải thuốc và không có tác dụng thay thế thuốc chữa bệnh. Khi có vấn đề sức khoẻ, hãy tham khảo ý kiến bác sĩ.
        </div>
      </div>
    </article>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand">NOVA</div>
          <p>Platform công nghệ wellness cho người Việt — kế thừa tri thức Y học Cổ truyền Việt Nam qua Tuệ Tĩnh và Hải Thượng Lãn Ông. Sản phẩm của Công ty Cổ phần ACME (MST 0100000000).</p>
        </div>
        <div>
          <h4>Hệ sinh thái</h4>
          <ul>
            <li><a href="../hoc-vien.html">Học Viện NOVA</a></li>
            <li><a href="index.html">Blog NOVA</a></li>
            <li><a href="../cong-dong.html">Cộng đồng NOVA</a></li>
            <li><a href="../app.html">Ứng dụng NOVA</a></li>
            <li><a href="../ve-acme.html">Về ACME Corp</a></li>
          </ul>
        </div>
        <div>
          <h4>Hỗ trợ</h4>
          <ul>
            <li><a href="../cong-nghe.html">Công nghệ NOVA</a></li>
            <li><a href="../chinh-sach-bao-mat.html">Chính sách bảo mật</a></li>
            <li><a href="mailto:contact@example.com">Liên hệ</a></li>
          </ul>
        </div>
        <div>
          <h4>Đối tác</h4>
          <ul>
            <li><a href="https://partner.example.com/" target="_blank" rel="noopener noreferrer">Đối tác mẫu</a></li>
          </ul>
        </div>
        <div>
          <h4>Liên hệ</h4>
          <ul class="contact-list">
            <li class="contact-item"><span class="contact-label">Email</span><a href="mailto:contact@example.com">contact@example.com</a></li>
            <li class="contact-item"><span class="contact-label">Tư vấn</span><a href="tel:0900000001">0900.000.001</a></li>
            <li class="contact-item"><span class="contact-label">Trụ sở</span>Số 1 Đường Mẫu, Phường Mẫu, Thành phố Mẫu</li>
          </ul>
        </div>
      </div>
      <div class="global-disclaimer">
        <p>Các sản phẩm gồm <strong style="color:rgba(255,255,255,0.78);">thực phẩm bổ sung</strong> và <strong style="color:rgba(255,255,255,0.78);">trà thảo mộc</strong>, không phải thuốc và không có tác dụng thay thế thuốc chữa bệnh. Kết quả có thể khác nhau tuỳ cơ địa.</p>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Công ty Cổ phần ACME — NOVA là thương hiệu được sở hữu và vận hành bởi ACME Corp.</span> <a href="mien-tru-trach-nhiem.html" style="color:rgba(255,255,255,0.7);text-decoration:underline">Miễn trừ trách nhiệm</a>
      </div>
    </div>
  </footer>
<script>(function(){var T='https://ops-hub.example.com/api/track';function lid(){try{var u=new URLSearchParams(location.search).get('lid');if(u){sessionStorage.setItem('nova_lid',u);return u;}return sessionStorage.getItem('nova_lid')||'';}catch(e){return '';}}function b(e,m){var id=lid();if(!id)return;var i=new Image();i.src=T+'?lid='+encodeURIComponent(id)+'&e='+e+(m?'&m='+encodeURIComponent(m):'')+'&_='+Date.now();}var s=location.pathname.split('/').pop().replace(/\\.html$/,'')||'index';if(lid())b('read',s);document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';if(/\\.pdf($|\\?)/i.test(h))b('download',(h.split('/').pop()||'pdf').slice(0,60));else if(/example|example\\.com\\/shop|tra\\.example|tra-b\\.example|app\\.html/.test(h))b('click',h.slice(0,80));},true);})();</script>
${taoPopup(chonSlugSanPham(post))}
</body>
</html>
`;
}

export function insertCard(hubHtml: string, post: BlogPost): string {
  const cat = CATEGORIES[post.categoryKey];
  const marker = '<div class="blog-grid">';
  const idx = hubHtml.indexOf(marker);
  if (idx < 0) throw new Error(`Hub không có .blog-grid (${cat.hub})`);
  const card =
    `<a class="blog-card" href="${post.slug}.html">` +
    `<div class="bc-img" style="background-image:url('../assets/blog/${post.slug}-hero.jpg')"></div>` +
    `<div class="bc-body"><span class="bc-cat">${escapeHtml(cat.label)}</span>` +
    `<h2 class="bc-title">${escapeHtml(post.title)}</h2>` +
    `<p class="bc-desc">${escapeHtml(post.description)}</p>` +
    `<span class="bc-meta">${post.readMinutes} phút đọc</span></div></a>`;
  const cut = idx + marker.length;
  return hubHtml.slice(0, cut) + card + hubHtml.slice(cut);
}

export function bumpSidebarCount(indexHtml: string, categoryKey: CategoryKey, add: number): string {
  const hubFile = CATEGORIES[categoryKey].hub.replace(/^blog\//, "");
  const re = new RegExp(`(<a href="${hubFile}">[^<]*</a><span>)(\\d+)(</span>)`);
  const m = indexHtml.match(re);
  if (!m) throw new Error(`Không thấy số đếm sidebar cho ${hubFile}`);
  return indexHtml.replace(re, `$1${Number(m[2]) + add}$3`);
}

export function addToSitemap(sitemapXml: string, slug: string): string {
  const entry = `  <url><loc>${SITE}/blog/${slug}.html</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
  const close = "</urlset>";
  const idx = sitemapXml.lastIndexOf(close);
  if (idx < 0) throw new Error("sitemap.xml không có </urlset>");
  return sitemapXml.slice(0, idx) + entry + sitemapXml.slice(idx);
}
