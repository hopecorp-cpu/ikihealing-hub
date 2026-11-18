import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import ContactsClient from "./ContactsClient";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Danh bạ khách (hotline Zalo) | IKIHEALING Hub") };
}

export default async function DanhBaKhachPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role) || isSalePosition((user as any).position))) redirect("/");

  const sb = getServiceClient();
  const probe = await sb.from("salework_contacts").select("id").limit(1);
  const tableMissing = !!probe.error;

  let rows: any[] = [];
  if (!tableMissing) {
    let off = 0;
    while (true) {
      const { data } = await sb.from("salework_contacts").select("phone,name,hotline,last_message,last_contact").order("last_contact", { ascending: false }).range(off, off + 999);
      if (!data || !data.length) break;
      rows = rows.concat(data); if (data.length < 1000) break; off += 1000;
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Danh bạ khách (hotline Zalo)")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Khách nhắn 3 hotline Zalo (Sơn / Đào / Đào), đồng bộ từ Salework. Tìm, lọc theo hotline, xuất Excel.")}</p>
      </div>
      {tableMissing ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
          {t("Chưa tạo bảng")} <code>salework_contacts</code>. {t("Paste")} <code>supabase/migrations/033_salework_contacts.sql</code> {t("vào Supabase → SQL Editor → Run, rồi chạy")} <code>node scripts/salework-fetch-contacts.mjs --commit</code>.
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">{t("Chưa có danh bạ. Chạy")} <code>node scripts/salework-fetch-contacts.mjs --commit</code>.</div>
      ) : (
        <ContactsClient rows={rows} />
      )}
    </div>
  );
}
