import { getServiceClient } from "@/lib/supabase-server";
import { appLink, APP_HOST } from "@/lib/app-url";
import { vnDateStr } from "@/lib/payroll";
import { geminiSearch, askGemini } from "@/lib/gemini";

export type SkillCall = { name: string; args: Record<string, any> };

export const SKILL_DECLS = [
  {
    name: "giao_viec",
    description: "Giao một việc. Có tên NHÂN VIÊN nhận (vd 'giao Sơn...') → tạo việc cho người đó. KHÔNG nêu tên người → việc tự chuyển cho Claude Code thực thi (không quay về tay CEO), có % tiến độ và báo khi xong.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Tên việc, ngắn gọn rõ ràng" },
        nguoi: { type: "string", description: "Tên người nhận việc nếu CEO nói giao cho ai (vd 'Sơn', 'chị Cúc'). Không nói thì để trống (việc sẽ giao Claude Code)." },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Độ ưu tiên" },
        due_date: { type: "string", description: "Hạn chót YYYY-MM-DD. CEO nói 'làm ngay/bây giờ' hoặc KHÔNG nói hạn → để trống (code tự lấy NGÀY HÔM NAY). CẤM tự đẩy sang ngày mai." },
      },
      required: ["title"],
    },
  },
  {
    name: "cao_misa",
    description: "ĐÃ NGƯNG (nguồn MISA không còn dùng). Chỉ gọi khi anh nói rõ chữ \"cào MISA\" — công cụ sẽ trả lời rằng MISA đã ngưng. KHÔNG dùng để lấy số liệu mới; số bán hàng là sổ đơn Telegram + J&T.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "cap_nhat_du_an",
    description: "Cập nhật việc kế tiếp của một dự án trong danh mục (đánh dấu vừa động tới hôm nay). Dùng khi anh báo tiến độ 1 dự án.",
    parameters: {
      type: "object",
      properties: {
        ten: { type: "string", description: "Tên hoặc từ khoá dự án" },
        viec: { type: "string", description: "Việc kế tiếp mới" },
      },
      required: ["ten", "viec"],
    },
  },
  {
    name: "soat_may",
    description: "SOÁT MÁY CHẠY NGẦM: cỗ máy nền nào đang chạy, cái nào đang đứt, đứt mấy ngày, ai chạy lại được. Dùng khi CEO hỏi kiểu 'máy chạy ngầm sao rồi', 'có máy nào chết không', 'hệ thống có gì hỏng', 'soát máy'. CHỈ ĐỌC, không đổi gì.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "tim_web",
    description: "Tra cứu THÔNG TIN BÊN NGOÀI trên web (đối thủ, giá thị trường, tin tức, xu hướng). CHỈ dùng cho thông tin công khai, KHÔNG dùng cho số liệu nội bộ.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Câu hỏi tra cứu (KHÔNG chứa số liệu nội bộ công ty)" } },
      required: ["query"],
    },
  },
  {
    name: "soan_cham_soc",
    description: "Soạn sẵn 1 tin nhắn chăm sóc/mời mua để sale gửi khách qua Zalo. Dùng khi CEO muốn có tin mẫu chăm khách theo nhóm (VIP, khách cũ lâu không mua, khách mới...).",
    parameters: {
      type: "object",
      properties: {
        doi_tuong: { type: "string", description: "Nhóm/kiểu khách (vd 'khách VIP', 'khách 90 ngày không mua', 'khách mới')" },
        muc_dich: { type: "string", description: "Mục đích (vd 'mời quay lại', 'giới thiệu combo mới', 'hỏi thăm dùng sản phẩm')" },
      },
      required: ["doi_tuong"],
    },
  },
  {
    name: "xem_tien_do",
    description: "Xem BẢNG VIỆC CHUNG của cả đội: việc Claude Code đang làm (kèm % tiến độ thật), việc Grok trên iMac đang chạy/kẹt/chờ anh, và việc đã giao cho nhân viên chưa xong. Dùng khi CEO hỏi 'việc X tới đâu rồi', 'Claude Code đang làm gì', 'Grok đang làm gì', 'còn việc gì chưa xong'.",
    parameters: { type: "object", properties: { tim: { type: "string", description: "Từ khoá việc cần tìm (để trống = xem tổng)" } } },
  },
  {
    name: "giao_claude_code",
    description: "Giao một việc BUILD/SỬA HỆ THỐNG cho Claude Code làm (thêm tính năng, sửa lỗi, dựng trang, viết script...). Dùng khi CEO hoặc thành viên BOD muốn phát triển thêm phần mềm, và cho MỌI việc người được uỷ quyền giao (nghiên cứu, viết, dựng...). CEO và người được uỷ quyền giao thì chạy ngay; người khác giao thì chờ CEO duyệt.",
    parameters: {
      type: "object",
      properties: {
        viec: { type: "string", description: "Mô tả việc cần build/sửa, càng rõ càng tốt" },
        du_an: { type: "string", description: "Dự án/repo áp dụng nếu biết (vd 'ikihealing-hub', 'NOVA', 'sale page'). Ghi 'tieu-my' khi CEO nói 'giao Trợ lý Mac' hoặc việc là VIỆC TRÊN MÁY MAC không sửa code (đọc/tóm tắt tài liệu, tra vault Obsidian, chạy script có sẵn, cào bằng trình duyệt) — Trợ lý Mac là trợ lý chạy trên máy anh." },
      },
      required: ["viec"],
    },
  },
  {
    name: "len_chien_dich",
    description: "GỌI GIÁM ĐỐC THƯƠNG HIỆU lên kế hoạch chiến dịch ĐỒNG BỘ TOÀN MẮT XÍCH (blog, fanpage, cộng đồng, app, sale Zalo, sản phẩm, email, ads, CSKH, đo lường). Dùng khi CEO muốn: lên chiến dịch, kế hoạch dịp lễ (Tết/Vu Lan/20-10/8-3), ra mắt sản phẩm, đổi thông điệp thương hiệu, hoặc rà xem các kênh có đang nói lệch nhau.",
    parameters: {
      type: "object",
      properties: {
        yeu_cau: { type: "string", description: "CEO muốn gì, càng rõ càng tốt (vd 'lên chiến dịch quà tặng Vu Lan cho trà Trà Mẫu B')" },
        dip: { type: "string", description: "Dịp hoặc mốc thời gian nếu có (vd 'Vu Lan rằm tháng 7', 'Tết 2027', '4 tuần tới')" },
      },
      required: ["yeu_cau"],
    },
  },
  {
    name: "yeu_cau_skill",
    description: "GỌI KHI CEO yêu cầu một việc mà bạn KHÔNG có kỹ năng phù hợp trong danh sách để làm. Ghi lại yêu cầu kỹ năng mới để đội kỹ thuật bổ sung. TUYỆT ĐỐI không bịa là đã làm được việc ngoài khả năng.",
    parameters: {
      type: "object",
      properties: {
        ten_skill: { type: "string", description: "Tên kỹ năng cần có, ngắn gọn (vd 'gửi email', 'xuất báo cáo PDF')" },
        ly_do: { type: "string", description: "Việc CEO muốn làm mà hiện chưa làm được" },
        vi_du: { type: "string", description: "Câu CEO vừa yêu cầu (để đội kỹ thuật hiểu ngữ cảnh)" },
      },
      required: ["ten_skill", "ly_do"],
    },
  },
];

export type MucQuyen = "mo" | "quanly" | "ceo";

export const QUYEN_SKILL: Record<string, MucQuyen> = {

  tim_web: "mo",
  soan_cham_soc: "mo",
  yeu_cau_skill: "mo",

  soat_may: "quanly",
  giao_viec: "quanly",
  cap_nhat_du_an: "quanly",
  giao_claude_code: "quanly",
  xem_tien_do: "quanly",
  len_chien_dich: "quanly",

  cao_misa: "ceo",
};

const THU_BAC: Record<MucQuyen, number> = { mo: 0, quanly: 1, ceo: 2 };

export function duocDungSkill(name: string, cua: MucQuyen): boolean {
  return THU_BAC[cua] >= THU_BAC[QUYEN_SKILL[name] ?? "ceo"];
}

export function loiTuChoiSkill(name: string): string {
  const can = QUYEN_SKILL[name] ?? "ceo";
  return can === "ceo"
    ? "Việc này em chỉ nhận từ CEO trong chat riêng thôi ạ. Anh/chị nhắn CEO giúp em nhé."
    : "Việc này em chỉ nhận từ CEO hoặc nhóm BOD / Ban điều hành ạ. Anh/chị nêu trong nhóm đó để em làm ngay nhé.";
}

export type SkillCtx = { chatId?: string; name?: string; userId?: string; laCeo?: boolean; tuGiao?: boolean };

export const PHAN_TRAM_TRANG_THAI: Record<string, number> = { todo: 0, doing: 50, blocked: 50, done: 100 };

async function giaoClaudeCode(viec: string, duAn: string, ctx: SkillCtx, laCeo: boolean, han?: string): Promise<string> {
  const { addTask, maTheCC } = await import("@/lib/cc-queue");
  const t = await addTask(viec, duAn, ctx.chatId || "", ctx.name || "BOD", { tuDuyet: laCeo });
  const tho = duAn.trim().toLowerCase() === "tieu-my" ? "Trợ lý Mac (máy Mac)" : "Claude Code";
  if (!laCeo) return `\u{1F4E5} Đã ghi việc vào hàng đợi (mã ${t.id}) và gửi CEO duyệt. Duyệt xong ${tho} sẽ làm rồi báo kết quả về đây.`;
  try {
    const row: any = { title: viec.slice(0, 200), status: "todo", priority: "high", due_date: han || vnDateStr(), description: `${maTheCC(t.id)} Giao ${tho} thực thi — % tiến độ cập nhật tự động, xong tự chuyển Xong.` };
    if (ctx.userId) row.assigner_id = ctx.userId;
    await getServiceClient().from("tasks").insert(row);
  } catch {  }
  return `\u{2713} Đã giao ${tho} làm ngay (mã ${t.id}), không cần chờ duyệt. Có % tiến độ ở ${APP_HOST}/tasks, xong em báo anh.`;
}

const boDau = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();

export function timNguoiNhan(goi: string, ds: Array<{ id: string; full_name: string | null }>): { id: string; ten: string } | null {
  const ten = boDau(goi).replace(/^(anh|chi|em|ban|co|chu|ong|ba|a|c|e)\s+/, "").trim();
  if (!ten) return null;
  const khop = ds.filter((u) => {
    const ho = boDau(u.full_name || "");
    return ho === ten || ho.endsWith(` ${ten}`);
  });
  return khop.length === 1 ? { id: khop[0].id, ten: khop[0].full_name || "" } : null;
}

export async function runSkill(c: SkillCall, ctx: SkillCtx = {}): Promise<string> {
  const sb = getServiceClient();
  const ceoChatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  const laCeo = !!ctx.laCeo || (!!ctx.chatId && !!ceoChatId && ctx.chatId === ceoChatId);
  const tuGiao = laCeo || !!ctx.tuGiao;
  try {
    switch (c.name) {
      case "giao_viec": {
        const row: any = { title: String(c.args.title || "").slice(0, 200), status: "todo", priority: ["low", "medium", "high", "urgent"].includes(c.args.priority) ? c.args.priority : "medium" };

        row.due_date = (c.args.due_date && /^\d{4}-\d{2}-\d{2}$/.test(c.args.due_date)) ? c.args.due_date : vnDateStr();
        if (ctx.userId) row.assigner_id = ctx.userId;
        const goi = String(c.args.nguoi || "").trim();

        if (!goi && tuGiao) return await giaoClaudeCode(row.title, "", ctx, true, row.due_date);
        let nhan: { id: string; ten: string } | null = null;
        if (goi) {
          const { data: ds } = await sb.from("users").select("id, full_name").eq("active", true);
          nhan = timNguoiNhan(goi, ds || []);
          if (nhan) row.assignee_id = nhan.id;
        }
        const { error } = await sb.from("tasks").insert(row);
        if (error) return `Chưa tạo được việc (${error.message}).`;
        if (nhan) return `\u{2713} Đã giao "${row.title}" cho ${nhan.ten}, hạn ${row.due_date}. Xem ở ${APP_HOST}/tasks.`;
        return goi
          ? `\u{2713} Đã tạo việc "${row.title}" nhưng chưa gán được cho "${goi}" (không thấy hoặc trùng tên). Anh giao tay ở ${APP_HOST}/tasks.`
          : `\u{2713} Đã tạo việc "${row.title}". Xem/giao người ở ${APP_HOST}/tasks.`;
      }
      case "cao_misa": {

        return "MISA đã ngưng — em không cào MISA nữa. Số bán hàng lấy từ sổ đơn Telegram, đối chiếu vận đơn J&T.";
      }
      case "cap_nhat_du_an": {
        const { touchProject } = await import("@/lib/portfolio");
        const p = await touchProject(String(c.args.ten || ""), { nextStep: String(c.args.viec || "") });
        return p ? `\u{2713} Đã cập nhật "${p.name}" → ${p.nextStep}.` : `Chưa thấy dự án khớp "${c.args.ten}".`;
      }
      case "soat_may": {
        const { banTinSoatMay } = await import("@/lib/may-chay-ngam");
        const { text, bamDuoc } = await banTinSoatMay();

        const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
        if (bamDuoc.length && ceo && ctx.chatId === ceo) {
          const { sendTelegramWithButtons } = await import("@/lib/telegram");
          await sendTelegramWithButtons(
            "Bấm để chạy lại ngay:",
            bamDuoc.slice(0, 6).map((m) => [{ text: `Chạy lại: ${m.ten.slice(0, 40)}`, callback_data: `maylai:${m.key}` }]),
            ceo,
          );
        }
        return text;
      }
      case "tim_web": {
        const r = await geminiSearch(String(c.args.query || ""));
        return r.ok && r.text ? r.text : `Chưa tra được thông tin này lúc: ${r.text || (r as any).error || "?"}.`;
      }
      case "soan_cham_soc": {
        const sys = `Bạn soạn TIN NHẮN ZALO chăm sóc khách cho ACME (thương hiệu dưỡng sinh, sản phẩm là THỰC PHẨM BỔ SUNG).
LUẬT BẮT BUỘC: KHÔNG gọi là thuốc/TPCN; CẤM claim chữa/trị/khỏi bệnh/thải độc/cam kết hiệu quả; nói về lối sống, cảm nhận, quan tâm chân thành. Khuyến mãi thì TẶNG QUÀ, KHÔNG chiết khấu %.
Yêu cầu: 1 tin ngắn (2-4 câu), giọng ấm áp tự nhiên, xưng "em/mình" gọi khách "anh/chị", có 1 câu hỏi mở để khách dễ trả lời. Chèn [Tên khách] để sale điền. Chỉ trả về nội dung tin, không giải thích.`;
        const prompt = `Soạn tin chăm sóc cho: ${c.args.doi_tuong}. Mục đích: ${c.args.muc_dich || "hỏi thăm & giữ kết nối"}.`;
        const r = await askGemini(sys, [], prompt);
        return r.ok && r.text ? `Tin gợi ý (sale copy gửi Zalo):\n\n${r.text}` : `Chưa soạn được lúc này.`;
      }
      case "giao_claude_code":
        return await giaoClaudeCode(String(c.args.viec || ""), String(c.args.du_an || ""), ctx, tuGiao);
      case "xem_tien_do":
        return await xemTienDo(String(c.args.tim || ""));
      case "len_chien_dich": {
        const { planCampaign } = await import("@/lib/brand-director");
        const plan = await planCampaign(String(c.args.yeu_cau || ""), String(c.args.dip || ""));
        return `GIÁM ĐỐC THƯƠNG HIỆU NOVA — kế hoạch nháp (chờ anh duyệt mới chạy):\n\n${plan}`;
      }
      case "yeu_cau_skill": {

        let q: any = { items: [] };
        try { q = JSON.parse((await sb.from("config").select("value").eq("key", "brain_skill_requests").maybeSingle()).data?.value || '{"items":[]}'); } catch {}
        const ten = String(c.args.ten_skill || "").slice(0, 80);
        const exist = (q.items || []).find((x: any) => (x.ten || "").toLowerCase() === ten.toLowerCase() && x.status !== "done");
        if (exist) { exist.count = (exist.count || 1) + 1; exist.lastAt = vnDateStr(); }
        else (q.items ||= []).push({ ten, ly_do: String(c.args.ly_do || "").slice(0, 200), vi_du: String(c.args.vi_du || "").slice(0, 200), status: "new", count: 1, at: vnDateStr(), lastAt: vnDateStr() });
        q.items = q.items.slice(-50);
        await sb.from("config").upsert({ key: "brain_skill_requests", value: JSON.stringify(q) }, { onConflict: "key" });
        return `\u{1F527} Việc này em CHƯA có kỹ năng để làm ("${ten}"). Em đã ghi lại + báo để đội kỹ thuật bổ sung (có kiểm duyệt an toàn), xong em sẽ làm được ngay. Em không tự tải phần mềm lạ về để giữ hệ thống an toàn cho anh.`;
      }
      default: return `Chưa hỗ trợ kỹ năng "${c.name}".`;
    }
  } catch (e: any) { return `Lỗi khi làm "${c.name}": ${String(e?.message || e).slice(0, 80)}`; }
}

export async function xemTienDo(tim = ""): Promise<string> {
  const sb = getServiceClient();
  const khop = (s: string) => !tim.trim() || boDau(s).includes(boDau(tim));
  const dong: string[] = [];
  try {
    const { anhChupHangDoi } = await import("@/lib/cc-queue");
    const cc = (await anhChupHangDoi()).filter((t) => khop(t.task));
    const NHAN: Record<string, string> = { approved: "chờ máy nhận", running: "đang làm", done: "xong", failed: "trục trặc" };
    if (cc.length) {
      dong.push("CLAUDE CODE:");
      for (const t of cc.slice(-8)) {
        const pt = t.status === "done" ? 100 : typeof t.tienDo === "number" ? t.tienDo : null;
        dong.push(`- ${t.task.slice(0, 80)} · ${NHAN[t.status] || t.status}${pt != null ? ` · ${pt}%` : ""}${t.buoc && t.status === "running" ? ` · bước: ${t.buoc}` : ""}`);
      }
    }
  } catch {  }
  try {
    const v = (await sb.from("config").select("value").eq("key", "bang_viec").maybeSingle()).data?.value;
    const bv = JSON.parse(v || "{}");
    const NHAN: Record<string, string> = { "dang-chay": "đang chạy", ket: "kẹt", "cho-anh": "chờ anh", xong: "xong" };
    const ds = (Array.isArray(bv.viec) ? bv.viec : []).filter((x: any) => x.trang_thai !== "xong" && khop(`${x.ma} ${x.mo_ta}`));
    if (ds.length) {
      dong.push("GROK (iMac):");
      for (const x of ds.slice(0, 8)) dong.push(`- ${x.ma}: ${String(x.mo_ta || "").slice(0, 80)} · ${NHAN[x.trang_thai] || x.trang_thai}`);
    }
  } catch {  }
  try {
    const { data } = await sb.from("tasks").select("title, status, due_date, description, assignee:users!tasks_assignee_id_fkey(full_name)")
      .in("status", ["todo", "doing", "blocked"]).not("assignee_id", "is", null).order("due_date", { ascending: true }).limit(60);
    const ds = (data || []).filter((t: any) => khop(t.title));
    if (ds.length) {
      dong.push("NHÂN VIÊN:");
      for (const t of ds.slice(0, 10) as any[]) dong.push(`- ${t.title.slice(0, 70)} · ${t.assignee?.full_name || "?"} · ${PHAN_TRAM_TRANG_THAI[t.status] ?? 0}%${t.due_date ? ` · hạn ${t.due_date}` : ""}`);
    }
  } catch {  }
  return dong.length ? dong.join("\n") : (tim ? `Không thấy việc nào khớp "${tim}".` : "Hiện không có việc nào đang mở.");
}
