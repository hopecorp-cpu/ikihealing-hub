import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { dungBaoCao, theoDoiDam, HANG_MUC, HM, type CheDoKy, type BaoCao, type DongKqkd, type DongTien } from "@/lib/bao-cao-tai-chinh";
import { ganHangMuc } from "./actions";
import { TriangleAlert, Info } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Báo cáo tài chính | ACME Ops Hub" };

const CHE: { key: CheDoKy; nhan: string }[] = [
  { key: "tuan", nhan: "Tuần" }, { key: "thang", nhan: "Tháng" }, { key: "quy", nhan: "Quý" }, { key: "nam", nhan: "Năm" },
];
const TAB = [
  { key: "tong-quan", nhan: "Tổng quan" }, { key: "kqkd", nhan: "Kết quả kinh doanh" },
  { key: "dong-tien", nhan: "Dòng tiền" }, { key: "dam", nhan: "Hàng đạm" },
];

const tr = (n: number) => (Math.abs(n) < 50_000 ? 0 : n / 1e6).toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—");
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const mau = (n: number) => (n < 0 ? "text-red-600" : "");

type SP = { ky?: string; tab?: string; chon?: string; muc?: string; nam?: string };

export default async function BaoCaoTaiChinhPage({ searchParams }: { searchParams: SP }) {
  const { t: tDich } = getT();
  const che = (CHE.find((c) => c.key === searchParams.ky)?.key || "thang") as CheDoKy;
  const tab = TAB.find((t) => t.key === searchParams.tab)?.key || "tong-quan";
  const homNay = vnDateStr();
  const nam = Math.min(Math.max(Number(searchParams.nam) || 2026, 2026), Number(homNay.slice(0, 4)));
  const sb = getServiceClient();
  const bc = await dungBaoCao(sb, che, nam, homNay);
  const dam = tab === "dam" ? await theoDoiDam(sb, nam, bc.giaoDich) : null;

  const link = (p: Partial<SP>) => {
    const q = new URLSearchParams();
    const all = { ky: che, tab, nam: String(nam), ...p } as Record<string, string | undefined>;
    for (const [k, v] of Object.entries(all)) if (v) q.set(k, v);
    return `/bao-cao-tai-chinh?${q.toString()}`;
  };

  const coSo = bc.dongTien.filter((d) => d.coSo);
  const chonKey = searchParams.chon && bc.kqkd.some((k) => k.ky.key === searchParams.chon)
    ? searchParams.chon : (coSo[coSo.length - 1] || bc.dongTien[bc.dongTien.length - 1])?.ky.key;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-4 bg-white">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{tDich("Báo cáo tài chính")} {nam}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {tDich("Số quản trị tự dựng từ sổ đơn, bảng lương, khoản vay và sổ phụ MB + TCB. Dùng để điều hành và soát lại báo cáo kế toán làm ra.")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {TAB.map((t) => (
            <Link key={t.key} href={link({ tab: t.key })}
              className={`px-3 py-1.5 text-sm ${t.key === tab ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"}`}>{tDich(t.nhan)}</Link>
          ))}
        </div>
        {tab !== "dam" && (
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            {CHE.map((c) => (
              <Link key={c.key} href={link({ ky: c.key, chon: undefined })}
                className={`px-3 py-1.5 text-sm ${c.key === che ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>{tDich(c.nhan)}</Link>
            ))}
          </div>
        )}
      </div>

      <CanhBao bc={bc} />

      {tab === "tong-quan" && <TongQuan bc={bc} chonKey={chonKey} link={link} />}
      {tab === "kqkd" && <BangKqkd bc={bc} />}
      {tab === "dong-tien" && <BangDongTien bc={bc} chonKey={chonKey} muc={tDich(searchParams.muc)} link={link} />}
      {tab === "dam" && dam && <HangDam d={dam} />}
    </div>
  );
}

function CanhBao({ bc }: { bc: BaoCao }) {
  const { t: tDich } = getT();
  const n = bc.nguon;
  return (
    <div className="space-y-2">
      {bc.canhBao.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <ul className="space-y-1 list-disc pl-4">{bc.canhBao.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {tDich("Nguồn: sổ phụ ngân hàng")} {n.nganHangTu ? `${dm(n.nganHangTu)}/${n.nganHangTu.slice(0, 4)}` : "—"} → {n.nganHangDen ? `${dm(n.nganHangDen)}/${n.nganHangDen.slice(0, 4)}` : "—"} {tDich("·\n          sổ đơn")} {n.soDonTu ? dm(n.soDonTu) : "—"} → {n.soDonDen ? dm(n.soDonDen) : "—"} {tDich("·\n          bảng lương tới")} {n.luongToi ? `T${n.luongToi.slice(5)}` : "—"} {tDich("·\n          giá vốn trung bình")} {pct(n.tyLeGvChung)} {tDich("doanh thu. Đơn vị: triệu đồng, doanh thu đã trừ VAT.")}
        </span>
      </div>
    </div>
  );
}

function The({ nhan, so, phu, am }: { nhan: string; so: string; phu?: string; am?: boolean }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{nhan}</div>
      <div className={`text-lg font-semibold tabular-nums ${am ? "text-red-600" : "text-gray-900"}`}>{so}</div>
      {phu && <div className="text-xs text-gray-500 mt-0.5">{phu}</div>}
    </div>
  );
}

function tong(rows: DongKqkd[]) {
  const s = (f: (r: DongKqkd) => number) => rows.reduce((a, r) => a + f(r), 0);
  return { doanhThu: s((r) => r.doanhThu), giaVon: s((r) => r.giaVon), laiGop: s((r) => r.laiGop), luong: s((r) => r.luong),
    tongChiPhi: s((r) => r.tongChiPhi), laiVay: s((r) => r.laiVay), loiNhuan: s((r) => (r.luongThieu ? 0 : r.loiNhuan)), doanhThuUoc: s((r) => r.doanhThuUoc) };
}

function TongQuan({ bc, chonKey, link }: { bc: BaoCao; chonKey?: string; link: (p: Partial<SP>) => string }) {
  const { t: tDich } = getT();
  const k = bc.kqkd.find((r) => r.ky.key === chonKey);
  const t = bc.dongTien.find((r) => r.ky.key === chonKey);
  const T = tong(bc.kqkd);
  const cuoi = [...bc.dongTien].reverse().find((d) => d.soDuCuoi != null);
  return (
    <div className="space-y-4">
      {k && t && (
        <>
          <div className="text-sm font-semibold text-gray-800">{tDich("Kỳ")} {tDich(k.ky.nhan)} <span className="font-normal text-gray-500">({dm(k.ky.tu)} – {dm(k.ky.den)})</span></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <The nhan={tDich("Doanh thu thuần")} so={tr(k.doanhThu)} phu={k.doanhThuUoc > 0 ? `trong đó ước ${tr(k.doanhThuUoc)}` : undefined} />
            <The nhan={tDich("Lãi gộp")} so={tr(k.laiGop)} phu={`biên ${pct(k.doanhThu ? k.laiGop / k.doanhThu : NaN)}`} />
            <The nhan={tDich("Lợi nhuận trước thuế")} so={tr(k.loiNhuan)} am={k.loiNhuan < 0} phu={k.luongThieu ? tDich("chưa đủ bảng lương kỳ này") : undefined} />
            <The nhan={tDich("Dòng tiền kinh doanh ròng")} so={t.coSo ? tr(t.thuKd - t.chiKd) : tDich("chưa có sổ phụ")} am={t.coSo && t.thuKd - t.chiKd < 0}
              phu={t.soDuCuoi != null ? `số dư cuối kỳ ${tr(t.soDuCuoi)}` : undefined} />
          </div>
        </>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <The nhan={`Doanh thu thuần ${bc.nam} tới nay`} so={tr(T.doanhThu)} phu={T.doanhThuUoc > 0 ? `trong đó ước ${tr(T.doanhThuUoc)}` : undefined} />
        <The nhan={tDich("Lãi gộp luỹ kế")} so={tr(T.laiGop)} phu={`biên ${pct(T.doanhThu ? T.laiGop / T.doanhThu : NaN)}`} />
        <The nhan={tDich("Lợi nhuận luỹ kế (kỳ đủ bảng lương)")} so={tr(T.loiNhuan)} am={T.loiNhuan < 0} />
        <The nhan={tDich("Số dư tài khoản")} so={cuoi?.soDuCuoi != null ? tr(cuoi.soDuCuoi) : "—"} phu={cuoi ? `cuối kỳ ${tDich(cuoi.ky.nhan)}` : undefined} />
      </div>

      <div className="rounded-md border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2 sticky left-0 bg-gray-50">{tDich("Kỳ")}</th>
              <th className="text-right px-3 py-2">Doanh thu</th><th className="text-right px-3 py-2">{tDich("Lãi gộp")}</th>
              <th className="text-right px-3 py-2">{tDich("Biên")}</th><th className="text-right px-3 py-2">{tDich("Lương")}</th>
              <th className="text-right px-3 py-2">{tDich("Chi phí khác")}</th><th className="text-right px-3 py-2">{tDich("Lãi vay")}</th>
              <th className="text-right px-3 py-2">{tDich("Lợi nhuận")}</th><th className="text-right px-3 py-2">{tDich("Tiền vào KD")}</th>
              <th className="text-right px-3 py-2">{tDich("Tiền ra KD")}</th><th className="text-right px-3 py-2">{tDich("Ròng (gồm vay)")}</th>
              <th className="text-right px-3 py-2">{tDich("Số dư cuối")}</th>
            </tr>
          </thead>
          <tbody>
            {bc.kqkd.map((r, i) => {
              const d = bc.dongTien[i];
              return (
                <tr key={r.ky.key} className={`border-t border-gray-100 ${r.ky.key === chonKey ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-1.5 sticky left-0 bg-inherit whitespace-nowrap">
                    <Link className="text-blue-700 hover:underline" href={link({ chon: r.ky.key })}>{tDich(r.ky.nhan)}</Link>
                    {r.doanhThuUoc > 0 && <span className="ml-1 text-[10px] text-amber-700">{tDich("ước")}</span>}
                  </td>
                  <td className="text-right px-3">{tr(r.doanhThu)}</td>
                  <td className="text-right px-3">{tr(r.laiGop)}</td>
                  <td className="text-right px-3 text-gray-500">{pct(r.doanhThu ? r.laiGop / r.doanhThu : NaN)}</td>
                  <td className="text-right px-3">{tr(r.luong)}{r.luongThieu ? "*" : ""}</td>
                  <td className="text-right px-3">{tr(r.tongChiPhi)}</td>
                  <td className="text-right px-3">{tr(r.laiVay)}</td>
                  <td className={`text-right px-3 font-medium ${r.luongThieu ? "text-gray-400" : mau(r.loiNhuan)}`}>{r.luongThieu ? tDich("chưa đủ") : tr(r.loiNhuan)}</td>
                  <td className="text-right px-3">{d.coSo ? tr(d.thuKd) : "—"}</td>
                  <td className="text-right px-3">{d.coSo ? tr(d.chiKd) : "—"}</td>
                  <td className={`text-right px-3 ${mau(d.rong)}`}>{d.coSo ? tr(d.rong) : "—"}</td>
                  <td className="text-right px-3">{d.soDuCuoi != null ? tr(d.soDuCuoi) : "—"}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
              <td className="px-3 py-2 sticky left-0 bg-gray-50">{tDich("Cộng")}</td>
              <td className="text-right px-3">{tr(T.doanhThu)}</td><td className="text-right px-3">{tr(T.laiGop)}</td>
              <td className="text-right px-3">{pct(T.doanhThu ? T.laiGop / T.doanhThu : NaN)}</td>
              <td className="text-right px-3">{tr(T.luong)}</td><td className="text-right px-3">{tr(T.tongChiPhi)}</td>
              <td className="text-right px-3">{tr(T.laiVay)}</td>
              <td className={`text-right px-3 ${mau(T.loiNhuan)}`}>{tr(T.loiNhuan)}</td>
              <td className="text-right px-3">{tr(bc.dongTien.reduce((s, d) => s + d.thuKd, 0))}</td>
              <td className="text-right px-3">{tr(bc.dongTien.reduce((s, d) => s + d.chiKd, 0))}</td>
              <td className="text-right px-3">{tr(bc.dongTien.reduce((s, d) => s + d.rong, 0))}</td>
              <td className="text-right px-3">{cuoi?.soDuCuoi != null ? tr(cuoi.soDuCuoi) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        {tDich("Lợi nhuận = doanh thu − giá vốn − lương (gồm BH phần công ty, theo tháng công) − chi phí khác (theo ngày chi trên sổ phụ) − lãi vay (theo dư nợ từng ngày).\n        Chưa trừ khấu hao xe, thiết bị và chưa phân bổ tiền thuê trả trước theo tháng. * = kỳ chưa có bảng lương.")}
      </p>
    </div>
  );
}

function Bang({ cot, dong }: { cot: { key: string; nhan: string }[]; dong: { nhan: string; gt: (number | null)[]; dam?: boolean; phu?: boolean; vien?: boolean }[] }) {
  const { t: tDich } = getT();
  return (
    <div className="rounded-md border border-gray-200 overflow-x-auto">
      <table className="text-sm tabular-nums min-w-full">
        <thead className="bg-gray-50 text-gray-600 text-xs">
          <tr>
            <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 min-w-[220px]">{tDich("Khoản mục")}</th>
            {cot.map((c) => <th key={c.key} className="text-right px-3 py-2 whitespace-nowrap">{tDich(c.nhan)}</th>)}
            <th className="text-right px-3 py-2">{tDich("Cộng")}</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((d, i) => {
            const co = d.gt.filter((x): x is number => x != null);
            const cong = co.reduce((s, x) => s + x, 0);
            return (
              <tr key={i} className={`${d.vien ? "border-t-2 border-gray-300" : "border-t border-gray-100"} ${d.dam ? "font-semibold bg-gray-50" : ""}`}>
                <td className={`px-3 py-1.5 sticky left-0 whitespace-nowrap ${d.dam ? "bg-gray-50" : "bg-white"} ${d.phu ? "pl-7 text-gray-600" : ""}`}>{tDich(d.nhan)}</td>
                {d.gt.map((x, j) => <td key={j} className={`text-right px-3 ${x != null ? mau(x) : "text-gray-300"}`}>{x == null ? "—" : tr(x)}</td>)}
                <td className={`text-right px-3 font-medium ${mau(cong)}`}>{co.length ? tr(cong) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BangKqkd({ bc }: { bc: BaoCao }) {
  const { t: tDich } = getT();
  const R = bc.kqkd;
  const muc = HANG_MUC.filter((h) => h.vaoKqkd)
    .map((h) => ({ h, tong: R.reduce((s, r) => s + (r.chiPhi[h.key] || 0), 0) }))
    .filter((x) => x.tong > 0).sort((a, b) => b.tong - a.tong);
  const coUoc = R.some((r) => r.doanhThuUoc > 0);
  return (
    <div className="space-y-2">
      <Bang cot={R.map((r) => r.ky)} dong={[
        { nhan: tDich("Doanh thu thuần (chưa VAT)"), gt: R.map((r) => r.doanhThu), dam: true },
        ...(coUoc ? [{ nhan: tDich("trong đó ước từ tiền về"), gt: R.map((r) => r.doanhThuUoc || null), phu: true }] : []),
        { nhan: tDich("Giá vốn hàng bán"), gt: R.map((r) => -r.giaVon) },
        { nhan: tDich("Lãi gộp"), gt: R.map((r) => r.laiGop), dam: true },
        { nhan: tDich("Chi phí lương (gồm BH công ty)"), gt: R.map((r) => (r.luongThieu && !r.luong ? null : -r.luong)) },
        ...muc.map((m) => ({ nhan: tDich(m.h.nhan), gt: R.map((r) => (r.chiPhi[m.h.key] ? -r.chiPhi[m.h.key] : null)), phu: true })),
        { nhan: tDich("Cộng chi phí hoạt động khác"), gt: R.map((r) => -r.tongChiPhi) },
        { nhan: tDich("Chi phí lãi vay"), gt: R.map((r) => -r.laiVay) },
        { nhan: tDich("Lợi nhuận trước thuế (kỳ đủ bảng lương)"), gt: R.map((r) => (r.luongThieu ? null : r.loiNhuan)), dam: true, vien: true },
      ]} />
      <p className="text-xs text-gray-500">
        {tDich("Giá vốn: số lượng × giá vốn sản phẩm cho dòng khớp được tên hàng, kể cả quà tặng 0 đồng; dòng không khớp (tên gõ tự do, sổ đơn T7 không ghi tên hàng) nhân tỷ lệ giá vốn trung bình.\n        Mua hàng, BHXH, thuế nộp ngân sách, trả gốc vay không phải chi phí của kỳ nên không nằm ở đây — xem thẻ Dòng tiền.")}
      </p>
    </div>
  );
}

function BangDongTien({ bc, chonKey, muc, link }: { bc: BaoCao; chonKey?: string; muc?: string; link: (p: Partial<SP>) => string }) {
  const { t: tDich } = getT();
  const D = bc.dongTien;
  const v = (d: DongTien, key: string) => (d.coSo ? d.theoMuc[key] || null : null);
  const dongMuc = (dk: (h: typeof HANG_MUC[number]) => boolean) =>
    HANG_MUC.filter(dk).filter((h) => D.some((d) => d.theoMuc[h.key])).map((h) => ({ nhan: h.nhan, gt: D.map((d) => v(d, h.key)), phu: true }));
  const nb = D.map((d) => (d.coSo ? (d.theoMuc.noi_bo_thu || 0) + (d.theoMuc.noi_bo_chi || 0) || null : null));
  const ky = D.find((d) => d.ky.key === chonKey);
  const gd = ky ? bc.giaoDich.filter((g) => g.ngay >= ky.ky.tu && g.ngay <= ky.ky.den && (!muc || g.hangMuc === muc)).sort((a, b) => b.tien - a.tien) : [];
  return (
    <div className="space-y-4">
      <Bang cot={D.map((d) => d.ky)} dong={[
        { nhan: tDich("Số dư đầu kỳ"), gt: D.map((d) => (d.soDuCuoi != null ? d.soDuCuoi - d.rong : null)), dam: true },
        { nhan: tDich("I. Thu từ kinh doanh"), gt: D.map((d) => (d.coSo ? d.thuKd : null)) },
        ...dongMuc((h) => tDich(h.nhom) === "kd" && h.chieu === "thu"),
        { nhan: "Chi cho kinh doanh", gt: D.map((d) => (d.coSo ? -d.chiKd : null)) },
        ...dongMuc((h) => tDich(h.nhom) === "kd" && h.chieu === "chi"),
        { nhan: tDich("Lưu chuyển thuần từ kinh doanh"), gt: D.map((d) => (d.coSo ? d.thuKd - d.chiKd : null)), dam: true },
        { nhan: tDich("II. Đầu tư (tài sản, thiết bị)"), gt: D.map((d) => (d.coSo ? d.dt || null : null)), dam: true },
        { nhan: tDich("III. Tài chính (vay, góp vốn, trả gốc)"), gt: D.map((d) => (d.coSo ? d.tc || null : null)), dam: true },
        ...dongMuc((h) => tDich(h.nhom) === "tc"),
        ...(nb.some((x) => x) ? [{ nhan: tDich("Chuyển nội bộ chưa khớp cặp"), gt: nb }] : []),
        { nhan: tDich("Lưu chuyển tiền thuần trong kỳ"), gt: D.map((d) => (d.coSo ? d.rong + (d.theoMuc.noi_bo_thu || 0) + (d.theoMuc.noi_bo_chi || 0) : null)), dam: true, vien: true },
        { nhan: tDich("Số dư cuối kỳ (MB + TCB)"), gt: D.map((d) => d.soDuCuoi), dam: true },
      ]} />

      <div className="rounded-md border border-gray-200 p-3 space-y-3">
        <form method="get" action="/bao-cao-tai-chinh" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="tab" value="dong-tien" />
          <input type="hidden" name="ky" value={bc.che} />
          <input type="hidden" name="nam" value={bc.nam} />
          <label className="flex flex-col text-xs text-gray-600">{tDich("Kỳ")}
            <select name="chon" defaultValue={chonKey} className="mt-0.5 border border-gray-300 rounded-md px-2 py-1 text-sm">
              {D.filter((d) => d.coSo).map((d) => <option key={d.ky.key} value={d.ky.key}>{tDich(d.ky.nhan)}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-600">{tDich("Hạng mục")}
            <select name="muc" defaultValue={muc || ""} className="mt-0.5 border border-gray-300 rounded-md px-2 py-1 text-sm">
              <option value="">{tDich("Tất cả")}</option>
              {HANG_MUC.map((h) => <option key={h.key} value={h.key}>{tDich(h.nhan)}</option>)}
            </select>
          </label>
          <button className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm">{tDich("Xem giao dịch")}</button>
          <Link href={link({ tab: "dong-tien", chon: chonKey, muc: "chi_khac" })} className="text-xs text-blue-700 hover:underline ml-auto">{tDich("Chỉ xem khoản chưa phân loại")}</Link>
        </form>
        {ky && (
          <div className="text-xs text-gray-500">
            {gd.length} {tDich("giao dịch kỳ")} {tDich(ky.ky.nhan)}{muc && HM[muc] ? ` · ${tDich(HM[muc].nhan)}` : ""}{tDich(". Nhãn sai thì chọn lại rồi bấm Lưu — báo cáo tính lại ngay. Chọn \"Theo luật máy\" để bỏ nhãn tay.")}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-gray-500">
              <tr><th className="text-left py-1 pr-2">{tDich("Ngày")}</th><th className="text-left pr-2">TK</th><th className="text-right pr-3">{tDich("Số tiền")}</th><th className="text-left pr-2">{tDich("Hạng mục")}</th><th className="text-left">{tDich("Khoản gì (dòng dưới: nguyên văn sổ phụ)")}</th></tr>
            </thead>
            <tbody>
              {gd.slice(0, 150).map((g) => (
                <tr key={g.id} className="border-t border-gray-100 align-top">
                  <td className="py-1 pr-2 whitespace-nowrap">{dm(g.ngay)}</td>
                  <td className="pr-2 text-gray-500">{g.nganHang}</td>
                  <td className={`pr-3 text-right whitespace-nowrap ${g.chieu === "chi" ? "text-red-600" : "text-emerald-700"}`}>{g.chieu === "chi" ? "−" : "+"}{g.tien.toLocaleString("vi-VN")}</td>
                  <td className="pr-2">
                    <form action={ganHangMuc} className="flex gap-1 items-center">
                      <input type="hidden" name="id" value={g.id} />
                      <select name="hm" defaultValue={g.hangMuc} className={`border rounded-md px-1 py-0.5 text-xs max-w-[190px] ${g.suaTay ? "border-blue-400" : "border-gray-300"}`}>
                        <option value="tu-dong">{tDich("Theo luật máy")}</option>
                        {HANG_MUC.filter((h) => h.chieu === g.chieu && h.key !== "van_chuyen").map((h) => <option key={h.key} value={h.key}>{tDich(h.nhan)}</option>)}
                      </select>
                      <button className="text-xs px-2 py-0.5 rounded-md border border-gray-300 hover:bg-gray-50">{tDich("Lưu")}</button>
                    </form>
                  </td>
                  <td className="text-xs min-w-[280px]"><div className="text-gray-900">{tDich(g.tomTat)}</div><div className="text-gray-400 mt-0.5">{tDich(g.noiDung).slice(0, 120)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {gd.length > 150 && <div className="text-xs text-gray-500 pt-2">{tDich("Đang hiện 150 khoản lớn nhất — lọc theo hạng mục để xem phần còn lại.")}</div>}
        </div>
      </div>
    </div>
  );
}

function HangDam({ d }: { d: Awaited<ReturnType<typeof theoDoiDam>> }) {
  const { t: tDich } = getT();
  const max = Math.max(1, ...d.tuan.map((t) => t.hop));
  const trungVi = [...d.tuan].map((t) => t.hop).sort((a, b) => a - b)[Math.floor(d.tuan.length / 2)] || 0;
  const u = d.uocTonNay;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <The nhan={tDich("Ước tồn hôm nay (hũ 500g)")} so={u ? String(Math.max(0, u.con)) : "—"} am={!!u && u.con <= d.tbTuan4}
          phu={u ? `${u.tuMoc.hop} hũ ngày ${dm(u.tuMoc.ngay)} − ${u.daGuiSauMoc} hũ đã gửi J&T sau đó` : undefined} />
        <The nhan={tDich("Bán ra trung bình 4 tuần")} so={`${Math.round(d.tbTuan4)} hũ/tuần`} />
        <The nhan={tDich("Còn đủ bán")} so={d.soTuanConLai == null ? "—" : u && u.con <= 0 ? tDich("đã hết") : d.soTuanConLai < 1 ? `${Math.round(d.soTuanConLai * 7)} ngày` : `${d.soTuanConLai.toFixed(1)} tuần`} am={d.soTuanConLai != null && d.soTuanConLai < 2} />
        <The nhan={tDich("Lần trả tiền hàng RV gần nhất")} so={d.thanhToanNcc.length ? dm(d.thanhToanNcc[d.thanhToanNcc.length - 1].ngay) : "—"}
          phu={d.thanhToanNcc.length ? `${tr(d.thanhToanNcc[d.thanhToanNcc.length - 1].tien)} triệu` : undefined} />
      </div>

      <div className="rounded-md border border-gray-200 p-3">
        <div className="text-sm font-semibold mb-2">{tDich("Các lần đếm tồn có thật")}</div>
        <table className="text-sm tabular-nums">
          <tbody>
            {d.mocTon.map((m) => (
              <tr key={m.ngay} className="border-t border-gray-100"><td className="py-1 pr-4">{`${dm(m.ngay)}/${m.ngay.slice(0, 4)}`}</td><td className="pr-4 text-right">{m.hop} {tDich("hũ")}</td><td className="text-gray-500 text-xs">{m.nguon}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-2">{tDich("Sổ tồn nội bộ (/kho) đang đứng trên số MISA 27/08 nên KHÔNG dùng ở đây. Hàng về thì ghi đợt nhập ở /kho, kho đếm lại thì khai mốc mới — ô này tự tính tiếp.")}</p>
      </div>

      <div className="rounded-md border border-gray-200 p-3">
        <div className="text-sm font-semibold mb-2">{tDich("Trả tiền hàng đạm cho nhà sản xuất (sổ phụ ngân hàng)")}</div>
        <table className="text-sm tabular-nums w-full">
          <tbody>
            {d.thanhToanNcc.map((p) => (
              <tr key={p.ngay + p.tien} className="border-t border-gray-100 align-top"><td className="py-1 pr-4 whitespace-nowrap">{`${dm(p.ngay)}/${p.ngay.slice(0, 4)}`}</td><td className="pr-4 text-right whitespace-nowrap">{tr(p.tien)} tr</td><td className="text-xs text-gray-500">{tDich(p.noiDung).slice(0, 140)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-gray-200 p-3">
        <div className="text-sm font-semibold mb-1">{tDich("Hũ đạm gửi đi mỗi tuần (vận đơn J&T, từ")} {d.vanDonTu ? dm(d.vanDonTu) : "—"})</div>
        <p className="text-xs text-gray-500 mb-2">{tDich("Cột đỏ = tuần gửi dưới một nửa mức thường (")}{trungVi} {tDich("hũ) — dấu hiệu thiếu hàng hoặc bán chậm.")}</p>
        <div className="space-y-1">
          {d.tuan.map((t) => (
            <div key={t.tuan} className="flex items-center gap-2 text-xs tabular-nums">
              <span className="w-12 text-gray-500">{dm(t.tuan)}</span>
              <div className="flex-1 bg-gray-100 rounded-sm h-3">
                <div className={`h-3 rounded-sm ${t.hop < trungVi / 2 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${(t.hop / max) * 100}%` }} />
              </div>
              <span className="w-24 text-right">{t.hop} {tDich("hũ ·")} {t.don} {tDich("đơn")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
