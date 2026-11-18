import * as XLSX from "xlsx";

export type FileReadResult = {
  csvContent: string;
  detectedFormat: "csv" | "xlsx" | "xls" | "tsv" | "unknown";
  sheetName?: string;
  rowCount: number;
};

/**
 * @param sheetHint  tên (hoặc mảnh tên) sheet muốn đọc. File đa sheet (TikTok Income có 4 sheet: "Chi tiết
 *   đơn hàng" / "Báo cáo" / "Lịch sử rút tiền" / "Giải thích về phí") mà đọc sheet đầu theo mặc định thì
 *   may mới trúng. Không truyền = sheet đầu như cũ (mọi chỗ gọi sẵn có không đổi).
 */
export function fileToCsv(input: Uint8Array | string, fileName: string, sheetHint?: string | RegExp): FileReadResult {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = typeof input === "string" ? input : new TextDecoder("utf-8").decode(input);
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return { csvContent: text, detectedFormat: "csv", rowCount: lines.length };
  }

  if (lower.endsWith(".tsv")) {
    const text = typeof input === "string" ? input : new TextDecoder("utf-8").decode(input);

    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return { csvContent: text, detectedFormat: "tsv", rowCount: lines.length };
  }

  if (/\.(xlsx|xls|xlsm|ods)$/i.test(lower)) {
    const buffer = typeof input === "string" ? new TextEncoder().encode(input) : input;
    const wb = XLSX.read(buffer, { type: "array", cellDates: true, cellNF: false, cellText: true });
    let sheetName = wb.SheetNames[0];
    if (sheetHint) {
      const kd = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const hit = wb.SheetNames.find((n) => sheetHint instanceof RegExp ? sheetHint.test(n) : kd(n).includes(kd(sheetHint)));
      if (hit) sheetName = hit;
    }
    if (!sheetName) {
      return { csvContent: "", detectedFormat: "xlsx", rowCount: 0 };
    }
    const sheet = wb.Sheets[sheetName];

    const csvContent = XLSX.utils.sheet_to_csv(sheet, {
      blankrows: false,
      dateNF: "yyyy-mm-dd",
      strip: false,
      forceQuotes: false
    });

    const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
    return {
      csvContent,
      detectedFormat: lower.endsWith(".xls") ? "xls" : "xlsx",
      sheetName,
      rowCount: lines.length
    };
  }

  const text = typeof input === "string" ? input : new TextDecoder("utf-8").decode(input);
  return { csvContent: text, detectedFormat: "unknown", rowCount: text.split(/\r?\n/).filter(l => l.trim()).length };
}

export function listExcelSheets(input: Uint8Array): { name: string; rowCount: number }[] {
  try {
    const wb = XLSX.read(input, { type: "array" });
    return wb.SheetNames.map(name => {
      const sheet = wb.Sheets[name];
      const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
      const rowCount = range ? range.e.r - range.s.r + 1 : 0;
      return { name, rowCount };
    });
  } catch {
    return [];
  }
}

export function readSheetAsCsv(input: Uint8Array, sheetName: string): string {
  const wb = XLSX.read(input, { type: "array", cellDates: true, cellNF: false, cellText: true });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return "";
  return XLSX.utils.sheet_to_csv(sheet, { blankrows: false, dateNF: "yyyy-mm-dd" });
}
