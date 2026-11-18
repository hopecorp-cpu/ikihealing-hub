const ALLOWED_NEGATIONS: RegExp[] = [
  /không (?:có tác dụng )?thay thế thuốc chữa bệnh/gi,
  /không phải (?:là )?thuốc(?: và không có tác dụng thay thế thuốc)? chữa bệnh/gi,
  /không thay thế (?:chẩn đoán|tư vấn|điều trị) y khoa/gi,
];

const BANNED: Array<{ re: RegExp; label: string }> = [
  { re: /chữa bệnh/gi, label: "chữa bệnh" },
  { re: /trị bệnh/gi, label: "trị bệnh" },
  { re: /điều trị/gi, label: "điều trị" },
  { re: /khỏi bệnh/gi, label: "khỏi bệnh" },
  { re: /thải độc/gi, label: "thải độc" },
  { re: /giải độc/gi, label: "giải độc" },
  { re: /mát gan/gi, label: "mát gan" },
  { re: /đặc trị/gi, label: "đặc trị" },
  { re: /thực phẩm chức năng/gi, label: "thực phẩm chức năng" },
  { re: /\bTPCN\b/g, label: "TPCN" },
  { re: /hiệu quả sau \d+/gi, label: "hiệu quả sau X" },
  { re: /cam kết khỏi/gi, label: "cam kết khỏi" },
  { re: /hạ huyết áp/gi, label: "hạ huyết áp" },
  { re: /hạ đường huyết/gi, label: "hạ đường huyết" },
];

export function stripHtml(html: string): string {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ComplianceResult = { ok: boolean; hits: string[] };

export function checkCompliance(htmlOrText: string): ComplianceResult {
  let prose = stripHtml(htmlOrText);
  for (const neg of ALLOWED_NEGATIONS) prose = prose.replace(neg, " ");
  const hits: string[] = [];
  for (const { re, label } of BANNED) {
    re.lastIndex = 0;
    if (re.test(prose)) hits.push(label);
  }
  return { ok: hits.length === 0, hits };
}
