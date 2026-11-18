export type SalesEventType = "flash" | "holiday" | "reset" | "subscription";
export type SalesEvent = {
  date: string;
  day: number;
  name: string;
  type: SalesEventType;
  goldenHour: string;
  hook: string;
  big?: boolean;
};

const GH_TOI = "20:00–22:00";
const GH_TRUA = "12:00–13:00";

const HOLIDAYS: Record<string, { name: string; hook: string; hour: string; big?: boolean }> = {
  "03-08": { name: "8/3 — Quốc tế Phụ nữ", hook: "Tri ân khách nữ: đơn từ 990k tặng trà thảo mộc + thiệp; khách mua tặng mẹ/vợ.", hour: GH_TOI },
  "06-01": { name: "1/6 — Quốc tế Thiếu nhi", hook: "Quà cho cả nhà: combo gia đình tặng phần dùng thử cho con (sữa hạt/đồ lành).", hour: GH_TRUA },
  "08-23": { name: "Sinh nhật ACME Corp", hook: "Đại tiệc tri ân (thành lập 23/8/2023): quà đặc biệt cho khách đồng hành + tri ân đại lý/CTV; kể câu chuyện hành trình thương hiệu.", hour: GH_TOI, big: true },
  "10-10": { name: "Sinh nhật NOVA (10/10)", hook: "Mừng sinh nhật NOVA — tinh thần 'reset/thanh lọc': tri ân khách đồng hành, quà detox nhẹ + thẻ member.", hour: GH_TOI, big: true },
  "10-20": { name: "20/10 — Phụ nữ Việt Nam", hook: "Tri ân khách nữ: đơn từ 1tr tặng combo trà thảo mộc + thiệp viết tay.", hour: GH_TOI },
  "11-20": { name: "Sinh nhật Học Viện NOVA (20/11)", hook: "Ngày Nhà giáo — tri ân học viên khoá dưỡng sinh: ưu đãi khoá học + quà tri thức; tôn vinh hành trình đào tạo.", hour: GH_TOI, big: true },
  "11-27": { name: "Black Friday", hook: "Đại tiệc quà: đơn lớn tặng Thẻ Vàng member + hộp quà dưỡng sinh; dồn ngân sách ads.", hour: GH_TOI, big: true },
  "12-24": { name: "Noel", hook: "Quà sức khoẻ tặng người thương: gift-set + gói quà miễn phí.", hour: GH_TOI },
  "12-31": { name: "Tất niên — Thải độc đón Tết", hook: "Chu trình đón Tết: mua combo tặng liệu trình dùng thử tháng sau (giữ LTV sang năm).", hour: GH_TOI },
};

const pad = (n: number) => String(n).padStart(2, "0");

function nthSunday(y: number, mo: number, n: number): number | null {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(y, mo - 1, d);
    if (dt.getMonth() !== mo - 1) break;
    if (dt.getDay() === 0 && ++count === n) return d;
  }
  return null;
}

export type ExtraEvent = { date: string; name: string; hook: string; goldenHour?: string; type?: SalesEventType; big?: boolean };

export function salesEventsForMonth(month: string, extra: ExtraEvent[] = []): SalesEvent[] {
  const [y, mo] = month.split("-").map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const ev: SalesEvent[] = [];
  const D = (d: number) => `${y}-${pad(mo)}-${pad(d)}`;

  ev.push({
    date: D(1), day: 1, name: `Reset đầu tháng ${mo}`, type: "reset", goldenHour: GH_TOI,
    hook: "Mở màn chu trình tháng: đơn combo tặng cẩm nang dưỡng sinh + buổi tư vấn cơ địa 1-1.",
  });

  if (mo <= daysInMonth) {
    const big = mo === 11 || mo === 12;
    ev.push({
      date: D(mo), day: mo, name: `Flash ${mo}/${mo} — Ngày đôi`, type: "flash", goldenHour: GH_TOI, big,
      hook: mo === 11
        ? "11.11 ĐỈNH: khung 20-22h, đơn từ 1,5tr tặng Thẻ Vàng + prepay 12 tháng ưu đãi quà; dồn ads."
        : `Khung ${GH_TOI}: đơn từ 990k tặng quà dưỡng sinh (trà/cafe NOVA dùng thử) + freeship. Đếm ngược tạo khan hiếm.`,
    });
  }

  for (const [md, h] of Object.entries(HOLIDAYS)) {
    const [hm, hd] = md.split("-").map(Number);
    if (hm === mo && hd <= daysInMonth) {
      ev.push({ date: D(hd), day: hd, name: h.name, type: "holiday", goldenHour: h.hour, hook: h.hook, big: h.big });
    }
  }

  if (mo === 5) { const d = nthSunday(y, 5, 2); if (d) ev.push({ date: D(d), day: d, name: "Ngày của Mẹ", type: "holiday", goldenHour: GH_TOI, hook: "Quà tặng mẹ: gift-set dưỡng sinh + thiệp; khách mua tri ân mẹ." }); }
  if (mo === 6) { const d = nthSunday(y, 6, 3); if (d) ev.push({ date: D(d), day: d, name: "Ngày của Cha", type: "holiday", goldenHour: GH_TOI, hook: "Quà tặng cha: combo sức khoẻ nam giới/người lớn tuổi + gói quà." }); }

  if (daysInMonth >= 15) {
    ev.push({
      date: D(15), day: 15, name: "Đợt Membership & Prepay", type: "subscription", goldenHour: GH_TRUA,
      hook: "Gói đồng hành 3/6/12 tháng + Auto-ship hàng tháng: trả trước tặng thêm tháng dùng + Thẻ Vàng. Giữ khách & dòng tiền đều.",
    });
  }

  for (const x of extra) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date || "")) continue;
    if (x.date.slice(0, 7) !== month) continue;
    ev.push({ date: x.date, day: Number(x.date.slice(8, 10)), name: x.name, type: x.type || "holiday", goldenHour: x.goldenHour || GH_TOI, hook: x.hook, big: x.big });
  }

  const seen = new Set<string>();
  return ev.sort((a, b) => a.day - b.day).filter((e) => (seen.has(e.date) ? false : (seen.add(e.date), true)));
}

export const EVENT_LABEL: Record<SalesEventType, string> = {
  flash: "Flash ngày đôi", holiday: "Dịp lễ", reset: "Reset đầu tháng", subscription: "Membership/Prepay",
};
