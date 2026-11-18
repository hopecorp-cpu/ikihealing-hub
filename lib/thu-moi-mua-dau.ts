import { wrap, trk, btn, getLeads, duocGuiQC, type Lead } from "@/lib/blog-nurture";
import { ganUtm } from "@/lib/utm";

const SITE = "https://example.com";
export const MA_CHIEN_DICH = "thu-moi-mua-dau";
const SP_DAM = "san-pham-a-quy-cach-cu";

export function linkShop(lid: string, slug?: string): string {
  const goc = `${SITE}/shop/${slug ? `?sp=${slug}` : ""}`;
  const u = ganUtm(goc, { source: "email-moimuadau", medium: "email", campaign: MA_CHIEN_DICH });
  return lid ? u + (u.includes("?") ? "&" : "?") + "lid=" + encodeURIComponent(lid) : u;
}

export const TIEU_DE = "Cuốn 100 món — anh chị nấu được mấy món rồi ạ?";

export function thuMoiMuaDau(lid: string, soNgay: number): string {
  const khiNao = soNgay >= 21 ? "Ba tuần trước" : soNgay >= 12 ? "Hai tuần trước" : soNgay >= 6 ? "Tuần trước" : "Mấy hôm trước";
  return wrap("Một câu hỏi nhỏ", `
    <p>${khiNao} anh chị tải cuốn <em>100 bữa ăn đủ đạm</em> bên em.</p>

    <p><strong>Em hỏi thật: anh chị nấu được mấy món rồi ạ?</strong></p>

    <p>Em hỏi vì đó là câu người đọc hay nhắn lại nhất — công thức thì thích, nhưng đi làm về lúc
    bảy giờ tối thì chẳng ai muốn đứng bếp thêm bốn mươi phút. Cuốn sách giải được chuyện
    <em>nấu gì</em>, nó không giải được chuyện <em>hôm nay không còn sức nấu</em>.</p>

    <p>Bên em làm bột đạm thực vật cho đúng những ngày như thế. Hộp 22 gói, đạm từ đậu và hạt,
    pha với nước hoặc sữa hạt trong khoảng hai phút. Giá 699.000đ một hộp, dùng được chừng
    ba tuần nếu mỗi ngày một phần.</p>

    <p>Nếu anh chị muốn thử, <strong>đơn đầu tiên</strong> bên em gửi kèm một hộp Trà Mẫu B
    (giá niêm yết 226.000đ) và bản thực đơn 7 ngày đủ đạm — coi như để anh chị bắt nhịp
    cho tuần đầu.</p>

    <p style="text-align:center;margin:22px 0">${btn(linkShop(lid, SP_DAM), "Xem hộp đạm &amp; đặt thử")}</p>

    <p style="font-size:14px;color:#475467">Chuyển khoản trước thì bên em miễn phí ship toàn quốc,
    hàng đi trong ngày. Anh chị muốn hỏi gì trước khi đặt thì cứ trả lời thẳng email này, em đọc hết ạ.</p>

    <p style="font-size:14px;color:#667085;margin-top:18px">Còn nếu anh chị vẫn đang nấu theo cuốn
    sách và thấy ổn thì tốt quá rồi — em không mời thêm gì nữa đâu ạ. Chúc anh chị một tuần ngon miệng.</p>

    <p style="font-size:13px;color:#98a2b3;margin-top:16px">Chưa đọc cuốn sách?
    <a href="${trk(`${SITE}/qua/100-bua-an-du-dam/`, lid)}" style="color:#2E8975">Tải lại ở đây</a>.</p>`);
}

export function chonNguoiNhan(
  leads: Lead[], sdtDaMua: Set<string>, daGui: Set<string>,
): { lead: Lead; soNgay: number }[] {
  const chuan = (s?: string) => String(s || "").replace(/\D/g, "").replace(/^84/, "0");
  const nay = Date.now();
  const ra: { lead: Lead; soNgay: number }[] = [];
  for (const l of leads) {
    const email = String(l.email || "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    if (!duocGuiQC(l)) continue;
    const sdt = chuan(l.phone);
    if (sdt && sdtDaMua.has(sdt)) continue;
    if (daGui.has(email)) continue;
    ra.push({ lead: l, soNgay: Math.max(0, Math.round((nay - Number(l.ts || nay)) / 86400e3)) });
  }
  ra.sort((a, b) => a.soNgay - b.soNgay);
  return ra;
}

export async function layNguoiNhan(sdtDaMua: Set<string>, daGui: Set<string>) {
  return chonNguoiNhan(await getLeads(), sdtDaMua, daGui);
}
