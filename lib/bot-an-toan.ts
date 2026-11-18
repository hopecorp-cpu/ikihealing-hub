import { maskPII } from "./covan/pii";
import { laCeo } from "./brain-quyen";

const sach = (s: unknown) => String(s ?? "").trim();

export function cheChoChat(chatId: unknown, ceoId: unknown, text: string, laLLM = false): string {
  const c = sach(ceoId);
  const dich = sach(chatId);
  if (c && dich === c) return text;
  if (dich.startsWith("-") || laLLM) return maskPII(text);
  return text;
}

export function catKhoiTaiSan(live: string): string {
  return String(live || "").split("\n").filter((d) => !/^\s*\[TÀI SẢN\]/.test(d)).join("\n");
}

export const GIOI_HAN_LUOT_BOT = { moiPhut: 6, moiNgay: 150 };
export type GioiHanLuot = { moiPhut: number; moiNgay: number };

export type SoLuot = { ngay: string; nguoi: Record<string, [number, number, number]> };
export const CAU_VUOT_LUOT = "Em đang nhận hơi nhiều câu một lúc — anh/chị đợi chút rồi hỏi lại giúp em nhé.";

export function xetLuot(so: SoLuot | null, nguoi: string, now: number, ngay: string, gh: GioiHanLuot): { vuot: boolean; so: SoLuot } {
  const s: SoLuot = so && typeof so === "object" && so.nguoi && so.ngay === ngay ? { ngay, nguoi: { ...so.nguoi } } : { ngay, nguoi: {} };
  const [p, t0, d] = s.nguoi[nguoi] || [0, now, 0];
  const conPhut = now - t0 < 60_000;
  const phut = conPhut ? p : 0;
  if (d >= gh.moiNgay || phut >= gh.moiPhut) return { vuot: true, so: s };
  s.nguoi[nguoi] = [phut + 1, conPhut ? t0 : now, d + 1];
  return { vuot: false, so: s };
}

export function quyenBatLaiCampaign(fromId: unknown, ceoId: unknown, nguoiDang: string[]): { cho: boolean; canhBao: boolean } {
  if (laCeo(fromId, ceoId)) return { cho: true, canhBao: false };
  if (!nguoiDang.length) return { cho: true, canhBao: true };
  const f = sach(fromId);
  return { cho: !!f && nguoiDang.includes(f), canhBao: false };
}

export function chuViecDeploy(id: string): string {
  return `[DEPLOY] Đẩy lên production thay đổi của việc ${id}. Theo luật vàng #15 + mục 1b CLAUDE.md: CẤM gõ thẳng vercel --prod. `
    + `Chỉ deploy commit ĐÃ ĐẨY lên origin/main: dựng worktree sạch tách từ origin/main mới nhất (git fetch origin), `
    + `kiểm git status --porcelain rỗng và git branch -r --contains HEAD có origin/main, rồi chạy scripts/deploy-prod.sh trong worktree đó (repo khác ops-hub: script deploy tương đương của repo đó, không có thì DỪNG và báo). `
    + `Sai một điều thì KHÔNG deploy, báo lại lý do. Không dùng --du-biet.`;
}
