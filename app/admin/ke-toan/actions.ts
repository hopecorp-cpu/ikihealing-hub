"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { fileToCsv, listExcelSheets, readSheetAsCsv } from "@/lib/file-to-csv";
import { revalidatePath } from "next/cache";

export async function previewBankFile(input: { fileBase64?: string; csvContent?: string; fileName: string }) {
  try {
    let csvText: string;
    let sheets: { name: string; rowCount: number }[] = [];
    if (input.fileBase64) {
      const binary = Buffer.from(input.fileBase64, "base64");
      const bytes = new Uint8Array(binary);
      sheets = listExcelSheets(bytes);
      const result = fileToCsv(bytes, input.fileName);
      csvText = result.csvContent;
    } else if (input.csvContent) {
      csvText = input.csvContent;
    } else {
      return { success: false, error: "Thiếu file" };
    }

    const lines = csvText.split(/\r?\n/).slice(0, 20);
    const parsedRows = lines.map((line, i) => ({
      lineNum: i + 1,
      cols: line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ""))
    }));
    return { success: true, lines, parsedRows, sheets, totalLines: csvText.split(/\r?\n/).length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function uploadBankWithSheet(input: { bank: string; fileBase64: string; fileName: string; sheetName: string }) {
  const binary = Buffer.from(input.fileBase64, "base64");
  const csvText = readSheetAsCsv(new Uint8Array(binary), input.sheetName);

  return uploadBankStatement({ bank: input.bank, csvContent: csvText, fileName: input.fileName });
}

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user: authUser } } = await auth.auth.getUser();
  if (!authUser) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", authUser.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) {
    throw new Error("Không có quyền");
  }
  return { sb, adminId: authUser.id };
}

function parseBankCsv(text: string): {
  txns: { txn_date: string; amount: number; type: "credit" | "debit"; description: string; counterparty: string; ref_code: string }[];
  totalCredit: number;
  totalDebit: number;
  rawPreview?: string[];
  headerRowIdx?: number;
  headersDetected?: string[];
} {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { txns: [], totalCredit: 0, totalDebit: 0, rawPreview: lines };

  const sampleLine = lines[Math.min(10, Math.floor(lines.length / 2))] || lines[0];
  const delim = sampleLine.includes("\t") ? "\t"
              : (sampleLine.match(/;/g) || []).length > (sampleLine.match(/,/g) || []).length ? ";"
              : ",";

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cols = parseCsvLine(lines[i], delim).map(c => c.toLowerCase().trim());
    const hasDate = cols.some(c => /ngày|date|posting|trans/i.test(c) && c.length < 50);

    const hasAmount = cols.some(c =>
      /^(số tiền|amount|ghi có|ghi nợ|phát sinh nợ|phát sinh có|phat sinh|credit|debit|so tien|tien vào|tien ra|có|nợ)/i.test(c) && c.length < 80
    );
    if (hasDate && hasAmount) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx < 0) {

    return { txns: [], totalCredit: 0, totalDebit: 0, rawPreview: lines.slice(0, 15), headerRowIdx: -1 };
  }

  const headerLine = lines[headerRowIdx];
  const headers = parseCsvLine(headerLine, delim).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));

  const findIdx = (...keys: string[]) => {
    for (const k of keys) {
      const idx = headers.findIndex(h => h.includes(k.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const idxDate = findIdx("ngày giao dịch", "ngày hiệu lực", "ngày hạch toán", "ngày gd", "ngày", "date", "trans_date", "transaction date", "posting date");
  const idxDesc = findIdx("nội dung", "diễn giải", "description", "narration", "noi dung", "dien giai", "trans desc", "mô tả");
  const idxAmount = findIdx("số tiền", "amount", "so tien", "trị giá");

  const idxCredit = findIdx("phát sinh có", "ghi có", "credit", "tiền vào", "tin vao", "ghi co", "phat sinh co");
  const idxDebit = findIdx("phát sinh nợ", "ghi nợ", "debit", "tiền ra", "tin ra", "ghi no", "phat sinh no");

  const idxRef = findIdx("bút toán", "mã gd", "ref", "reference", "số ref", "ma gd", "số giao dịch", "số tham chiếu", "but toan");

  const idxCounter = findIdx("đơn vị thụ hưởng", "đơn vị chuyển", "đối tác", "counterparty", "tên đối tác", "doi tac", "người chuyển", "người nhận", "don vi thu huong");

  if (idxDate < 0 || (idxAmount < 0 && idxCredit < 0 && idxDebit < 0)) {
    return {
      txns: [], totalCredit: 0, totalDebit: 0,
      rawPreview: lines.slice(headerRowIdx, headerRowIdx + 5),
      headerRowIdx,
      headersDetected: headers
    };
  }

  const txns: any[] = [];
  let totalCredit = 0, totalDebit = 0;

  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delim);
    if (cols.length < 2) continue;

    const fullRow = cols.join(" ").toLowerCase();
    if (/^[\s,]*$/.test(fullRow)) continue;
    if (/tổng cộng|tổng phát sinh|số dư cuối|opening balance|closing balance|người lập|người tạo|ngày in|date printed|cộng phát sinh/i.test(fullRow)) continue;

    const rawDate = cols[idxDate]?.trim();
    if (!rawDate) continue;
    const txn_date = normalizeDate(rawDate);
    if (!txn_date) continue;

    let amount = 0;
    let type: "credit" | "debit" = "credit";

    if (idxCredit >= 0 && idxDebit >= 0) {
      const cr = parseAmount(cols[idxCredit]);
      const db = parseAmount(cols[idxDebit]);
      if (cr > 0) { amount = cr; type = "credit"; }
      else if (db > 0) { amount = db; type = "debit"; }
    } else if (idxAmount >= 0) {
      const v = parseAmount(cols[idxAmount]);
      amount = Math.abs(v);
      type = v >= 0 ? "credit" : "debit";
    }

    if (amount === 0) continue;

    const desc = cols[idxDesc]?.trim() || "";
    const ref = idxRef >= 0 ? cols[idxRef]?.trim() : "";
    const counterparty = idxCounter >= 0 ? cols[idxCounter]?.trim() : extractCounterparty(desc);

    txns.push({ txn_date, amount, type, description: desc, counterparty, ref_code: ref || "" });
    if (type === "credit") totalCredit += amount;
    else totalDebit += amount;
  }
  return { txns, totalCredit, totalDebit, headerRowIdx, headersDetected: headers };
}

function parseCsvLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (c === '"') { inQuote = !inQuote; }
    else if (c === delim && !inQuote) { result.push(cur); cur = ""; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

function parseAmount(s: string | undefined): number {
  if (!s) return 0;
  const clean = s.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const v = parseFloat(clean);
  return isNaN(v) ? 0 : v;
}

function normalizeDate(s: string): string | null {
  if (!s) return null;
  const trimmed = s.trim();

  const datePart = trimmed.split(/\s+/)[0];

  const ddmm = datePart.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (ddmm) {
    const y = ddmm[3].length === 2 ? `20${ddmm[3]}` : ddmm[3];
    return `${y}-${ddmm[2].padStart(2,"0")}-${ddmm[1].padStart(2,"0")}`;
  }

  const yymm = datePart.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if (yymm) return `${yymm[1]}-${yymm[2].padStart(2,"0")}-${yymm[3].padStart(2,"0")}`;
  return null;
}

function extractCounterparty(desc: string): string {
  const m = desc.match(/(?:CT TU |CK TU |FROM )([\p{L}\s]+?)(?:\s+CHUYEN|\s+SEND|\s+\d|$)/iu);
  if (m) return m[1].trim();
  return "";
}

function classifyTxn(t: { description: string; type: string; amount: number }): { category: string; isInternalTransfer: boolean } {
  const d = (t.description || "").toUpperCase();

  const isInternal = /CHUYEN NOI BO|RUT TIEN|NAP TIEN|TAI KHOAN PHU|RG BANK|INTERNAL TRANSFER/i.test(d);

  let category: string;
  if (t.type === "credit") {
    if (/SHOPEE|PANCAKE|TIKI|LAZADA|TIKTOK/i.test(d)) category = "revenue_ecom";
    else if (/CHUYEN KHOAN|DON HANG|ORDER|TT DON/i.test(d)) category = "revenue_order";
    else if (/HOC PHI|KHOA HOC|COURSE/i.test(d)) category = "revenue_course";
    else category = "revenue_other";
  } else {
    if (/FACEBOOK|FB ADS|GOOGLE ADS|TIKTOK ADS|ZALO ADS/i.test(d)) category = "expense_marketing";
    else if (/LUONG|SALARY|THUONG|TRA LUONG/i.test(d)) category = "expense_salary";
    else if (/SHIP|GIAO HANG|GHN|GHTK|VIETTEL POST|J&T/i.test(d)) category = "expense_logistics";
    else if (/HOA DON DIEN|TIEN DIEN|TIEN NUOC|INTERNET|VPS|HOSTING/i.test(d)) category = "expense_office";
    else if (/MISA|HARAVAN|SAPO|KIOTVIET|CANVA|NOTION|VERCEL|SUPABASE/i.test(d)) category = "expense_software";
    else if (/THUE|TAX|VAT|BHXH/i.test(d)) category = "expense_tax";
    else if (/MUA NGUYEN LIEU|NHAP HANG|HANG HOA/i.test(d)) category = "expense_material";
    else category = "expense_other";
  }

  return { category, isInternalTransfer: isInternal };
}

export async function uploadBankStatement(input: {
  bank: string;
  csvContent?: string;
  fileBase64?: string;
  fileName: string;
}) {
  try {
    const { sb, adminId } = await requireAdmin();

    let csvText: string;
    let format = "csv";
    if (input.fileBase64) {
      const binary = Buffer.from(input.fileBase64, "base64");
      const result = fileToCsv(new Uint8Array(binary), input.fileName);
      csvText = result.csvContent;
      format = result.detectedFormat;
    } else if (input.csvContent) {
      const result = fileToCsv(input.csvContent, input.fileName);
      csvText = result.csvContent;
      format = result.detectedFormat;
    } else {
      return { success: false, error: "Thiếu nội dung file" };
    }

    const parsed = parseBankCsv(csvText);
    if (parsed.txns.length === 0) {
      const debugInfo = parsed.headerRowIdx === -1
        ? `Không tìm được dòng header (cần dòng có 'Ngày' + 'Ghi có/Ghi nợ' hoặc 'Số tiền')`
        : `Tìm được header ở dòng ${parsed.headerRowIdx + 1} với cột: [${parsed.headersDetected?.join(", ")}], nhưng không có dòng dữ liệu hợp lệ`;
      return {
        success: false,
        error: `Không parse được (${format}). ${debugInfo}`,
        rawPreview: parsed.rawPreview,
        headerRowIdx: parsed.headerRowIdx,
        headersDetected: parsed.headersDetected
      };
    }

    const dates = parsed.txns.map(t => t.txn_date).sort();
    const period_from = dates[0];
    const period_to = dates[dates.length - 1];

    const { data: stmt, error: stmtErr } = await sb.from("bank_statements").insert({
      upload_by: adminId,
      bank_name: input.bank,
      period_from,
      period_to,
      total_credit: parsed.totalCredit,
      total_debit: parsed.totalDebit,
      txn_count: parsed.txns.length,
      note: `Uploaded ${input.fileName}`
    }).select("id").single();

    if (stmtErr || !stmt) {
      const msg = stmtErr?.message || "Insert statement failed";
      if (/schema cache|does not exist|relation .* does not exist/i.test(msg)) {
        return { success: false, error: `Bảng bank_statements chưa có trong Supabase. Mở Supabase SQL Editor → paste migration 012 → Run. (Copy lệnh: cat supabase/migrations/012*.sql | pbcopy)` };
      }
      return { success: false, error: msg };
    }

    const txnRows = parsed.txns.map(t => {
      const cls = classifyTxn(t);
      return {
        statement_id: stmt.id,
        txn_date: t.txn_date,
        amount: t.type === "credit" ? t.amount : -t.amount,
        type: t.type,
        description: t.description,
        counterparty: t.counterparty,
        ref_code: t.ref_code,
        category: cls.isInternalTransfer ? "internal_transfer" : cls.category,
        reviewed: cls.isInternalTransfer
      };
    });

    const { error: txnErr } = await sb.from("bank_transactions").insert(txnRows);
    if (txnErr) return { success: false, error: txnErr.message };

    revalidatePath("/admin/ke-toan");
    return {
      success: true,
      parsed: parsed.txns.length,
      totalCredit: parsed.totalCredit,
      totalDebit: parsed.totalDebit
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function convertCreditTxnsToOrders(input: {
  txnIds: string[];
  saleId: string | null;
  channel?: string;
}) {
  const { sb } = await requireAdmin();
  if (input.txnIds.length === 0) return { success: false, error: "Chưa chọn giao dịch nào" };

  const { data: txns } = await sb.from("bank_transactions")
    .select("*").in("id", input.txnIds).eq("type", "credit");

  if (!txns || txns.length === 0) return { success: false, error: "Không có giao dịch thu nào hợp lệ" };

  let created = 0;
  const errors: any[] = [];

  for (const t of txns) {

    let customerId: string | null = null;
    if (t.counterparty) {
      const { data: existing } = await sb.from("customers")
        .select("id").ilike("full_name", t.counterparty.trim()).maybeSingle();
      if (existing) customerId = existing.id;
      else {
        const { data: newC } = await sb.from("customers").insert({
          full_name: t.counterparty.trim() || "KH bank " + t.ref_code,
          phone: null,
          notes: `Auto-created from bank txn ${t.ref_code}`
        }).select("id").single();
        customerId = newC?.id || null;
      }
    }

    const amount = Math.abs(t.amount);
    const { data: order, error: ordErr } = await sb.from("orders").insert({
      order_code: `BANK-${t.ref_code || t.id.slice(0, 8)}`,
      customer_id: customerId,
      salesperson_id: input.saleId,
      channel: input.channel || "Bank Transfer",
      sub_channel: "Chuyển khoản",
      gross_revenue: amount,
      discount_value: 0,
      shipping_cost: 0,
      quantity: 1,
      status: "delivered",
      order_date: t.txn_date,
      source_platform: "bank_reconcile",
      counts_for_bonus: true,
      notes: `Bank: ${t.description}`
    }).select("id").single();

    if (ordErr || !order) {
      errors.push({ txnId: t.id, error: ordErr?.message });
      continue;
    }

    await sb.from("bank_transactions").update({
      matched_order_id: order.id,
      reviewed: true,
      category: "revenue_order"
    }).eq("id", t.id);

    created++;
  }

  revalidatePath("/admin/ke-toan");
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { success: true, created, errors };
}

export async function convertDebitTxnsToExpenses(input: {
  txnIds: string[];
  category: string;
  paidBy?: string;
}) {
  const { sb, adminId } = await requireAdmin();
  if (input.txnIds.length === 0) return { success: false, error: "Chưa chọn giao dịch nào" };

  const { data: txns } = await sb.from("bank_transactions")
    .select("*").in("id", input.txnIds).eq("type", "debit");

  if (!txns || txns.length === 0) return { success: false, error: "Không có giao dịch chi nào hợp lệ" };

  let created = 0;
  for (const t of txns) {
    const amount = Math.abs(t.amount);
    const { data: exp } = await sb.from("expenses").insert({
      expense_date: t.txn_date,
      amount,
      category: input.category,
      vendor: t.counterparty || "Bank — " + t.description.slice(0, 40),
      description: t.description,
      payment_method: "bank_transfer",
      bank_txn_id: t.id,
      paid_by: input.paidBy || adminId,
      approved_by: adminId,
      status: "paid"
    }).select("id").single();

    if (exp) {
      await sb.from("bank_transactions").update({
        matched_expense_id: exp.id,
        reviewed: true,
        category: input.category
      }).eq("id", t.id);
      created++;
    }
  }

  revalidatePath("/admin/ke-toan");
  return { success: true, created };
}

export async function markAsInternalTransfer(txnIds: string[]) {
  const { sb } = await requireAdmin();
  await sb.from("bank_transactions").update({
    category: "internal_transfer",
    reviewed: true
  }).in("id", txnIds);
  revalidatePath("/admin/ke-toan");
  return { success: true };
}

export async function markAsIgnored(txnIds: string[]) {
  const { sb } = await requireAdmin();
  await sb.from("bank_transactions").update({
    category: "ignored",
    reviewed: true
  }).in("id", txnIds);
  revalidatePath("/admin/ke-toan");
  return { success: true };
}

export async function updateTxnCategory(txnId: string, category: string) {
  const { sb } = await requireAdmin();
  await sb.from("bank_transactions").update({ category, reviewed: true }).eq("id", txnId);
  revalidatePath("/admin/ke-toan");
  return { success: true };
}

export async function getAllCategoriesInUse() {
  const { sb } = await requireAdmin();
  const { data } = await sb.from("bank_transactions").select("category");
  const counts: Record<string, number> = {};
  (data ?? []).forEach((r: any) => {
    if (!r.category) return;
    counts[r.category] = (counts[r.category] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => ({ cat, count }));
}

export async function renameCategory(input: { oldCategory: string; newCategory: string }) {
  const { sb } = await requireAdmin();
  if (!input.newCategory || input.newCategory.length < 2) {
    return { success: false, error: "Tên nhóm mới phải có ít nhất 2 ký tự" };
  }
  const { data, error } = await sb.from("bank_transactions")
    .update({ category: input.newCategory })
    .eq("category", input.oldCategory)
    .select("id");
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/ke-toan");
  return { success: true, updated: data?.length ?? 0 };
}

export async function bulkUpdateCategory(input: { txnIds: string[]; category: string }) {
  const { sb } = await requireAdmin();
  if (input.txnIds.length === 0) return { success: false, error: "Chưa chọn GD" };
  if (!input.category) return { success: false, error: "Chưa chọn category" };
  const { error } = await sb.from("bank_transactions")
    .update({ category: input.category, reviewed: true })
    .in("id", input.txnIds);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/ke-toan");
  return { success: true, updated: input.txnIds.length };
}

export async function autoMatchTransactions(month: string) {
  const { sb } = await requireAdmin();
  const [y, m] = month.split("-").map(Number);
  const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const [{ data: txns }, { data: orders }] = await Promise.all([
    sb.from("bank_transactions").select("*").is("matched_order_id", null).eq("type", "credit")
      .gte("txn_date", `${month}-01`).lt("txn_date", nextStart),
    sb.from("orders").select("id, final_revenue, order_date").gte("order_date", `${month}-01`).lt("order_date", nextStart)
  ]);

  let matched = 0;
  for (const t of txns ?? []) {
    const candidates = (orders ?? []).filter((o: any) => {
      const dDiff = Math.abs(new Date(t.txn_date).getTime() - new Date(o.order_date).getTime()) / 86400000;
      return Math.abs(o.final_revenue - Math.abs(t.amount)) < 1 && dDiff <= 3;
    });
    if (candidates.length === 1) {
      await sb.from("bank_transactions").update({ matched_order_id: candidates[0].id, reviewed: true }).eq("id", t.id);
      matched++;
    }
  }

  revalidatePath("/admin/ke-toan");
  return { success: true, matched };
}
