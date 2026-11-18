import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dịch họp" };

export default async function DichHopPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=dich-hop");
  return (
    <iframe
      src="/dich-hop-app/index.html"
      title="Dịch họp"
      allow="microphone; display-capture; speaker-selection; autoplay"
      className="w-full rounded-lg border border-gray-200"
      style={{ height: "calc(100vh - 96px)" }}
    />
  );
}
