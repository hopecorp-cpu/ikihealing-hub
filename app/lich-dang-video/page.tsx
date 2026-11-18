import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { loadQueue, loadLibrary, queueSummary, PAGES } from "@/lib/video-queue";
import { getConfigValue } from "@/lib/app-config";
import VideoQueueClient from "./VideoQueueClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Lịch đăng video | IKIHEALING Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role) && !isMktPosition((user as any).position)) redirect("/?denied=lich-dang-video");

  const [queue, library, summary, statusRaw] = await Promise.all([
    loadQueue().catch(() => []),
    loadLibrary().catch(() => []),
    queueSummary().catch(() => ({ waiting: 0, approved: 0, scheduled: 0, failed: 0, nextDays: [], gapWarning: null })),
    getConfigValue("video_poster_status").catch(() => null),
  ]);

  let posterStatus: { at?: string; ok?: boolean; scheduled?: number; failed?: number } | null = null;
  try { posterStatus = statusRaw ? JSON.parse(statusRaw) : null; } catch { }

  return (
    <VideoQueueClient
      queue={queue.slice().reverse()}
      library={library}
      pages={PAGES}
      summary={summary}
      posterStatus={posterStatus}
    />
  );
}
