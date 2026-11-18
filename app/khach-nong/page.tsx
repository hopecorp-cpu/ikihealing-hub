import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { PageHeader, SectionCard } from "@/components/ui/kit";
import { Flame, Clock } from "lucide-react";
import type { KetQuaCham } from "@/lib/cham-diem-zalo";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Khách nóng Zalo | ACME Ops Hub") };
}

export default async function Page() {
  const { t: tDich } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sb = getServiceClient();
  const { data } = await sb.from("config").select("value").eq("key", "zalo_diem_khach").maybeSingle();
  let goi: any = null;
  try { goi = data?.value ? JSON.parse(data.value) : null; } catch { goi = null; }

  if (!goi) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <PageHeader icon={Flame} title={tDich("Khách nóng Zalo")} subtitle={tDich("Máy chưa chấm lần nào")} />
        <SectionCard>
          <p className="text-sm text-gray-600">
            {tDich("Chưa có dữ liệu. Máy tự chấm lúc 9:14 sáng mỗi ngày; muốn có ngay thì chạy tay cron")}
            <code className="mx-1 px-1 bg-gray-100 rounded text-xs">cham-diem-zalo</code>.
          </p>
        </SectionCard>
      </div>
    );
  }

  const top: KetQuaCham[] = goi.top || [];

  const dangNo: KetQuaCham[] = (goi.dangNo || top.filter((k: KetQuaCham) => k.loiCuaMinh))
    .slice().sort((a: KetQuaCham, b: KetQuaCham) => b.diem - a.diem);
  const canChot = top.filter((k) => !k.loiCuaMinh && k.diem >= 45);

  const mauBac: Record<string, string> = { nong: "#DC2626", am: "#F59E0B", nguoi: "#6B7280", lanh: "#9CA3AF" };
  const tenBac: Record<string, string> = { nong: "Nóng", am: "Ấm", nguoi: "Nguội", lanh: "Lạnh" };

  const Dong = ({ k }: { k: KetQuaCham }) => (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 border-b border-gray-100 last:border-0">
      <span className=" text-sm font-bold tabular-nums w-9 text-right" style={{ color: mauBac[k.bac] }}>{k.diem}</span>
      <div className="flex-1 min-w-[220px]">
        <div className="text-sm font-medium text-gray-900">
          {tDich(k.ten)}
          {k.sale && <span className="ml-2 text-xs font-normal text-gray-400">sale: {k.sale}</span>}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {k.tinHieu.filter((t) => t.diem > 0).map((t) => tDich(t.nhan)).join(" · ")}
          {k.tinHieu.some((t) => t.diem < 0) && (
            <span className="text-red-600"> {tDich("· trừ:")} {k.tinHieu.filter((t) => t.diem < 0).map((t) => tDich(t.nhan)).join(", ")}</span>
          )}
        </div>
      </div>
      {k.sdt && <a href={`https://zalo.me/${k.sdt}`} target="_blank" rel="noopener noreferrer"
        className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 whitespace-nowrap">{k.sdt}</a>}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <PageHeader icon={Flame} title={tDich("Khách nóng Zalo")}
        subtitle={`Máy chấm ${new Date(goi.at).toLocaleString("vi-VN")} · quét ${(goi.tongTin || 0).toLocaleString("vi-VN")} tin của ${(goi.tongLienHe || 0).toLocaleString("vi-VN")} liên hệ`} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["nong", "am", "nguoi", "lanh"] as const).map((b) => (
          <div key={b} className="bg-white border border-gray-100 rounded-2xl p-3">
            <div className="text-2xl font-bold tabular-nums" style={{ color: mauBac[b] }}>{goi.theoBac?.[b] ?? 0}</div>
            <div className="text-xs text-gray-500">{tDich(tenBac[b])}</div>
          </div>
        ))}
      </div>

      {dangNo.length > 0 && (
        <SectionCard>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-gray-900">{tDich("Mình đang nợ trả lời —")} {goi.soBoRoi ?? dangNo.length} {tDich("khách")}</h2>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            {tDich("Khách nhắn mà mình chưa trả lời quá 24 giờ. Đây không phải khách nguội, đây là việc của mình.")}
          </p>
          <div>{dangNo.slice(0, 40).map((k) => <Dong key={k.zalo_uid} k={k} />)}</div>
          {dangNo.length > 40 && <p className="text-xs text-gray-400 mt-2">{tDich("… còn")} {dangNo.length - 40} {tDich("khách nữa")}</p>}
        </SectionCard>
      )}

      <SectionCard>
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-900">{tDich("Cần chốt —")} {canChot.length} {tDich("khách")}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          {tDich("Xếp theo tín hiệu mua đọc được trong 21 ngày gần nhất. Câu hỏi mua cũ hơn không tính — hỏi giá tháng trước rồi mua xong thì không còn là khách cần chốt.")}
        </p>
        {canChot.length === 0
          ? <p className="text-sm text-gray-500 py-3">{tDich("Chưa có khách nào đạt ngưỡng cần chốt.")}</p>
          : <div>{canChot.slice(0, 50).map((k) => <Dong key={k.zalo_uid} k={k} />)}</div>}
      </SectionCard>

      <p className="text-xs text-gray-400">
        {tDich("Máy chỉ xếp hạng, không tự nhắn cho khách. Đã loại")} {goi.boQuaBroadcast || 0} {tDich("mẫu nội dung bắn hàng loạt và toàn bộ nhóm Zalo khỏi danh sách.")}
      </p>
    </div>
  );
}
