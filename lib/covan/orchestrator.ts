import { callClaude, buildSystem, pickModel, MODEL_SMART } from "./advisor";
import { modelMacDinh } from "@/lib/ai-model";
import { activeUsers, createTask } from "./delegation";
import { computePnl } from "./pnl";
import { metricValue } from "./learning";
import {
  loadRecs,
  saveRecs,
  saveLiveCampaign,
  type CampaignItem,
  type CampaignPlan,
  type LiveCampaign,
} from "./state";
import { getConfigValue } from "@/lib/app-config";
import { checkCompliance } from "@/lib/blogwriter/compliance";

const JUDGE_MODEL = modelMacDinh("hangLoat");
const PASS_SCORE = 75;

const MAX_ITEMS = 10;
const MAX_AI_ITEMS = 4;
const PHONG_BAN = ["Marketing", "Kinh doanh", "Tài chính-Kế toán", "CSKH", "Nhân sự", "Vận hành"];

const LEGAL_RULE =
  "RÀO PHÁP LÝ BẮT BUỘC (sai là bỏ cả bài): sản phẩm là THỰC PHẨM BỔ SUNG. " +
  "TUYỆT ĐỐI không được xuất hiện các chữ sau ở bất kỳ đâu trong bài, kể cả trong " +
  "prompt ảnh, tên file hay ví dụ: chữa bệnh, trị bệnh, điều trị, khỏi bệnh, thải độc, " +
  "giải độc, mát gan, đặc trị, thực phẩm chức năng, TPCN, hiệu quả sau X ngày, cam kết khỏi, " +
  "hạ huyết áp, hạ đường huyết. Muốn nói về lợi ích thì tả NẾP SỐNG và CẢM NHẬN " +
  "(nhẹ bụng, ăn ngon miệng, ngủ sâu hơn), không dùng ngôn ngữ y học. " +
  "Khuyến mãi gọi là TẶNG QUÀ, không giảm giá phần trăm.";

const IMPERATIVE_RE =
  /chuẩn bị|ra mắt|triển khai|lên kế hoạch|tổ chức|chạy chiến dịch|làm cho tôi|làm cho anh|soạn|viết|tạo|xây|đăng|thiết kế|dựng/i;

export async function detectCampaignIntent(text: string): Promise<boolean> {
  const t = (text || "").trim();
  if (t.length < 40 || !IMPERATIVE_RE.test(t)) return false;
  try {
    const raw = await callClaude(
      [{ role: "user", content: t }],
      "Phân loại tin nhắn của CEO gửi trợ lý. Trả DUY NHẤT JSON " +
        '{"loai":"chiendich"|"hoi"}. "chiendich" = mệnh lệnh THỰC HIỆN một mục tiêu ' +
        "gồm NHIỀU đầu việc/sản phẩm (ra mắt sản phẩm, chuẩn bị content + dự toán + " +
        'FAQ, tổ chức chương trình...). "hoi" = câu hỏi, xin tư vấn, tra cứu số liệu, ' +
        "bàn luận, hoặc lệnh đơn lẻ 1 việc. Mơ hồ thì chọn \"hoi\".",
      200, undefined, JUDGE_MODEL
    );
    return raw.includes('"chiendich"');
  } catch {
    return false;
  }
}

async function planningContext(): Promise<string> {
  const parts: string[] = [];
  try {
    const pnl = await computePnl();
    const rows = pnl.pnl.slice(-3);
    parts.push("P&L 3 THÁNG GẦN NHẤT (VND):\n" + JSON.stringify(rows));
    if (pnl.caveats?.length) parts.push("Khoản ghi thiếu: " + pnl.caveats.join("; "));
  } catch {  }
  try {

    const { layTienMat, tienMatThanhChu } = await import("./tien-mat");
    parts.push(tienMatThanhChu(await layTienMat()));
  } catch {  }
  try {
    const raw = await getConfigValue("offer_architecture");
    if (raw) {
      const data = JSON.parse(raw) as unknown;
      const arr = Array.isArray(data)
        ? data
        : (data && typeof data === "object" && Array.isArray((data as { offers?: unknown[] }).offers))
          ? (data as { offers: unknown[] }).offers
          : Object.values(data as Record<string, unknown>);
      const lines = arr
        .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
        .map((o) => {
          const gia = o.gia ?? o.gia_ban ?? o.price ?? o.price_vnd ?? o.gia_le;
          return `- ${String(o.ten || o.name || "?")} [${String(o.status || "?")}]${gia ? ` giá ${gia}` : ""}`;
        })
        .slice(0, 40);
      if (lines.length) parts.push("OFFER/COMBO ĐANG CÓ (giá thật, chỉ dùng các mã này):\n" + lines.join("\n"));
    }
  } catch {  }
  try {
    const thang = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    const ads = await getConfigValue(`mkt_spend_${thang}`);
    if (ads) parts.push(`Chi ads tháng này đã ghi: ${ads}`);
  } catch {  }
  return parts.join("\n\n");
}

export async function draftCampaign(
  goal: string
): Promise<{ ok: false; error: string } | { ok: true; plan: CampaignPlan }> {
  const users = await activeUsers();
  const roster = users
    .map((u) => `- ${u.full_name} (${u.position || "nhân viên"})`)
    .join("\n");
  const kinhTe = await planningContext();

  const rosterNotes = await getConfigValue("covan_roster_notes").catch(() => null);
  const system =
    "Bạn là nhạc trưởng chiến dịch của công ty thực phẩm bổ sung. Rã MỤC TIÊU " +
    "của CEO thành kế hoạch TÁC CHIẾN sát điều kiện kinh tế thật bên dưới. " +
    "Trả về DUY NHẤT một JSON (không markdown):\n" +
    '{"items":[{"title":"...","kind":"ai"|"human","phong_ban":"...","detail":"...","kpi":"...","assignee_name":"..."}]}\n' +
    `- phong_ban: gán MỖI việc vào đúng 1 phòng: ${PHONG_BAN.join(" / ")} — kế hoạch tốt tỏa ra ít nhất 3 phòng.\n` +
    `- Tối đa ${MAX_ITEMS} đầu việc, trong đó tối đa ${MAX_AI_ITEMS} việc kind "ai". Xếp việc "ai" trước.\n` +
    '- kind "ai" = việc AI làm được ngay: viết bài/caption, brief hình ảnh, phân tích ' +
    "số liệu, soạn FAQ/kịch bản/tài liệu, dự toán. detail = đề bài đủ cụ thể để AI " +
    "làm một mạch (định dạng, số lượng, giọng điệu). detail MỖI việc tối đa 350 ký tự — viết gọn.\n" +
    '- kind "human" = việc cần người thật (đăng bài, chạy ads trên tài khoản, gọi điện, ' +
    "chụp ảnh, đóng hàng...). assignee_name chọn ĐÚNG 1 tên từ danh sách, hợp vai nhất. " +
    "detail = việc cụ thể + tiêu chí khi nào tính là XONG. KHÔNG bịa tên.\n" +
    "- THIẾU NGƯỜI THẬT PHÙ HỢP (theo ghi chú vai trò): KHÔNG gán bừa — chuyển việc " +
    'thành kind "ai" giao NHÂN VIÊN AI phù hợp bên dưới, detail ghi rõ: phần AI làm ' +
    "TRỌN GÓI + phần còn lại cần 1 người bấm/duyệt trong bao nhiêu phút (VD: AI soạn " +
    "trọn chiến dịch ads gồm nội dung, tệp khách, ngân sách/ngày, các bước bấm — người " +
    "chỉ cần 15 phút bấm theo). Việc chỉ CEO làm được thì assignee_name = Nguyễn Văn An.\n" +
    "NHÂN VIÊN AI CÓ SẴN (giao được ngay): Máy viết content (bài đăng/blog/caption theo " +
    "lịch); Máy thiết kế ảnh (ghép logo, dùng ảnh sản phẩm thật); Bot Zalo CSKH (trả lời " +
    "khách 24/7, tra đơn, kịch bản từ chối); Máy nhắc đặt lại (tự quét khách cũ đến chu kỳ " +
    "30-45 ngày, đẩy danh sách gọi mỗi sáng); Cố vấn Cố vấn AI (phân tích số, dự toán, kịch bản, FAQ).\n" +
    "- MỌI đầu việc phải có kpi = 1 con số đo được (VD: 5 bài đăng, 40 lead, 80tr doanh số).\n" +
    "- Nếu mục tiêu là DOANH SỐ (ốp số, đạt X triệu/tỷ): kế hoạch BẮT BUỘC gồm " +
    "(a) 1 việc ai: chọn combo chủ lực + giá TỪ DANH SÁCH OFFER THẬT + dự toán " +
    "ngân sách quà/ads sao cho vẫn còn lãi với biên gộp ~65% — KHÔNG bịa combo mới, " +
    "KHÔNG bịa giá; (b) 1 việc ai: PHÂN BỔ CHỈ TIÊU cho TỪNG sale trong danh sách " +
    "nhân sự (cộng lại = mục tiêu) + số lead/ngày cần + kênh kéo lead; " +
    "(c) các việc human giao đúng người chạy.\n" +
    "- Nếu mục tiêu là RA MẮT/PR sản phẩm mới: gồm việc ai soạn tuyến bài theo giai " +
    "đoạn (gây tò mò -> ra mắt -> bằng chứng xã hội dạng trải nghiệm dịch vụ) + brief " +
    "hình ảnh (ghi rõ DÙNG ẢNH SẢN PHẨM THẬT, không để AI vẽ lại bao bì) + việc human đăng/quay.\n" +
    "- Ngân sách đề xuất KHÔNG vượt tiền mặt hiện có; ads mới phải nêu trần chi/ngày.\n" +
    "- Rào pháp lý: sản phẩm là THỰC PHẨM BỔ SUNG — cấm chữa/trị/điều trị/khỏi bệnh/" +
    "thải độc/hiệu quả sau X ngày; khuyến mãi = TẶNG QUÀ, không chiết khấu %.\n" +
    "- KHÔNG emoji. Tiếng Việt đủ dấu.\n" +
    `Danh sách nhân sự:\n${roster}` +
    (rosterNotes ? `\nGHI CHÚ VAI TRÒ TỪ CEO (TUÂN THỦ TUYỆT ĐỐI khi chọn người):\n${rosterNotes}` : "") +
    (kinhTe ? `\n\nBỐI CẢNH KINH TẾ THẬT (bắt buộc bám vào):\n${kinhTe}` : "");

  const raw = await callClaude([{ role: "user", content: goal }], system, 16000, undefined, MODEL_SMART);

  const tryParse = (text: string): { items?: unknown[] } | null => {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(text.slice(start, end + 1)) as { items?: unknown[] };
    } catch {  }
    const lastComplete = text.lastIndexOf("},");
    if (lastComplete > start) {
      try {
        return JSON.parse(text.slice(start, lastComplete + 1) + "]}") as { items?: unknown[] };
      } catch {  }
    }
    return null;
  };

  let parsed = tryParse(raw);
  if (!parsed) {
    const raw2 = await callClaude(
      [
        { role: "user", content: goal },
        { role: "assistant", content: raw.slice(0, 3000) },
        { role: "user", content: "JSON trên bị hỏng định dạng. Trả lại DUY NHẤT JSON hợp lệ theo đúng schema, escape mọi dấu nháy kép trong chuỗi, không markdown, không giải thích." },
      ],
      system, 16000, undefined, MODEL_SMART
    );
    parsed = tryParse(raw2);
  }
  if (!parsed) {
    return { ok: false, error: `LLM không trả JSON hợp lệ sau 2 lần: ${raw.slice(0, 150)}` };
  }
  const items: CampaignItem[] = (Array.isArray(parsed.items) ? parsed.items : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .slice(0, MAX_ITEMS)
    .map((x, i) => ({
      id: i + 1,
      title: String(x.title || `Đầu việc ${i + 1}`).trim(),
      kind: x.kind === "human" ? "human" : "ai",
      detail: String(x.detail || "").trim(),
      assignee_name: x.assignee_name ? String(x.assignee_name).trim() : undefined,
      kpi: x.kpi ? String(x.kpi).trim() : undefined,
      phong_ban: PHONG_BAN.includes(String(x.phong_ban || "").trim())
        ? String(x.phong_ban).trim()
        : "Marketing",
    }))
    .filter((x) => x.detail);
  if (!items.length) return { ok: false, error: "Kế hoạch rỗng — anh mô tả mục tiêu rõ hơn giúp em." };

  let aiCount = 0;
  for (const it of items) {
    if (it.kind === "ai" && ++aiCount > MAX_AI_ITEMS) it.kind = "human";
  }
  return { ok: true, plan: { goal: goal.trim(), items } };
}

export function formatPlan(plan: CampaignPlan): string {
  const lines = [`KẾ HOẠCH CHIẾN DỊCH: ${plan.goal}`];

  const groups = new Map<string, typeof plan.items>();
  for (const it of plan.items) {
    const pb = it.phong_ban || "Marketing";
    if (!groups.has(pb)) groups.set(pb, []);
    groups.get(pb)!.push(it);
  }
  for (const [pb, items] of groups) {
    lines.push(`\nP. ${pb.toUpperCase()}:`);
    for (const it of items) {
      const who = it.kind === "ai" ? "AI làm" : `GIAO ${it.assignee_name || "?"}`;
      const kpi = it.kpi ? ` | Đo: ${it.kpi}` : "";
      lines.push(`${it.id}. [${who}] ${it.title}${kpi}\n   ${it.detail.slice(0, 150)}`);
    }
  }
  lines.push("---\nGõ /ok để CHẠY cả kế hoạch, /huy để bỏ.");
  return lines.join("\n");
}

async function judge(detail: string, output: string): Promise<{ diem: number; sua: string }> {
  const system =
    "Bạn chấm SẢN PHẨM theo ĐỀ BÀI. Trả DUY NHẤT JSON {\"diem\": 0-100, \"sua\": " +
    "\"góp ý sửa ngắn gọn nếu diem dưới " + PASS_SCORE + ", chuỗi rỗng nếu đạt\"}. " +
    "Tiêu chí: đúng đề bài, dùng được ngay không cần sửa, tiếng Việt đủ dấu, không " +
    "emoji, không claim y học (chữa/trị/khỏi bệnh/thải độc).";
  try {
    const raw = await callClaude(
      [{ role: "user", content: `ĐỀ BÀI:\n${detail}\n\nSẢN PHẨM:\n${output.slice(0, 12000)}` }],
      system, 1000, undefined, JUDGE_MODEL
    );
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const j = JSON.parse(raw.slice(start, end + 1)) as { diem?: unknown; sua?: unknown };
    const diem = Math.max(0, Math.min(100, Number(j.diem) || 0));
    return { diem, sua: String(j.sua || "") };
  } catch {
    return { diem: 70, sua: "" };
  }
}

export type ItemResult = {
  item: CampaignItem;
  status: "done" | "task_created" | "failed";
  score?: number;
  rounds?: number;
  output?: string;
  note?: string;
};

export async function runCampaign(
  plan: CampaignPlan,
  notify: (text: string) => Promise<unknown>
): Promise<{ results: ItemResult[]; report: string }> {
  const results: ItemResult[] = [];
  const total = plan.items.length;

  const nowVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16);
  const live: LiveCampaign = {
    goal: plan.goal,
    started_at: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " "),
    done: false,
    items: plan.items.map((it) => ({
      id: it.id,
      title: it.title,
      kind: it.kind,
      phong_ban: it.phong_ban || "Marketing",
      status: "cho" as const,
    })),
    events: [],
  };
  const pushLive = async (
    patch?: { id: number; status: "cho" | "dang_lam" | "xong" | "loi"; score?: number; note?: string; task_id?: string },
    event?: string
  ) => {
    try {
      if (patch) {
        const li = live.items.find((x) => x.id === patch.id);
        if (li) {
          li.status = patch.status;
          if (patch.score !== undefined) li.score = patch.score;
          if (patch.note) li.note = patch.note;
          if (patch.task_id) li.task_id = patch.task_id;
        }
      }
      if (event) live.events.unshift({ at: nowVN(), text: event.slice(0, 200) });
      live.events = live.events.slice(0, 40);
      await saveLiveCampaign(live);
    } catch {  }
  };
  const say = async (msg: string) => {
    await notify(msg);
    await pushLive(undefined, msg);
  };
  const tag = () => `(${results.length}/${total} · ${Math.round((results.length / total) * 100)}%)`;
  await pushLive(undefined, `Bắt đầu chiến dịch: ${plan.goal.slice(0, 120)}`);

  for (const item of plan.items) {
    await pushLive({ id: item.id, status: "dang_lam" });
    if (item.kind === "human") {

      const users = await activeUsers();
      const match = users.find(
        (u) => u.full_name.toLowerCase() === (item.assignee_name || "").toLowerCase()
      );
      if (!match) {
        results.push({ item, status: "failed", note: `Không khớp người nhận '${item.assignee_name || ""}'` });
        await pushLive({ id: item.id, status: "loi", note: "không khớp người nhận" });
        await say(`${tag()} LỖI giao việc "${item.title}": không khớp người nhận.`);
        continue;
      }
      const d = await createTask({
        title: item.title,
        description: `${item.detail}\n\n(Thuộc chiến dịch: ${plan.goal})`,
        assignee_name: match.full_name,
        assignee_id: match.id,
        assignee_position: match.position || "",
        priority: "medium",
        due_days: 3,
      });
      if (d.ok) {
        results.push({ item, status: "task_created", note: `${d.assignee} | hạn ${d.due_date}` });
        await pushLive({ id: item.id, status: "xong", note: `giao ${d.assignee}`, task_id: d.task_id });
        await say(`${tag()} ĐÃ GIAO người thật: ${item.title} -> ${d.assignee}, hạn ${d.due_date}.`);
      } else {
        results.push({ item, status: "failed", note: d.error });
        await pushLive({ id: item.id, status: "loi", note: d.error.slice(0, 80) });
        await say(`${tag()} LỖI ghi task "${item.title}": ${d.error}`);
      }
      continue;
    }

    try {
      const system = await buildSystem(item.detail);
      const model = pickModel(item.detail);
      const ask = (extra: string) =>
        callClaude(
          [{ role: "user", content: `${item.detail}\n\nTrả về SẢN PHẨM HOÀN CHỈNH dùng được ngay, không rào đón, không giải thích.\n\n${LEGAL_RULE}${extra}` }],
          system, 6000, undefined, model
        );

      let output = await ask("");
      let rounds = 1;
      let legal = checkCompliance(output);
      let verdict = await judge(item.detail, output);

      if ((!legal.ok || verdict.diem < PASS_SCORE) && output.trim()) {
        const fixes = [
          !legal.ok
            ? `Bản trước DÍNH đúng các chữ này: "${legal.hits.join('", "')}". Viết lại TOÀN BỘ ` +
              `sao cho không còn chuỗi ký tự nào trong số đó, kể cả trong prompt ảnh và ví dụ. ` +
              `Diễn đạt lại bằng nếp sống và cảm nhận.`
            : "",
          verdict.diem < PASS_SCORE ? `Sửa theo góp ý: ${verdict.sua}` : "",
        ].filter(Boolean).join(" ");
        output = await ask(`\n\nBản trước chưa đạt. ${fixes}`);
        rounds = 2;
        legal = checkCompliance(output);
        verdict = await judge(item.detail, output);
      }

      if (!legal.ok) {
        results.push({ item, status: "failed", note: `Kẹt gate pháp lý: ${legal.hits.join(", ")}` });
        await pushLive({ id: item.id, status: "loi", note: `gate pháp lý: ${legal.hits.join(", ")}` });
        await say(`${tag()} "${item.title}" KẸT gate pháp lý (${legal.hits.join(", ")}) — em giữ lại, không trình.`);
      } else {
        results.push({ item, status: "done", score: verdict.diem, rounds, output });
        await pushLive({ id: item.id, status: "xong", score: verdict.diem });
        await say(`${tag()} Xong: ${item.title} — ${verdict.diem}/100${rounds > 1 ? " (1 vòng sửa)" : ""}.`);
      }
    } catch (e) {
      const note = String(e instanceof Error ? e.message : e).slice(0, 150);
      results.push({ item, status: "failed", note });
      await pushLive({ id: item.id, status: "loi", note: note.slice(0, 80) });
      await say(`${tag()} LỖI "${item.title}": ${note}`);
    }
  }

  live.done = true;
  await pushLive(undefined, "Chiến dịch chạy xong — báo cáo file đã gửi Telegram.");

  try {
    const summ = await computePnl();
    const baseline = metricValue(summ, "revenue");
    const recs = await loadRecs();
    const nextId = recs.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    const measureAt = new Date(Date.now() + 7 * 3600e3 + 7 * 86400e3).toISOString().slice(0, 10);
    recs.push({
      id: nextId,
      title: `Đo chiến dịch: ${plan.goal.slice(0, 80)}`,
      evidence: [`${results.filter((r) => r.status === "done").length} sản phẩm AI + ${results.filter((r) => r.status === "task_created").length} việc người thật`],
      action: "So doanh thu kỳ chiến dịch với nền trước khi chạy (lưu ý MISA trễ 3-5 ngày COD)",
      metric: "revenue",
      baseline,
      measure_at: measureAt,
      outcome: null,
      status: "approved",
    });
    await saveRecs(recs);
    await notify(`Em đã hẹn đo kết quả chiến dịch ngày ${measureAt} (doanh thu nền: ${baseline === null ? "chưa có" : Math.round(baseline).toLocaleString("vi-VN")}). Đến hạn em tự so số báo thắng/thua.`);
  } catch {  }

  return { results, report: buildReport(plan, results) };
}

function buildReport(plan: CampaignPlan, results: ItemResult[]): string {
  const at = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  const parts = [`# Chiến dịch: ${plan.goal}`, `Chạy lúc ${at} (giờ VN)`, ""];
  const done = results.filter((r) => r.status === "done");
  const tasks = results.filter((r) => r.status === "task_created");
  const failed = results.filter((r) => r.status === "failed");
  parts.push(`Kết quả: ${done.length} sản phẩm AI, ${tasks.length} việc đã giao người, ${failed.length} lỗi.`, "");
  for (const r of done) {
    parts.push(`## ${r.item.id}. ${r.item.title} (${r.score}/100)`, "", r.output || "", "");
  }
  if (tasks.length) {
    parts.push("## Việc đã giao người thật");
    for (const r of tasks) parts.push(`- ${r.item.title} -> ${r.note}`);
    parts.push("");
  }
  if (failed.length) {
    parts.push("## Chưa xong");
    for (const r of failed) parts.push(`- ${r.item.title}: ${r.note}`);
  }
  return parts.join("\n");
}
