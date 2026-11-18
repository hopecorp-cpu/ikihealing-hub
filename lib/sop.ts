import { getConfigValue, setConfigValue } from "@/lib/app-config";
import template from "@/data/sop-template.json";

export type SopItem = { key: string; title: string; dept: string; icon: string; purpose: string; steps: string[]; link?: string; published?: boolean; custom?: boolean };
const TPL = template as unknown as { intro: string; items: SopItem[] };
export const SOP_INTRO = TPL.intro;
const CONFIG_KEY = "sop_library";

type Overrides = { obj: Record<string, Partial<SopItem> & { deleted?: boolean }>; custom: SopItem[]; updatedAt?: string; updatedBy?: string };

async function loadOverrides(): Promise<Overrides> {
  try { const d = JSON.parse((await getConfigValue(CONFIG_KEY)) || "{}"); return { obj: d.obj || {}, custom: d.custom || [], updatedAt: d.updatedAt, updatedBy: d.updatedBy }; }
  catch { return { obj: {}, custom: [] }; }
}

export async function getSopLibrary(): Promise<{ items: SopItem[]; updatedAt?: string }> {
  const ov = await loadOverrides();
  const base = TPL.items
    .filter((it) => !ov.obj[it.key]?.deleted)
    .map((it) => ({ ...it, published: it.published !== false, ...ov.obj[it.key] } as SopItem));
  const custom = (ov.custom || []).map((it) => ({ ...it, custom: true, published: it.published !== false }));
  return { items: [...base, ...custom], updatedAt: ov.updatedAt };
}

export async function countPublishedSops(): Promise<number> {
  const { items } = await getSopLibrary();
  return items.filter((it) => it.published !== false).length;
}

export async function saveSop(item: SopItem, by?: string): Promise<void> {
  const ov = await loadOverrides();
  const isTpl = TPL.items.some((t) => t.key === item.key);
  if (isTpl) {
    ov.obj[item.key] = { title: item.title, dept: item.dept, icon: item.icon, purpose: item.purpose, steps: item.steps, link: item.link, published: item.published };
  } else {
    const i = (ov.custom || []).findIndex((c) => c.key === item.key);
    if (i >= 0) ov.custom[i] = { ...item, custom: true }; else ov.custom.push({ ...item, custom: true });
  }
  await setConfigValue(CONFIG_KEY, JSON.stringify({ ...ov, updatedAt: new Date().toISOString(), updatedBy: by || "" }), "Thư viện quy trình SOP");
}

export async function deleteSop(key: string, by?: string): Promise<void> {
  const ov = await loadOverrides();
  const isTpl = TPL.items.some((t) => t.key === key);
  if (isTpl) ov.obj[key] = { ...(ov.obj[key] || {}), deleted: true };
  else ov.custom = (ov.custom || []).filter((c) => c.key !== key);
  await setConfigValue(CONFIG_KEY, JSON.stringify({ ...ov, updatedAt: new Date().toISOString(), updatedBy: by || "" }), "Thư viện quy trình SOP");
}
