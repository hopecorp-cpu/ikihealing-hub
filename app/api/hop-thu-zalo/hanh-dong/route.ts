import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isBodRole } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { normalizePhone } from "@/lib/zalo";
import { nickChoPhep } from "@/lib/hop-thu-zalo-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });
  if (isBodRole(user.role)) return NextResponse.json({ loi: "Không có quyền" }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const viec = String(b.viec || "");
  const own = String(b.own || "").trim();

  const duocXem = await nickChoPhep(user);
  if (own && duocXem !== null && !duocXem.includes(own)) {
    return NextResponse.json({ loi: "Không có quyền thao tác trên hộp thư này" }, { status: 403 });
  }

  const sb = getServiceClient();
  const ten = String(b.ten || "").trim() || "khách Zalo";
  const phone = String(b.phone || "").trim();

  try {
    if (viec === "tao-viec") {
      const tieuDe = String(b.tieuDe || "").trim();
      if (!tieuDe) return NextResponse.json({ loi: "Thiếu tiêu đề việc" }, { status: 400 });
      const han = String(b.han || "").trim() || vnDateStr();
      const { error } = await sb.from("tasks").insert({
        title: tieuDe,
        description: [
          `Khách: ${ten}`,
          phone ? `SĐT: ${phone}` : "",

          own && b.uid ? `Hội thoại: /hop-thu-zalo?hoi-thoai=${own}|${b.uid}` : "",
          b.ghiChu || "",
        ].filter(Boolean).join("\n"),
        assigner_id: (user as any).id || null,
        assignee_id: (user as any).id || null,
        related_to: "khach-zalo",

        priority: b.gap ? "urgent" : "medium",
        status: "todo",
        due_date: han,
        tags: ["hop-thu-zalo"],
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, han });
    }

    if (viec === "ghi-cham") {
      if (!phone) return NextResponse.json({ loi: "Khách chưa có số điện thoại nên chưa ghi được lượt chăm" }, { status: 400 });
      const kieu = ["call", "message", "gift"].includes(String(b.kieu)) ? String(b.kieu) : "message";
      const { error } = await sb.from("care_events").insert({
        customer_phone: normalizePhone(phone) || phone,
        customer_name: ten,
        sale_name: b.sale || user.full_name || null,
        sale_id: (user as any).id || null,
        kind: kieu,
        channel: "zalo",
        content: String(b.ghiChu || "").trim() || null,
        month: vnDateStr().slice(0, 7),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ loi: "Việc không hợp lệ" }, { status: 400 });
  } catch (e: any) {

    return NextResponse.json({ loi: String(e?.message || e) }, { status: 500 });
  }
}
