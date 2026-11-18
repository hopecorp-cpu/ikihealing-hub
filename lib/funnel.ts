import { getConfigValue, setConfigValue } from "@/lib/app-config";

const KEY = "funnel_daily";

export const FUNNELS: Record<string, { label: string; steps: { key: string; label: string }[] }> = {
  "khaosat-thuckhuya": {
    label: "Khảo sát thức khuya (example.com/khao-sat)",
    steps: [
      { key: "view", label: "Vào trang" },
      { key: "start", label: "Bắt đầu trả lời" },
      { key: "submit", label: "Gửi khảo sát" },
    ],
  },
  "khaosat-chitieu": {
    label: "Khảo sát chi tiêu sức khoẻ (example.com/khao-sat)",
    steps: [
      { key: "view", label: "Vào trang" },
      { key: "start", label: "Bắt đầu trả lời" },
      { key: "submit", label: "Gửi khảo sát" },
    ],
  },
  quiz: {
    label: "Quiz sức khoẻ (example.com/quiz)",
    steps: [
      { key: "view", label: "Vào trang" },
      { key: "start", label: "Bắt đầu làm" },
      { key: "q_done", label: "Trả lời xong" },
      { key: "gate_view", label: "Tới ô nhập thông tin" },
      { key: "lead", label: "Để lại email (lead)" },

      { key: "zalo_lead", label: "Để lại số Zalo (sale gọi)" },
      { key: "offers", label: "Xem gói có phí (nhánh phụ)" },
      { key: "checkout", label: "Vào thanh toán" },
      { key: "pay_qr", label: "Hiện mã QR" },
      { key: "paid", label: "Thanh toán xong" },
    ],
  },
  sanphama: {
    label: "Bột đạm Đạm Mẫu (example.com)",
    steps: [
      { key: "view", label: "Vào trang" },
      { key: "select", label: "Chọn combo" },
      { key: "submit", label: "Bấm đặt hàng" },
      { key: "pay_qr", label: "Hiện mã QR" },
      { key: "paid", label: "Thanh toán xong" },
    ],
  },
  sanphamc: {
    label: "Trà Mẫu A",
    steps: [
      { key: "view", label: "Vào trang" },
      { key: "select", label: "Chọn combo" },
      { key: "submit", label: "Bấm đặt hàng" },
      { key: "pay_qr", label: "Hiện mã QR" },
      { key: "paid", label: "Thanh toán xong" },
    ],
  },
  sanphamb: {
    label: "Trà Mẫu B",
    steps: [
      { key: "view", label: "Vào trang" },
      { key: "select", label: "Chọn combo" },
      { key: "submit", label: "Bấm đặt hàng" },
      { key: "pay_qr", label: "Hiện mã QR" },
      { key: "paid", label: "Thanh toán xong" },
    ],
  },
  example: {
    label: "Trang chủ example.com",
    steps: [
      { key: "view", label: "Vào trang" },
      { key: "cta_quiz", label: "Bấm làm Quiz" },
      { key: "cta_product", label: "Bấm xem sản phẩm" },
      { key: "cta_blog", label: "Bấm đọc blog" },
    ],
  },
};

type Daily = Record<string, Record<string, number>>;

async function read(): Promise<Daily> {
  const raw = await getConfigValue(KEY);
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export async function recordFunnel(page: string, step: string, day: string, n = 1) {
  if (!FUNNELS[page]) return;
  if (!FUNNELS[page].steps.find((s) => s.key === step)) return;
  const map = await read();

  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })();
  for (const k of Object.keys(map)) if (k < cutoff) delete map[k];
  (map[day] ??= {});
  const kk = `${page}:${step}`;
  map[day][kk] = (map[day][kk] || 0) + n;
  await setConfigValue(KEY, JSON.stringify(map), "Đếm bước phễu mua hàng theo ngày");
}

function pctN(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

function suggestFor(page: string, stepKey: string): string {
  const m: Record<string, string> = {
    start: "Nhiều người vào nhưng chưa bấm bắt đầu — thử làm nút bắt đầu nổi bật hơn, nêu rõ 'chỉ 90 giây, miễn phí'.",
    q_done: "Bắt đầu nhưng bỏ giữa chừng — quiz có thể dài; cân nhắc rút bớt câu hoặc hiện thanh tiến độ rõ hơn.",
    gate_view: "Trả lời xong nhưng chưa tới ô nhập — kiểm tra nút 'xem kết quả' có rõ không.",
    lead: "Tới ô nhập nhưng không để lại email — giảm số ô bắt buộc, nhấn mạnh quà tặng (ebook + thực đơn) nhận ngay.",
    zalo_lead: "Để email nhưng không để số Zalo — đây là đích chính (sale gọi); xem lại câu mời 'thực đơn 3 ngày qua Zalo' có đủ rõ lợi ích không.",
    offers: "Xem kết quả nhưng ít bấm 'cải thiện nhanh' — thử làm nhánh này hấp dẫn hơn (nêu lợi ích rõ).",
    checkout: "Xem gói nhưng không vào thanh toán — cân nhắc giá/ưu đãi, thêm bằng chứng tin tưởng.",
    pay_qr: "Vào thanh toán nhưng chưa hiện QR — kiểm tra cổng PayOS có lỗi không.",
    paid: "Hiện QR nhưng chưa trả — có thể vướng thao tác chuyển khoản; kiểm tra QR + hướng dẫn, hoặc để sale gọi chốt.",
    select: "Vào trang nhưng ít chọn combo — thử làm combo/ưu đãi nổi bật hơn ngay đầu trang.",
    submit: "Chọn combo nhưng không bấm đặt hàng — rút gọn form, nêu rõ freeship/quà.",
    cta_quiz: "Vào trang chủ nhưng ít bấm làm Quiz — đưa nút Quiz lên vị trí dễ thấy hơn.",
  };
  return m[stepKey] || "Xem lại trải nghiệm ở bước này để giảm rớt khách.";
}

export async function buildFunnelReport(days = 7): Promise<string> {
  const data = await getFunnel(days);
  const out: string[] = [`BÁO CÁO PHỄU MUA HÀNG — ${days} ngày gần nhất`, `(Trợ lý AI tổng hợp)`, ""];
  let any = false;
  for (const [pk, f] of Object.entries(FUNNELS)) {
    const rec = data[pk] || {};
    const top = rec[f.steps[0].key] || 0;
    if (top === 0) continue;
    any = true;
    const last = rec[f.steps[f.steps.length - 1].key] || 0;
    out.push(`▸ ${f.label}`);
    out.push(`  Vào trang ${top} → chốt ${last} (${pctN(last, top)}%)`);
    let wi = -1, wd = 0;
    for (let i = 1; i < f.steps.length; i++) {
      const p = rec[f.steps[i - 1].key] || 0, c = rec[f.steps[i].key] || 0;
      const d = p > 0 ? (p - c) / p : 0;
      if (p > 0 && d > wd) { wd = d; wi = i; }
    }
    if (wi > 0 && wd >= 0.3) {
      out.push(`  Rớt mạnh nhất: "${f.steps[wi].label}" (−${Math.round(wd * 100)}% so với bước trước)`);
      out.push(`  Đề xuất: ${suggestFor(pk, f.steps[wi].key)}`);
    } else {
      out.push(`  Phễu khá đều, chưa có bước rớt bất thường.`);
    }
    out.push("");
  }
  if (!any) return "BÁO CÁO PHỄU MUA HÀNG\n\nTuần này chưa có lượt nào được ghi — beacon vừa gắn, chờ khách vào các trang là có số.";
  out.push("Xem chi tiết ở /tracking trong hệ thống.");
  return out.join("\n");
}

export async function getFunnel(days = 7): Promise<Record<string, Record<string, number>>> {
  const map = await read();
  const since = (() => { const d = new Date(); d.setDate(d.getDate() - days + 1); return d.toISOString().slice(0, 10); })();
  const out: Record<string, Record<string, number>> = {};
  for (const [day, rec] of Object.entries(map)) {
    if (day < since) continue;
    for (const [kk, n] of Object.entries(rec)) {
      const [page, step] = kk.split(":");
      (out[page] ??= {});
      out[page][step] = (out[page][step] || 0) + n;
    }
  }
  return out;
}
