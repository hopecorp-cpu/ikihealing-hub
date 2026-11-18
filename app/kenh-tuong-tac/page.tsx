import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui/kit";
import { MessageSquare, Clock, AlertTriangle, ThumbsUp } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Phễu tương tác | ACME Ops Hub") };
}

type FbData = {
  at?: string; days?: number;
  perPage?: Array<{ page: string; hoiThoai: number; daTraLoi: number; dangCho: number; binhLuan: number; like: number; share: number; bai: number }>;
  repCount?: number; repMedian?: number | null; repUnder15Pct?: number;
  waiting?: Array<{ page: string; ten: string | null; link: string; tuLuc: string; phut: number }>;
  waitingTotal?: number;
};
type ZaloData = { at?: string; total?: number; items?: Array<{ name: string | null; phone: string | null; hotline: string; at: string; phut: number }> };

const gio = (phut: number) => phut >= 60 ? `${Math.round(phut / 60)} giờ` : `${phut} phút`;

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/");

  const sb = getServiceClient();
  const cfg = async <T,>(k: string): Promise<T | null> => {
    try { const v = (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value; return v ? JSON.parse(v) as T : null; } catch { return null; }
  };
  const [fb, zalo] = await Promise.all([cfg<FbData>("fb_tuong_tac"), cfg<ZaloData>("zalo_unreplied")]);

  const tong = (fb?.perPage || []).reduce((a, p) => ({
    hoiThoai: a.hoiThoai + p.hoiThoai, like: a.like + p.like, share: a.share + p.share, binhLuan: a.binhLuan + p.binhLuan, bai: a.bai + p.bai,
  }), { hoiThoai: 0, like: 0, share: 0, binhLuan: 0, bai: 0 });
  const choTong = (fb?.waitingTotal || 0) + (zalo?.total || 0);
  const maxLike = Math.max(1, ...(fb?.perPage || []).map((p) => p.like));

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={t("Phễu tương tác")}
        subtitle={`Khách chạm vào ACME bằng cách nào, ai đang chờ trả lời — ${fb?.days || 14} ngày gần nhất`}
        icon={MessageSquare}
        actions={choTong > 0
          ? <Badge tone="red" dot>{choTong} {t("khách đang chờ")}</Badge>
          : <Badge tone="green" dot>{t("không ai phải chờ")}</Badge>}
      />

      {!fb && !zalo && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-[13px] text-amber-900">
          {t("Chưa có số liệu. Chạy trên máy văn phòng:")} <code>node scripts/fb-tuong-tac.mjs --commit</code> {t("và")}{" "}
          <code>node scripts/salework-fetch-contacts.mjs --commit</code>.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { k: "Tin nhắn Facebook", v: tong.hoiThoai.toLocaleString("vi-VN") },
          { k: "Bình luận", v: tong.binhLuan.toLocaleString("vi-VN") },
          { k: "Lượt thích", v: tong.like.toLocaleString("vi-VN") },
          { k: "Lượt chia sẻ", v: tong.share.toLocaleString("vi-VN") },
          { k: "Bài đã đăng", v: tong.bai.toLocaleString("vi-VN") },
        ].map((x) => (
          <div key={x.k} className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
            <div className="text-[11.5px] text-gray-500">{x.k}</div>
            <div className="text-[19px] font-bold text-gray-900 tabular-nums mt-0.5">{x.v}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-[14px] font-bold text-gray-800 mb-2 inline-flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />{t("Sale trả lời nhanh cỡ nào")}
        </h2>
        <div className="flex flex-wrap gap-6 items-baseline">
          <div>
            <div className="text-[26px] font-bold text-emerald-700 tabular-nums">{fb?.repMedian ?? "—"}<span className="text-[14px] font-semibold text-gray-500 ml-1">{t("phút")}</span></div>
            <div className="text-[11.5px] text-gray-500">{t("thời gian trả lời thường gặp")}</div>
          </div>
          <div>
            <div className="text-[26px] font-bold text-gray-900 tabular-nums">{fb?.repUnder15Pct ?? 0}<span className="text-[14px] font-semibold text-gray-500 ml-1">%</span></div>
            <div className="text-[11.5px] text-gray-500">{t("trả lời trong vòng 15 phút")}</div>
          </div>
          <div>
            <div className="text-[26px] font-bold text-gray-900 tabular-nums">{fb?.repCount ?? 0}</div>
            <div className="text-[11.5px] text-gray-500">{t("hội thoại đo được")}</div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          {t("Đo bằng khoảng cách từ tin khách nhắn tới tin sale trả lời ngay sau đó, lấy từ chính lịch sử chat —\n          không phụ thuộc ai bấm nút.")}
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${choTong ? "text-rose-500" : "text-gray-300"}`} />
          <h2 className="text-[14px] font-bold text-gray-800">{t("Khách đang chờ trả lời")}</h2>
          <span className="text-[11.5px] text-gray-400">Facebook {fb?.waitingTotal || 0} · Zalo {zalo?.total || 0}</span>
        </div>
        {choTong === 0 ? (
          <div className="p-4 text-[13px] text-gray-500">{t("Không có ai đang chờ.")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">{t("Khách")}</th>
                  <th className="text-left px-3 py-2 font-semibold">{t("Kênh")}</th>
                  <th className="text-right px-4 py-2 font-semibold">{t("Chờ đã")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ...(zalo?.items || []).map((z) => ({ ten: z.name || z.phone || t("khách Zalo"), kenh: `Zalo · ${z.hotline}`, phut: z.phut, link: null as string | null })),
                  ...(fb?.waiting || []).map((f) => ({ ten: t(f.ten) || t("khách Facebook"), kenh: `Facebook · ${f.page}`, phut: f.phut, link: f.link })),
                ].sort((a, b) => b.phut - a.phut).slice(0, 40).map((r, i) => (
                  <tr key={i} className={r.phut > 1440 ? "bg-rose-50/40" : ""}>
                    <td className="px-4 py-2 font-semibold text-gray-800">
                      {r.link ? <a href={r.link} target="_blank" rel="noreferrer" className="hover:underline">{t(r.ten)}</a> : t(r.ten)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.kenh}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${r.phut > 1440 ? "text-rose-700" : "text-gray-700"}`}>{gio(r.phut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <ThumbsUp className="w-4 h-4 text-gray-400" />
          <h2 className="text-[14px] font-bold text-gray-800">{t("Trang nào đang kéo được người")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Fanpage</th>
                <th className="text-right px-3 py-2 font-semibold">{t("Bài")}</th>
                <th className="text-right px-3 py-2 font-semibold">{t("Thích")}</th>
                <th className="text-left px-3 py-2 font-semibold w-32">{t("So với trang đầu")}</th>
                <th className="text-right px-3 py-2 font-semibold">{t("Chia sẻ")}</th>
                <th className="text-right px-3 py-2 font-semibold">{t("Bình luận")}</th>
                <th className="text-right px-4 py-2 font-semibold">{t("Nhắn tin")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(fb?.perPage || []).slice().sort((a, b) => b.like - a.like).map((p) => (
                <tr key={p.page} className={p.bai > 5 && p.like < 50 ? "bg-amber-50/40" : ""}>
                  <td className="px-4 py-2 font-semibold text-gray-800">{p.page}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.bai}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{p.like.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2">
                    <div className="h-1.5 rounded bg-gray-100 overflow-hidden">
                      <div className="h-full bg-brand-500" style={{ width: `${Math.round(p.like / maxLike * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.share}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.binhLuan}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">{p.hoiThoai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-gray-50">
          {t("Dòng tô vàng là trang đăng nhiều mà gần như không ai tương tác — đang tốn công mà không ra người.\n          Số liệu cào lúc")} {fb?.at ? new Date(fb.at).toLocaleString("vi-VN") : "—"}.
        </p>
      </section>
    </div>
  );
}
