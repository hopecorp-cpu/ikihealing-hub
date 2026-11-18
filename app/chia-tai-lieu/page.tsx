import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import ShareClient from "./ShareClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Gửi tài liệu cho khách | IKIHEALING Hub") };
}

const DOCS = [
  { slug: "cam-nang-suc-khoe-chu-dong", title: "Cẩm nang chăm sóc sức khoẻ chủ động", tag: "Cẩm nang · PDF" },
  { slug: "lang-nghe-co-the", title: "Lắng nghe cơ thể", tag: "Ebook · PDF" },
];

function slugName(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role) || isSalePosition((user as any).position);
  if (!ok) redirect("/");

  const meName = user.full_name || "";
  const meSlug = slugName(meName) || slugName(user.email?.split("@")[0] || "");
  return <ShareClient docs={DOCS} meName={meName} meSlug={meSlug} />;
}
