import { getConfigValue } from "@/lib/app-config";
import { BOD_EMAILS } from "@/lib/auth";

export type EmailRec = {
  id: string; threadId: string; from: string; fromEmail: string; subject: string; snippet: string; date: string;
  category: "customer" | "finance" | "supplier" | "partner" | "other";
  needsAction: boolean; urgency: "high" | "normal" | "low"; reason: string;
  assignee: string; status: "new" | "doing" | "done"; assignedBy?: string; updatedAt?: string;
};
export type Routing = Record<string, string>;

export const CATS: { key: EmailRec["category"]; label: string }[] = [
  { key: "customer", label: "Khách hàng / đơn hàng" },
  { key: "finance", label: "Tài chính / hoá đơn" },
  { key: "supplier", label: "Nhà cung cấp / mua hàng" },
  { key: "partner", label: "Đối tác / đầu tư / pháp lý" },
  { key: "other", label: "Khác / Newsletter" },
];
export const CAT_LABEL: Record<string, string> = Object.fromEntries(CATS.map(c => [c.key, c.label]));

export const DEFAULT_ROUTING: Routing = { customer: "", finance: BOD_EMAILS[0] || "", supplier: "", partner: BOD_EMAILS[0] || "", other: "" };

export async function getEmails(): Promise<EmailRec[]> {
  try { return JSON.parse((await getConfigValue("gmail_emails")) || "[]"); } catch { return []; }
}
export async function getRouting(): Promise<Routing> {
  try { return { ...DEFAULT_ROUTING, ...JSON.parse((await getConfigValue("gmail_routing")) || "{}") }; } catch { return { ...DEFAULT_ROUTING }; }
}
export async function getEmailLatest(): Promise<any> {
  try { return JSON.parse((await getConfigValue("gmail_inbox_latest")) || "null"); } catch { return null; }
}

export const gmailLink = (threadId: string) => `https://mail.google.com/mail/u/0/#all/${threadId}`;
