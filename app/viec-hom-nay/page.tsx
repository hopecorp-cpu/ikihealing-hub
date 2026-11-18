import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { layViecHomNay } from "@/lib/today-work";
import ViecClient from "./ViecClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Việc hôm nay | IKIHEALING Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role) && !isSalePosition((user as any).position)) redirect("/?denied=viec");

  let viec;
  try {
    viec = await layViecHomNay((user as any).id);
  } catch {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>{t("Việc hôm nay")}</h1>
        <p style={{ color: "#b91c1c" }}>{t("Chưa đọc được danh sách khách. Anh/chị thử tải lại trang giúp em.")}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{t("Việc hôm nay")}</h1>
      <p style={{ color: "#8b93a1", fontSize: 13, marginBottom: 20 }}>
        {t("Khách vừa nhắn xếp trên cùng. Làm hết nắm này là xong ngày — mai hệ thống rót tiếp.")}
      </p>
      <ViecClient items={viec.items} daXong={viec.daXong} />
    </main>
  );
}
