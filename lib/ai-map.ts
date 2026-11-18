import { getServiceClient } from "@/lib/supabase-server";
import { checkAllSources, type SourceHealth } from "@/lib/watchdog";
import { tomTatMay } from "@/lib/viec-may";

export type AgentState =
  | "live"
  | "stale"
  | "empty"
  | "realtime"
  | "human"
  | "notbuilt";

export type AgentMaturity = "full" | "partial" | "notbuilt";

export type AgentTuChu =
  | "nguoi"
  | "doc"
  | "de-xuat"
  | "cho-duyet"
  | "trong-han";

export type AgentDef = {
  id: string;
  tier: number;
  tierLabel: string;
  name: string;
  role: string;
  maturity: AgentMaturity;
  human?: boolean;
  hub?: boolean;
  link?: string;
  statusKey?: string;
  configKey?: string;
  runKey?: string;
  schedule?: string;
  tuChu?: AgentTuChu;
  chot?: string;
  note?: string;

  phongBan?: string | null;

  canhBaoDb?: string;

  chiKhaiDb?: boolean;
};

export type AgentSanLuong = {
  luot: number;
  sanPham: number;
  donVi: string | null;
  hong: number;
  khongCoGi: number;
  lanCuoi: string;
};

export type AgentLive = AgentDef & {
  state: AgentState;
  detail: string;
  ageHours: number | null;
  sanLuong: AgentSanLuong | null;

  chu: string | null;
};

export const AGENTS: AgentDef[] = [

  { id: "founder", tier: 1, tierLabel: "Quyết định", name: "Founder / BGĐ", role: "Đặt mục tiêu · Duyệt chiến lược · Xem báo cáo", tuChu: "nguoi", chot: "CEO & BGĐ quyết", maturity: "full", human: true, link: "/bang-dieu-hanh" },

  { id: "strategy", tier: 2, tierLabel: "Chiến lược", name: "Chiến lược", role: "Bản đồ chiến lược (BSC) · KPI · cảnh báo lệch nhịp", tuChu: "doc", chot: "trang tính tại chỗ, không hành động ra ngoài", maturity: "full", link: "/ban-do-chien-luoc", schedule: "Đèn xanh/vàng/đỏ chảy số tự động" },
  { id: "research", tier: 2, tierLabel: "Chiến lược", name: "Research", role: "Nghiên cứu thị trường · đối thủ · nỗi đau KH", tuChu: "trong-han", chot: "chỉ ghi kho nội bộ nuôi Nhà máy Content, không ra khách", maturity: "partial", configKey: "mkt_research", runKey: "mkt-research", link: "/chien-luoc-mkt", schedule: "Chủ Nhật hằng tuần", note: "Chạy tự động tuần + lưu lịch sử 12 bản + có mặt tiền xem; nuôi Nhà máy Content. Còn: prompt cố định (chưa tuỳ biến câu hỏi)." },

  { id: "dispatch", tier: 3, tierLabel: "Điều phối", name: "Dispatch — Hub điều phối", role: "Phân rã brief · route · Cửa QA · gom bài đạt", tuChu: "de-xuat", chot: "rã brief + chấm QA rồi ĐỀ XUẤT; người chốt mới chạy chiến dịch", maturity: "partial", hub: true, configKey: "dispatch_log", link: "/dispatch", note: "Đọc gap doanh thu để 'Đề xuất chiến dịch'; nối Lịch chiến dịch năm→quý→tháng→tuần→ngày (/lich-chien-dich). Content+Design+QA sống; Performance chờ token." },

  { id: "plan", tier: 4, tierLabel: "Thực thi", name: "Kế hoạch", role: "Vòng lặp doanh thu · KPI ngược · trần ngân sách ads", tuChu: "doc", chot: "trang tính tại chỗ, không hành động ra ngoài", maturity: "full", link: "/vong-lap-doanh-thu", schedule: "Tính realtime từ MISA" },
  { id: "content", tier: 4, tierLabel: "Thực thi", name: "Content", role: "Nhà máy Content — AI viết bài nháp chờ duyệt", tuChu: "cho-duyet", chot: "bài nháp đẩy Telegram chờ CEO bấm Đã đăng / Bỏ; cửa từ cấm lib/banned-words chặn trước", maturity: "full", statusKey: "content_factory_last", runKey: "content-factory", link: "/content", schedule: "Hằng ngày 8:30 + gõ 'tạo bài'" },
  { id: "blog", tier: 4, tierLabel: "Thực thi", name: "Máy viết blog NOVA", role: "Bài dài ≥2500 từ cho example.com/blog + lớp bù trong ngày", tuChu: "trong-han", chot: "TỰ đăng blog thật — chặn bằng cửa từ cấm + bài không kết bằng thẻ đóng thì loại, không đăng", maturity: "full", statusKey: "blog_writer_last", runKey: "blog-writer", link: "/content", schedule: "6:08 + 14:20, bù 12:30 + 20:30" },
  { id: "donhang", tier: 4, tierLabel: "Thực thi", name: "Máy bóc đơn Telegram", role: "Đọc nhóm Đơn Hàng → bóc thành đơn (nguồn doanh thu số 1)", tuChu: "trong-han", chot: "chỉ GHI đơn vào tg_orders; không đổi tiền, không gửi gì ra khách", maturity: "full", runKey: "tg-boc-don", configKey: "nguon_boc_don_tele", link: "/gan-don", schedule: "2 lần/giờ" },
  { id: "design", tier: 4, tierLabel: "Thực thi", name: "Design", role: "Vẽ ảnh (Gemini→free) + dán logo NOVA cho mỗi bài", tuChu: "trong-han", chot: "ảnh tĩnh vật + tự dán logo NOVA; prompt cấm cận mặt người, cấm chữ, cấm bao bì", maturity: "partial", statusKey: "content_factory_last", note: "Ảnh tĩnh vật + logo tự động mỗi bài; hỗ trợ đa tỉ lệ feed/vuông/story + hàm carousel. Còn: bật carousel trong luồng ngày + hiển thị nhiều ảnh ở /content." },
  { id: "performance", tier: 4, tierLabel: "Thực thi", name: "Performance", role: "Quảng cáo Meta · đo lường · đề xuất tăng/giảm/ngừng ngân sách", tuChu: "de-xuat", chot: "ads_autopilot MẶC ĐỊNH TẮT · trần ads_max_daily_budget 1tr/ngày kẹp ở adjustCampaignBudget · nút đổi tiền CHỈ ở chat riêng CEO", maturity: "partial", statusKey: "ads_campaigns", runKey: "ads-spend", link: "/do-luong-mkt", schedule: "Kéo chi tiêu hằng ngày", note: "ĐANG kéo chi tiêu/CPO Meta THẬT về /do-luong-mkt. Có nút tăng/giảm/ngừng chiến dịch + đề xuất ngân sách theo CPO trần. AI chỉ ĐỀ XUẤT, người bấm mới đổi tiền." },

  { id: "content_bu", tier: 4, tierLabel: "Thực thi", name: "Lớp bù bài fanpage", role: "Đếm bài trong ngày, thiếu thì tự viết bù — không đợi CEO nhắc", tuChu: "cho-duyet", chot: "bù bài thiếu rồi đẩy duyệt; trần 3 bài/lượt, không tự đăng fanpage", maturity: "full", runKey: "content-bu", link: "/content", schedule: "12:00 · 17:00 · 21:00" },
  { id: "blog_bu", tier: 4, tierLabel: "Thực thi", name: "Lớp bù bài blog", role: "Chữa lượt blog khung giờ bị gãy, giữ chỉ tiêu ngày", tuChu: "trong-han", chot: "chỉ chạy khi thiếu so với chiTieuToiGio(); đủ thì im, vẫn ghi nhịp tim", maturity: "full", runKey: "blog-bu", link: "/content", schedule: "12:30 · 20:30" },
  { id: "dangcheo", tier: 4, tierLabel: "Thực thi", name: "Máy soạn bài đăng chéo", role: "Soạn bản đăng cho Medium, Substack, X, LinkedIn... người đăng tay", tuChu: "de-xuat", chot: "chỉ SOẠN bản đăng; người đăng tay từng nền tảng", maturity: "full", runKey: "dang-cheo", link: "/dang-cheo", schedule: "7:45 hằng ngày" },
  { id: "catruc", tier: 4, tierLabel: "Thực thi", name: "Ca trực AI", role: "Soạn sẵn câu trả lời cho khách đang chờ — máy soạn, người bấm gửi", tuChu: "de-xuat", chot: "soạn sẵn câu trả lời, NGƯỜI bấm gửi — máy không tự nhắn khách", maturity: "full", runKey: "ca-truc-ai", link: "/ca-truc-ai", schedule: "07:00 trước ca sáng" },
  { id: "zalonhac", tier: 4, tierLabel: "Thực thi", name: "Máy nhắc khách chờ Zalo", role: "Chỉ nhắc thứ ĐO ĐƯỢC: khách nói câu cuối mà chưa ai đáp", tuChu: "trong-han", chot: "chỉ nhắc NỘI BỘ nhóm sale thứ đo được (khách nói câu cuối chưa ai đáp); không nhắn khách", maturity: "full", runKey: "zalo-nhac", link: "/cham-soc-kh", schedule: "9:30 · 14:30 · 19:30" },
  { id: "report", tier: 5, tierLabel: "Đánh giá", name: "Báo cáo", role: "Giám đốc AI · bản tin sáng/chiều · tự học", tuChu: "trong-han", chot: "gửi bản tin cho CEO; locCEO() lọc nguồn rác, không đụng dữ liệu", maturity: "full", statusKey: "brain_learn_status", runKey: "brain-brief", link: "/giam-doc-ai", schedule: "Sáng + chiều + CN" },
  { id: "hocthegioi", tier: 5, tierLabel: "Đánh giá", name: "Máy học thế giới", role: "Chuyện có nguồn → nguyên lý → SOI LẠI ACME bằng số thật", tuChu: "trong-han", chot: "ghi kho + gửi; không tìm được chuyện đáng kể thì IM, vẫn ghi nhịp tim", maturity: "full", runKey: "hoc-the-gioi", statusKey: "hoc_the_gioi_last", schedule: "7:40 · 13:40 · 20:40" },

  { id: "cowork", tier: 6, tierLabel: "Tự động hoá", name: "Cowork — Tự động hoá", role: "17 tác vụ theo lịch + Watchdog canh gác 2h/lần", tuChu: "trong-han", chot: "tự mở việc khi nguồn chết — MỘT việc mở/nguồn, nguồn sống lại máy tự đóng; không đẻ việc cho nguồn chiThamKhao", maturity: "full", statusKey: "web_alive", runKey: "watchdog", schedule: "Cron Vercel", note: "Watchdog hỏng-phải-kêu; nguồn nào chết bắn Telegram." },

  { id: "brandbible", tier: 7, tierLabel: "Kho tri thức", name: "Brand Bible + SOP", role: "Tư cách phát ngôn · luật TPBS · quy trình lõi", tuChu: "doc", chot: "kho nền cho mọi agent đọc, không hành động", maturity: "full", link: "/quy-trinh", schedule: "Nền cho mọi agent" },
  { id: "campaign_memory", tier: 7, tierLabel: "Kho tri thức", name: "Campaign Memory", role: "Nhớ bài WIN (bài chạy tốt) & FAIL (bị bỏ/dính luật) — đã nạp ngược vào brief", tuChu: "doc", chot: "kho nhớ bài WIN/FAIL, nạp ngược vào brief; không hành động", maturity: "partial", configKey: "campaign_memory", link: "/dispatch", note: "Ghi bài fail (bỏ khi duyệt / còn từ cấm) + có panel xem ở /dispatch; chưa gắn tín hiệu tương tác thấp." },
];

const pickTs = (o: any): any => o?.generatedAt || o?.updatedAt || o?.handledAt || o?.at || o?.lastAt || o?.time || null;
const hoursSince = (iso: any): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 3600e3 * 10) / 10);
};
const ageText = (h: number | null): string => {
  if (h == null) return "";
  if (h < 1) return "vừa xong";
  if (h < 48) return `${Math.round(h)}h trước`;
  return `${Math.round(h / 24)} ngày trước`;
};

export async function buildAiMap(): Promise<AgentLive[]> {
  const [health, tt, rowsDb] = await Promise.all([
    checkAllSources().catch(() => [] as SourceHealth[]),
    tomTatMay(1).catch(() => null),
    docAgentsDb(),
  ]);
  const byKey = new Map(health.map((h) => [h.key, h]));
  const sanLuongTheoAgent = new Map((tt?.theoAgent ?? []).map((x) => [x.agent, x]));
  const sb = getServiceClient();

  let soGiu: Record<string, string> | null = null;
  try {
    const v = (await sb.from("config").select("value").eq("key", "nguoi_giu").maybeSingle()).data?.value;
    soGiu = v ? JSON.parse(v) : {};
  } catch { soGiu = null; }
  const chuCua = (id: string) => (soGiu ? soGiu[`agent:${id}`] || null : null);

  const sl = (a: AgentDef): AgentSanLuong | null => {
    if (!a.runKey) return null;
    const x = sanLuongTheoAgent.get(a.runKey);
    if (!x) return null;
    return { luot: x.luot, sanPham: x.sanPham, donVi: x.donVi, hong: x.hong, khongCoGi: x.khongCoGi, lanCuoi: x.lanCuoi };
  };

  const out: AgentLive[] = [];
  const danhSach = ghepAgentsDb(AGENTS, rowsDb);
  for (const a of danhSach) {

    if (a.chiKhaiDb) { out.push({ ...a, chu: chuCua(a.id), state: "empty", detail: "Khai ở bảng agents, chưa có nguồn đo", ageHours: null, sanLuong: null }); continue; }

    if (a.human) { out.push({ ...a, chu: chuCua(a.id), state: "human", detail: "CEO & BGĐ", ageHours: null, sanLuong: null }); continue; }

    if (a.maturity === "notbuilt") { out.push({ ...a, chu: chuCua(a.id), state: "notbuilt", detail: "Chưa dựng — đợt sau", ageHours: null, sanLuong: null }); continue; }

    if (a.statusKey && byKey.has(a.statusKey)) {
      const h = byKey.get(a.statusKey)!;
      const state: AgentState = h.ageHours == null ? (h.ok ? "realtime" : "empty") : (h.ok ? "live" : "stale");
      const detail = h.ageHours == null ? (h.ok ? (a.schedule || "Đang chạy") : (h.note || "Chưa có dữ liệu"))
        : `${h.ok ? "Đang chạy" : "Quá hạn"} · ${ageText(h.ageHours)}`;
      out.push({ ...a, chu: chuCua(a.id), state, detail, ageHours: h.ageHours, sanLuong: sl(a) });
      continue;
    }

    if (a.configKey) {
      let o: any = null;
      try { const v = (await sb.from("config").select("value").eq("key", a.configKey).maybeSingle()).data?.value; o = v ? JSON.parse(v) : null; } catch { }
      const age = hoursSince(pickTs(o));
      const state: AgentState = o == null ? "empty" : age == null ? "realtime" : age <= 24 * 8 ? "live" : "stale";
      const detail = o == null ? "Chưa có dữ liệu" : age == null ? (a.schedule || "Đang chạy") : `Cập nhật ${ageText(age)}`;
      out.push({ ...a, chu: chuCua(a.id), state, detail, ageHours: age, sanLuong: sl(a) });
      continue;
    }

    out.push({ ...a, chu: chuCua(a.id), state: "realtime", detail: a.schedule || "Tính realtime", ageHours: null, sanLuong: sl(a) });
  }
  return out;
}

export const PHONG_AI_TINH: { id: string; ten: string; loai: string }[] = [
  { id: "tlgd", ten: "Trợ lý Giám đốc", loai: "tro_ly" },
  { id: "grok-bot", ten: "Grok Bot", loai: "router" },
  { id: "th", ten: "Thương hiệu & Truyền thông", loai: "phong" },
  { id: "mkt", ten: "Marketing tăng trưởng", loai: "phong" },
  { id: "kd", ten: "Kinh doanh", loai: "phong" },
  { id: "cskh", ten: "Chăm sóc khách hàng", loai: "phong" },
  { id: "vhsp", ten: "Vận hành & Sản phẩm", loai: "phong" },
  { id: "ns", ten: "Nhân sự & Văn hóa", loai: "phong" },
  { id: "tc", ten: "Tài chính & Gọi vốn", loai: "phong" },
  { id: "kt", ten: "Kỹ thuật & Dữ liệu", loai: "phong" },
];

export type DongAgentDb = {
  id: string; ten: string; loai: string; phong_id: string | null; trang_thai: string | null;
  ghi_chu?: string | null;
  departments?: { name: string } | null;
};

const TRANG_THAI_CANH_BAO: Record<string, string> = { tam_dung: "tạm dừng", chet: "đã chết" };

export function ghepAgentsDb(agentsCode: AgentDef[], rowsDb: DongAgentDb[] | null): AgentDef[] {
  if (!rowsDb) return agentsCode;
  const theoId = new Map(rowsDb.map((r) => [r.id, r]));
  const canhBao = (r: DongAgentDb) => (r.trang_thai ? TRANG_THAI_CANH_BAO[r.trang_thai] : undefined);
  const ra: AgentDef[] = agentsCode.map((a) => {
    const r = theoId.get(a.id);
    if (!r) return a;
    const cb = canhBao(r);
    return {
      ...a,
      name: r.ten || a.name,
      phongBan: r.departments?.name ?? null,
      ...(cb ? { canhBaoDb: `Bảng agents ghi: ${cb}`, note: [a.note, `Bảng agents ghi: ${cb}`].filter(Boolean).join(" · ") } : {}),
    };
  });
  const coTrongCode = new Set(agentsCode.map((a) => a.id));
  for (const r of rowsDb) {
    if (coTrongCode.has(r.id) || (r.loai !== "bot" && r.loai !== "may")) continue;
    const cb = canhBao(r);
    ra.push({
      id: r.id, tier: 4, tierLabel: "Thực thi", name: r.ten, role: r.ghi_chu || (r.loai === "bot" ? "Bot" : "Máy"),
      maturity: "partial", chiKhaiDb: true, phongBan: r.departments?.name ?? null,
      note: ["Khai ở bảng agents, chưa có nguồn đo", cb ? `Bảng agents ghi: ${cb}` : ""].filter(Boolean).join(" · "),
      ...(cb ? { canhBaoDb: `Bảng agents ghi: ${cb}` } : {}),
    });
  }
  return ra;
}

export async function docAgentsDb(): Promise<DongAgentDb[] | null> {
  try {
    const { data, error } = await getServiceClient()
      .from("agents")
      .select("id, ten, loai, phong_id, trang_thai, ghi_chu, departments(name)");
    return error ? null : ((data ?? []) as unknown as DongAgentDb[]);
  } catch {
    return null;
  }
}
export type PhongAiLive = {
  id: string; ten: string; loai: string; trangThai: string | null; phongBan: string | null;
  thanhVien: { id: string; ten: string; loai: string }[];
};

export function ghepPhongAi(rows: DongAgentDb[] | null): { daNapDb: boolean; phong: PhongAiLive[] } {
  const LOAI_PHONG = new Set(["phong", "tro_ly", "router"]);
  const phongDb = (rows ?? []).filter((r) => LOAI_PHONG.has(r.loai));
  if (!rows || phongDb.length === 0) {
    return {
      daNapDb: false,
      phong: PHONG_AI_TINH.map((p) => ({ ...p, trangThai: null, phongBan: null, thanhVien: [] })),
    };
  }
  const thuTu = new Map(PHONG_AI_TINH.map((p, i) => [p.id, i]));
  return {
    daNapDb: true,
    phong: phongDb
      .sort((a, b) => (thuTu.get(a.id) ?? 99) - (thuTu.get(b.id) ?? 99))
      .map((p) => ({
        id: p.id, ten: p.ten, loai: p.loai, trangThai: p.trang_thai,
        phongBan: p.departments?.name ?? null,
        thanhVien: rows.filter((r) => r.phong_id === p.id).map((r) => ({ id: r.id, ten: r.ten, loai: r.loai })),
      })),
  };
}

export async function docPhongAi(): Promise<{ daNapDb: boolean; phong: PhongAiLive[] }> {
  return ghepPhongAi(await docAgentsDb());
}
