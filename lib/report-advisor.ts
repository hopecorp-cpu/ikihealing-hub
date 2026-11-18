import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { getConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";

const MIN_N = 200;
const MIN_N_PROVINCE = 20;

const KHACH_NEU = /khách (hỏi|quan tâm|muốn|cần|thắc mắc|đang tìm|nhắn|chủ động|bày tỏ|đề cập|tự)/i;
const DAU_HIEU_TEMPLATE = /sale (gửi|nhắn|chào|giới thiệu|tư vấn chung|spam)|template|copy-?paste|gửi (nhiều|hàng loạt|liên tiếp)|thông tin chung chung|quảng cáo liên tiếp/i;
const locKhachChuDong = (needs: string[]) => needs.filter((t) => KHACH_NEU.test(t) && !DAU_HIEU_TEMPLATE.test(t));

export type ReportIdea = {
  key: string;
  title: string;
  angle: string;
  seeds: string[];
  n: number;
  ready: boolean;
  need?: string;
  score: number;
  source: string;
};

export type ReportSnapshot = {
  month: string;
  dayCut: number;
  monthClosed: boolean;
  orders: number;
  customers: number;
  repeatPct: number;
  reMuaMedian: number;
  chatMedian: number;
  headline: string;
  diemSang: string;
  segments: Array<{ name: string; share: number; mom: number | null; small: boolean }>;
  provinces: Array<{ name: string; share: number; avgCod: number; n: number }>;
  monthIndex: Array<{ month: string; index: number }>;
  concerns: Array<{ name: string; pct: number; n: number }>;
};

export type ReportAdvice = {
  month: string;
  prevMonth: string;
  ideas: ReportIdea[];
  published: string[];
  fbDraft: string;
  snapshot: ReportSnapshot;
  generatedAt: string;
};

const CATS: Array<[string, RegExp]> = [
  ["Đạm thực vật", /true\s*vegan|dam\s|đạm|protein/i],
  ["Trà thảo mộc", /tra\s|trà|tue\s*minh|tuệ minh|thanh\s*huong|thanh hương/i],
  ["Thức uống thay cà phê", /nova|cafe|ca\s*phe|cà phê/i],
  ["Dầu ăn", /dau\s|dầu/i],
  ["Đồ dùng bếp", /silicon|hop\s|hộp|binh\s|bình/i],
];
const catOf = (name: string) => {
  for (const [c, re] of CATS) if (re.test(name || "")) return c;
  return "Nhóm khác";
};

const chuanSdt = (p?: string | null) => {
  let s = String(p || "").replace(/\D/g, "");
  if (s.startsWith("84") && s.length >= 11) s = "0" + s.slice(2);
  if (s.length === 9 && !s.startsWith("0")) s = "0" + s;
  return s;
};
const boDau = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PROVINCES = ["Hà Nội", "Hải Phòng", "Hải Dương", "Quảng Ninh", "Thái Bình", "Nam Định", "Ninh Bình", "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Bắc Ninh", "Bắc Giang", "Hưng Yên", "Vĩnh Phúc", "Phú Thọ", "Thái Nguyên", "Lạng Sơn", "Cao Bằng", "Lào Cai", "Yên Bái", "Sơn La", "Hòa Bình", "Tuyên Quang", "Hà Giang", "Điện Biên", "Lai Châu", "Bắc Kạn", "Hà Nam", "Đà Nẵng", "Huế", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên", "Khánh Hòa", "Ninh Thuận", "Bình Thuận", "Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng", "Quảng Bình", "Quảng Trị", "Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Bà Rịa", "Long An", "Tiền Giang", "Bến Tre", "Trà Vinh", "Vĩnh Long", "Đồng Tháp", "An Giang", "Kiên Giang", "Cần Thơ", "Hậu Giang", "Sóc Trăng", "Bạc Liêu", "Cà Mau", "Tây Ninh", "Bình Phước"];
const provinceOf = (addr: string) => {
  const a = boDau(addr || "");
  for (const p of PROVINCES) if (a.includes(boDau(p))) return p;
  return null;
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * (a - b)) / b) : 0);
const sign = (n: number) => (n > 0 ? `+${n}%` : `${n}%`);

async function pageAll(build: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let off = 0; off < 40000; off += 1000) {
    const { data } = await build(off, off + 999);
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export async function buildReportAdvice(): Promise<ReportAdvice> {
  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);
  const d = new Date(today + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - 1);
  const prevMonth = d.toISOString().slice(0, 7);

  const [items, bills, chats] = await Promise.all([

    layDoanhThuNhieuThang(sb, "2026-01-01", today).then((k) => k.rows.map((r) => ({ ...r, gross_amount: r.net_amount }))),
    pageAll((a, b) => sb.from("jt_waybills")
      .select("receiver_address,cod_value,is_void,order_create_time").range(a, b)),

    pageAll((a, b) => sb.from("salework_chat_analysis")
      .select("customer_need,msg_count").range(a, b)).catch(() => []),
  ]);

  const orders = new Map<string, { date: string; phone: string; cats: Set<string>; total: number }>();
  for (const r of items) {
    const o = orders.get(r.order_code) || { date: r.order_date, phone: chuanSdt(r.customer_phone), cats: new Set<string>(), total: 0 };
    o.cats.add(catOf(r.product_name || ""));
    o.total += r.net_amount || 0;
    orders.set(r.order_code, o);
  }
  const byPhone = new Map<string, Array<{ date: string; cats: Set<string> }>>();
  for (const o of orders.values()) {
    if (!o.phone) continue;
    const arr = byPhone.get(o.phone) || [];
    arr.push({ date: o.date, cats: o.cats });
    byPhone.set(o.phone, arr);
  }

  const lastDataDay = items.reduce((mx: string, r: any) => {
    const d = String(r.order_date || "");
    return d.slice(0, 7) === month && d > mx ? d : mx;
  }, "");
  const dayCut = lastDataDay ? Number(lastDataDay.slice(8, 10)) : 31;
  const monthClosed = dayCut >= new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

  const catRev = new Map<string, { cur: number; prev: number; curQty: number }>();
  let curTot = 0, prevTot = 0;
  for (const r of items) {
    const dstr = String(r.order_date || "");
    const m = dstr.slice(0, 7);
    if (m !== month && m !== prevMonth) continue;

    if (m === prevMonth && Number(dstr.slice(8, 10)) > dayCut) continue;
    const c = catOf(r.product_name || "");
    const cur = catRev.get(c) || { cur: 0, prev: 0, curQty: 0 };
    if (m === month) { cur.cur += r.net_amount || 0; cur.curQty += r.quantity || 0; curTot += r.net_amount || 0; }
    else { cur.prev += r.net_amount || 0; prevTot += r.net_amount || 0; }
    catRev.set(c, cur);
  }
  const catRows = [...catRev.entries()]

    .filter(([c, v]) => c !== "Nhóm khác" && (v.cur > 0 || v.prev > 0))
    .sort((a, b) => b[1].cur - a[1].cur);

  const prov = new Map<string, { n: number; cod: number[] }>();
  let provTot = 0;
  for (const b of bills) {
    if (b.is_void) continue;
    const p = provinceOf(b.receiver_address);
    if (!p) continue;
    const cur = prov.get(p) || { n: 0, cod: [] };
    cur.n++;
    if (+b.cod_value > 0) cur.cod.push(+b.cod_value);
    prov.set(p, cur);
    provTot++;
  }
  const provRows = [...prov.entries()].filter(([, v]) => v.n >= MIN_N_PROVINCE);

  const readArr = async (k: string) => { try { return JSON.parse((await getConfigValue(k)) || "[]"); } catch { return []; } };
  const [quiz, svNight, svSpend, leads] = await Promise.all([
    readArr("quiz_submissions"), readArr("survey_responses_thuc-khuya"),
    readArr("survey_responses_chi-tieu-suc-khoe"), readArr("blog_leads"),
  ]);

  const ideas: ReportIdea[] = [];
  const push = (i: Omit<ReportIdea, "ready" | "score"> & { ready?: boolean; score?: number }) => {
    const ready = i.n >= MIN_N;

    const base = Math.min(45, Math.round((i.n / MIN_N) * 45)) + (i.seeds.length >= 3 ? 25 : 10) + (i.score ?? 20);
    ideas.push({ ...i, ready, score: Math.min(100, base) });
  };

  if (catRows.length && curTot > 0) {
    const cmpNote = monthClosed ? "so với tháng trước" : `so với cùng kỳ tháng trước (tính tới ngày ${dayCut})`;
    const seeds = catRows.slice(0, 5).map(([c, v]) => {
      const share = Math.round((100 * v.cur) / curTot);
      const mom = pct(v.cur, v.prev);

      const cmp = share < 3
        ? "quy mô còn nhỏ, chưa nên diễn giải biến động"
        : v.prev > 0 ? `${sign(mom)} ${cmpNote}` : "chưa có nền kỳ trước để so";
      return `${c}: chiếm ${share}% giỏ hàng tháng ${month.slice(5)}, ${cmp}`;
    });
    const top = catRows[0];
    seeds.unshift(`Tổng quan: ${top[0]} tiếp tục dẫn dắt giỏ hàng sức khoẻ; theo dõi ${catRows.length} phân khúc`);
    if (!monthClosed) seeds.push(`Lưu ý số liệu: tháng ${month.slice(5)} mới có dữ liệu tới ngày ${dayCut} — mọi so sánh đã cắt kỳ trước về cùng ngày để không bị lệch pha`);
    push({
      key: "nhip-phan-khuc-thang",
      title: `Báo cáo nhịp tiêu dùng sức khoẻ tháng ${month.slice(5)}/${month.slice(0, 4)}`,
      angle: "Bản tin định kỳ hàng tháng theo phân khúc (đúng mô hình báo cáo thị trường): mỗi nhóm sản phẩm một dòng có thị phần và so sánh cùng kỳ. Báo chí dùng được ngay làm tư liệu thường kỳ, và nhịp đều đặn giúp thương hiệu thành nguồn số liệu quen mặt." + (monthClosed ? "" : " CHỜ HẾT THÁNG hãy công bố bản chính thức — hiện dữ liệu chưa đủ tháng."),
      seeds,
      n: orders.size,
      source: "sổ đơn Telegram (lib/doanh-thu)",
      score: monthClosed ? 30 : 12,
    });
  }

  if (provRows.length >= 5) {
    const byN = [...provRows].sort((a, b) => b[1].n - a[1].n).slice(0, 5);
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const byVal = [...provRows].filter(([, v]) => v.cod.length >= MIN_N_PROVINCE).sort((a, b) => avg(b[1].cod) - avg(a[1].cod)).slice(0, 5);
    const seeds = [
      `Dẫn đầu lượng đơn: ${byN.map(([p, v]) => `${p} (${Math.round((100 * v.n) / provTot)}%)`).join(", ")}`,
      byVal.length ? `Dẫn đầu giá trị mỗi đơn: ${byVal.map(([p, v]) => `${p} (${Math.round(avg(v.cod) / 1000)}k/đơn)`).join(", ")}` : "",
      `Phủ ${prov.size} tỉnh thành trên tổng ${provTot} vận đơn đọc được địa chỉ`,
    ].filter(Boolean);
    push({
      key: "ban-do-tinh",
      title: "Báo cáo bản đồ tiêu dùng sức khoẻ theo tỉnh thành",
      angle: "Xếp hạng tỉnh theo lượng đơn VÀ theo giá trị mỗi đơn — hai bảng khác nhau tạo góc bài ngược trực giác (tỉnh nhỏ chi đậm hơn đô thị lớn). Đây là dạng bảng xếp hạng báo chí rất thích trích.",
      seeds,
      n: provTot,
      source: "jt_waybills (J&T)",
      score: 25,
    });
  }

  if (byPhone.size >= 100) {
    const stats = new Map<string, { n: number; rep: number }>();
    for (const arr of byPhone.values()) {
      arr.sort((a, b) => (a.date < b.date ? -1 : 1));
      for (const c of arr[0].cats) {
        const s = stats.get(c) || { n: 0, rep: 0 };
        s.n++;
        if (arr.slice(1).some((o) => o.cats.has(c))) s.rep++;
        stats.set(c, s);
      }
    }
    const rows = [...stats.entries()]
      .filter(([c, s]) => c !== "Nhóm khác" && s.n >= 50)
      .sort((a, b) => b[1].rep / b[1].n - a[1].rep / a[1].n);
    if (rows.length >= 2) {
      push({
        key: "giu-chan-phan-khuc",
        title: "Báo cáo độ bền thói quen: nhóm sản phẩm nào giữ chân người dùng lâu nhất",
        angle: "Đo bằng hành vi mua lặp thật thay vì khảo sát tự khai — chỉ số hiếm có ở thị trường Việt Nam. ĐÃ CÔNG BỐ kỳ đầu; kỳ sau nên cập nhật số mới và thêm chiều thời gian giữa hai lần mua.",
        seeds: rows.slice(0, 4).map(([c, s]) => `${c}: ${Math.round((100 * s.rep) / s.n)}% khách mua lại đúng nhóm (n=${s.n})`),
        n: byPhone.size,
        source: "sổ đơn Telegram ghép theo số điện thoại",
        score: 10,
      });
    }
  }

  {
    const cnt = new Map<string, number>();
    for (const q of quiz) { const p = q?.profile || q?.theTrang; if (p) cnt.set(p, (cnt.get(p) || 0) + 1); }
    const rows = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
    push({
      key: "the-trang-nguoi-viet",
      title: "Báo cáo phân bố thể trạng Đông y của người Việt hiện đại",
      angle: "ĐỘC QUYỀN TUYỆT ĐỐI — không đơn vị nào tại Việt Nam có bộ dữ liệu thể trạng quy mô lớn. Đây là hướng giá trị nhất về mặt PR và cũng là nền cho định vị công ty công nghệ sức khoẻ.",
      seeds: rows.length
        ? rows.slice(0, 5).map(([p, n]) => `${p}: ${n} người (${Math.round((100 * n) / quiz.length)}%)`)
        : ["Chưa có bài quiz nào được nộp — cần đẩy quiz vào cộng đồng trước"],
      n: quiz.length,
      source: "config quiz_submissions",
      need: quiz.length < MIN_N ? `còn thiếu ${MIN_N - quiz.length} bài quiz nữa (đẩy link example.com/quiz vào cộng đồng)` : undefined,
      score: 30,
    });
  }

  const surveyIdea = (key: string, arr: any[], title: string, angle: string, fields: Array<[string, string]>) => {
    const seeds: string[] = [];
    for (const [f, label] of fields) {
      const cnt = new Map<string, number>();
      for (const r of arr) { const v = r?.a?.[f]; if (v) cnt.set(v, (cnt.get(v) || 0) + 1); }
      const top = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) seeds.push(`${label}: "${top[0]}" chiếm ${Math.round((100 * top[1]) / arr.length)}%`);
    }
    push({
      key, title, angle,
      seeds: seeds.length ? seeds : ["Chưa có phiếu nào — cần đẩy link khảo sát vào cộng đồng"],
      n: arr.length,
      source: `config survey_responses_${key.replace("khao-sat-", "")}`,
      need: arr.length < MIN_N ? `còn thiếu ${MIN_N - arr.length} phiếu nữa` : undefined,
      score: 25,
    });
  };
  surveyIdea("khao-sat-thuc-khuya", svNight,
    "Báo cáo: Người Việt thức khuya — nguyên nhân và hệ quả tự cảm nhận",
    "Chủ đề báo chí luôn cần, gắn Gen Z. Khảo sát ẩn danh nên công bố an toàn; có thể cắt theo tuổi và theo vùng.",
    [["gio_ngu", "Giờ đi ngủ phổ biến"], ["ly_do", "Lý do ngủ muộn hàng đầu"], ["sang_day", "Trạng thái buổi sáng"]]);
  surveyIdea("khao-sat-chi-tieu-suc-khoe", svSpend,
    "Báo cáo: Chi tiêu cho sức khoẻ khi kinh tế khó khăn — cắt gì, giữ gì",
    "Góc kinh tế tiêu dùng, đối chiếu được với số bán hàng thật của ACME — mạnh hơn hẳn khảo sát đơn thuần.",
    [["cat_dau", "Khoản bị cắt đầu tiên"], ["giu_cung", "Khoản giữ đến cùng"], ["muc_chi", "Mức chi mỗi tháng"]]);

  {
    const gaps: number[] = [];
    for (const arr of byPhone.values()) {
      if (arr.length < 2) continue;
      const ds = arr.map((o) => o.date).filter(Boolean).sort();
      for (let i = 1; i < ds.length; i++) {
        const g = Math.round((Date.parse(ds[i]) - Date.parse(ds[i - 1])) / 86400000);
        if (g > 0 && g < 400) gaps.push(g);
      }
    }
    if (gaps.length >= 100) {
      gaps.sort((a, b) => a - b);
      const q = (p: number) => gaps[Math.floor(gaps.length * p)];
      push({
        key: "chu-ky-tai-mua",
        title: "Báo cáo chu kỳ tái mua: người Việt quay lại với sản phẩm sức khoẻ sau bao lâu",
        angle: "Con số trung vị ~1 tháng gợi ra hai cách đọc thú vị cho báo chí: vừa khớp chu kỳ dùng hết một hộp, vừa khớp nhịp lương. Đây là chỉ số 'nhịp tiêu dùng' chưa ai công bố ở ngành thực phẩm bổ sung Việt Nam.",
        seeds: [
          `Trung vị ${q(0.5)} ngày giữa hai lần mua (n=${gaps.length} lượt tái mua)`,
          `Nhóm mua lại nhanh: 25% quay lại trong vòng ${q(0.25)} ngày`,
          `Nhóm chậm hơn: 25% cách nhau trên ${q(0.75)} ngày`,
        ],
        n: gaps.length,
        source: "sổ đơn Telegram ghép theo số điện thoại",
        score: 30,
      });
    }
  }

  {
    const perOrder = new Map<string, { lines: number; gift: number }>();
    for (const r of items) {
      const o = perOrder.get(r.order_code) || { lines: 0, gift: 0 };
      o.lines++;
      if ((r.net_amount || 0) === 0 && (r.gross_amount || 0) > 0) o.gift++;
      perOrder.set(r.order_code, o);
    }
    const all = [...perOrder.values()];
    if (all.length >= MIN_N) {
      const one = all.filter((o) => o.lines === 1).length;
      const three = all.filter((o) => o.lines >= 3).length;
      const gift = all.filter((o) => o.gift > 0).length;
      push({
        key: "cau-truc-gio-hang",
        title: "Báo cáo cấu trúc giỏ hàng sức khoẻ: người Việt mua thử một món hay mua cả bộ",
        angle: "Gần 6/10 đơn chỉ có một món — chân dung người tiêu dùng thận trọng, thử trước rồi mới mở rộng. Góc bài về tâm lý tiêu dùng ngành sức khoẻ, và là lời khuyên thực tế cho người mới bắt đầu.",
        seeds: [
          `${Math.round((100 * one) / all.length)}% đơn chỉ có một món — mua thử trước khi mở rộng`,
          `${Math.round((100 * three) / all.length)}% đơn từ ba món trở lên`,
          `${Math.round((100 * gift) / all.length)}% đơn có món tặng kèm (chính sách tặng quà thay vì giảm giá)`,
        ],
        n: all.length,
        source: "sổ đơn Telegram (theo đơn)",
        score: 25,
      });
    }
  }

  {
    const mc = (chats as any[]).map((c) => c.msg_count || 0).filter((n) => n > 0).sort((a, b) => a - b);
    if (mc.length >= 100) {
      const q = (p: number) => mc[Math.floor(mc.length * p)];
      push({
        key: "hanh-trinh-hoi-dap",
        title: "Báo cáo: cần bao nhiêu lượt trao đổi để một người Việt quyết định mua sản phẩm sức khoẻ",
        angle: "HƯỚNG MẠNH NHẤT TỪ DỮ LIỆU HỘI THOẠI. Trung vị khoảng 16 lượt tin nhắn cho một quyết định mua — con số này giải thích vì sao ngành hàng đưa vào cơ thể không bán được bằng nút 'Mua ngay', và ăn khớp với số 80-85% doanh thu đi qua kênh nhắn tin. Góc bài rất mạnh cho cả báo kinh doanh lẫn giới marketing.",
        seeds: [
          `Trung vị ${q(0.5)} lượt tin nhắn mỗi cuộc tư vấn (n=${mc.length} cuộc hội thoại)`,
          `Nhóm cần nhiều thông tin nhất: 10% cuộc vượt ${q(0.9)} lượt tin`,
          "Đối chiếu: 80-85% doanh thu của NOVA đi qua kênh nhắn tin, không qua giỏ hàng thương mại điện tử",
        ],
        n: mc.length,
        source: "salework_chat_analysis (hội thoại tư vấn Zalo)",
        score: 35,
      });
    }
  }

  {
    const TOPICS: Array<[string, RegExp]> = [
      ["Tiêu hoá và đường ruột", /tiêu hóa|tiêu hoá|đường ruột|táo bón|đầy bụng|khó tiêu|dạ dày/i],
      ["Mệt mỏi, thiếu năng lượng", /mệt mỏi|năng lượng|uể oải|suy nhược|kiệt sức/i],
      ["Giấc ngủ", /mất ngủ|giấc ngủ|khó ngủ|ngủ không/i],
      ["Ăn chay và nguồn đạm", /ăn chay|thuần chay|đạm thực vật|protein/i],
      ["Chăm sức khoẻ cho bố mẹ", /lớn tuổi|bố mẹ|cha mẹ|người già|trung niên/i],
      ["Da và sắc đẹp", /\bda\b|sắc đẹp|nám|mụn/i],
      ["Xương khớp", /xương|khớp/i],
      ["Dưỡng Can theo Đông y (gan mật)", /gan|mật/i],
      ["Băn khoăn về giá", /giá|đắt|rẻ|khuyến mãi|ưu đãi/i],
      ["Muốn thấy bằng chứng, sợ bị lừa", /nghi ngờ|lo ngại|thật không|hiệu quả không|uy tín|kiểm chứng/i],
    ];
    const needsAll = (chats as any[]).map((c) => String(c.customer_need || ""))
      .filter((t) => t && !/chưa có nhu cầu|chưa xác định|không rõ/i.test(t.slice(0, 80)));

    const needs = locKhachChuDong(needsAll);
    if (needs.length >= 100) {
      const cnt = new Map<string, number>();
      for (const t of needs) for (const [n, re] of TOPICS) if (re.test(t)) cnt.set(n, (cnt.get(n) || 0) + 1);
      const rows = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      const loaiBo = needsAll.length - needs.length;
      push({
        key: "ban-do-noi-lo",
        title: "Báo cáo bản đồ quan tâm sức khoẻ: người Việt chủ động hỏi gì khi tìm mua",
        angle: "Đo bằng điều khách CHỦ ĐỘNG NÊU trong hội thoại thật, không phải khảo sát chọn đáp án — nên phản ánh quan tâm tự nhiên. Insight ngược rất mạnh: nhóm 'băn khoăn về giá' và 'muốn thấy bằng chứng' đứng gần đầu bảng, cho thấy rào cản lớn nhất của ngành là NIỀM TIN chứ không phải nhu cầu.",
        seeds: [
          ...rows.map(([n, c]) => `${n}: ${Math.round((100 * c) / needs.length)}% các cuộc khách chủ động nêu (n=${c})`),
          `Phương pháp lọc: từ ${needsAll.length.toLocaleString("vi-VN")} cuộc có nhu cầu rõ, chỉ giữ ${needs.length.toLocaleString("vi-VN")} cuộc mà khách là bên nêu vấn đề; loại ${loaiBo.toLocaleString("vi-VN")} cuộc còn lại để số không bị tin nhắn tư vấn gửi sẵn làm phồng`,
          "Chủ đề dưỡng Can (gan mật) được ghi theo góc nhìn dưỡng sinh Đông y — là điều khách quan tâm, không phải công dụng sản phẩm",
        ],
        n: needs.length,
        source: "salework_chat_analysis, đã lọc còn cuộc khách chủ động nêu",
        score: 32,
      });
    }
  }

  {

    const byMonth = new Map<string, { rev: number; orders: Set<string>; firstDay: number }>();
    for (const r of items) {
      const dstr = String(r.order_date || "");
      const m = dstr.slice(0, 7);
      if (!m) continue;
      const day = Number(dstr.slice(8, 10)) || 31;
      const cur = byMonth.get(m) || { rev: 0, orders: new Set<string>(), firstDay: 31 };
      cur.rev += r.net_amount || 0;
      cur.orders.add(r.order_code);
      if (day < cur.firstDay) cur.firstDay = day;
      byMonth.set(m, cur);
    }

    const months = [...byMonth.entries()].sort()
      .filter(([m, v]) => (monthClosed || m !== month) && v.firstDay <= 3);
    if (months.length >= 3) {
      const base = months[0][1].orders.size || 1;
      const idx = months.map(([m, v]) => [m, Math.round((100 * v.orders.size) / base)] as [string, number]);
      const peak = [...idx].sort((a, b) => b[1] - a[1])[0];
      const low = [...idx].sort((a, b) => a[1] - b[1])[0];
      push({
        key: "nhip-mua-theo-thang",
        title: "Báo cáo nhịp mùa của thị trường sức khoẻ chủ động: tháng nào người Việt chăm mình nhất",
        angle: "Chỉ số nhịp theo tháng (lấy tháng đầu kỳ làm mốc 100) cho thấy sức khoẻ chủ động có tính mùa vụ rõ. Dạng số này báo chí dùng được cho bài dự báo cuối năm và bài mùa lễ.",
        seeds: [
          ...idx.map(([m, v]) => `Tháng ${m.slice(5)}: chỉ số nhịp ${v} (mốc 100 = tháng ${months[0][0].slice(5)})`),
          `Cao điểm: tháng ${peak[0].slice(5)} · Thấp điểm: tháng ${low[0].slice(5)}`,
          "Phương pháp: đo theo THÁNG chứ không theo thứ hay giờ, vì ngày ghi nhận đơn trên hệ thống có thể lệch 1-3 ngày so với lúc khách đặt — sai số đó đủ làm sai phân bố theo thứ nhưng gần như không ảnh hưởng phân bố theo tháng",
        ],
        n: [...byMonth.values()].reduce((s, v) => s + v.orders.size, 0),
        source: "sổ đơn Telegram theo tháng ghi nhận",
        score: 22,
      });
    }
  }

  if (leads.length >= 20) {
    push({
      key: "blog-den-don-hang",
      title: "Báo cáo: từ đọc kiến thức sức khoẻ đến quyết định mua — hành trình bao lâu",
      angle: "Đo thời gian từ lúc để lại email đọc cẩm nang tới đơn đầu tiên. Góc bài cho giới marketing/khởi nghiệp, và là bằng chứng mô hình content-first cho nhà đầu tư.",
      seeds: [`Hiện có ${leads.length} lead blog để đo`, "Cần đủ lead có phát sinh đơn mới ra được trung vị thời gian"],
      n: leads.length,
      source: "config blog_leads ghép mshopkeeper_line_items theo SĐT",
      need: leads.length < MIN_N ? `còn thiếu ${MIN_N - leads.length} lead nữa` : undefined,
      score: 15,
    });
  }

  ideas.sort((a, b) => (b.ready ? 1 : 0) - (a.ready ? 1 : 0) || b.score - a.score);

  const published = [
    "Người Việt chăm sóc sức khoẻ chủ động 2026 (cơ cấu giỏ hàng, repeat, vùng miền, COD)",
    "Bản đồ chi tiêu sức khoẻ theo vùng miền (giá trị đơn theo tỉnh)",
    "Độ bền thói quen theo nhóm sản phẩm (mua lại đúng nhóm)",
  ];

  const customers = byPhone.size;
  const repeatCnt = [...byPhone.values()].filter((a) => a.length >= 2).length;
  const repeatPctVal = customers ? Math.round((100 * repeatCnt) / customers) : 0;

  const gapsAll: number[] = [];
  for (const arr of byPhone.values()) {
    if (arr.length < 2) continue;
    const ds = arr.map((o) => o.date).filter(Boolean).sort();
    for (let i = 1; i < ds.length; i++) {
      const g = Math.round((Date.parse(ds[i]) - Date.parse(ds[i - 1])) / 86400000);
      if (g > 0 && g < 400) gapsAll.push(g);
    }
  }
  gapsAll.sort((a, b) => a - b);
  const taiMuaMedian = gapsAll.length ? gapsAll[Math.floor(gapsAll.length / 2)] : 0;

  const provTop3 = [...prov.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);
  const topProvLine = provTop3.length && provTot
    ? `${provTop3.map(([p, v]) => `${p} ${Math.round((100 * v.n) / provTot)}%`).join(", ")}; phủ ${prov.size} tỉnh thành.`
    : "";

  const msgCounts = (chats as any[]).map((c) => c.msg_count || 0).filter((n) => n > 0).sort((a, b) => a - b);
  const chatLine = msgCounts.length
    ? `trung vị ${msgCounts[Math.floor(msgCounts.length / 2)]} lượt tin nhắn tư vấn cho một quyết định mua (n=${msgCounts.length.toLocaleString("vi-VN")} cuộc).`
    : "";

  const grow = catRows
    .filter(([, v]) => v.prev > 0 && curTot > 0 && (100 * v.cur) / curTot >= 3)
    .map(([c, v]) => [c, pct(v.cur, v.prev)] as [string, number])
    .sort((a, b) => b[1] - a[1])[0];
  const diemSang = grow && grow[1] > 0
    ? `${grow[0]} tăng nhanh nhất trong kỳ (${sign(grow[1])} ${monthClosed ? "so với tháng trước" : "so cùng kỳ tháng trước"}).`
    : catRows.length ? `${catRows[0][0]} tiếp tục là cửa ngõ phổ biến nhất của lối sống sức khoẻ chủ động.` : "";

  const ICON = {
    chart: "\u{1F4CA}", pin: "\u{1F4CC}", dam: "\u{1F33F}", tra: "\u{1F375}",
    cafe: "\u{2615}", dau: "\u{1FAD2}", bep: "\u{1F961}", map: "\u{1F5FA}",
    chat: "\u{1F4AC}", loop: "\u{1F501}", star: "\u{2B50}",
  };
  const iconCat = (c: string) =>
    /Đạm/.test(c) ? ICON.dam : /Trà/.test(c) ? ICON.tra : /cà phê/i.test(c) ? ICON.cafe
      : /Dầu/.test(c) ? ICON.dau : /bếp/i.test(c) ? ICON.bep : ICON.chart;

  const cmpLabel = monthClosed ? "so với tháng trước" : `so với cùng kỳ tháng trước (tới ngày ${dayCut})`;
  const L: string[] = [];
  if (catRows.length && curTot > 0) {
    const top = catRows[0];
    const tang = catRows.filter(([, v]) => v.prev > 0 && v.cur > v.prev).length;
    L.push(`${ICON.pin} BÁO CÁO TIÊU DÙNG SỨC KHOẺ CHỦ ĐỘNG THÁNG ${month.slice(5)}/${month.slice(0, 4)} - THEO DỮ LIỆU CỦA NOVA BY ACME Corp`);
    L.push("");
    L.push(`Tháng ${month.slice(5)} ghi nhận giỏ hàng sức khoẻ tiếp tục tập trung quanh bữa ăn chính: ${top[0].toLowerCase()} giữ vai trò dẫn dắt, ${tang > 0 ? `${tang} phân khúc tăng ${cmpLabel}` : "các phân khúc còn lại đi ngang"}.`);
    L.push("");
    L.push(`${ICON.chart} Tổng quan: ${orders.size.toLocaleString("vi-VN")} đơn của ${customers.toLocaleString("vi-VN")} khách hàng trong kỳ; ${repeatPctVal}% khách quay lại mua tiếp, chu kỳ tái mua trung vị ${taiMuaMedian || "-"} ngày.`);
    for (const [c, v] of catRows.slice(0, 5)) {
      const share = Math.round((100 * v.cur) / curTot);
      const mom = pct(v.cur, v.prev);
      const cmp = share < 3 ? "quy mô còn nhỏ, chưa diễn giải biến động"
        : v.prev > 0 ? `${sign(mom)} ${cmpLabel}` : "chưa có nền kỳ trước để so";
      L.push(`${iconCat(c)} ${c}: chiếm ${share}% giỏ hàng, ${cmp}.`);
    }
    if (topProvLine) L.push(`${ICON.map} Địa bàn: ${topProvLine}`);
    if (chatLine) L.push(`${ICON.chat} Hành trình mua: ${chatLine}`);
    L.push(`${ICON.star} Điểm sáng: ${diemSang}`);
    L.push("");
    L.push(`Nguồn: dữ liệu vận hành của Công ty Cổ phần ACME${monthClosed ? "" : ` (tháng ${month.slice(5)} có dữ liệu tới ngày ${dayCut}, mọi so sánh đã cắt kỳ trước về cùng ngày)`}. Số liệu tổng hợp, không chứa thông tin cá nhân.`);
    L.push("Báo chí trích dẫn miễn phí kèm nguồn. Xem đầy đủ: https://example.com/blog/danh-muc-bao-cao.html");
  }
  const fbDraft = L.join("\n");

  const avgOf = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const nhipMua = (() => {
    const bm = new Map<string, { n: Set<string>; first: number }>();
    for (const r of items) {
      const dstr = String(r.order_date || "");
      const m = dstr.slice(0, 7);
      if (!m) continue;
      const day = Number(dstr.slice(8, 10)) || 31;
      const c = bm.get(m) || { n: new Set<string>(), first: 31 };
      c.n.add(r.order_code);
      if (day < c.first) c.first = day;
      bm.set(m, c);
    }
    const ms = [...bm.entries()].sort().filter(([m, v]) => (monthClosed || m !== month) && v.first <= 3);
    if (!ms.length) return [];
    const base = ms[0][1].n.size || 1;
    return ms.map(([m, v]) => ({ month: m, index: Math.round((100 * v.n.size) / base) }));
  })();

  const concerns = (() => {
    const T: Array<[string, RegExp]> = [
      ["Dưỡng Can theo Đông y", /gan|mật/i],
      ["Băn khoăn về giá", /giá|đắt|rẻ|khuyến mãi|ưu đãi/i],
      ["Ăn chay và nguồn đạm", /ăn chay|thuần chay|đạm thực vật|protein/i],
      ["Tiêu hoá và đường ruột", /tiêu hóa|tiêu hoá|đường ruột|táo bón|đầy bụng|khó tiêu|dạ dày/i],
      ["Da và sắc đẹp", /\bda\b|sắc đẹp|nám|mụn/i],
      ["Muốn thấy bằng chứng", /nghi ngờ|lo ngại|thật không|uy tín|kiểm chứng/i],
    ];
    const clean = locKhachChuDong((chats as any[]).map((c) => String(c.customer_need || ""))
      .filter((t) => t && !/chưa có nhu cầu|chưa xác định|không rõ/i.test(t.slice(0, 80))));
    if (!clean.length) return [];
    return T.map(([name, re]) => {
      const n = clean.filter((t) => re.test(t)).length;
      return { name, pct: Math.round((100 * n) / clean.length), n };
    }).filter((r) => r.n > 0).sort((a, b) => b.pct - a.pct);
  })();

  const snapshot: ReportSnapshot = {
    month, dayCut, monthClosed,
    orders: orders.size,
    customers,
    repeatPct: repeatPctVal,
    reMuaMedian: taiMuaMedian,
    chatMedian: msgCounts.length ? msgCounts[Math.floor(msgCounts.length / 2)] : 0,
    headline: catRows.length
      ? `Tháng ${month.slice(5)}: ${catRows[0][0].toLowerCase()} dẫn dắt giỏ hàng sức khoẻ; chu kỳ tái mua trung vị ${taiMuaMedian} ngày.`
      : "Chưa đủ dữ liệu để dựng nhận định tháng.",
    diemSang,
    segments: catRows.slice(0, 6).map(([name, v]) => {
      const share = curTot ? Math.round((100 * v.cur) / curTot) : 0;
      return { name, share, mom: v.prev > 0 && share >= 3 ? pct(v.cur, v.prev) : null, small: share < 3 };
    }),
    provinces: [...prov.entries()]
      .filter(([, v]) => v.n >= MIN_N_PROVINCE)
      .sort((a, b) => b[1].n - a[1].n).slice(0, 10)
      .map(([name, v]) => ({ name, share: provTot ? Math.round((1000 * v.n) / provTot) / 10 : 0, avgCod: Math.round(avgOf(v.cod)), n: v.n })),
    monthIndex: nhipMua,
    concerns,
  };

  return { month, prevMonth, ideas, published, fbDraft, snapshot, generatedAt: new Date().toISOString() };
}
