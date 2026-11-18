export function ganUtm(url: string, nhan: { source: string; medium: string; campaign?: string; content?: string }): string {
  try {
    const u = new URL(url);
    if (!/(^|\.)example\.com$/i.test(u.hostname)) return url;
    if (u.searchParams.has("utm_source")) return url;
    u.searchParams.set("utm_source", nhan.source);
    u.searchParams.set("utm_medium", nhan.medium);
    if (nhan.campaign) u.searchParams.set("utm_campaign", nhan.campaign);
    if (nhan.content) u.searchParams.set("utm_content", nhan.content);
    return u.toString();
  } catch { return url; }
}
