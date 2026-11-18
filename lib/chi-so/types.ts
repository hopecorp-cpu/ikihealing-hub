export type Den = "xanh" | "vang" | "do" | "xam";
export type TrangThai = "song" | "cham" | "chua-co-du-lieu" | "loi";

export type O = {
  key: string;
  phong: string;
  ten: string;
  giaTri: number | string | null;
  donVi: string;
  mucTieu: string | null;
  den: Den;
  trangThai: TrangThai;
  lyDo: string | null;
  nguon: string;
  capNhatLuc: string | null;
  tanSuat: string;
  nhayCam: boolean;
};

export type SucKhoe = { key: string; ok: boolean; note: string; chiThamKhao?: boolean };

export type Ctx = {
  health?: SucKhoe[];

  docCauHinh?: (key: string) => Promise<string | null>;
};

export const KHOA_O: (keyof O)[] = [
  "key", "phong", "ten", "giaTri", "donVi", "mucTieu", "den", "trangThai",
  "lyDo", "nguon", "capNhatLuc", "tanSuat", "nhayCam",
];
