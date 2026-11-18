import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui/kit";
import { PhoneCall, Trophy } from "lucide-react";
import { BUCKET_GHI_AM } from "@/lib/cuoc-goi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ghi âm cuộc gọi | ACME Ops Hub" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/");

  const sb = getServiceClient();
  const [{ data: cfg }, { data: cuoc, error }] = await Promise.all([
    sb.from("config").select("value").eq("key", "kich_ban_thang").maybeSingle(),
    sb.from("cuoc_goi").select("id,sale,sdt,chieu,bat_dau,thoi_luong_giay,trang_thai,diem,cham,ban_chep,file_path,loi")
      .order("bat_dau", { ascending: false }).limit(60),
  ]);
  let kb: any = null;
  try { kb = cfg?.value ? JSON.parse(cfg.value) : null; } catch { kb = null; }

  const ds = (cuoc || []) as any[];
  const { data: ky } = ds.length
    ? await sb.storage.from(BUCKET_GHI_AM).createSignedUrls(ds.map((c) => c.file_path), 3600)
    : { data: [] as any[] };
  const linkNghe = new Map<string, string>();
  for (const k of ky || []) if (k.path && k.signedUrl && !k.error) linkNghe.set(k.path, k.signedUrl);

  const gio = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  const anSdt = (s: string | null) => (s ? `${s.slice(0, 4)}***${s.slice(-3)}` : "—");
  const mauDiem = (d: number | null) => (d == null ? "#9CA3AF" : d >= 7 ? "#059669" : d >= 5 ? "#D97706" : "#DC2626");
  const tenTT: Record<string, string> = { cho_chep: "chờ chấm", qua_ngan: "dưới 30 giây", loi: "lỗi" };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <PageHeader icon={PhoneCall} title="Ghi âm cuộc gọi"
        subtitle="Máy Samsung tự ghi âm, app ACME Ghi âm đẩy về, máy chép lời và chấm mỗi giờ. Thắng/thua đo bằng đơn thật trong 7 ngày." />

      {error && (
        <SectionCard>
          <p className="text-sm text-red-700">Chưa đọc được bảng cuoc_goi: {error.message}. Nếu là lần đầu, cần chạy migration 077_cuoc_goi.sql.</p>
        </SectionCard>
      )}

      <SectionCard>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-900">Kịch bản thắng</h2>
          {kb && <span className="text-xs text-gray-500">{kb.khoang} · {kb.thang} cuộc ra đơn / {kb.thua} cuộc không ra đơn · phân tích {gio(kb.at)}</span>}
        </div>
        {kb
          ? <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{kb.noiDung}</div>
          : <p className="text-sm text-gray-500">Chưa có. Máy phân tích sáng Thứ Hai, khi đã có ít nhất 3 cuộc gọi ra đơn.</p>}
      </SectionCard>

      <SectionCard>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">60 cuộc gần nhất</h2>
        {!ds.length && <p className="text-sm text-gray-500">Chưa có cuộc nào được đẩy lên.</p>}
        <div>
          {ds.map((c) => {
            const url = linkNghe.get(c.file_path);
            return (
              <details key={c.id} className="py-2.5 border-b border-gray-100 last:border-0">
                <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer list-none">
                  <span className="text-sm font-bold tabular-nums w-10 text-right" style={{ color: mauDiem(c.diem) }}>
                    {c.diem != null ? `${c.diem}/10` : "—"}
                  </span>
                  <span className="text-sm text-gray-900 w-24">{c.sale || "(chưa gán)"}</span>
                  <span className="text-xs text-gray-500 w-28">{gio(c.bat_dau)}</span>
                  <span className="text-xs text-gray-500 w-24">{c.chieu === "den" ? "khách gọi đến" : "gọi đi"} · {Math.max(1, Math.round(c.thoi_luong_giay / 60))}p</span>
                  <span className="text-xs text-gray-400 w-24 tabular-nums">{anSdt(c.sdt)}</span>
                  <span className="text-xs flex-1 min-w-[160px]">
                    {c.trang_thai !== "da_cham" && <span className="text-gray-400">{tenTT[c.trang_thai] || c.trang_thai}</span>}
                    {((c.cham?.tags || []) as string[]).map((t) => (
                      <span key={t} className={`inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded-md ${t.startsWith("VI PHẠM") ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}>{t}</span>
                    ))}
                  </span>
                </summary>
                <div className="mt-2 pl-12 space-y-2">
                  {url && <audio controls preload="none" src={url} className="w-full max-w-md" />}
                  {c.loi && <p className="text-xs text-red-700">Lỗi: {c.loi}</p>}
                  {c.cham && (
                    <div className="text-xs text-gray-700 space-y-1">
                      {c.cham.khach_can_gi && <p><b>Khách cần:</b> {c.cham.khach_can_gi}</p>}
                      {!!c.cham.lam_tot?.length && <p><b>Làm tốt:</b> {c.cham.lam_tot.join(" · ")}</p>}
                      {!!c.cham.yeu_diem?.length && <p><b>Yếu:</b> {c.cham.yeu_diem.join(" · ")}</p>}
                      {!!c.cham.goi_y_cu_the?.length && <p><b>Gợi ý:</b> {c.cham.goi_y_cu_the.join(" · ")}</p>}
                    </div>
                  )}
                  {c.ban_chep && <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-2 max-h-80 overflow-auto font-sans">{c.ban_chep}</pre>}
                </div>
              </details>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
