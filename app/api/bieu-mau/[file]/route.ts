import { NextResponse } from "next/server";
import path from "path";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const file = decodeURIComponent(params.file || "").replace(/[\\/]/g, "").trim();
  if (!file || file.includes("..")) return NextResponse.json({ error: "bad file" }, { status: 400 });
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data, error } = await getServiceClient().storage.from("bieu-mau").download(file);
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ext = path.extname(file).toLowerCase();
  return new NextResponse(Buffer.from(await data.arrayBuffer()), {
    status: 200,
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "private, max-age=600",
    },
  });
}
