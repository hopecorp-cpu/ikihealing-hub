import { getConfigValue, setConfigValue } from "@/lib/app-config";

export type DealerCommit = {
  san_pham: string;
  han: string;
  moc_giua?: string;
  da_lay: number;
  can_lay: number;
};

export type Dealer = {
  ma: string;
  ho_ten: string;
  cccd?: string;
  dia_chi?: string;
  dien_thoai?: string;
  dien_thoai_khac?: string[];
  bac: string;
  chiet_khau: Record<string, number>;
  freeship_tu?: string;
  hop_dong_so?: string;
  ngay_ky?: string;
  cam_ket?: DealerCommit;
  ghi_chu?: string;
  createdAt?: string;
};

const KEY = "dealers";

export async function getDealers(): Promise<Dealer[]> {
  try {
    const raw = await getConfigValue(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : j.dealers || [];
    }
  } catch { }
  return [];
}

export async function saveDealers(list: Dealer[], by?: string): Promise<void> {
  await setConfigValue(KEY, JSON.stringify({ dealers: list, updatedBy: by || "" }), "Sổ đại lý");
}

export function sapToiHan(list: Dealer[], today: string, days = 15): Dealer[] {
  const moc = new Date(today).getTime() + days * 86400e3;
  return list.filter(d => {
    const c = d.cam_ket;
    if (!c || c.da_lay >= c.can_lay) return false;
    const h = new Date(c.han).getTime();
    return h >= new Date(today).getTime() && h <= moc;
  });
}
