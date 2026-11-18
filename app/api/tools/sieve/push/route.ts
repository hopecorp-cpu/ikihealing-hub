import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const SIEVE = "https://mango.sievedata.com/v2";

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-sieve-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Thiếu Sieve API key (x-sieve-key header)" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const fn = (form.get("function") as string) || "sieve/eye-contact-correction";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file video" }, { status: 400 });
  }

  try {

    const uploadInit = await fetch(`${SIEVE}/upload-url`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ file_name: file.name || "input.webm" }),
    });
    if (!uploadInit.ok) {
      const t = await uploadInit.text();
      return NextResponse.json({ error: `Sieve upload-url: ${uploadInit.status} ${t}` }, { status: 502 });
    }
    const { upload_url, id: file_id, url: file_url } = await uploadInit.json();

    const buf = Buffer.from(await file.arrayBuffer());
    const put = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "video/webm" },
      body: buf,
    });
    if (!put.ok) {
      const t = await put.text();
      return NextResponse.json({ error: `Sieve PUT: ${put.status} ${t}` }, { status: 502 });
    }

    const push = await fetch(`${SIEVE}/push`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        function: fn,
        inputs: { file: { url: file_url || `sieve://${file_id}` } },
      }),
    });
    if (!push.ok) {
      const t = await push.text();
      return NextResponse.json({ error: `Sieve push: ${push.status} ${t}` }, { status: 502 });
    }
    const job = await push.json();
    return NextResponse.json({ jobId: job.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Lỗi không xác định" }, { status: 500 });
  }
}
