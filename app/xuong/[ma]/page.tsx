import { timMa } from "@/lib/xuong-video-server";
import XuongClient from "./XuongClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Xưởng video | NOVA by ACME", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function Page({ params }: { params: { ma: string } }) {
  const ma = await timMa(decodeURIComponent(params.ma || "")).catch(() => null);
  if (!ma) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <h1 className="text-xl font-semibold">Đường link không còn hiệu lực</h1>
        <p className="mt-2 text-sm text-neutral-500">Liên hệ người phụ trách của ACME để nhận đường link mới.</p>
      </main>
    );
  }
  return <XuongClient ma={decodeURIComponent(params.ma)} ten={ma.ten} />;
}
