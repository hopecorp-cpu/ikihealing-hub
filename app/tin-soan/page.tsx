import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { PageHeader, SectionCard } from "@/components/ui/kit";
import { MessagesSquare } from "lucide-react";
import { CHUOI_MAC_DINH, type Chuoi } from "@/lib/chuoi-cham-soc";
import { docKhoNhapOa, docCheDoOa } from "@/lib/zalo-oa-nhap-server";
import { nhanKhachOa } from "@/lib/zalo-oa-che-do";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Tin chờ duyệt | ACME Ops Hub") };
}

export default async function Page() {
  const { t: tDich } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sb = getServiceClient();
  const doc = async (k: string) => {
    const { data } = await sb.from("config").select("value").eq("key", k).maybeSingle();
    try { return data?.value ? JSON.parse(data.value) : null; } catch { return null; }
  };
  const kho = await doc("zalo_tin_soan");
  const chuois: Chuoi[] = (await doc("zalo_chuoi")) || CHUOI_MAC_DINH;
  const tenChuoi: Record<string, string> = Object.fromEntries(chuois.map((c) => [c.ma, c.ten]));
  tenChuoi.oa = "Zalo OA";

  const khoOa = await docKhoNhapOa();
  const cheDoOa = await docCheDoOa();
  const tinOa = Object.entries(khoOa)
    .sort((a, b) => String(b[1].luc).localeCompare(String(a[1].luc)))
    .map(([id, t]) => ({
      kenh: "oa", chuoi: "oa", buoc: 0, zalo_uid: id, ten: nhanKhachOa(id), sdt: t.sdt || null,
      noiDung: t.nhap || "", tinKhach: t.tinKhach || "", luc: t.luc, hot: !!t.hot, medical: !!t.medical,
    }));
  const tinChuoi = kho?.tin || [];
  const tin = [...tinOa, ...tinChuoi];

  const Client = (await import("./Client")).default;
  const nhanCheDo = cheDoOa === "nhap" ? "AI soạn nháp, người gửi" : cheDoOa === "tat" ? "AI tắt, người tự viết" : "máy TỰ GỬI (đã duyệt)";
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
      <PageHeader icon={MessagesSquare} title={tDich("Tin chờ duyệt")}
        subtitle={`Zalo OA: ${tinOa.length} tin chờ (chế độ: ${nhanCheDo}) · Chuỗi chăm sóc: ${kho?.at ? `máy soạn ${new Date(kho.at).toLocaleString("vi-VN")} · ${tinChuoi.length} tin` : tDich("chưa có lượt soạn nào")}`} />
      <SectionCard>
        <p className="text-xs text-gray-500 mb-2">
          {tDich("Máy soạn, KHÔNG tự gửi. Sửa lời cho hợp rồi bấm Gửi; bấm Bỏ qua thì tin rời danh sách (chuỗi chăm sóc: hôm nay máy không soạn lại cho khách đó).")}
        </p>
        <Client tin={tin} tenChuoi={tenChuoi} />
      </SectionCard>
      <p className="text-xs text-gray-400">
        {tDich("Mọi tin vẫn đi qua cổng từ cấm thực phẩm bổ sung. Tin chuỗi chăm sóc thêm hai cổng: quyền dùng nick · khách đã yêu cầu ngừng nhận tin.\n        Tin Zalo OA chỉ gửi được trong 48 giờ kể từ lúc khách nhắn (luật của Zalo).")}
      </p>
    </div>
  );
}
