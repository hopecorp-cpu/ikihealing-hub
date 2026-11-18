import kho from "@/data/tuyen-bai-san-pham.json";
import { CATEGORIES, type CategoryKey } from "./site";
import type { Topic } from "./writer";

type MucTuyenBai = {
  slug: string;
  title: string;
  tuKhoa: string;
  categoryKey: string;
  yDinh: string;
  angle: string;
  anh?: string[];
  linkXuong?: string[];
};

type Cum = {
  id: string;
  sanPham: string;
  giaNiemYet?: string;
  thanhPhan?: string;
  tuKhoaGoc: string;
  raoRieng?: string[];
  truCot: MucTuyenBai;
  nhanh: MucTuyenBai[];
};

export function boDau(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function tieuDeCoTuKhoa(title: string, tuKhoa?: string): boolean {
  if (!tuKhoa) return true;
  return boDau(title).includes(boDau(tuKhoa));
}

function dungAngle(muc: MucTuyenBai, cum: Cum, laTruCot: boolean, slugCoThat: string[]): string {
  const phan: string[] = [muc.angle];

  phan.push(
    `TỪ KHOÁ CHÍNH: "${muc.tuKhoa}" — phải nằm trong tiêu đề và xuất hiện tự nhiên ở đoạn mở đầu, ` +
      `KHÔNG nhồi lặp lại. Ý định người tìm: ${muc.yDinh}.`
  );

  phan.push(
    `SẢN PHẨM CỦA CỤM: ${cum.sanPham}` +
      (cum.thanhPhan ? ` (${cum.thanhPhan})` : "") +
      (cum.giaNiemYet ? `, giá niêm yết ${cum.giaNiemYet}` : "") +
      `. Chỉ nhắc sản phẩm ở ĐÚNG MỘT mục h2 và ở thế một lựa chọn đặt cạnh các lựa chọn khác, ` +
      `trừ bài trụ thương hiệu vốn là trang thông tin về chính sản phẩm. ` +
      `CẤM tự đặt giá khác, CẤM tự chế khuyến mãi (khuyến mãi luôn là TẶNG QUÀ, không giảm phần trăm).`
  );

  if (cum.raoRieng?.length) {
    phan.push(`RÀO RIÊNG CỦA CỤM NÀY (nặng hơn rào chung, vi phạm là bài bị loại):\n- ${cum.raoRieng.join("\n- ")}`);
  }

  if (laTruCot) {
    const co = (muc.linkXuong || []).filter((s) => slugCoThat.includes(s));
    if (co.length) {
      phan.push(
        `LINK NỘI BỘ BẮT BUỘC: đây là bài TRỤ của cụm, phải dẫn xuống các bài chuyên sâu sau ` +
          `(mỗi link đặt trong đúng mục nội dung liên quan, chữ neo tự nhiên): ${co.join(", ")}.`
      );
    }
  } else if (slugCoThat.includes(cum.truCot.slug)) {
    phan.push(
      `LINK NỘI BỘ BẮT BUỘC: dẫn về bài trụ của cụm "${cum.truCot.slug}.html" ở phần mở đầu ` +
        `hoặc phần kết, với chữ neo chứa cụm "${cum.tuKhoaGoc}".`
    );
  }

  if (muc.anh?.length) {

    phan.push(
      `TRÌNH BÀY: nội dung này cần nhìn được, không chỉ đọc được. Dựng ít nhất MỘT bảng <table> ` +
        `HTML thật (có <thead>/<tbody>) cho phần so sánh hoặc số liệu trong bài. ` +
        `Ảnh dự kiến của bài (dùng để đặt heroPrompt và heroAlt cho sát): ${muc.anh.join(" · ")}.`
    );
  }

  return phan.join("\n");
}

export function layTuyenBai(existingSlugs: string[], n: number, boQua?: Set<string>): Topic[] {
  if (n <= 0) return [];
  const daCo = new Set(existingSlugs);

  const phat = boQua || new Set<string>();
  const bo = (slug: string) => daCo.has(slug) || phat.has(slug);
  const cums = (kho.cum || []) as unknown as Cum[];

  const xepHang: Array<{ muc: MucTuyenBai; cum: Cum; laTruCot: boolean }> = [];

  for (const cum of cums) {
    if (cum.truCot && !bo(cum.truCot.slug)) {
      xepHang.push({ muc: cum.truCot, cum, laTruCot: true });
    }
  }

  const conLai = cums.map((cum) => (cum.nhanh || []).filter((m) => !bo(m.slug)).map((muc) => ({ muc, cum, laTruCot: false })));
  for (let i = 0; xepHang.length < n * 3 && conLai.some((l) => l.length > i); i++) {
    for (const list of conLai) if (list[i]) xepHang.push(list[i]);
  }

  return xepHang.slice(0, n).map(({ muc, cum, laTruCot }) => ({
    slug: muc.slug,
    title: muc.title,

    categoryKey: ((Object.keys(CATEGORIES) as string[]).includes(muc.categoryKey)
      ? muc.categoryKey
      : "cam-nang") as CategoryKey,
    tuKhoa: muc.tuKhoa,
    angle: dungAngle(muc, cum, laTruCot, existingSlugs),
  }));
}

export function conLaiTrongKho(existingSlugs: string[]): number {
  const daCo = new Set(existingSlugs);
  return ((kho.cum || []) as unknown as Cum[]).reduce(
    (s, c) => s + (daCo.has(c.truCot.slug) ? 0 : 1) + (c.nhanh || []).filter((m) => !daCo.has(m.slug)).length,
    0
  );
}
