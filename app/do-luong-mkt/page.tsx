import Link from "next/link";
import {
  ChevronRight, BarChart3, ExternalLink, Database, ShieldCheck, Facebook, Youtube,
  Upload, PlusCircle, RefreshCw, CalendarDays, Film, Users, Settings, Rocket, Info,
  TrendingUp, AlertTriangle,
} from "lucide-react";
import { getT } from "@/lib/i18n-server";
import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import AdsControl from "./AdsControl";

export function generateMetadata() {
  const { t } = getT();
  return { title: t("Đo lường đa kênh (MKT Studio) — ACME Hub") };
}
export const dynamic = "force-dynamic";

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const ageText = (iso?: string): string => {
  if (!iso) return "chưa có";
  const h = (Date.now() - new Date(iso).getTime()) / 3600e3;
  if (!isFinite(h)) return "chưa có";
  if (h < 1) return "vừa xong"; if (h < 48) return `${Math.round(h)}h trước`; return `${Math.round(h / 24)} ngày trước`;
};

async function loadAdsPerf() {
  const sb = getServiceClient();
  const month = vnDateStr().slice(0, 7);
  const get = async (k: string) => { try { const v = (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value; return v ?? null; } catch { return null; } };
  const [adsRaw, spendRaw, topRaw] = await Promise.all([get("ads_campaigns"), get(`mkt_spend_${month}`), get("mkt_top_posts")]);
  let ads: any = null, top: any = null;
  try { ads = adsRaw ? JSON.parse(adsRaw) : null; } catch { }
  try { top = topRaw ? JSON.parse(topRaw) : null; } catch { }
  const spend = spendRaw ? Number(String(spendRaw).replace(/\D/g, "")) : 0;
  const campaigns = Array.isArray(ads?.campaigns) ? ads.campaigns : [];
  const posts = Array.isArray(top?.posts) ? top.posts : (Array.isArray(top) ? top : []);
  return { month, spend, campaigns, posts, generatedAt: ads?.generatedAt, hasData: !!ads || spend > 0 };
}

const MKT_STUDIO_URL =
  process.env.NEXT_PUBLIC_MKT_STUDIO_URL || "https://mkt-studio.example.com";

const platforms = [
  { name: "Facebook", icon: Facebook, color: "text-blue-600 bg-blue-50", desc: "Graph API v21 — page impressions, engaged users, video insights" },
  { name: "YouTube", icon: Youtube, color: "text-red-600 bg-red-50", desc: "Data API v3 + Analytics API — views theo ngày, thống kê video, auto-refresh token" },
  { name: "TikTok", icon: Film, color: "text-gray-900 bg-gray-100", desc: "Open API v2 (Login Kit) — user info, video list. Hỗ trợ import CSV từ TikTok Studio" },
];

const features = [
  { icon: BarChart3, title: "Dashboard tổng quan", desc: "Lọc theo thời gian + nền tảng, 3 thẻ chỉ số chính, 3 thẻ kênh, biểu đồ views đa nền tảng." },
  { icon: Users, title: "Quản lý kênh", desc: "Thêm kênh thủ công, import CSV, kết nối OAuth, đồng bộ và xoá kênh FB/YT/TikTok." },
  { icon: CalendarDays, title: "Lịch đăng bài", desc: "Calendar theo tháng + modal tạo lịch đăng, chấm màu theo nền tảng." },
  { icon: Film, title: "Kho video", desc: "Thư viện video đồng bộ từ các nền tảng — lọc, sắp xếp, phân trang." },
  { icon: Settings, title: "Cấu hình API", desc: "Khai báo API key Facebook / YouTube / TikTok, secret được che." },
  { icon: ShieldCheck, title: "Đa người dùng", desc: "Đăng nhập JWT 30 ngày, phân quyền admin (toàn quyền) vs member (chỉ xem)." },
];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>{children}</div>;
}

export default async function DoLuongMktPage() {
  const { t } = getT();
  const perf = await loadAdsPerf();
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div>
        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
          <span>{t("Team MKT")}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900">{t("Đo lường đa kênh")}</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-pink-600" /> {t("Đo lường đa kênh — MKT Studio")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Công cụ nội bộ quản lý & đo lường hiệu suất đa kênh")} <b>Facebook · YouTube · TikTok</b> {t("dùng chung cho cả team Marketing.")}
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" /> {t("Hiệu suất quảng cáo Meta")} <span className="text-xs font-normal text-gray-400">({perf.month})</span>
          </h2>
          {perf.hasData && <span className="text-[11px] text-gray-400">{t("cập nhật")} {ageText(perf.generatedAt)}</span>}
        </div>
        {!perf.hasData ? (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <b>{t("Chưa cắm token quảng cáo Meta.")}</b> {t("Dán")} <code>FB_ADS_TOKEN</code> {t("(hoặc")} <code>FB_USER_TOKEN</code>) + <code>FB_AD_ACCOUNT</code> {t("vào Vercel → cron mỗi sáng tự kéo chi tiêu & CPO từng chiến dịch về đây.")}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">{t("Tổng chi tháng này")}: <b className="text-gray-900">{vnd(perf.spend)}</b> · {perf.campaigns.length} {t("chiến dịch")}</div>
            {perf.campaigns.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="py-1.5 pr-2">{t("Chiến dịch")}</th>
                      <th className="py-1.5 px-2 text-right">{t("Chi")}</th>
                      <th className="py-1.5 px-2 text-right">{t("Kết quả")}</th>
                      <th className="py-1.5 px-2 text-right">CPO</th>
                      <th className="py-1.5 pl-2 text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.campaigns.slice(0, 12).map((c: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2 max-w-[240px] truncate">{c.name}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{vnd(c.spend)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{c.results || 0} {c.rtype || ""}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{c.cpo ? vnd(c.cpo) : "—"}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums">{c.ctr ? c.ctr + "%" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {perf.posts.length > 0 && (
              <p className="text-xs text-gray-500">{t("Bài organic đáng bơm ngân sách")}: {perf.posts.length} {t("bài (Nhà máy Content đang học hướng này).")}</p>
            )}
          </div>
        )}
      </Card>

      <AdsControl />

      <div className="rounded-2xl p-6 bg-gradient-to-br from-pink-600 to-rose-500 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-lg font-bold">{t("Mở MKT Studio")}</div>
            <p className="text-sm text-white/85 mt-1 max-w-xl">
              {t("Dashboard số liệu views / tương tác / followers theo từng kênh, lịch đăng bài và kho video — tất cả ở một nơi.")}
            </p>
          </div>
          {MKT_STUDIO_URL ? (
            <a
              href={MKT_STUDIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 bg-white text-pink-700 font-semibold px-5 py-3 rounded-xl hover:bg-pink-50 transition"
            >
              <ExternalLink className="w-4 h-4" /> {t("Mở ứng dụng")}
            </a>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-2 bg-white/20 text-white font-semibold px-5 py-3 rounded-xl border border-white/30">
              <Rocket className="w-4 h-4" /> {t("Đang triển khai — link cập nhật sau khi deploy")}
            </span>
          )}
        </div>
      </div>

      <Card className="p-4 flex items-start gap-3 bg-emerald-50 border-emerald-200">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-900">
          <b>{t("Không cần đăng nhập.")}</b> {t("Cả team MKT bấm vào là dùng được ngay — không cần nhập tài khoản/mật khẩu. Dữ liệu lưu vĩnh viễn trên cloud (Turso), không mất khi cập nhật ứng dụng.")}
        </div>
      </Card>

      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{t("Nền tảng kết nối")}</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {platforms.map((p) => (
            <Card key={p.name} className="p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.color}`}>
                <p.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-gray-900 mt-3">{p.name}</div>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t(p.desc)}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{t("Tính năng chính")}</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {features.map((f) => (
            <Card key={t(f.title)} className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{t(f.title)}</div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t(f.desc)}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
          <PlusCircle className="w-5 h-5 text-pink-600" /> {t("Cách đưa số liệu kênh vào hệ thống")}
        </h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <PlusCircle className="w-4 h-4 text-emerald-600" /> {t("1. Thêm thủ công")}
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">
              {t("Trang")} <b>{t("Channels → “+ Thêm kênh”")}</b>: {t("chọn nền tảng, nhập tên kênh + followers. Không cần OAuth — nhập số liệu tay nhanh nhất.")}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Upload className="w-4 h-4 text-blue-600" /> {t("2. Import CSV")}
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">
              {t("Export từ")} <b>Meta Business Suite</b> / <b>TikTok Studio</b> / <b>YouTube Studio</b> {t("rồi upload. Parser tự nhận cột ngày / views / tương tác, hỗ trợ nhiều định dạng ngày.")}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <RefreshCw className="w-4 h-4 text-purple-600" /> {t("3. Kết nối OAuth + Sync")}
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">
              {t("Bấm nút OAuth (Facebook / YouTube) để cấp quyền, sau đó")} <b>Sync</b> {t("tự kéo số liệu. TikTok cần HTTPS — dùng khi đã deploy production.")}
            </p>
          </div>
        </div>
      </Card>

      <details className="bg-white rounded-xl border border-gray-200 group">
        <summary className="cursor-pointer select-none px-5 py-4 font-bold text-gray-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-gray-500" />
          {t("Thông tin kỹ thuật & hướng dẫn deploy (dành cho dev)")}
          <ChevronRight className="w-4 h-4 ml-auto text-gray-400 group-open:rotate-90 transition" />
        </summary>
        <div className="px-5 pb-5 space-y-4 text-sm text-gray-600 border-t border-gray-100 pt-4">
          <div>
            <div className="font-semibold text-gray-800 mb-1">Stack</div>
            <p className="text-xs leading-relaxed">
              {t("Next.js 14 App Router + TypeScript + Tailwind · SQLite (better-sqlite3) lưu channels/stats/content/scheduler ·\n              JWT trong httpOnly cookie (jose), auth 30 ngày · bcryptjs hash mật khẩu · Recharts vẽ biểu đồ.")}
            </p>
          </div>
          <div>
            <div className="font-semibold text-gray-800 mb-1">{t("Database (5 bảng SQLite)")}</div>
            <p className="text-xs leading-relaxed">
              <code>users</code> (admin/member) · <code>channels</code> (FB page / YT channel / TikTok account) ·
              <code> channel_stats</code> {t("(snapshot ngày: views, interactions, videos, followers_gain) ·")}
              <code> content</code> (kho video) · <code>scheduled_posts</code> {t("(lịch đăng) ·")} <code>settings</code> {t("(key-value API keys).\n              File lưu ở")} <code>data/mkt.db</code> {t("— persistent, không mất khi restart.")}
            </p>
          </div>
          <div>
            <div className="font-semibold text-gray-800 mb-1">{t("Biến môi trường (.env)")}</div>
            <pre className="bg-gray-900 text-gray-100 text-[11px] rounded-lg p-3 overflow-x-auto">{`JWT_SECRET=chuoi-bi-mat-toi-thieu-32-ky-tu
APP_URL=https://mkt.example.vn   # URL public, dùng cho OAuth redirect`}</pre>
          </div>
          <div>
            <div className="font-semibold text-gray-800 mb-1">{t("Deploy production")}</div>
            <ul className="text-xs leading-relaxed list-disc pl-5 space-y-1">
              <li>{t("Platform: Railway / Render / VPS bất kỳ chạy Node.js.")}</li>
              <li>{t("SQLite để trên")} <b>persistent disk</b> (<code>/data/mkt.db</code>{t(") — KHÔNG để trong storage ephemeral của container.")}</li>
              <li><code>next.config.mjs</code> {t("cần")} <code>experimental.serverComponentsExternalPackages: [&apos;better-sqlite3&apos;]</code> (native module).</li>
              <li>{t("Cập nhật OAuth redirect URIs trên Facebook / YouTube / TikTok developer portal:")} <code>https://[domain]/api/oauth/*</code>.</li>
              <li>{t("Backup định kỳ: cron copy")} <code>data/mkt.db</code> → Drive / S3. Rate-limit <code>/api/auth/login</code> {t("chống brute force.")}</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-gray-800 mb-1">{t("Nâng cấp cần làm khi rebuild")}</div>
            <ul className="text-xs leading-relaxed list-disc pl-5 space-y-1">
              <li>{t("Trang quản lý Users: admin tạo tài khoản cho team members + phân quyền admin/member.")}</li>
              <li>{t("Trang đổi mật khẩu (profile) cho từng user; team invite qua email.")}</li>
              <li>{t("Audit log (ai sync kênh nào, khi nào) · cảnh báo views drop đột ngột · export báo cáo PDF/Excel tháng.")}</li>
              <li>{t("Thêm nút TikTok OAuth trên trang Channels (hiện mới có Facebook + YouTube).")}</li>
            </ul>
          </div>
          <p className="text-[11px] text-gray-400 italic pt-1">
            {t("Sau khi deploy xong, dán link app vào")} <code>NEXT_PUBLIC_MKT_STUDIO_URL</code> {t("(hoặc sửa hằng số")} <code>MKT_STUDIO_URL</code> {t("trong file này) để nút “Mở ứng dụng” hoạt động.")}
          </p>
        </div>
      </details>
    </div>
  );
}
