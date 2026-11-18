import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { listSlugs, getFile, commitBatch, type CommitFile } from "./github";
import { pickTopics, writeArticle, type Topic } from "./writer";
import { checkCompliance } from "./compliance";
import { fetchHeroCoNguon } from "./hero";
import {
  CATEGORIES,
  renderArticleHtml,
  insertCard,
  bumpSidebarCount,
  addToSitemap,
  type BlogPost,
  type CategoryKey,
} from "./site";
import { vnDateStr } from "@/lib/payroll";

export const SITE_BLOG = "https://example.com/blog/";

export const CHI_TIEU_NGAY = 4;

export function gioVN(): number {
  return new Date(Date.now() + 7 * 3600_000).getUTCHours();
}

export function chiTieuToiGio(gio = gioVN()): number {
  if (gio < 12) return 0;
  if (gio < 16) return 2;
  return CHI_TIEU_NGAY;
}

export type Skipped = { slug: string; reason: string };
export type KetQuaLuot = {
  ok: boolean;
  posted: string[];
  skipped: Skipped[];
  titles: Array<{ slug: string; title: string; cat: string; anh?: string }>;
  commit?: string;
  error?: string;
};

type SoNgay = { ngay: string; dang: number; slugs: string[] };

export async function demBaiHomNay(): Promise<SoNgay> {
  const ngay = vnDateStr();
  try {
    const raw = await getConfigValue("blog_writer_ngay");
    const j = raw ? (JSON.parse(raw) as SoNgay) : null;
    if (j && j.ngay === ngay) {
      return { ngay, dang: Number(j.dang) || 0, slugs: Array.isArray(j.slugs) ? j.slugs : [] };
    }
  } catch {  }
  return { ngay, dang: 0, slugs: [] };
}

async function congBaiHomNay(slugs: string[]): Promise<void> {
  if (!slugs.length) return;
  const so = await demBaiHomNay();
  const moi: SoNgay = {
    ngay: so.ngay,
    dang: so.dang + slugs.length,
    slugs: [...so.slugs, ...slugs].slice(-20),
  };
  await setConfigValue("blog_writer_ngay", JSON.stringify(moi), "Sổ đếm bài blog đã đăng trong ngày");
}

type VetHong = { count: number; lastAt: string; reason: string };
type SoHong = Record<string, VetHong>;

export const HET_GIO = "hết giờ của lượt chạy, để dành cho lượt sau";

const NGUONG_PHAT = 2;

const HAN_PHAT_MS = 3 * 24 * 3600_000;

async function docSoHong(): Promise<SoHong> {
  try {
    const raw = await getConfigValue("blog_slug_hong");
    const j = raw ? (JSON.parse(raw) as SoHong) : null;
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

export function slugDangPhat(so: SoHong, now = Date.now()): Set<string> {
  const ra = new Set<string>();
  for (const [slug, v] of Object.entries(so || {})) {
    const at = Date.parse(v?.lastAt || "");
    if ((v?.count || 0) >= NGUONG_PHAT && at && now - at < HAN_PHAT_MS) ra.add(slug);
  }
  return ra;
}

export function capNhatSoHong(
  so: SoHong,
  hong: Array<{ slug: string; reason: string }>,
  xong: string[],
  now = Date.now()
): SoHong {
  const moi: SoHong = { ...(so || {}) };
  for (const slug of xong) delete moi[slug];
  for (const { slug, reason } of hong) {
    const cu = moi[slug];
    const at = cu ? Date.parse(cu.lastAt || "") : 0;

    const count = cu && at && now - at < HAN_PHAT_MS ? (cu.count || 0) + 1 : 1;
    moi[slug] = { count, lastAt: new Date(now).toISOString(), reason: String(reason).slice(0, 200) };
  }
  return moi;
}

async function ghiSoHong(so: SoHong, skipped: Skipped[], xong: string[]): Promise<void> {
  try {
    const hong = skipped.filter((s) => s.reason !== HET_GIO).map((s) => ({ slug: s.slug, reason: s.reason }));
    if (!hong.length && !xong.length) return;
    const moi = capNhatSoHong(so, hong, xong);
    await setConfigValue("blog_slug_hong", JSON.stringify(moi), "Sổ slug blog viết hỏng (để không chặn hàng đợi)");
  } catch {  }
}

export async function chayMotLuot(soBai: number, hanChotAt: number): Promise<KetQuaLuot> {
  const posted: string[] = [];
  const skipped: Skipped[] = [];
  const titles: KetQuaLuot["titles"] = [];

  try {
    const existingSlugs = await listSlugs();
    const soHong = await docSoHong();
    const topics = await pickTopics(existingSlugs, soBai, hanChotAt, slugDangPhat(soHong));
    const today = vnDateStr();

    const ready: Array<{ post: BlogPost; hero: Buffer; nguonAnh: string }> = [];
    for (const topic of topics) {

      if (hanChotAt - Date.now() < 120_000) {
        skipped.push({ slug: topic.slug, reason: HET_GIO });
        continue;
      }
      try {
        const { post, hero, nguonAnh } = await producePost(topic, existingSlugs, today, hanChotAt);
        ready.push({ post, hero, nguonAnh });
      } catch (e) {
        skipped.push({ slug: topic.slug, reason: String(e instanceof Error ? e.message : e) });
      }
    }

    await ghiSoHong(soHong, skipped, ready.map((r) => r.post.slug));

    if (!ready.length) {
      return {
        ok: false,
        posted,
        skipped,
        titles,
        error: skipped.map((s) => `${s.slug}: ${s.reason}`).join(" · ") || "không viết được bài nào",
      };
    }

    const files: CommitFile[] = [];
    for (const { post, hero } of ready) {
      files.push({ path: `blog/${post.slug}.html`, content: renderArticleHtml(post) });
      files.push({
        path: `assets/blog/${post.slug}-hero.jpg`,
        content: hero.toString("base64"),
        isBase64: true,
      });
    }

    const byCategory = new Map<CategoryKey, BlogPost[]>();
    for (const { post } of ready) {
      const list = byCategory.get(post.categoryKey) || [];
      list.push(post);
      byCategory.set(post.categoryKey, list);
    }
    for (const [key, posts] of Array.from(byCategory.entries())) {
      let hubHtml = await getFile(CATEGORIES[key].hub);
      for (const post of posts) hubHtml = insertCard(hubHtml, post);
      files.push({ path: CATEGORIES[key].hub, content: hubHtml });
    }

    let indexHtml = await getFile("blog/index.html");
    for (const [key, posts] of Array.from(byCategory.entries())) {
      indexHtml = bumpSidebarCount(indexHtml, key, posts.length);
    }
    files.push({ path: "blog/index.html", content: indexHtml });

    let sitemap = await getFile("sitemap.xml");
    for (const { post } of ready) sitemap = addToSitemap(sitemap, post.slug);
    files.push({ path: "sitemap.xml", content: sitemap });

    const slugs = ready.map((r) => r.post.slug);
    const sha = await commitBatch(files, `blog: ${slugs.join(", ")} (máy viết blog tự động)`);
    posted.push(...slugs);
    titles.push(
      ...ready.map((r) => ({
        slug: r.post.slug,
        title: r.post.title,
        cat: CATEGORIES[r.post.categoryKey].label,
        anh: r.nguonAnh,
      }))
    );

    await congBaiHomNay(slugs);

    return { ok: true, posted, skipped, titles, commit: sha };
  } catch (e) {
    return {
      ok: false,
      posted,
      skipped,
      titles,
      error: String(e instanceof Error ? e.message : e),
    };
  }
}

async function producePost(
  topic: Topic,
  existingSlugs: string[],
  today: string,
  hanChotAt: number
): Promise<{ post: BlogPost; hero: Buffer; nguonAnh: string }> {
  let draft = await writeArticle(topic, existingSlugs, undefined, hanChotAt);
  let gate = gateDraftProse(draft.title, draft.description, draft.answerBox, draft.bodyHtml, draft.faq, draft.lamNgay);
  if (!gate.ok) {
    draft = await writeArticle(topic, existingSlugs, gate.hits.join(", "), hanChotAt);
    gate = gateDraftProse(draft.title, draft.description, draft.answerBox, draft.bodyHtml, draft.faq, draft.lamNgay);
    if (!gate.ok) {
      throw new Error(`dính từ cấm sau khi viết lại: ${gate.hits.join(", ")}`);
    }
  }

  const { buf: hero, nguon: nguonAnh } = await fetchHeroCoNguon(
    draft.heroPrompt || `${topic.title} healthy Vietnamese lifestyle photo`
  );
  const post: BlogPost = {
    slug: topic.slug,
    title: draft.title,
    description: draft.description,
    categoryKey: topic.categoryKey,
    answerBox: draft.answerBox,
    lamNgay: draft.lamNgay,
    bodyHtml: draft.bodyHtml,
    faq: draft.faq,
    related: draft.related,
    heroAlt: draft.heroAlt || draft.title,
    readMinutes: draft.readMinutes,
    date: today,
  };
  return { post, hero, nguonAnh };
}

function gateDraftProse(
  title: string,
  description: string,
  answerBox: string,
  bodyHtml: string,
  faq: Array<{ q: string; a: string }>,
  lamNgay?: string[]
): { ok: boolean; hits: string[] } {

  const all = [title, description, answerBox, bodyHtml, ...(lamNgay || []), ...faq.map((f) => `${f.q} ${f.a}`)].join("\n");
  const r = checkCompliance(all);
  return { ok: r.ok, hits: r.hits };
}
