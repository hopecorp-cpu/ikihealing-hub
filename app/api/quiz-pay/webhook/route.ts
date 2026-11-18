import { NextResponse } from "next/server";
import { verifyWebhook, getQuizOrder } from "@/lib/payos";
import { fulfillQuizPaid } from "@/lib/quiz-fulfill";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {  }

  if (!body || !body.data) return NextResponse.json({ success: true });

  if (!verifyWebhook(body)) {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
  }

  const d = body.data || {};
  const paid = (body.code === "00" || body.success === true);

  if (paid && d.orderCode) {
    const o = await getQuizOrder(d.orderCode);

    await fulfillQuizPaid(o, {
      amount: Number(d.amount || 0) || undefined,
      paidAt: d.transactionDateTime ? Date.parse(d.transactionDateTime) || Date.now() : Date.now(),
      reference: d.reference || "",
    });
  }

  return NextResponse.json({ success: true });
}
