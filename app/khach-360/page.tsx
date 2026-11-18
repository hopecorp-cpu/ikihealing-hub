import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition, isCskhPosition } from "@/lib/auth";
import { norm } from "@/lib/sale-metrics";
import { fmtVND } from "@/lib/payroll";
import { layDoanhThuNhieuThang, gopTenSale } from "@/lib/doanh-thu";
import { getT } from "@/lib/i18n-server";
import { Crown, Repeat, UserPlus, UserMinus, Users, Inbox, Shuffle, ClipboardList } from "lucide-react";
import { getQuizSubmissions } from "@/lib/quiz-leads";
import { getLeads } from "@/lib/blog-nurture";
import { CareMarkButton } from "@/components/care-mark-button";
import { saleBotUsername } from "@/lib/telegram";
import { maNoiSale } from "@/lib/noi-sale-tg";
import { chamTep, demTheoKhuc, CHU_KY_NGAY, type KhachRFM, type PhanKhuc } from "@/lib/rfm";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Hồ sơ khách 360 | IKIHEALING Hub") };
}

const STATUS_VI: Record<string, string> = { delivered: "đã giao", returned: "hoàn", cancelled: "huỷ", transit: "đang giao", other: "vấn đề" };
const VIP_MIN = 5_000_000;
const SEGS = [
  { key: "all", label: "Tất cả", icon: Users },
  { key: "vip", label: "VIP (≥5tr)", icon: Crown },
  { key: "repeat", label: "Mua lại (≥2 đơn)", icon: Repeat },
  { key: "new", label: "Mới tháng này", icon: UserPlus },
  { key: "churn", label: "Sắp rời bỏ (>90 ngày)", icon: UserMinus },
  { key: "lead", label: "Chưa mua (lead)", icon: Inbox },
  { key: "quiz", label: "Từ Quiz", icon: ClipboardList },
  { key: "pool", label: "Chưa có sale", icon: Shuffle },
] as const;

function normPhone(s: any): string | null {
  if (!s) return null; let d = String(s).replace(/[^0-9]/g, ""); if (d.length < 9) return null;
  if (d.startsWith("84")) d = "0" + d.slice(2); if (!d.startsWith("0")) d = "0" + d; return d.slice(0, 11);
}
function extractPhone(name: any): string | null { const m = String(name || "").match(/(?:\+?84|0)\d{8,10}/); return m ? normPhone(m[0]) : null; }

export default async function Khach360({ searchParams }: { searchParams: { q?: string; seg?: string; rfm?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const manager = isManagerOrAbove(user.role);
  const isSale = isSalePosition((user as any).position);
  const isCskh = isCskhPosition((user as any).position);
  if (!manager && !isSale && !isCskh) redirect("/?denied=k360");
  const meMode = !manager;
  const meName = norm((user as any).full_name || "");
  const mine = (saleName: string) => { const s = norm(saleName || ""); return !!s && !!meName && (s.includes(meName) || meName.includes(s)); };
  const { t } = getT();
  const q = (searchParams.q || "").trim();
  const seg = (searchParams.seg || "all").trim();
  const rfmSeg = (searchParams.rfm || "").trim();
  const sb = getServiceClient();

  const { data: uAll } = await sb.from("users").select("full_name,position").eq("active", true);
  const realSaleNames = (uAll || []).filter(u => isSalePosition((u as any).position)).map(u => norm(u.full_name)).filter(Boolean);
  const isRealSale = (name: string) => { const s = norm(name || ""); return !!s && realSaleNames.some(rn => s.includes(rn) || rn.includes(s)); };

  const canSee = (saleName: string) => !meMode || mine(saleName) || !isRealSale(saleName);

  const tgBot = saleBotUsername();
  let tgConnected = false;
  if (tgBot) { try { const map = JSON.parse((await sb.from("config").select("value").eq("key", "sale_tg_chat").maybeSingle()).data?.value || "{}"); tgConnected = !!map[String((user as any).id)]; } catch { } }

  let list: any[] = [], segCounts: Record<string, number> = {}, total = 0;
  let rfmDem: Array<{ khuc: PhanKhuc; so: number; net: number }> = [];
  const pageAll = async (tbl: string, cols: string) => { let r: any[] = [], o = 0; while (true) { const { data } = await sb.from(tbl).select(cols).range(o, o + 999); if (!data || !data.length) break; r = r.concat(data); if (data.length < 1000) break; o += 1000; } return r; };
  if (!q) {
    const monStart = new Date().toISOString().slice(0, 7) + "-01";
    const churnCut = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const by: Record<string, any> = {};
    const getC = (p: string) => (by[p] ??= { phone: p, name: "", orders: new Set(), rev: 0, last: "", first: "", channels: new Set(), sales: new Set(), prods: {}, bought: false, hotline: "" });

    const gopTenDs = gopTenSale((uAll || []).map((u: any) => ({ ten: u.full_name || "" })));
    for (const r of (await layDoanhThuNhieuThang(sb, "2026-03-01", new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))).rows) {
      const p = normPhone(r.customer_phone) || extractPhone(r.customer_name); if (!p) continue;
      const c = getC(p); c.bought = true; c.orders.add(r.order_code); c.rev += r.net_amount || 0;
      const d = (r.order_date || "").slice(0, 10); if (d > c.last) c.last = d; if (d && (!c.first || d < c.first)) c.first = d;
      if (!c.name && r.customer_name) c.name = r.customer_name;
      if (r.sale_channel) c.channels.add(r.sale_channel); if (r.sale_name) c.sales.add(gopTenDs(r.sale_name));
      if (r.product_name) c.prods[r.product_name] = (c.prods[r.product_name] || 0) + (r.quantity || 0);
    }

    for (const r of await pageAll("salework_contacts", "phone,name,hotline")) {
      const p = normPhone(r.phone); if (!p) continue; const c = getC(p);
      if (!c.name && r.name) c.name = r.name; if (r.hotline && !c.hotline) c.hotline = r.hotline; c.channels.add("Zalo");
    }

    for (const s of await getQuizSubmissions()) {
      const p = normPhone(s.phone);
      const key = p || (s.email ? "em:" + s.email.toLowerCase() : ""); if (!key) continue;
      const c = getC(key); if (!p) c.phone = "";
      if (!c.name && s.name && !s.name.includes("@")) c.name = s.name;
      (c.emails ??= new Set()).add(s.email); c.channels.add("Quiz");
      c.quizTimes = (c.quizTimes || 0) + 1;
      if (!c.quiz || (s.ts || 0) > c.quiz.ts) c.quiz = { profile: s.profileName || s.profile || "", overall: s.overall || 0, ts: s.ts || 0, source: s.source || "" };
    }

    for (const l of await getLeads()) {
      const p = normPhone(l.phone);
      const key = p || (l.email ? "em:" + l.email.toLowerCase() : ""); if (!key) continue;
      const c = getC(key); if (!p) c.phone = "";
      (c.emails ??= new Set()).add(l.email); c.channels.add("Email");
    }

    const cared: Record<string, string> = {};
    for (const r of await pageAll("customer_care_log", "customer_phone,last_contact")) { const p = normPhone(r.customer_phone); if (p) cared[p] = r.last_contact || ""; }

    const arr = Object.values(by).map((c: any) => {
      const orders = c.orders.size, sales = [...c.sales];
      return {
        ...c, orders, sales, channels: [...c.channels], emails: [...(c.emails || [])],
        topProds: Object.entries(c.prods).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3),
        isVip: c.rev >= VIP_MIN, repeat: orders >= 2,
        isNew: c.bought && c.first >= monStart, isChurn: c.bought && !!c.last && c.last < churnCut,
        chuaMua: !c.bought,
        chuaSale: !sales.some(isRealSale),
        daCham: !!cared[c.phone], caredLast: cared[c.phone] || "",
        hasQuiz: !!c.quiz,
      };
    });

    const nayVN = Date.now() + 7 * 3600e3;
    const daMuaArr = arr.filter((c: any) => c.bought && c.last);
    const chamRfm = chamTep(daMuaArr.map((c: any) => ({
      ngayTuDonCuoi: Math.max(0, Math.round((nayVN - +new Date(c.last)) / 864e5)),
      soLanMua: c.orders, tongNet: c.rev,
    })));
    daMuaArr.forEach((c: any, i: number) => { c.rfm = chamRfm[i] as KhachRFM; });

    const visible = meMode ? arr.filter(c => c.sales.some((s: string) => mine(s)) || c.chuaSale) : arr;
    const match = (c: any, s: string) => s === "vip" ? c.isVip : s === "repeat" ? c.repeat : s === "new" ? c.isNew : s === "churn" ? c.isChurn : s === "lead" ? c.chuaMua : s === "quiz" ? c.hasQuiz : s === "pool" ? c.chuaSale : true;
    for (const s of SEGS) segCounts[s.key] = visible.filter(c => match(c, s.key)).length;
    rfmDem = demTheoKhuc(visible.filter((c: any) => c.rfm).map((c: any) => c.rfm));
    total = visible.length;

    const actionSeg = seg === "pool" || seg === "churn" || seg === "lead";
    list = visible.filter(c => match(c, seg) && (!rfmSeg || c.rfm?.khuc.ma === rfmSeg)).sort((a, b) =>
      (actionSeg ? (a.daCham ? 1 : 0) - (b.daCham ? 1 : 0) : 0) ||
      (b.bought ? 1 : 0) - (a.bought ? 1 : 0) || b.rev - a.rev
    ).slice(0, 300);
  }

  let customers: any[] = [], leadHits: any[] = [];
  if (q) {
    const safe = q.replace(/[,%()]/g, " ");

    const gopTen = gopTenSale((uAll || []).map((u: any) => ({ ten: u.full_name || "" })));
    const tim = norm(safe);
    const khop = (v: any) => !!v && norm(String(v)).includes(tim);
    const li = (await layDoanhThuNhieuThang(sb, "2026-03-01", new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))).rows
      .filter((r) => khop(r.customer_phone) || khop(r.customer_name))
      .map((r) => ({ ...r, sale_name: r.sale_name ? gopTen(r.sale_name) : r.sale_name }));
    const byPhone: Record<string, any> = {};
    for (const r of li) {
      if (!canSee(r.sale_name || "")) continue;
      const k = r.customer_phone || r.customer_name || "—";
      const c = (byPhone[k] ??= { phone: r.customer_phone, name: r.customer_name, orders: new Set(), rev: 0, last: "", channels: new Set(), sales: new Set(), prods: {} });
      c.orders.add(r.order_code); c.rev += r.net_amount || 0; if ((r.order_date || "") > c.last) c.last = r.order_date;
      if (r.sale_channel) c.channels.add(r.sale_channel); if (r.sale_name) c.sales.add(r.sale_name);
      if (r.product_name) c.prods[r.product_name] = (c.prods[r.product_name] || 0) + (r.quantity || 0);
    }
    customers = Object.values(byPhone).map((c: any) => ({ ...c, orders: c.orders.size, channels: [...c.channels], sales: [...c.sales], topProds: Object.entries(c.prods).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4) }))
      .sort((a, b) => b.rev - a.rev).slice(0, 40);

    const phones = customers.map(c => c.phone).filter(Boolean);
    if (phones.length) {
      const [{ data: jt }, { data: chat }, { data: contacts }, { data: careR }] = await Promise.all([
        sb.from("jt_waybills").select("receiver_phone,receiver_address,status_name,status_group,order_create_time").in("receiver_phone", phones).order("order_create_time", { ascending: false }),
        sb.from("salework_chat_analysis").select("phone,score,customer_need,weaknesses").in("phone", phones).order("analyzed_at", { ascending: false }),
        sb.from("salework_contacts").select("phone,hotline,name").in("phone", phones),
        sb.from("customer_care_log").select("customer_phone,last_contact").in("customer_phone", phones),
      ]);
      const jtBy: Record<string, any> = {}; for (const w of jt ?? []) if (w.receiver_phone && !jtBy[w.receiver_phone]) jtBy[w.receiver_phone] = w;
      const chBy: Record<string, any> = {}; for (const c of chat ?? []) if (c.phone && !chBy[c.phone]) chBy[c.phone] = c;
      const ctBy: Record<string, any> = {}; for (const c of contacts ?? []) if (c.phone && !ctBy[c.phone]) ctBy[c.phone] = c;
      const careBy: Record<string, string> = {}; for (const c of careR ?? []) if (c.customer_phone) careBy[c.customer_phone] = c.last_contact || "";
      customers = customers.map(c => ({ ...c, jt: jtBy[c.phone], chat: chBy[c.phone], contact: ctBy[c.phone], cared: careBy[c.phone] != null, caredLast: careBy[c.phone] }));
    }

    const [quizSubs, blogLeads] = await Promise.all([getQuizSubmissions(), getLeads()]);
    const quizByPhone: Record<string, any> = {};
    for (const s of quizSubs) {
      const p = normPhone(s.phone);
      if (p && (!quizByPhone[p] || (s.ts || 0) > quizByPhone[p].ts)) quizByPhone[p] = s;
    }
    customers = customers.map(c => ({ ...c, quiz: quizByPhone[normPhone(c.phone) || ""] || null }));
    const ql = q.toLowerCase(); const qd = q.replace(/\D/g, "");
    const foundPhones = new Set(customers.map(c => normPhone(c.phone)).filter(Boolean));
    const hit = (email?: string, phone?: string, name?: string) => {
      const p = normPhone(phone);
      if (p && foundPhones.has(p)) return false;
      return (email || "").toLowerCase().includes(ql) || (!!name && name.toLowerCase().includes(ql)) || (qd.length >= 4 && !!p && p.includes(qd));
    };
    leadHits = [
      ...quizSubs.filter(s => hit(s.email, s.phone, s.name)).map(s => ({ kind: "quiz", name: s.name, email: s.email, phone: s.phone, info: `${s.profileName || s.profile} · ${s.overall || 0}/100`, src: s.source || "", ts: s.ts || 0 })),
      ...blogLeads.filter(l => hit(l.email, l.phone)).map(l => ({ kind: "email", name: "", email: l.email, phone: l.phone, info: "Lead email blog", src: l.source || "", ts: l.ts || 0 })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 20);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Phân loại khách & VIP")}{meMode && <span className="ml-2 text-xs align-middle bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t("khách của bạn")}</span>}</h1>
        <p className="text-sm text-gray-500 mt-1">{meMode ? t("Khách của BẠN + khách chưa có sale (pool — ai cũng nhận được). Có cờ 'Đã chăm' để tránh chăm lại. Bấm tên xem hồ sơ 360.") : t("Gộp khách ĐÃ MUA (sổ đơn) + danh bạ Zalo + lead Quiz sức khoẻ + lead email blog + đã chăm (care) + chat + J&T. Lọc theo hạng hoặc tìm SĐT/tên/email.")}</p>
      </div>
      {tgBot && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 text-sm flex items-center gap-2 flex-wrap">
          {tgConnected
            ? <span className="text-sky-800 font-medium">{t("✓ Đã bật nhắc chăm qua Telegram — mỗi sáng bot sẽ nhắn khách tới hạn chăm.")}</span>
            : <>
                <span className="text-sky-800">{t("Nhận nhắc chăm sóc qua Telegram (mỗi sáng, riêng bạn):")}</span>
                <a href={`https://t.me/${tgBot}?start=${maNoiSale(String((user as any).id))}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700">{t("Bật nhắc qua Telegram →")}</a>
              </>}
        </div>
      )}
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={t("Nhập SĐT hoặc tên khách…")} className="flex-1 p-2.5 border border-gray-200 rounded-lg text-sm" />
        <button className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Tìm")}</button>
      </form>

      {!q && (
        <>
          <div className="flex gap-2 flex-wrap">
            {SEGS.map(s => {
              const Icon = s.icon; const active = seg === s.key;
              return (
                <a key={s.key} href={`/khach-360?seg=${s.key}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                  <Icon className="w-4 h-4" /> {t(s.label)} <span className={`text-xs ${active ? "text-white/70" : "text-gray-400"}`}>{segCounts[s.key] ?? 0}</span>
                </a>
              );
            })}
          </div>

          {rfmDem.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase">{t("Phân khúc RFM")}</span>
                <span className="text-[11px] text-gray-400">
                  {t("chu kỳ dùng hết hàng")} {CHU_KY_NGAY} {t("ngày")} · {t("xếp theo việc cần làm trước")}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {rfmDem.map(({ khuc, so, net }) => {
                  const active = rfmSeg === khuc.ma;
                  const href = `/khach-360?seg=${seg}${active ? "" : `&rfm=${khuc.ma}`}`;
                  return (
                    <a key={khuc.ma} href={href} title={khuc.viec}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${active ? "bg-gray-900 text-white border-gray-900" : `${khuc.mau} border-transparent hover:brightness-95`}`}>
                      <span className="text-[10px] opacity-60">{khuc.uuTien}</span>
                      {t(khuc.ten)}
                      <span className={`text-xs ${active ? "text-white/70" : "opacity-60"}`}>{so}</span>
                      <span className={`text-[11px] sensitive ${active ? "text-white/60" : "opacity-50"}`}>{(net / 1e6).toFixed(0)}tr</span>
                    </a>
                  );
                })}
                {rfmSeg && <a href={`/khach-360?seg=${seg}`} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">{t("Bỏ lọc")}</a>}
              </div>
              {rfmSeg && rfmDem.find(r => r.khuc.ma === rfmSeg) && (
                <div className="flex gap-2 items-start p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700">
                  <span className="font-semibold shrink-0">{t("Việc cần làm")}:</span>
                  <span>{t(rfmDem.find(r => r.khuc.ma === rfmSeg)!.khuc.viec)}</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left p-3">{t("Khách")}</th>
                  <th className="text-left p-3">{t("Hạng")}</th>
                  <th className="text-right p-3">{t("Tổng chi")}</th>
                  <th className="text-right p-3">{t("Đơn")}</th>
                  <th className="text-left p-3">{t("Hay mua")}</th>
                  <th className="text-left p-3">{t("Sale")}</th>
                  <th className="text-right p-3">{t("Mua cuối")}</th>
                  <th className="text-right p-3">{t("Chăm sóc")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-3"><a className="font-medium text-blue-600 hover:underline" href={`/khach-360?q=${encodeURIComponent(c.phone || c.emails[0] || "")}`}>{c.name || c.emails[0] || "—"}</a><div className="text-[11px] text-gray-400">{c.phone || c.emails[0] || ""}</div></td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {c.rfm && <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${c.rfm.khuc.mau}`} title={`R${c.rfm.diem.R} F${c.rfm.diem.F} M${c.rfm.diem.M} · ${c.rfm.khuc.viec}`}>{t(c.rfm.khuc.ten)}</span>}
                        {c.isVip && <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">VIP</span>}
                        {c.chuaMua ? <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{t("Chưa mua")}</span>
                          : (c.repeat ? <span className="text-[11px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{t("Mua lại")}</span> : <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t("1 lần")}</span>)}
                        {c.isNew && <span className="text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{t("Mới")}</span>}
                        {c.isChurn && <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{t("Sắp rời")}</span>}
                        {c.chuaSale && <span className="text-[11px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{t("Chưa có sale")}</span>}
                        {c.quiz && <span className="text-[11px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full" title={`Điểm ${c.quiz.overall}/100 · ${c.quizTimes} lần làm`}>Quiz: {String(c.quiz.profile).slice(0, 18)}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold sensitive">{c.bought ? fmtVND(c.rev) : "—"}</td>
                    <td className="p-3 text-right">{c.bought ? c.orders : "—"}</td>
                    <td className="p-3 text-xs text-gray-600 max-w-[220px]">{c.topProds.length ? c.topProds.map((p: any) => `${p[0].slice(0, 20)} ×${p[1]}`).join(", ") : (c.chuaMua ? t("(chưa mua)") : "—")}</td>
                    <td className="p-3 text-xs text-gray-600">{c.sales.join(", ") || <span className="text-indigo-500">{t("chưa gán")}</span>}</td>
                    <td className="p-3 text-right text-[11px] text-gray-500">{c.last ? `${c.last.slice(8, 10)}/${c.last.slice(5, 7)}` : "—"}</td>
                    <td className="p-3 text-right">{c.phone ? <CareMarkButton phone={c.phone} name={c.name} sale={(user as any).full_name} bought={c.bought} initialCared={c.daCham} caredLast={c.caredLast} /> : <span className="text-xs text-gray-300">—</span>}</td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-gray-400">{t("Chưa có khách trong nhóm này")}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="text-center text-xs text-gray-400">{t("Tổng")} <b>{total.toLocaleString("vi-VN")}</b> {t("khách (đã mua + danh bạ Zalo)")}{list.length >= 300 ? ` · ${t("hiện 300 dòng đầu — dùng bộ lọc hoặc ô tìm")}` : ""}</div>
        </>
      )}

      {q && customers.length === 0 && leadHits.length === 0 && <div className="text-center py-16 text-gray-400">{t("Không tìm thấy khách")} "{q}".</div>}

      {q && leadHits.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 sm:p-5">
          <div className="text-sm font-bold text-gray-900 mb-2">{t("Từ quiz / lead email (chưa có đơn mua)")}</div>
          <div className="space-y-2">
            {leadHits.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm border-t first:border-t-0 border-gray-50 pt-2 first:pt-0">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${h.kind === "quiz" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600"}`}>{h.kind === "quiz" ? "Quiz" : "Email"}</span>
                <span className="font-medium text-gray-900">{h.name || h.email}</span>
                {h.phone && <a className="text-emerald-700" href={`tel:${h.phone}`}>{h.phone}</a>}
                {h.email && h.name && <a className="text-gray-500" href={`mailto:${h.email}`}>{h.email}</a>}
                <span className="text-gray-500">{h.info}</span>
                {h.src && <span className="text-[11px] text-gray-400">{h.src}</span>}
              </div>
            ))}
          </div>
          <a href="/quiz-leads" className="inline-block mt-3 text-xs font-semibold text-violet-700 hover:underline">{t("Xem chi tiết quiz + tin tư vấn mẫu →")}</a>
        </div>
      )}

      {customers.map((c, i) => {
        const isVip = c.rev >= 5_000_000, repeat = c.orders >= 2;
        return (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-bold text-lg">{c.name || c.contact?.name || "—"}</div>
                <div className="text-sm text-gray-500">{c.phone || "—"} {c.contact?.hotline && <span className="text-xs">· hotline {c.contact.hotline}</span>}</div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {isVip && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">VIP</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${repeat ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{repeat ? t("Mua lại") : t("Mua 1 lần")}</span>
                {c.chat && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t("chat")} {c.chat.score}/10</span>}
                <CareMarkButton phone={c.phone} name={c.name} sale={(user as any).full_name} bought={c.orders > 0} initialCared={!!c.cared} caredLast={c.caredLast} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
              <Box label={t("Tổng chi")} value={fmtVND(c.rev)} />
              <Box label={t("Số đơn")} value={String(c.orders)} />
              <Box label={t("Mua gần nhất")} value={c.last || "—"} />
              <Box label={t("Kênh")} value={c.channels.join(", ") || "—"} />
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1">{t("Hay mua")}</div>
                {c.topProds.length ? c.topProds.map((p: any, j: number) => <div key={j} className="text-gray-700">• {p[0]} ×{p[1]}</div>) : <span className="text-gray-400">—</span>}
              </div>
              <div className="space-y-1">
                {c.jt && <div><span className="text-xs font-semibold text-gray-500">{t("Địa chỉ (J&T):")}</span> <span className="text-gray-700">{c.jt.receiver_address || "—"}</span> <span className="text-xs text-gray-400">({t(STATUS_VI[c.jt.status_group] || c.jt.status_name)})</span></div>}
                {c.sales.length > 0 && <div><span className="text-xs font-semibold text-gray-500">{t("Sale phụ trách:")}</span> {c.sales.join(", ")}</div>}
                {c.chat?.customer_need && <div><span className="text-xs font-semibold text-gray-500">{t("Nhu cầu (từ chat):")}</span> {c.chat.customer_need}</div>}
                {c.quiz && <div><span className="text-xs font-semibold text-gray-500">{t("Quiz sức khoẻ:")}</span> {c.quiz.profileName || c.quiz.profile} · {c.quiz.overall || 0}/100 <a href="/quiz-leads" className="text-xs text-violet-600 hover:underline">{t("chi tiết →")}</a></div>}
              </div>
            </div>
          </div>
        );
      })}
      {customers.length >= 40 && <div className="text-center text-xs text-gray-400">{t("Hiện 40 khách khớp nhất — gõ cụ thể hơn để lọc.")}</div>}
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return <div className="bg-gray-50 rounded-lg p-2"><div className="text-[11px] text-gray-500">{label}</div><div className="font-semibold text-gray-800 text-sm">{value}</div></div>;
}
