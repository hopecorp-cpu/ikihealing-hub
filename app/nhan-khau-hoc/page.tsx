import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { buildNhanKhauHoc } from "@/lib/nhan-khau-hoc";
import { getT } from "@/lib/i18n-server";
import { fmtVND } from "@/lib/payroll";
import { PageHeader, SectionCard, Badge } from "@/components/ui/kit";
import { Users, MapPin, Megaphone, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Nhân khẩu học khách hàng | IKIHEALING Hub") };
}

const RANGES = [30, 90, 180];

export default async function Page({ searchParams }: { searchParams: { d?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/");

  const { t } = getT();
  const days = RANGES.includes(Number(searchParams.d)) ? Number(searchParams.d) : 90;
  const a = await buildNhanKhauHoc(days);

  const doanDuoc = a.gioi.nu + a.gioi.nam;
  const pctNu = doanDuoc ? (a.gioi.nu * 100) / doanDuoc : 0;
  const pctNam = doanDuoc ? (a.gioi.nam * 100) / doanDuoc : 0;
  const nf = (n: number) => n.toLocaleString("vi-VN");

  const bar = (pct: number, tone = "bg-brand-500") => (
    <div className="h-1.5 rounded bg-gray-100 overflow-hidden">
      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={t("Nhân khẩu học khách hàng")}
        subtitle={`${t("Khách đã mua thật")}, ${a.tu} — ${a.den}`}
        icon={Users}
        actions={
          <div className="flex gap-1.5">
            {RANGES.map((d) => (
              <a
                key={d}
                href={`?d=${d}`}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold border ${d === days ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"}`}
              >
                {d} {t("ngày")}
              </a>
            ))}
          </div>
        }
      />

      {a.canhBao.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          {a.canhBao.map((c, i) => (
            <div key={i} className="flex gap-2 text-[12.5px] text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" /> {t("Giới tính người mua")}
          </span>
        }
        desc={t("Ước lượng từ họ tên khách trong sổ đơn — không phải khai báo của khách")}
        right={<Badge tone="gray">{t("đoán được")} {a.phuSongGioi.toFixed(0)}%</Badge>}
      >
        {doanDuoc === 0 ? (
          <p className="text-[13px] text-gray-500">{t("Chưa đủ dữ liệu để ước lượng.")}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-[11.5px] text-gray-500">{t("Nữ")}</div>
                <div className="text-2xl font-bold text-gray-900">{pctNu.toFixed(1)}%</div>
                <div className="text-[11.5px] text-gray-500">{nf(a.gioi.nu)} {t("khách")} · {fmtVND(a.gioi.tienNu)}</div>
                <div className="mt-2">{bar(pctNu, "bg-rose-400")}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-[11.5px] text-gray-500">{t("Nam")}</div>
                <div className="text-2xl font-bold text-gray-900">{pctNam.toFixed(1)}%</div>
                <div className="text-[11.5px] text-gray-500">{nf(a.gioi.nam)} {t("khách")} · {fmtVND(a.gioi.tienNam)}</div>
                <div className="mt-2">{bar(pctNam, "bg-sky-400")}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-[11.5px] text-gray-500">{t("Không đoán được")}</div>
                <div className="text-2xl font-bold text-gray-400">{nf(a.gioi.khongRo)}</div>
                <div className="text-[11.5px] text-gray-500">{t("tên trung tính, không chia bừa về hai phía")}</div>
              </div>
            </div>
            <p className="text-[11.5px] text-gray-500">
              {t("Trên tổng")} <b>{nf(a.khachCoTen)}</b> {t("khách có tên (đã gộp trùng theo số điện thoại). Cách đoán: chữ đệm Thị/Văn và tên riêng phổ biến — đúng về tỉ lệ, không đúng từng người.")}
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t("Độ tuổi người mua")}
        desc={t("Mảng này hệ thống chưa đo được")}
      >
        <p className="text-[13px] text-gray-600">
          {t("Không có nơi nào lưu tuổi của người mua: sổ đơn không có, hồ sơ khách không có, và chưa khâu nào hỏi khách. Khác với giới tính, tuổi không suy ra được từ tên. Muốn có thì phải thu khi lên đơn hoặc trong quiz — xem phần quảng cáo bên dưới để biết tuổi NGƯỜI XEM, nhưng đừng đọc đó thành tuổi người mua.")}
        </p>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-brand-600" /> {t("Đối chiếu: người XEM quảng cáo")}
          </span>
        }
        desc={t("Số của Facebook — đây là người xem, không phải người mua. Lệch nhau là tín hiệu nhắm sai tệp.")}
      >
        {!a.qc ? (
          <p className="text-[13px] text-gray-500">{t("Chưa đọc được số quảng cáo trong kỳ này.")}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-[12px] font-semibold text-gray-700 mb-1.5">{t("Theo giới")}</div>
              <table className="w-full text-[12.5px]">
                <thead className="text-gray-500">
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-1.5 font-semibold">{t("Giới")}</th>
                    <th className="text-right py-1.5 font-semibold">{t("Lượt hiển thị")}</th>
                    <th className="text-right py-1.5 font-semibold">{t("Chi")}</th>
                    <th className="text-right py-1.5 font-semibold">{t("Liên hệ")}</th>
                    <th className="text-right py-1.5 font-semibold">{t("Giá mỗi liên hệ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.qc.gioi.map((g) => (
                    <tr key={g.gioi} className="border-b border-gray-50">
                      <td className="py-1.5 font-medium text-gray-800">{t(g.gioi)}</td>
                      <td className="text-right tabular-nums">{nf(g.hienThi)} <span className="text-gray-400">({g.share.toFixed(0)}%)</span></td>
                      <td className="text-right tabular-nums">{fmtVND(g.chi)}</td>
                      <td className="text-right tabular-nums">{nf(g.lienHe)}</td>
                      <td className="text-right tabular-nums font-semibold">
                        {g.giaMoiLienHe === null ? <span className="text-gray-400">{t("không có")}</span> : fmtVND(g.giaMoiLienHe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="text-[12px] font-semibold text-gray-700 mb-1.5">{t("Theo nhóm tuổi")}</div>
              <div className="space-y-1.5">
                {a.qc.tuoi.map((r) => (
                  <div key={r.tuoi} className="flex items-center gap-3">
                    <div className="w-16 text-[12.5px] text-gray-700 font-medium">{r.tuoi}</div>
                    <div className="flex-1">{bar(r.share)}</div>
                    <div className="w-14 text-right text-[12px] tabular-nums text-gray-600">{r.share.toFixed(1)}%</div>
                    <div className="w-24 text-right text-[12px] tabular-nums text-gray-500">{fmtVND(r.chi)}</div>
                    <div className="w-20 text-right text-[12px] tabular-nums text-gray-500">{nf(r.lienHe)} {t("lh")}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-600" /> {t("Khách theo tỉnh thành")}
          </span>
        }
        desc={t("Tên tỉnh đã gộp các cách viết khác nhau trước khi đếm")}
        right={
          <div className="flex gap-1.5">
            {a.mienTong.map((m) => (
              <Badge key={m.mien} tone="gray">{t(`Miền ${m.mien}`)} {m.share.toFixed(0)}%</Badge>
            ))}
          </div>
        }
      >
        <table className="w-full text-[12.5px]">
          <thead className="text-gray-500">
            <tr className="border-b border-gray-100">
              <th className="text-left py-1.5 font-semibold">{t("Tỉnh / Thành")}</th>
              <th className="text-right py-1.5 font-semibold">{t("Khách")}</th>
              <th className="text-right py-1.5 font-semibold">{t("Đơn")}</th>
              <th className="text-right py-1.5 font-semibold">{t("Doanh thu")}</th>
              <th className="text-right py-1.5 font-semibold w-28">{t("Tỉ trọng")}</th>
            </tr>
          </thead>
          <tbody>
            {a.tinhs.slice(0, 25).map((p, i) => (
              <tr key={p.tinh} className={`border-b border-gray-50 ${i === 0 ? "bg-brand-50/40" : ""}`}>
                <td className="py-1.5 font-medium text-gray-800">
                  {p.tinh}
                  <span className="text-[10.5px] text-gray-400 ml-1.5">{t(`Miền ${p.mien}`)}</span>
                </td>
                <td className="text-right tabular-nums">{nf(p.khach)}</td>
                <td className="text-right tabular-nums">{nf(p.don)}</td>
                <td className="text-right tabular-nums">{fmtVND(p.tien)}</td>
                <td className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="tabular-nums text-gray-600 w-10">{p.share.toFixed(1)}%</span>
                    <div className="w-14">{bar(p.share)}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11.5px] text-gray-500 mt-2">
          {t("Đọc được tỉnh của")} <b>{a.phuSongTinh.toFixed(0)}%</b> {t("đơn (địa chỉ khách gõ tay, phần còn lại không ghi tên tỉnh).")}
        </p>
      </SectionCard>
    </div>
  );
}
