import { NextResponse } from "next/server";
import { danhDauTuChoi } from "@/lib/blog-nurture";
import { chuanEmail, kiemTokenHuy } from "@/lib/du-lieu-ca-nhan";

export const dynamic = "force-dynamic";

function trang(tieuDe: string, than: string, status = 200) {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${tieuDe} · NOVA</title>
<style>body{margin:0;background:#FFFFFF;font-family:-apple-system,"Be Vietnam Pro",Segoe UI,Arial,sans-serif;color:#1F2937}main{max-width:520px;margin:48px auto;padding:32px 28px;background:#fff;border-radius:18px;box-shadow:0 10px 40px rgba(16,24,40,.08)}h1{font-size:1.35rem;color:#1F4D1F;margin:0 0 12px}p{line-height:1.55;color:#475467}button{background:#1F4D1F;color:#fff;border:0;border-radius:8px;padding:14px 26px;font-size:1rem;font-weight:700;cursor:pointer}a{color:#2E6B2D}.nho{font-size:.82rem;color:#98a2b3;margin-top:22px}</style></head>
<body><main><h1>${tieuDe}</h1>${than}<p class="nho">Công ty Cổ phần ACME (NOVA) · contact@example.com · <a href="https://example.com/chinh-sach-bao-mat.html">Chính sách dữ liệu</a></p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function doc(req: Request) {
  const u = new URL(req.url);
  const e = chuanEmail(u.searchParams.get("e"));
  const t = u.searchParams.get("t") || "";
  return { e, t, ngay: u.searchParams.get("ngay") === "1", hopLe: !!e && kiemTokenHuy(e, t) };
}

async function huy(e: string) {
  const r = await danhDauTuChoi(e, "email", "link-huy-nhan");
  return trang(
    "Đã ngừng gửi email cho bạn",
    `<p>NOVA xác nhận đã nhận yêu cầu và <strong>đã ngừng</strong> gửi email tới <strong>${e}</strong>${r.daCo ? " (địa chỉ này đã được ngừng từ trước)" : ""}. Nếu có thư nào đang trên đường đi thì đó là thư cuối.</p>
     <p>Bạn vẫn có thể tải tài liệu đã nhận, dùng app NOVA và mua hàng bình thường. Muốn nhận lại tin, chỉ cần đăng ký lại trên example.com.</p>
     <p>Muốn xoá hẳn dữ liệu cá nhân? Gửi yêu cầu tại <a href="https://example.com/quyen-du-lieu.html">example.com/quyen-du-lieu</a> — NOVA phản hồi trong 2 ngày làm việc.</p>`,
  );
}

export async function GET(req: Request) {
  const { e, ngay, hopLe } = doc(req);
  if (!hopLe || !e) return trang("Liên kết không hợp lệ", `<p>Liên kết huỷ nhận này không đúng hoặc đã bị cắt khi sao chép. Bạn có thể trả lời email của NOVA với chữ <strong>Huỷ</strong>, hoặc gửi yêu cầu tại <a href="https://example.com/quyen-du-lieu.html">example.com/quyen-du-lieu</a>.</p>`, 400);
  if (ngay) return huy(e);
  return trang(
    "Ngừng nhận email từ NOVA?",
    `<p>Bạn sắp ngừng nhận mọi email từ NOVA tới <strong>${e}</strong> (bản tin, thực đơn, ưu đãi). Bấm nút bên dưới để xác nhận.</p>
     <form method="post" action="/api/huy-nhan?e=${encodeURIComponent(e)}&t=${encodeURIComponent(doc(req).t)}"><button type="submit">Xác nhận ngừng nhận</button></form>`,
  );
}

export async function POST(req: Request) {
  const { e, hopLe } = doc(req);
  if (!hopLe || !e) return NextResponse.json({ ok: false, error: "token" }, { status: 400 });

  const ct = req.headers.get("content-type") || "";
  const res = await huy(e);
  return ct.includes("application/x-www-form-urlencoded") && !(await req.text().catch(() => "")).includes("One-Click")
    ? res
    : NextResponse.json({ ok: true, email: e });
}
