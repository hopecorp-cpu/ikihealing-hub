import { getServiceClient } from "./supabase-server";
import { vnDateStr } from "./payroll";

export type ReminderSeverity = "high" | "med" | "low";
export type AdminReminder = {
  id: string;
  type: "probation_ending" | "salary_review_6m" | "contract_pending" | "contract_expiring" | "missing_hire_date";
  severity: ReminderSeverity;
  icon: string;
  title: string;
  detail: string;
  employeeName: string;
  dueDate: string | null;
  daysLeft: number | null;
  actionHref: string;
  actionLabel: string;
};

const PROBATION_MONTHS = 2;
const REVIEW_MONTHS = 6;
const PROBATION_WARN_DAYS = 21;
const REVIEW_WARN_DAYS = 14;
const CONTRACT_EXPIRE_DAYS = 30;

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + "T00:00:00Z").getTime();
  const b = new Date(toStr + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}
function isProbation(ct?: string): boolean {
  const s = (ct || "").toLowerCase();
  return s.includes("thử việc") || s.includes("thu_viec") || s.includes("thu viec");
}

export async function getAdminReminders(): Promise<AdminReminder[]> {
  try {
    const sb = getServiceClient();
    const today = vnDateStr();

    const [{ data: users }, { data: contracts }] = await Promise.all([
      sb.from("users").select("id, full_name, role, contract_type, hire_date, base_salary, created_at, active").eq("active", true),
      sb.from("employment_contracts").select("user_id, contract_number, contract_type, probation_end_date, end_date, status"),
    ]);

    const out: AdminReminder[] = [];
    const contractByUser = new Map<string, any[]>();
    for (const c of contracts || []) {
      if (!contractByUser.has(c.user_id)) contractByUser.set(c.user_id, []);
      contractByUser.get(c.user_id)!.push(c);
    }

    for (const u of users || []) {
      const name = u.full_name || "(chưa rõ tên)";
      const ucontracts = contractByUser.get(u.id) || [];

      if (isProbation(u.contract_type)) {
        const contractProbEnd = ucontracts.map(c => c.probation_end_date).filter(Boolean).sort().pop() || null;
        const probEnd = contractProbEnd || (u.hire_date ? addMonths(u.hire_date, PROBATION_MONTHS) : null);
        if (probEnd) {
          const d = daysBetween(today, probEnd);
          if (d <= PROBATION_WARN_DAYS) {
            out.push({
              id: `prob-${u.id}`,
              type: "probation_ending",
              severity: d < 0 ? "high" : d <= 7 ? "high" : "med",
              icon: "",
              title: d < 0 ? `${name} ĐÃ hết hạn thử việc` : `${name} sắp hết hạn thử việc`,
              detail: d < 0
                ? `Hết hạn ${probEnd} (quá ${Math.abs(d)} ngày). Cần quyết định: ký HĐ chính thức hay dừng.`
                : `Hết hạn ${probEnd} (còn ${d} ngày). Chuẩn bị đánh giá & quyết định ký chính thức.`,
              employeeName: name,
              dueDate: probEnd,
              daysLeft: d,
              actionHref: "/admin/contracts",
              actionLabel: "Xử lý hợp đồng",
            });
          }
        } else {
          out.push({
            id: `prob-nodate-${u.id}`,
            type: "missing_hire_date",
            severity: "med",
            icon: "",
            title: `${name} (thử việc) thiếu ngày vào làm`,
            detail: "Bổ sung ngày vào làm để hệ thống tính được mốc hết thử việc.",
            employeeName: name,
            dueDate: null,
            daysLeft: null,
            actionHref: "/nhan-su",
            actionLabel: "Bổ sung hồ sơ",
          });
        }
      }

      if (!isProbation(u.contract_type) && u.role !== "ceo") {
        const base = u.hire_date || (u.created_at ? u.created_at.slice(0, 10) : null);
        if (base) {
          const reviewDate = addMonths(base, REVIEW_MONTHS);
          const d = daysBetween(today, reviewDate);
          if (d <= REVIEW_WARN_DAYS && d >= -60) {
            out.push({
              id: `review-${u.id}`,
              type: "salary_review_6m",
              severity: d < 0 ? "high" : "med",
              icon: "",
              title: d < 0 ? `${name} đã quá hạn review lương 6 tháng` : `${name} đến hạn review lương 6 tháng`,
              detail: d < 0
                ? `Mốc 6 tháng: ${reviewDate} (quá ${Math.abs(d)} ngày). Xem xét tăng lương / điều chỉnh.`
                : `Mốc 6 tháng: ${reviewDate} (còn ${d} ngày). Chuẩn bị đánh giá hiệu suất & xem xét tăng lương.`,
              employeeName: name,
              dueDate: reviewDate,
              daysLeft: d,
              actionHref: "/nhan-su",
              actionLabel: "Xem hồ sơ NV",
            });
          }
        }
      }

      if (!isProbation(u.contract_type) && u.role !== "ceo" && !u.hire_date && !u.created_at) {
        out.push({
          id: `nohire-${u.id}`,
          type: "missing_hire_date",
          severity: "low",
          icon: "",
          title: `${name} thiếu ngày vào làm`,
          detail: "Bổ sung ngày vào làm để tính mốc review tăng lương.",
          employeeName: name,
          dueDate: null,
          daysLeft: null,
          actionHref: "/nhan-su",
          actionLabel: "Bổ sung hồ sơ",
        });
      }
    }

    const userById = new Map((users || []).map(u => [u.id, u]));
    for (const c of contracts || []) {
      const name = userById.get(c.user_id)?.full_name || "(NV)";
      if (c.status === "pending_signatures" || c.status === "draft") {
        out.push({
          id: `csign-${c.contract_number}`,
          type: "contract_pending",
          severity: "med",
          icon: "",
          title: `HĐ ${c.contract_number} (${name}) chờ ký`,
          detail: "Hợp đồng chưa hoàn tất chữ ký 2 bên. Hoàn tất để có hiệu lực pháp lý.",
          employeeName: name,
          dueDate: null,
          daysLeft: null,
          actionHref: "/admin/contracts",
          actionLabel: "Hoàn tất ký",
        });
      }
      if (c.end_date && c.status !== "terminated") {
        const d = daysBetween(today, c.end_date);
        if (d >= 0 && d <= CONTRACT_EXPIRE_DAYS) {
          out.push({
            id: `cexp-${c.contract_number}`,
            type: "contract_expiring",
            severity: d <= 14 ? "high" : "med",
            icon: "⏳",
            title: `HĐ ${c.contract_number} (${name}) sắp hết hạn`,
            detail: `Hết hạn ${c.end_date} (còn ${d} ngày). Chuẩn bị gia hạn hoặc ký HĐ mới.`,
            employeeName: name,
            dueDate: c.end_date,
            daysLeft: d,
            actionHref: "/admin/contracts",
            actionLabel: "Gia hạn HĐ",
          });
        }
      }
    }

    const sevRank = { high: 0, med: 1, low: 2 };
    out.sort((a, b) => {
      if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity];
      const da = a.daysLeft ?? 9999, db = b.daysLeft ?? 9999;
      return da - db;
    });
    return out;
  } catch (e) {
    return [];
  }
}
