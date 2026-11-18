import { NextResponse } from "next/server";
import { getQuizOrder, getPayosStatus } from "@/lib/payos";
import { fulfillQuizPaid } from "@/lib/quiz-fulfill";

export const dynamic = "force-dynamic";

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://example.com",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors() }); }

export async function GET(req: Request) {
  const orderCode = new URL(req.url).searchParams.get("orderCode");
  if (!orderCode) return NextResponse.json({ status: "UNKNOWN", error: "Thiếu orderCode" }, { status: 400, headers: cors() });

  const local = await getQuizOrder(orderCode);
  if (local?.status === "paid") {

    if (!local.fulfilled) await fulfillQuizPaid(local).catch(() => {});
    return NextResponse.json({ status: "PAID", local: true }, { headers: cors() });
  }

  const status = await getPayosStatus(orderCode);

  if (status === "PAID") {
    await fulfillQuizPaid(local, {}).catch(() => {});
  }
  return NextResponse.json({ status }, { headers: cors() });
}
