import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";

export const sdtChuan = (p: any) => String(p || "").replace(/\D/g, "").replace(/^84/, "0");

export type BanDoCham = Map<string, { at: string; nguon: string }>;

const NGUON_VN: Record<string, string> = {
  zalo: "sale đã nhắn trên Zalo",
  salework: "hội thoại Salework",
  care: "nhật ký chăm sóc",
  don: "đã mua hàng",
  jt: "đã gửi hàng",
};

export const tenNguon = (k: string) => NGUON_VN[k] || k;

export async function layDauVetCham(sb: any, soNgay = 90): Promise<{ ban: BanDoCham; thieuNguon: string[] }> {
  const ban: BanDoCham = new Map();
  const thieuNguon: string[] = [];
  const cut = new Date(Date.now() - soNgay * 864e5).toISOString();
  const cutNgay = cut.slice(0, 10);

  const ghi = (p: any, at: any, nguon: string) => {
    const k = sdtChuan(p);
    if (k.length < 9) return;
    const t = String(at || "");
    if (!t) return;
    const cu = ban.get(k);
    if (!cu || t > cu.at) ban.set(k, { at: t, nguon });
  };

  const quet = async (bang: string, cotSdt: string, cotAt: string, nguon: string, loc?: (q: any) => any) => {
    try {
      for (let f = 0; f < 60000; f += 1000) {
        let q = sb.from(bang).select(`${cotSdt}, ${cotAt}`).range(f, f + 999);
        if (loc) q = loc(q);
        const { data, error } = await q;
        if (error) { thieuNguon.push(`${bang}: ${error.message.slice(0, 60)}`); return; }
        if (!data?.length) return;
        for (const r of data) ghi((r as any)[cotSdt], (r as any)[cotAt], nguon);
        if (data.length < 1000) return;
      }
    } catch (e: any) { thieuNguon.push(`${bang}: ${String(e?.message || e).slice(0, 60)}`); }
  };

  await Promise.all([

    quet("zalo_bridge_contacts", "phone_norm", "last_out_at", "zalo", (q) => q.not("last_out_at", "is", null).gte("last_out_at", cut)),
    quet("salework_contacts", "phone", "last_contact", "salework"),
    quet("care_events", "customer_phone", "created_at", "care", (q) => q.gte("created_at", cut)),
    quet("jt_waybills", "receiver_phone", "order_create_time", "jt", (q) => q.gte("order_create_time", cutNgay)),
    layDoanhThuNhieuThang(sb, cutNgay, new Date().toISOString().slice(0, 10))
      .then((k) => { for (const r of k.rows) ghi(r.customer_phone, r.order_date, "don"); })
      .catch((e) => thieuNguon.push(`đơn hàng: ${String(e?.message || e).slice(0, 60)}`)),
  ]);

  return { ban, thieuNguon };
}

export function lanChamCuoi(ban: BanDoCham, sdt: any): { at: string; nguon: string } | null {
  const k = sdtChuan(sdt);
  return k.length >= 9 ? ban.get(k) || null : null;
}
