import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { contentDailyStatus } from "@/lib/content-factory";
import { checkAllSources } from "@/lib/watchdog";
import { soatMayChayNgam } from "@/lib/may-chay-ngam";
import { getHistory as getAdsHistory } from "@/lib/google-ads";
import { layDoanhThu, tuoiNguonDon } from "@/lib/doanh-thu";

const vnd = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function delta(cur: number, prev: number | null | undefined): string {
  if (prev == null || !Number.isFinite(prev)) return "";
  if (prev === 0) return cur > 0 ? " (hôm qua chưa có)" : "";
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return " (bằng hôm qua)";
  return ` (${d > 0 ? "+" : ""}${d}% so hôm qua)`;
}

export type EodSnapshot = {
  date: string;
  posts: { created: number; published: number; failed: number; ranToday: boolean };
  metaSpendMtd: number;
  jtOrders: number;
  jtCod: number;
  revenue: number;
  orders: number;
  leads: number;
  openTasks: number;
  overdueTasks: number;
};

export type EodResult = { text: string; snapshot: EodSnapshot; badSources: number };

export async function buildEodReport(): Promise<EodResult> {
  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);
  const yStart = new Date(`${today}T00:00:00+07:00`);
  yStart.setDate(yStart.getDate() - 1);
  const yesterday = yStart.toISOString().slice(0, 10);

  let prev: Partial<EodSnapshot> = {};
  try {
    const raw = await getConfigValue("eod_last");
    const j = raw ? JSON.parse(raw) : null;
    if (j && j.date && j.date !== today) prev = j;
  } catch {  }

  const tStart = new Date(`${today}T00:00:00Z`);
  tStart.setUTCDate(tStart.getUTCDate() + 1);
  const tomorrow = tStart.toISOString().slice(0, 10);

  const [content, adsCfg, adsHist, jtToday, jtYest, soDon, leadRows, taskRows, sources, expiredRaw, tuoiDon, chuaBoc] = await Promise.all([
    contentDailyStatus().catch(() => null),
    getConfigValue("ads_campaigns").catch(() => null),
    getAdsHistory().catch(() => []),

    sb.from("jt_waybills").select("waybill_no, cod_value, is_void").gte("order_create_time", `${today}T00:00:00+00:00`).lt("order_create_time", `${tomorrow}T00:00:00+00:00`),
    sb.from("jt_waybills").select("waybill_no, cod_value, is_void").gte("order_create_time", `${yesterday}T00:00:00+00:00`).lt("order_create_time", `${today}T00:00:00+00:00`),

    layDoanhThu(sb, today, today).catch(() => null),
    sb.from("leads").select("id, status, channel, created_at").gte("created_at", `${today}T00:00:00+07:00`).limit(500),
    sb.from("tasks").select("id, status, due_date, title").in("status", ["todo", "doing", "review", "blocked"]).limit(500),
    checkAllSources().catch(() => []),
    getConfigValue("day_plan_expired_last").catch(() => null),
    tuoiNguonDon(sb).catch(() => null),

    (async (): Promise<number | null> => {
      try { const r: any = await sb.from("tg_messages").select("id", { count: "exact", head: true }).eq("da_boc", false); return r?.count ?? null; }
      catch { return null; }
    })(),
  ]);

  const L: string[] = [`\u{1F319} <b>TỔNG KẾT MÁY CHẠY</b> — ${today}`, `(cuối ngày; số đo thật, chỗ nào chưa có số thì nói rõ)`];

  L.push("", `\u{1F4DD} <b>NỘI DUNG</b>`);
  if (content) {
    L.push(`• Bài AI tạo hôm nay: <b>${content.createdToday}</b> · đã đăng: <b>${content.publishedToday}</b> · chặn vì từ cấm: ${content.failedToday}`);
    if (!content.factoryRanToday) L.push(`  \u{26A0}\u{FE0F} Nhà máy content CHƯA chạy hôm nay — mở /content hoặc nhắn "tạo bài".`);
    else if (content.createdToday > 0 && content.publishedToday === 0) L.push(`  \u{26A0}\u{FE0F} Có ${content.createdToday} bài nháp nhưng CHƯA bài nào được đăng — bài đang chờ anh bấm duyệt trong Telegram.`);
  } else {
    L.push(`• Không đọc được trạng thái nhà máy content (lỗi truy vấn) — kiểm /content.`);
  }

  L.push("", `\u{1F4B8} <b>QUẢNG CÁO</b>`);
  let metaSpendMtd = 0;
  let metaOk = false;
  try {
    const j = adsCfg ? JSON.parse(adsCfg) : null;
    if (j?.month === month && Array.isArray(j.campaigns)) {
      metaOk = true;
      metaSpendMtd = j.campaigns.reduce((s: number, c: any) => s + Number(c.spend || 0), 0);
      const running = j.campaigns.filter((c: any) => /active/i.test(String(c.status || "")));
      const spentToday = prev.metaSpendMtd != null ? metaSpendMtd - Number(prev.metaSpendMtd) : null;
      L.push(`• Meta: lũy kế tháng <b>${vnd(metaSpendMtd)}</b> · ${running.length} chiến dịch đang chạy`);
      if (spentToday != null) L.push(`  \u{2192} tiêu trong hôm nay: <b>${vnd(Math.max(0, spentToday))}</b>`);
      else L.push(`  \u{2192} chưa có mốc hôm qua để tính riêng chi phí trong ngày — từ mai sẽ có.`);
      const top = j.campaigns
        .filter((c: any) => Number(c.spend || 0) > 0)
        .sort((a: any, b: any) => Number(b.spend || 0) - Number(a.spend || 0))
        .slice(0, 3);
      for (const c of top) {
        const res = Number(c.results || 0);
        const rtype = c.rtype && c.rtype !== "—" ? c.rtype : "kết quả";
        const cpo = Number(c.cpo || 0);
        L.push(`  • ${esc(String(c.name || "").slice(0, 40))}: ${vnd(Number(c.spend || 0))} · ${res} ${rtype}${res > 0 && cpo > 0 ? ` · ${vnd(cpo)}/${rtype}` : ""}`);
      }
    }
  } catch {  }
  if (!metaOk) L.push(`• Meta: CHƯA có số tháng này — cron ads-spend không chạy được (thường do FB_ADS_TOKEN hết hạn). Vòng lặp doanh thu đang tính bằng số cũ.`);

  const gToday = (adsHist as any[]).slice(-1)[0] || null;
  const gPrev = gToday ? (adsHist as any[]).filter((d) => d.date < gToday.date).slice(-1)[0] : null;
  if (gToday) {
    const t = gToday.totals;
    L.push(`• Google (số ngày ${gToday.date}): <b>${vnd(t.cost)}</b> · ${t.clicks} nhấp · <b>${t.conv} chuyển đổi</b>`);
    if (gPrev) L.push(`  \u{2192} so ${gPrev.date}: chi phí ${delta(t.cost, gPrev.totals.cost).trim() || "bằng"} · chuyển đổi ${gPrev.totals.conv}\u{2192}${t.conv}`);
    if (t.cost > 0 && t.conv === 0) L.push(`  \u{26A0}\u{FE0F} Tiêu ${vnd(t.cost)} mà 0 chuyển đổi — tiền đang chảy ra không thu lại gì.`);
  } else {
    L.push(`• Google: chưa có số nào được gửi về (task cào sáng cần Chrome của anh mở + đăng nhập).`);
  }

  const donRows = soDon?.rows || [];
  const rev = donRows.reduce((s: number, r: any) => s + (r.net_amount || 0), 0);
  const orders = new Set(donRows.map((r: any) => r.order_code)).size;
  const jt = (jtToday.data || []).filter((r: any) => !r.is_void);
  const jtY = (jtYest.data || []).filter((r: any) => !r.is_void);
  const jtCod = jt.reduce((s: number, r: any) => s + Number(r.cod_value || 0), 0);
  const jtCodY = jtY.reduce((s: number, r: any) => s + Number(r.cod_value || 0), 0);
  const traTruoc = jt.filter((r: any) => Number(r.cod_value || 0) === 0).length;

  L.push("", `\u{1F4B0} <b>BÁN HÀNG</b> (sổ đơn nhóm Telegram, số NET đã trừ VAT)`);
  if (!soDon) {
    L.push(`  \u{26A0}\u{FE0F} <b>Không đọc được sổ đơn</b> (lỗi truy vấn tg_orders) — số dưới đây KHÔNG có, đừng đọc thành "0 đơn".`);
  } else {
    L.push(`• Hôm nay: <b>${orders} đơn</b>${delta(orders, prev.orders)} · doanh thu <b>${vnd(rev)}</b>${delta(rev, prev.revenue)}`);

    if (tuoiDon?.teleTre != null && tuoiDon.teleTre > 2) L.push(`  \u{26A0}\u{FE0F} <b>Số này KHÔNG đáng tin</b> — sổ đơn Telegram cũ ${tuoiDon.teleTre} ngày (bóc tới ${tuoiDon.teleToi}). Kiểm cron tg-boc-don + webhook bot trong nhóm Đơn Hàng.`);
    else if (chuaBoc != null && chuaBoc > 0) L.push(`  \u{2139}\u{FE0F} Còn ${chuaBoc} tin trong nhóm chưa bóc (cron bóc :05/:35) — số có thể nhích thêm.`);
    else if (orders === 0) L.push(`  \u{26A0}\u{FE0F} Sổ đơn vẫn tươi mà 0 đơn — hôm nay thật sự chưa có đơn nào được gõ vào nhóm.`);
    for (const c of soDon.canhBao || []) L.push(`  \u{26A0}\u{FE0F} ${esc(c)}`);
  }

  const jtDead = (sources as any[]).find((s) => (s.key === "jt_waybills" || s.key === "jt_session") && !s.ok);
  if (jtDead) L.push(`• Vận đơn J&amp;T: <b>không đối soát được</b> — ${esc(jtDead.label)}: ${esc(jtDead.note)}. Chạy lại <code>node scripts/jt-login.mjs</code> (đòi captcha, anh tự nhập).`);
  else {
    L.push(`• Đối soát J&amp;T: <b>${jt.length} vận đơn</b>${delta(jt.length, jtY.length)} · COD <b>${vnd(jtCod)}</b>${delta(jtCod, jtCodY)}${traTruoc > 0 ? ` · ${traTruoc} đơn CK trước (COD=0)` : ""}`);
    if (orders > 0 && jt.length < orders * 0.6) L.push(`  \u{2139}\u{FE0F} Vận đơn ít hơn hẳn số đơn trong sổ — thường là đơn tạo cuối ngày mai mới lên vận đơn, không phải mất đơn.`);
  }

  const leads = leadRows.data || [];
  const untouched = leads.filter((l: any) => l.status === "new").length;
  L.push("", `\u{1F464} <b>KHÁCH MỚI</b>`);
  L.push(`• Lead về hôm nay: <b>${leads.length}</b>${delta(leads.length, prev.leads)} · chưa ai chạm: <b>${untouched}</b>`);
  if (leads.length > 0 && untouched === leads.length) L.push(`  \u{26A0}\u{FE0F} Toàn bộ lead hôm nay chưa ai liên hệ.`);

  const tasks = taskRows.data || [];
  const overdue = tasks.filter((t: any) => t.due_date && t.due_date < today).length;
  let expiredTxt = "";
  try {
    const e = expiredRaw ? JSON.parse(expiredRaw) : null;
    if (e?.date === today && e.expired > 0) {
      expiredTxt = `• Đã dọn <b>${e.expired}</b> việc hết hiệu lực sáng nay`;
      if (e.missedCalls > 0) expiredTxt += ` \u{2192} <b>${e.missedCalls} lượt gọi</b> đã trôi qua không ai gọi`;
    }
  } catch {  }
  L.push("", `\u{1F4CB} <b>VIỆC</b>`);
  L.push(`• Đang mở: <b>${tasks.length}</b>${delta(tasks.length, prev.openTasks)} · quá hạn: <b>${overdue}</b>`);
  if (expiredTxt) L.push(expiredTxt);
  if (overdue > 15) L.push(`  \u{26A0}\u{FE0F} Quá hạn còn nhiều — vào /ke-hoach-ngay xem việc nào nên BỎ thay vì dời tiếp.`);

  try {
    const raw = await getConfigValue("cc_queue");
    const items: any[] = raw ? (JSON.parse(raw)?.items || []) : [];
    const moc7 = Date.now() - 7 * 86400000;
    const choDuyet = items.filter((t) => t.status === "pending");
    const dangLam = items.filter((t) => t.status === "approved" || t.status === "running");
    const xong7 = items.filter((t) => t.status === "done" && Date.parse(t.finishedAt || t.createdAt || "") >= moc7);
    const hong7 = items.filter((t) => t.status === "failed" && Date.parse(t.finishedAt || t.createdAt || "") >= moc7);
    if (choDuyet.length || dangLam.length || xong7.length || hong7.length) {
      L.push("", `\u{1F9F0} <b>VIỆC DEV (Claude Code / Trợ lý Mac)</b>`);
      L.push(`• Chờ anh duyệt: <b>${choDuyet.length}</b> · đang làm: <b>${dangLam.length}</b> · xong 7 ngày: <b>${xong7.length}</b>${hong7.length ? ` · hỏng: <b>${hong7.length}</b>` : ""}`);
      for (const t of choDuyet.slice(-3)) L.push(`  • chờ duyệt <code>${esc(t.id)}</code> — ${esc(String(t.task || "").slice(0, 60))}`);
      for (const t of xong7.slice(-3)) L.push(`  • xong <code>${esc(t.id)}</code> — ${esc(String(t.task || "").slice(0, 60))}`);
    }
  } catch {  }

  const bad = (sources as any[]).filter((s) => !s.ok);
  const soat = await soatMayChayNgam(sources as any[]).catch(() => null);
  L.push("", `\u{1F527} <b>MÁY MÓC</b>`);
  if (!bad.length) L.push(`• ${(sources as any[]).length} nguồn dữ liệu đều còn tươi.`);
  else {
    L.push(`• <b>${bad.length}/${(sources as any[]).length} nguồn đang chết hoặc đứng số:</b>`);
    for (const s of bad.slice(0, 6)) {
      const n = soat?.ngayDut?.[s.key];
      L.push(`  • ${esc(s.label)} — ${esc(s.note)}${n ? ` · <b>đứt ${n} ngày</b>` : ""}`);
    }
    if (bad.length > 6) L.push(`  • …và ${bad.length - 6} nguồn nữa (xem /may-chay-ngam)`);
  }
  if (soat) {
    if (soat.boMac.length) {
      L.push(`• \u{26A0}\u{FE0F} <b>${soat.boMac.length} máy đứt từ 3 ngày trở lên chưa ai đụng</b>: ${soat.boMac.slice(0, 3).map((m) => `${esc(m.ten)} (${m.ngay} ngày)`).join(" · ")}`);
      L.push(`  Tới mốc này thứ cần quyết là SỬA DỨT ĐIỂM hay CHỐT BỎ HẲN, không phải chạy lại thêm một lượt.`);
    }

    L.push(`• Hôm nay <b>${soat.bamHomNay}</b> lượt bấm Chạy lại trên /may-chay-ngam${soat.bamHong ? ` · <b>${soat.bamHong} lượt bấm rồi vẫn hỏng</b>` : ""}`);
  }

  const props: string[] = [];

  const dayNum = Number(today.slice(8, 10));
  const lastDay = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  if (lastDay - dayNum <= 2) props.push("Sắp hết tháng — đối chiếu vận đơn J&T cả tháng với sao kê MB Bank (và sổ MISA) để chốt số thật.");
  if (content && content.createdToday > 0 && content.publishedToday === 0) props.push(`Duyệt ${content.createdToday} bài đang chờ trong Telegram — bài không đăng thì tiền viết bài coi như bỏ.`);
  if (gToday && gToday.totals.cost > 0 && gToday.totals.conv === 0) props.push(`Google Ads tiêu ${vnd(gToday.totals.cost)} mà 0 chuyển đổi — nên tắt mã kém nhất hoặc đổi trang đích trước khi tiêu tiếp.`);
  if (!metaOk) props.push(`Cắm lại FB_ADS_TOKEN trên Vercel — thiếu nó thì mọi tính toán ngân sách quảng cáo đang chạy bằng số cũ.`);
  if (untouched > 0 && leads.length > 0) props.push(`${untouched} lead chưa ai chạm — nhắc sale dứt điểm trong sáng mai, để qua đêm thứ hai là nguội.`);
  if (overdue > 15) props.push(`${overdue} việc quá hạn — chọn 5 việc bỏ hẳn thay vì dời tiếp; dời tiếp là cách tồn đọng tự nhân lên.`);
  if (jtDead) props.unshift("Chạy lại máy cào J&T trước mọi việc khác — nó là nguồn số bán hàng thật; nó chết là báo cáo hôm nay vô nghĩa.");
  if (soat?.boMac.length) props.unshift(`${soat.boMac[0].ten} đứt ${soat.boMac[0].ngay} ngày rồi — quyết đi: sửa dứt điểm hay chốt bỏ hẳn (gắn chiThamKhao), đừng để nó kêu tiếp mỗi tối.`);
  if (bad.length) props.push(`Chữa ${bad.length} nguồn đang chết trước — số liệu trong mọi báo cáo khác đều dựa vào chúng.`);
  if (!props.length) props.push(`Máy chạy đủ, không có gì bất thường — giữ nhịp.`);
  L.push("", `\u{1F4A1} <b>ĐỀ XUẤT</b> (nhắn em làm):`, ...props.slice(0, 4).map((p, i) => `${i + 1}. ${p}`));

  const snapshot: EodSnapshot = {
    date: today,
    posts: {
      created: content?.createdToday || 0,
      published: content?.publishedToday || 0,
      failed: content?.failedToday || 0,
      ranToday: !!content?.factoryRanToday,
    },
    metaSpendMtd,
    jtOrders: jt.length,
    jtCod,
    revenue: rev,
    orders,
    leads: leads.length,
    openTasks: tasks.length,
    overdueTasks: overdue,
  };
  return { text: L.join("\n"), snapshot, badSources: bad.length };
}

export async function saveEodSnapshot(s: EodSnapshot): Promise<void> {
  await setConfigValue("eod_last", JSON.stringify(s), "Mốc tổng kết cuối ngày (để so hôm sau)");
}
