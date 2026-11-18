import { getConfigValue, setConfigValue } from "./app-config";

export const SOCIAL_CONFIG_KEY = "social_tracking";

export type SocialChannel = { id: string; name: string; platform: string; handle?: string };
export type SocialSnapshot = {
  channelId: string;
  date: string;
  followers: number;
  reach: number;
  engagement: number;
  views: number;
};
export type SocialData = { channels: SocialChannel[]; snapshots: SocialSnapshot[] };

const DEFAULT_CHANNELS: SocialChannel[] = [
  { id: "fb-thanhtam", name: "Lan Sống Khoẻ Mỗi Ngày", platform: "Facebook" },
  { id: "fb-nova", name: "NOVA", platform: "Facebook" },
  { id: "fb-ndv", name: "NOVA Beauty & Wellness", platform: "Facebook" },
  { id: "fb-beplanhnova", name: "Bếp Lành NOVA", platform: "Facebook" },
];

export async function getSocialData(): Promise<SocialData> {
  const raw = await getConfigValue(SOCIAL_CONFIG_KEY);
  if (!raw) return { channels: DEFAULT_CHANNELS, snapshots: [] };
  try {
    const d = JSON.parse(raw);
    return {
      channels: Array.isArray(d.channels) && d.channels.length ? d.channels : DEFAULT_CHANNELS,
      snapshots: Array.isArray(d.snapshots) ? d.snapshots : [],
    };
  } catch {
    return { channels: DEFAULT_CHANNELS, snapshots: [] };
  }
}

export async function saveSocialData(data: SocialData): Promise<void> {
  await setConfigValue(SOCIAL_CONFIG_KEY, JSON.stringify(data), "Theo dõi truyền thông (MKT nhập tay)");
}

export function summarize(data: SocialData) {
  const dates = [...new Set(data.snapshots.map(s => s.date))].sort();

  const byDate = dates.map(date => {
    const rows = data.snapshots.filter(s => s.date === date);
    const followers = rows.reduce((a, s) => a + (s.followers || 0), 0);
    const reach = rows.reduce((a, s) => a + (s.reach || 0), 0);
    const engagement = rows.reduce((a, s) => a + (s.engagement || 0), 0);
    const views = rows.reduce((a, s) => a + (s.views || 0), 0);
    return { date, followers, reach, engagement, views, er: reach > 0 ? (engagement / reach) * 100 : 0 };
  });
  const latest = byDate[byDate.length - 1] || null;
  const prev = byDate[byDate.length - 2] || null;
  return { dates, byDate, latest, prev };
}
