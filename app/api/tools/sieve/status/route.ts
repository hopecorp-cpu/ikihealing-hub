import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SIEVE = "https://mango.sievedata.com/v2";

export async function GET(req: Request) {
  const apiKey = req.headers.get("x-sieve-key");
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("id");
  if (!apiKey) return NextResponse.json({ error: "Thiếu Sieve API key" }, { status: 400 });
  if (!jobId) return NextResponse.json({ error: "Thiếu jobId" }, { status: 400 });

  try {
    const r = await fetch(`${SIEVE}/jobs/${jobId}`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: `Sieve status: ${r.status} ${t}` }, { status: 502 });
    }
    const data = await r.json();

    const status: string = data.status;
    let outputUrl: string | null = null;
    if (status === "finished") {
      const out = data.outputs?.[0];
      outputUrl = out?.data?.url || out?.url || null;
    }
    return NextResponse.json({ status, outputUrl, raw: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Lỗi" }, { status: 500 });
  }
}
