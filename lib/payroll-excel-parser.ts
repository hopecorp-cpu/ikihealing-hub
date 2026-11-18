import * as XLSX from "xlsx";

export type ParsedPayrollRow = {
  empName: string;
  position?: string;
  cccd?: string;
  tax_code?: string;
  base_salary: number;
  gross_salary: number;
  working_days_standard: number;
  working_days_actual: number;
  salary_by_workdays: number;
  bonus_amount: number;
  total_income: number;
  employee_insurance: number;
  personal_deduction: number;
  taxable_income: number;
  personal_income_tax: number;
  advance_payment: number;
  net_salary: number;
  employer_insurance: number;
  total_company_cost: number;
  notes?: string;
  raw_line: number;
};

export type ParsedSheet = {
  month: string;
  sheetName: string;
  rows: ParsedPayrollRow[];
};

const parseNum = (s: any) => {
  if (s === null || s === undefined) return 0;
  const v = parseFloat(String(s).replace(/[^\d.-]/g, ""));
  return isNaN(v) ? 0 : v;
};

const parseMonthFromSheetName = (name: string): string | null => {
  const m = name.match(/Th[áa]ng\s*(\d{1,2})[.\s\/]+(\d{4})/i);
  if (m) return `${m[2]}-${String(m[1]).padStart(2, "0")}`;
  return null;
};

export function parsePayrollExcel(fileBuffer: Uint8Array): ParsedSheet[] {
  const wb = XLSX.read(fileBuffer, { type: "array", cellDates: false });
  const result: ParsedSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const month = parseMonthFromSheetName(sheetName);
    if (!month) continue;

    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: "" });

    const parsed: ParsedPayrollRow[] = [];

    for (let i = 4; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] || !String(r[0]).match(/^\d+$/)) continue;
      const empName = r[1]?.toString().trim();
      if (!empName) continue;

      parsed.push({
        empName,
        position: r[3]?.toString() || "",
        cccd: r[4]?.toString() || "",
        tax_code: r[5]?.toString() || "",
        base_salary: parseNum(r[6]),
        gross_salary: parseNum(r[7]),
        working_days_standard: parseInt(r[8]) || 26,
        working_days_actual: parseInt(r[9]) || 26,
        salary_by_workdays: parseNum(r[10]),
        bonus_amount: parseNum(r[11]),
        total_income: parseNum(r[12]),
        employee_insurance: parseNum(r[13]),
        personal_deduction: parseNum(r[14]),
        taxable_income: parseNum(r[15]),
        personal_income_tax: parseNum(r[16]),
        advance_payment: parseNum(r[17]),
        net_salary: parseNum(r[18]),
        employer_insurance: parseNum(r[20]),
        total_company_cost: parseNum(r[21]),
        notes: r[23]?.toString() || "",
        raw_line: i + 1
      });
    }

    if (parsed.length > 0) {
      result.push({ month, sheetName, rows: parsed });
    }
  }

  return result;
}
