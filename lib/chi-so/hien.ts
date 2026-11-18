import { CHU } from "./muc-tieu";
import type { O } from "./types";

export function hienSo(o: O): string {
  if (o.trangThai === "loi") return "lỗi";
  if (o.trangThai === "chua-co-du-lieu" || o.giaTri == null) return CHU.chuaDuLieu;
  if (typeof o.giaTri === "number") {
    const so = new Intl.NumberFormat("vi-VN").format(o.giaTri);
    return o.donVi ? `${so} ${o.donVi}` : so;
  }
  return String(o.giaTri);
}
