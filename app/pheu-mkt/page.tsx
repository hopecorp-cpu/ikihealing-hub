import { getT } from "@/lib/i18n-server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { tinhPheuMkt, thangMacDinh, KENH_KHONG_RO, KENH_KHACH_CU, KENH_KHONG_SDT, type DongKenh } from "@/lib/pheu-mkt-server";
import { PageHeader, SectionCard, StatCard } from "@/components/ui/kit";
import { layBamChat } from "@/lib/bam-chat";
import { Gauge, AlertTriangle, Wallet, Users, ShoppingBag, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Phễu MKT | ACME Ops Hub") };
}

const vnd = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("vi-VN") + "đ");
const tr = (v: number) => (Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tr" : vnd(v));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) + "%" : "—");
const chia = (a: number | null, b: number) => (a == null || b <= 0 ? null : a / b);

function thangLui(thang: string, n: number): string {
  const d = new Date(Date.UTC(+thang.slice(0, 4), +thang.slice(5, 7) - 1 - n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function PheuMktPage({ searchParams }: { searchParams: { thang?: string } }) {
  const { t: tDich } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const xem = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role) || isMktPosition(user.position);
  if (!xem) redirect("/");

  const thangNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
  const cacHien = [0, 1, 2, 3].map((n) => thangLui(thangNay, n));
  const thang = /^\d{4}-\d{2}$/.test(searchParams.thang || "") && searchParams.thang! >= "2025-01" && searchParams.thang! <= thangNay
    ? searchParams.thang! : thangMacDinh();
  const [p, bam] = await Promise.all([tinhPheuMkt(thang), layBamChat(`${thang}-01`, `${thang}-31`)]);
  const t = p.tong;

  const cacTong = chia(p.chi.tong, t.khachMoi);
  const roas = chia(t.dt, p.chi.tong || 0);
  const roasMoi = chia(t.dtMoi, p.chi.tong || 0);
  const coSo = (k: DongKenh) => k.kenh !== KENH_KHACH_CU && k.kenh !== KENH_KHONG_SDT;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <PageHeader icon={Gauge} title={tDich("Phễu MKT — tiền vào kênh nào ra bao nhiêu")}
        subtitle={`${tDich("Kỳ")} ${p.tu} → ${p.den} · ${tDich("chi QC → lead → đơn → doanh thu, tách khách mới / cũ")}`}
        actions={
          <div className="flex gap-1.5 text-sm">
            {cacHien.map((m) => (
              <a key={m} href={`/pheu-mkt?thang=${m}`}
                className={`px-3 py-1.5 rounded-lg border ${m === thang ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200"}`}>
                {tDich("T")}{m.slice(5)}/{m.slice(2, 4)}
              </a>
            ))}
          </div>
        } />

      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex gap-3 items-start">
        <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
        <div className="text-red-900">
          <div className="text-lg font-bold">
            {tDich("Đơn khách mới KHÔNG RÕ NGUỒN:")} {t.donMoiKhongRo}/{t.donMoi} {tDich("đơn")} ({pct(t.donMoiKhongRo, t.donMoi)}) · {tr(t.dtMoiKhongRo)}
          </div>
          <div className="text-[13.5px] mt-1">
            {tDich("Không có dòng \"Nguồn:\" trong tin đơn và SĐT không khớp lead nào trong 90 ngày trước đơn. Cách bịt: sale ghi thêm một dòng")}{" "}
            <b>Nguồn: fb | zalo | web | khach-cu | gioi-thieu | san | khac</b> {tDich("vào tin đơn Telegram — máy bóc đơn tự đọc.")}
            {" "}{tDich("Tháng này")} <b>{t.donCoNguonSaleGhi}/{t.don}</b> {tDich("đơn có dòng Nguồn.")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={tDich("Chi quảng cáo")} value={tr(p.chi.tong)} icon={Wallet} color="#2563EB"
          hint={`Meta ${p.chi.meta == null ? tDich("chưa có số") : tr(p.chi.meta)} · Google ${tr(p.chi.google)}${p.chi.googleNgayThieu ? ` (${tDich("thiếu")} ${p.chi.googleNgayThieu} ${tDich("ngày")})` : ""}`} />
        <StatCard label={tDich("Lead")} value={t.lead} icon={Users} color="#7C3AED"
          hint={`${t.lead - t.leadDoan} ${tDich("đo được")} · ${t.leadDoan} ${tDich("đoán")} · ${t.leadCoDon} ${tDich("đã ra đơn")} (${pct(t.leadCoDon, t.leadCoSdt)} ${tDich("lead có SĐT")})`} />
        <StatCard label={tDich("Đơn · doanh thu net")} value={`${t.don} · ${tr(t.dt)}`} icon={ShoppingBag} color="#059669"
          hint={`${tDich("khách cũ")} ${t.donCu} ${tDich("đơn")} (${pct(t.donCu, t.don)}) · ${tDich("không SĐT")} ${t.donKhongSdt}`} />
        <StatCard label={tDich("Khách mới")} value={`${t.khachMoi} · ${tr(t.dtMoi)}`} icon={UserPlus} color="#DC2626"
          hint={`CAC ${vnd(cacTong)} · ROAS ${roas == null ? "—" : roas.toFixed(1) + "x"} (${tDich("khách mới")} ${roasMoi == null ? "—" : roasMoi.toFixed(1) + "x"})`} />
      </div>

      <SectionCard title={tDich("Theo kênh")} desc={tDich("Chi → lead → đơn khách mới. Khách cũ mua lại tách riêng, không tính vào kênh nào.")}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 px-3">{tDich("Kênh")}</th>
                <th className="py-2 px-3 text-right">{tDich("Chi QC")}</th>
                <th className="py-2 px-3 text-right">{tDich("Lead")}</th>
                <th className="py-2 px-3 text-right">CPL</th>
                <th className="py-2 px-3 text-right">{tDich("Lead → đơn")}</th>
                <th className="py-2 px-3 text-right">{tDich("Đơn khách mới")}</th>
                <th className="py-2 px-3 text-right">{tDich("Khách mới")}</th>
                <th className="py-2 px-3 text-right">{tDich("DT khách mới")}</th>
                <th className="py-2 px-3 text-right">CAC</th>
                <th className="py-2 px-3 text-right">ROAS</th>
                <th className="py-2 px-3">{tDich("Quy bằng")}</th>
              </tr>
            </thead>
            <tbody>
              {p.kenh.map((k) => {
                const noi = k.kenh === KENH_KHONG_RO;
                const quy = k.kenh === KENH_KHACH_CU ? tDich("SĐT đã mua trước kỳ")
                  : k.kenh === KENH_KHONG_SDT ? tDich("không xếp được mới/cũ")
                  : noi ? tDich("không có gì để quy")
                  : [k.donSaleGhi ? `${k.donSaleGhi} ${tDich("sale ghi")}` : "", k.donKhopLead ? `${k.donKhopLead} ${tDich("khớp SĐT lead")}${k.donKhopLeadDoan ? ` (${k.donKhopLeadDoan} ${tDich("lead đoán")})` : ""}` : ""].filter(Boolean).join(" · ") || "—";
                return (
                  <tr key={k.kenh} className={`border-b last:border-0 ${noi ? "bg-red-50 font-bold text-red-800" : ""}`}>
                    <td className="py-2 px-3">{tDich(k.kenh)}</td>
                    <td className="py-2 px-3 text-right">{k.chi == null ? "—" : vnd(k.chi)}</td>
                    <td className="py-2 px-3 text-right">{coSo(k) ? <>{k.lead}{k.leadDoan ? <span className="text-gray-400 font-normal"> ({k.leadDoan} {tDich("đoán")})</span> : null}</> : "—"}</td>
                    <td className="py-2 px-3 text-right">{k.lead && k.chi != null ? vnd(k.chi / k.lead) : "—"}</td>
                    <td className="py-2 px-3 text-right">{k.lead ? `${k.leadCoDon}/${k.lead} (${pct(k.leadCoDon, k.lead)})` : "—"}</td>
                    <td className="py-2 px-3 text-right">{k.kenh === KENH_KHACH_CU ? `${k.donCu} ${tDich("đơn cũ")}` : k.kenh === KENH_KHONG_SDT ? `${k.donKhongSdt}` : k.donMoi}</td>
                    <td className="py-2 px-3 text-right">{coSo(k) ? k.khachMoi : "—"}</td>
                    <td className="py-2 px-3 text-right">{k.kenh === KENH_KHACH_CU ? tr(k.dtCu) : k.kenh === KENH_KHONG_SDT ? tr(k.dtKhongSdt) : tr(k.dtMoi)}</td>
                    <td className="py-2 px-3 text-right">{k.chi != null && k.khachMoi ? vnd(k.chi / k.khachMoi) : k.chi ? tDich("0 khách") : "—"}</td>
                    <td className="py-2 px-3 text-right">{k.chi ? (k.dtMoi / k.chi).toFixed(1) + "x" : "—"}</td>
                    <td className="py-2 px-3 text-gray-500 font-normal">{quy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title={tDich("Lead theo cửa")} desc={tDich("Chỗ khách để lại thông tin (cùng cách xếp với /nguon-lead).")}>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 px-3">{tDich("Cửa")}</th><th className="py-2 px-3 text-right">{tDich("Lead")}</th><th className="py-2 px-3 text-right">{tDich("Đã ra đơn")}</th></tr></thead>
            <tbody>
              {p.cua.map((c) => (
                <tr key={c.cua} className="border-b last:border-0">
                  <td className="py-2 px-3">{tDich(c.cua)}</td><td className="py-2 px-3 text-right">{c.lead}</td>
                  <td className="py-2 px-3 text-right">{c.leadCoDon} ({pct(c.leadCoDon, c.lead)})</td>
                </tr>
              ))}
              {!p.cua.length && <tr><td className="py-2 px-3 text-gray-500" colSpan={3}>{tDich("Không có lead trong kỳ.")}</td></tr>}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title={tDich("Đơn khách mới quy về kênh bằng cách nào")} desc={tDich("Càng nhiều \"sale ghi\" / \"lead đo được\" thì số càng thật.")}>
          <table className="w-full text-[13px]">
            <tbody>
              {([
                ["sale-ghi", "Sale ghi dòng Nguồn trong tin đơn (đo thật)"],
                ["lead-do", "Khớp SĐT lead có nhãn nguồn (suy luận, nhãn đo thật)"],
                ["lead-doan", "Khớp SĐT lead mà kênh lead là ĐOÁN (suy luận hai lớp)"],
                ["khong-ro", "Không rõ nguồn"],
              ] as const).map(([k, ten]) => (
                <tr key={k} className={`border-b last:border-0 ${k === "khong-ro" ? "text-red-700 font-bold" : ""}`}>
                  <td className="py-2 px-3">{tDich(ten)}</td>
                  <td className="py-2 px-3 text-right">{t.theoCach[k]} ({pct(t.theoCach[k], t.donMoi)})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <SectionCard title={tDich("Theo ngày")} desc={tDich("Meta chỉ có số THÁNG — ngày để trống, trừ khi cả tháng chi 0đ. Google là số cào giao diện, ngày trống = sổ thiếu ngày đó.")}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 px-3">{tDich("Ngày")}</th><th className="py-2 px-3 text-right">{tDich("Chi Google")}</th>
                <th className="py-2 px-3 text-right">{tDich("Chi Meta")}</th><th className="py-2 px-3 text-right">{tDich("Lead")}</th>
                <th className="py-2 px-3 text-right">{tDich("Đơn")}</th><th className="py-2 px-3 text-right">{tDich("Đơn khách mới")}</th>
                <th className="py-2 px-3 text-right">{tDich("Mới không rõ nguồn")}</th><th className="py-2 px-3 text-right">{tDich("DT net")}</th>
              </tr>
            </thead>
            <tbody>
              {[...p.ngay].reverse().map((n) => (
                <tr key={n.ngay} className="border-b last:border-0">
                  <td className="py-1.5 px-3">{n.ngay.slice(8)}/{n.ngay.slice(5, 7)}</td>
                  <td className="py-1.5 px-3 text-right">{vnd(n.chiGoogle)}</td>
                  <td className="py-1.5 px-3 text-right">{vnd(n.chiMeta)}</td>
                  <td className="py-1.5 px-3 text-right">{n.lead}</td>
                  <td className="py-1.5 px-3 text-right">{n.don}</td>
                  <td className="py-1.5 px-3 text-right">{n.donMoi}</td>
                  <td className={`py-1.5 px-3 text-right ${n.donMoiKhongRo ? "text-red-700 font-bold" : ""}`}>{n.donMoiKhongRo}</td>
                  <td className="py-1.5 px-3 text-right">{tr(n.dt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title={tDich("Bấm Zalo / gọi trên web và sale page, theo kênh khách tới")}
        desc={tDich("Link Zalo không mang mã nguồn vào cuộc chat, nên đếm ngay lúc khách bấm (nguon.js nhớ khách tới từ đâu). Đây là số lượt bấm, chưa phải lead.")}>
        {!bam.coSo ? (
          <div className="text-[13px] text-gray-500">{tDich("Tháng này chưa có lượt bấm nào được ghi (bộ đếm bắt đầu từ 02/11/2026).")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="py-1.5 px-3">{tDich("Kênh")}</th>
                <th className="py-1.5 px-3 text-right">{tDich("Bấm Zalo")}</th>
                <th className="py-1.5 px-3 text-right">{tDich("Bấm gọi")}</th>
                <th className="py-1.5 px-3">{tDich("Trang")}</th>
              </tr></thead>
              <tbody>
                {bam.dong.map((d) => (
                  <tr key={d.kenh} className="border-b last:border-0">
                    <td className="py-1.5 px-3 font-medium">{d.kenh}</td>
                    <td className="py-1.5 px-3 text-right">{d.zalo}</td>
                    <td className="py-1.5 px-3 text-right">{d.goi}</td>
                    <td className="py-1.5 px-3 text-gray-500">{Object.entries(d.theoTrang).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ")}</td>
                  </tr>
                ))}
                <tr className="font-bold"><td className="py-1.5 px-3">{tDich("Tổng")}</td><td className="py-1.5 px-3 text-right">{bam.tong.zalo}</td><td className="py-1.5 px-3 text-right">{bam.tong.goi}</td><td /></tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title={tDich("Cách tính và chỗ ước tính")}>
        <ul className="text-[13px] text-gray-700 space-y-1.5 list-disc pl-5">
          <li>{tDich("Doanh thu = net đã trừ VAT, bán lẻ (đã tách đơn sỉ/đại lý), lấy qua cửa doanh thu duy nhất lib/doanh-thu.ts.")}</li>
          <li>{tDich("Khách mới = SĐT chưa có đơn nào trong sổ từ 01/2025 tới trước kỳ. Sale ghi \"Nguồn: khach-cu\" thì tính là khách cũ.")}</li>
          <li>{tDich("Quy đơn về kênh: dòng Nguồn sale ghi → nếu không có, lead gần nhất cùng SĐT trong 90 ngày trước đơn (SUY LUẬN, không phải đo nhấp chuột) → không có thì KHÔNG RÕ NGUỒN.")}</li>
          <li>{tDich("Lead \"đoán\" = kênh suy từ tên fanpage/nick Zalo, không có nhãn utm/mã nguồn. Lead → đơn tính trên lead có SĐT, đơn trong kỳ từ ngày lead trở đi.")}</li>
          <li>{tDich("CAC = chi QC ÷ khách mới; ROAS = doanh thu ÷ chi QC. Chi chỉ gồm Meta + Google (không gồm lương sale, quà, phí sàn).")}</li>
          <li>{tDich("Tính trong")} {p.giay}s.</li>
        </ul>
        {p.canhBao.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-[13px] text-amber-900 space-y-1">
            {p.canhBao.map((c, i) => <div key={i}>{c}</div>)}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
