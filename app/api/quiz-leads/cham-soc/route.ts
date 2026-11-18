import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isBodRole, isManagerOrAbove } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { kieuHopLe, phanHoiHopLe, napTrangThai, PHAN_HOI, sdt0 } from "@/lib/quiz-cham-soc";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });
  if (isBodRole(user.role)) return NextResponse.json({ loi: "Không có quyền" }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const viec = String(b.viec || "");
  const leadId = String(b.leadId || "").trim();

  const sb = getServiceClient();
  const ten = String(b.ten || "").trim() || null;
  const ghiChu = String(b.ghiChu || "").trim();

  const kenh = String(b.kenh || "quiz").trim().slice(0, 40) || "quiz";

  try {

    const cot = "id, phone, assignee_id, status, first_contact_at, users:assignee_id(full_name)";
    let lead: any = null;
    if (leadId) {
      const { data } = await sb.from("leads").select(cot).eq("id", leadId).maybeSingle();
      lead = data || null;
      if (!lead) return NextResponse.json({ loi: "Không tìm thấy lead này" }, { status: 404 });
    }

    const phone = sdt0(lead?.phone ?? b.phone);
    if (!phone) return NextResponse.json({ loi: "Khách này chưa có số điện thoại hợp lệ nên chưa ghi được" }, { status: 400 });

    if (!lead) {
      const { data } = await sb
        .from("leads")
        .select(cot)
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lead = data || null;
    }

    if (lead?.assignee_id && !isManagerOrAbove(user.role) && lead.assignee_id !== (user as any).id) {
      const chu = (lead as any).users?.full_name;
      return NextResponse.json({ loi: `Khách này đang do ${chu || "sale khác"} chăm, bạn không sửa được` }, { status: 403 });
    }

    const chung = {
      customer_phone: phone,
      customer_name: ten,
      sale_name: (user as any).full_name || null,
      sale_id: (user as any).id || null,
      channel: kenh,
      month: vnDateStr().slice(0, 7),
    };

    if (viec === "cham") {
      const kieu = String(b.kieu || "");
      if (!kieuHopLe(kieu)) return NextResponse.json({ loi: "Kiểu chăm sóc không hợp lệ" }, { status: 400 });
      const { error } = await sb.from("care_events").insert({ ...chung, kind: kieu, content: ghiChu || null });
      if (error) throw new Error(error.message);

      if (lead && (!lead.first_contact_at || lead.status === "new")) {
        await sb.from("leads")
          .update({ first_contact_at: lead.first_contact_at || new Date().toISOString(), status: lead.status === "new" ? "contacted" : lead.status })
          .eq("id", lead.id);
      }
      return NextResponse.json({ ok: true, trongMayChia: !!lead });
    }

    if (viec === "phan-hoi") {
      const ma = String(b.phanHoi || "");
      if (!phanHoiHopLe(ma)) return NextResponse.json({ loi: "Tình trạng phản hồi không hợp lệ" }, { status: 400 });
      if (ghiChu.length < 5) return NextResponse.json({ loi: "Ghi rõ tình hình giúp em (ít nhất 5 ký tự)" }, { status: 400 });
      const { error } = await sb.from("care_events").insert({ ...chung, kind: "note", outcome: ma, content: ghiChu });
      if (error) throw new Error(error.message);

      if (ma === "tuchoi") {
        try {
          const { ghiTuChoi } = await import("@/lib/du-lieu-ca-nhan");
          await ghiTuChoi(sb, { phone: (chung as any).customer_phone, kenh: "sale-ghi", lyDo: "khach-yeu-cau", nguon: `cham-soc:${(chung as any).channel || ""}`, tinGoc: ghiChu, daXacNhan: true });
        } catch {  }
      }

      const moi = napTrangThai(lead?.status, PHAN_HOI.find((p) => p.ma === ma)?.trangThai || "contacted");
      if (lead && (moi || !lead.first_contact_at)) {
        const patch: any = {};
        if (moi) patch.status = moi;

        if (!lead.first_contact_at) patch.first_contact_at = new Date().toISOString();
        await sb.from("leads").update(patch).eq("id", lead.id);
      }
      return NextResponse.json({ ok: true, trongMayChia: !!lead });
    }

    return NextResponse.json({ loi: "Việc không hợp lệ" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ loi: String(e?.message || e) }, { status: 500 });
  }
}
