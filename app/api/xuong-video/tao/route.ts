import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { kiemDauVaoTao, soManh, vuotHanMuc, type ViecXuong } from "@/lib/xuong-video";
import { timMa, dsViec, ghiViec, linkTaiLen, tuCam } from "@/lib/xuong-video-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  let ma;
  try { ma = await timMa(String(body?.ma || "")); }
  catch (e: any) { return NextResponse.json({ ok: false, loi: "Máy chủ đang lỗi, thử lại sau" }, { status: 500 }); }
  if (!ma) return NextResponse.json({ ok: false, loi: "Mã không đúng hoặc đã bị thu hồi" }, { status: 401 });

  const kt = kiemDauVaoTao(body);
  if (!kt.ok) return NextResponse.json({ ok: false, loi: kt.loi }, { status: 400 });
  const v = kt.v;
  const cam = tuCam(`${v.san_pham}\n${v.y_chinh}`);
  if (cam.length) {
    return NextResponse.json({ ok: false, loi: `Phần ghi chú có từ không được dùng cho thực phẩm bổ sung: ${cam.join(", ")}` }, { status: 400 });
  }
  try {
    const cua = (await dsViec()).filter((x) => x.ma_id === ma.id);
    const han = vuotHanMuc(cua);
    if (han) return NextResponse.json({ ok: false, loi: han }, { status: 429 });

    const id = crypto.randomUUID();
    const manh = soManh(v.bytes);
    const links = await linkTaiLen(id, manh);
    const viec: ViecXuong = {
      id, ma_id: ma.id, ten_dai_ly: ma.ten, tao_luc: new Date().toISOString(), trang_thai: "cho_tai",
      san_pham: v.san_pham, y_chinh: v.y_chinh, so_ban: v.so_ban,
      file: { ten: v.ten, duoi: v.duoi, bytes: v.bytes, manh },
    };
    await ghiViec(viec);
    return NextResponse.json({ ok: true, id, links });
  } catch (e: any) {
    return NextResponse.json({ ok: false, loi: "Máy chủ đang lỗi, thử lại sau" }, { status: 500 });
  }
}
