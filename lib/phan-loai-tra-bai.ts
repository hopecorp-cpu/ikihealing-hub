import { khongDau } from "@/lib/covan/loc-y-dinh";

export type NhomLoi = "sai_thong_tin" | "phap_ly" | "giong_van" | "dai_nhat" | "lech_doi_tuong" | "khac";
export const TEN_NHOM_LOI: Record<NhomLoi, string> = {
  sai_thong_tin: "sai thông tin/giá",
  phap_ly: "rủi ro pháp lý (TPBS, từ cấm)",
  giong_van: "lệch giọng thương hiệu",
  dai_nhat: "dài, chung chung, nhạt",
  lech_doi_tuong: "lệch đối tượng/chủ đề",
  khac: "khác",
};

const LUAT: [NhomLoi, string[]][] = [
  ["phap_ly", ["phap ly", "tu cam", "chua benh", "dieu tri", "thai doc", "cong dung", "noi qua", "cam ket", "hieu qua sau", "tpbs", "thuc pham chuc nang", "chiet khau", "giam %"]],
  ["sai_thong_tin", ["sai gia", "sai so", "sai thong tin", "khong dung", "ghi nham", "viet nham", "nham gia", "thieu thong tin", "sai ten", "sai thanh phan"]],
  ["giong_van", ["giong", "van phong", "khong giong", "sen", "suong", "may moc", "tho", "xung ho", "emoji"]],
  ["dai_nhat", ["dai qua", "qua dai", "dai dong", "chung chung", "nhat", "yeu", "khong co hook", "mo bai", "lan man"]],
  ["lech_doi_tuong", ["sai doi tuong", "khong phai khach", "lech", "chu de", "khong lien quan", "sai kenh"]],
];

const KHEN = ["ok", "oke", "duoc", "dep", "tot", "hay", "duyet", "dang duoc", "chuan", "good"];

export function phanLoaiTraBai(text: string): NhomLoi | null {
  const kd = ` ${khongDau(String(text || "")).replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim()} `;
  if (kd.trim().length < 8) return null;
  for (const [nhom, tu] of LUAT) if (tu.some((t) => kd.includes(` ${t} `))) return nhom;
  const tu = kd.trim().split(" ");
  if (tu.length <= 4 && tu.every((x) => KHEN.includes(x) || x.length <= 2)) return null;
  return "khac";
}

export function cauBaiHoc(nhom: NhomLoi, tieuDe: string, nhanXet: string): string {
  return `Quản lý trả bài "${String(tieuDe || "").slice(0, 60)}" vì ${TEN_NHOM_LOI[nhom]}: ${String(nhanXet || "").trim().slice(0, 120)}`;
}
