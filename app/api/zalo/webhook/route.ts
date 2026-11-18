import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { insertAndAssign } from "@/lib/leads";
import { sendOAMessage } from "@/lib/zalo";
import { handleInboundMessage, chamTinKhach, type InboundResult } from "@/lib/zalo-agent";
import { docCheDoOa, docKhoNhapOa, ghiKhoNhapOa, layTokenOa } from "@/lib/zalo-oa-nhap-server";
import { themNhapOa, LOI_CHAO_FOLLOW_OA } from "@/lib/zalo-oa-che-do";
import { lyDoDung } from "@/lib/dung-khan-cap";
import { ghiTuChoi } from "@/lib/du-lieu-ca-nhan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() { return NextResponse.json({ ok: true }); }

function verify(appId: string, raw: string, timestamp: string, mac: string, secret: string): boolean {
  const expect = crypto.createHash("sha256").update(appId + raw + timestamp + secret).digest("hex");
  const got = (mac || "").replace(/^mac=/, "");
  return got === expect;
}

type Luot = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const raw = await req.text();
  let body: any = {};
  try { body = JSON.parse(raw); } catch { }
  const sig = req.headers.get("x-zevent-signature") || "";
  const appId = String(body.app_id || process.env.ZALO_OA_APP_ID || "");

  const secret = (process.env.ZALO_OA_APP_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook chưa cấu hình bảo mật (thiếu ZALO_OA_APP_SECRET)" }, { status: 503 });
  }
  if (!verify(appId, raw, String(body.timestamp || ""), sig, secret)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  const event = String(body.event_name || "");
  const senderId = body?.sender?.id ? String(body.sender.id) : "";
  const sb = getServiceClient();

  const cheDoGoc = await docCheDoOa();
  const cheDo = cheDoGoc === "tu_gui" && (await lyDoDung("nhan_khach")) ? "nhap" : cheDoGoc;
  const token = cheDo === "tu_gui" ? await layTokenOa() : undefined;

  if (/^user_send_text$/.test(event) && senderId) {
    const text = String(body?.message?.text || "").trim();

    const HKEY = `zalo_hist_${senderId}`;
    let history: Luot[] = [];
    try { history = JSON.parse((await getConfigValue(HKEY)) || "[]"); } catch { }

    const r: InboundResult = cheDo === "tat"
      ? { reply: "", ...chamTinKhach(text, history) }
      : await handleInboundMessage(text, history, "", "zalo", { kenh: "zalo_oa", senderId });
    const { reply, hot, capturedPhone, medical, handoffNote } = r;

    if (r.yKhach?.ngungNhan) {
      await ghiTuChoi(sb, { zaloUid: senderId, kenh: "zalo_oa", lyDo: "khách nhắn xin ngừng nhận tin", nguon: "zalo-oa-webhook", tinGoc: text })
        .catch((e: any) => console.error("[zalo-oa] không ghi được danh sách từ chối:", e?.message || e));
    }

    let choDuyet = false;
    if (cheDo === "tu_gui") {
      if (token && reply) await sendOAMessage(senderId, reply, token).catch(() => { });
    } else {

      try {
        const kho = await docKhoNhapOa();
        await ghiKhoNhapOa(themNhapOa(kho, senderId, {
          tinKhach: text.slice(0, 500), nhap: cheDo === "nhap" ? reply : "",
          luc: new Date().toISOString(), suKien: "tin",
          hot, medical: !!medical, sdt: capturedPhone, cheDo,
        }));
        choDuyet = true;
      } catch (e: any) { console.error("[zalo-oa] không ghi được kho nháp:", e?.message || e); }
    }

    try {
      const them: Luot[] = cheDo === "tu_gui" && reply
        ? [{ role: "user", content: text.slice(0, 500) }, { role: "assistant", content: reply.slice(0, 500) }]
        : [{ role: "user", content: text.slice(0, 500) }];
      await setConfigValue(HKEY, JSON.stringify([...history, ...them].slice(-8)), `Lịch sử chat Zalo ${senderId}`);
    } catch { }

    if (hot || capturedPhone || medical) {
      await insertAndAssign(sb, {
        customer_name: null, phone: capturedPhone, source: "Zalo OA", channel: "zalo",
        external_id: `zalooa:${senderId}`,
        note: (handoffNote || text).slice(0, 400),
      }, { notify: true }).catch(() => { });
    }
    return NextResponse.json({ ok: true, hot, medical: !!medical, cheDo, choDuyet });
  }

  if (/^follow$/.test(event) && senderId) {
    if (cheDo === "tu_gui") {
      if (token) await sendOAMessage(senderId, LOI_CHAO_FOLLOW_OA, token).catch(() => { });
      return NextResponse.json({ ok: true, followed: true, cheDo });
    }
    try {
      const kho = await docKhoNhapOa();
      await ghiKhoNhapOa(themNhapOa(kho, senderId, {
        tinKhach: "(khách vừa quan tâm OA — chưa nhắn gì)", nhap: LOI_CHAO_FOLLOW_OA,
        luc: new Date().toISOString(), suKien: "follow", cheDo,
      }));
    } catch (e: any) { console.error("[zalo-oa] không ghi được lời chào vào kho nháp:", e?.message || e); }
    return NextResponse.json({ ok: true, followed: true, cheDo, choDuyet: true });
  }

  return NextResponse.json({ ok: true, ignored: event, cheDo });
}
