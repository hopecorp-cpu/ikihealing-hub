const PRODUCT_NOUN = "trà|cà phê|ca phe|cafe|bột đạm|bot dam|protein|sản phẩm|sp|nova|Sản phẩm A|tuệ minh|thảo mộc|viên|nước uống|combo|liệu trình";
const CLAIM_GIUP = new RegExp(`((?:${PRODUCT_NOUN})[^,.;!?\\n]{0,24}?)\\s+giúp\\b`, "gi");

export const BANNED_REPLACEMENTS: { re: RegExp; to: string }[] = [
  { re: /thực phẩm chức năng/gi, to: "thực phẩm bổ sung" },

  { re: /(?:hỗ trợ\s+)?(?:cơ thể\s+)?đào thải độc tố/gi, to: "hỗ trợ tiêu hoá" },
  { re: /phòng và (?:chữa|trị)(?:\s+bệnh)?/gi, to: "chăm sóc sức khoẻ" },
  { re: /Bộ\s+thanh lọc đại tràng/gi, to: "Bộ chăm sóc đại tràng" },
  { re: /(?:bộ\s+)?thanh lọc đại tràng/gi, to: "bộ chăm sóc đại tràng" },
  { re: /thải độc đại tràng/gi, to: "hỗ trợ tiêu hoá" },
  { re: /thải độc/gi, to: "thanh nhẹ cơ thể" },

  { re: /giải độc gan/gi, to: "chăm sóc chức năng gan" },
  { re: /giải độc cơ thể/gi, to: "thanh nhẹ cơ thể" },
  { re: /giải độc/gi, to: "thanh nhẹ cơ thể" },
  { re: /\bdetox\b/gi, to: "chăm sóc tiêu hoá" },

  { re: /dầu ngậm\s+rút độc/gi, to: "dầu ngậm" },
  { re: /(?:bộ\s+)?tẩy sỏi gan(?:\s+ruột)?(?:\s+mật)?/gi, to: "bộ chăm sóc gan mật" },
  { re: /tẩy sỏi/gi, to: "chăm sóc" },

  { re: /(?:rút|hút|khử|tống)\s*độc/gi, to: "thanh nhẹ cơ thể" },

  { re: /liệu trình/gi, to: "bộ dùng theo đợt" },
  { re: /thanh lọc\s+cơ thể/gi, to: "chăm sóc cơ thể" },
  { re: /thanh lọc/gi, to: "chăm sóc cơ thể" },
  { re: /giảm cân/gi, to: "hỗ trợ vóc dáng" },
  { re: /đặc trị/gi, to: "hỗ trợ" },
  { re: /điều trị/gi, to: "hỗ trợ" },
  { re: /chữa bệnh/gi, to: "hỗ trợ sức khoẻ" },
  { re: /chữa khỏi/gi, to: "hỗ trợ cải thiện" },
  { re: /khỏi bệnh/gi, to: "cải thiện sức khoẻ" },
  { re: /thần dược/gi, to: "sản phẩm" },
  { re: /cam kết (khỏi|hết bệnh)/gi, to: "hỗ trợ" },
  { re: /giảm béo/gi, to: "hỗ trợ vóc dáng" },

  { re: /hiệu quả (?:ngay )?(?:sau|trong|chỉ(?: sau)?)\s*\d+\s*(?:ngày|tuần|tháng)/gi, to: "hỗ trợ đều đặn mỗi ngày" },
  { re: /(?:khỏi|hết|dứt)\s+(?:sau|trong)\s*\d+\s*(?:ngày|tuần|tháng)/gi, to: "cải thiện dần theo thói quen" },

  { re: /kháng sinh tự nhiên/gi, to: "thức uống lên men thảo mộc" },
  { re: /nước chữa lành/gi, to: "nước uống lên men thảo mộc" },
  { re: /(?:khả năng\s+)?tự chữa lành/gi, to: "tự chăm sóc sức khoẻ" },
  { re: /chữa lành/gi, to: "chăm sóc" },
  { re: /(?:tiêu\s*)?diệt\s+(?:hầu hết\s+)?(?:các loại\s+)?(?:vi khuẩn|vi trùng|ký sinh trùng|nấm|virus|vi rút)/gi, to: "hỗ trợ đề kháng" },
  { re: /kháng khuẩn|diệt khuẩn|sát trùng/gi, to: "hỗ trợ đề kháng" },
  { re: /(?:phòng(?: và)?\s*)?(?:chống|ngừa|phòng ngừa|giảm nguy cơ mắc)\s+ung thư/gi, to: "chăm sóc sức khoẻ" },
  { re: /tủ thuốc/gi, to: "gian bếp lành" },
  { re: /bác sĩ (?:cho|của) chính mình/gi, to: "người hiểu cơ thể mình" },
  { re: /giảm mỡ (?:máu|gan|nội tạng)/gi, to: "hỗ trợ chuyển hoá" },
  { re: /giảm đường huyết/gi, to: "hỗ trợ sức khoẻ" },
  { re: /thuốc bổ/gi, to: "sản phẩm bổ sung" },
];
const DETECT = /thực phẩm chức năng|thải độc|giải độc|(?:rút|hút|khử|tống)\s*độc|tẩy sỏi|liệu trình|\bdetox\b|thanh lọc|giảm cân|giảm béo|đặc trị|điều trị|chữa bệnh|chữa khỏi|khỏi bệnh|thần dược|kháng sinh tự nhiên|chữa lành|kháng khuẩn|diệt khuẩn|sát trùng|(?:tiêu\s*)?diệt\s+(?:hầu hết\s+)?(?:các loại\s+)?(?:vi khuẩn|vi trùng|ký sinh trùng|nấm|virus|vi rút)|(?:chống|ngừa|phòng ngừa)\s+ung thư|phòng và chữa|tủ thuốc|bác sĩ (?:cho|của) chính mình|giảm mỡ (?:máu|gan|nội tạng)|giảm đường huyết|thuốc bổ|hiệu quả (?:ngay )?(?:sau|trong|chỉ(?: sau)?)\s*\d+\s*(?:ngày|tuần|tháng)/i;

export function hasBanned(text: string): boolean {
  return DETECT.test(text || "");
}

const RAO_HOP_LE = [
  /không thay thế chẩn đoán hoặc điều trị y khoa/gi,
  /không thay thế (?:cho )?(?:việc )?(?:thăm khám|chẩn đoán|điều trị)[^.]*/gi,

  /không (?:nhằm|mang tính) (?:mục đích )?(?:chẩn đoán|thăm khám)[^.]*/gi,
  /không (?:có )?(?:tác dụng )?thay thế thuốc chữa bệnh/gi,
];
const boRao = (text: string) => RAO_HOP_LE.reduce((t, re) => t.replace(re, " "), text || "");

const THE_KHONG_DAU = /detox|thai ?doc|giai ?doc|rut ?doc|hut ?doc|tay ?soi|lieu ?trinh|thanh ?loc|giam ?can|chua ?lanh|chua ?benh|dieu ?tri|khoi ?benh|than ?duoc|khang ?khuan|dietkhuan|thuoc ?bo/i;

export function sanitizeContent(text: string): string {
  let t = text || "";

  const kho: string[] = [];
  for (const re of RAO_HOP_LE) {
    t = t.replace(re, (m) => { kho.push(m); return `\u0000RAO${kho.length - 1}\u0000`; });
  }

  const the: string[] = [];
  t = t.replace(/#[^\s#]+/g, (m) => { the.push(m); return `\u0000THE${the.length - 1}\u0000`; });
  for (const { re, to } of BANNED_REPLACEMENTS) t = t.replace(re, to);
  t = t.replace(CLAIM_GIUP, "$1 hỗ trợ");
  t = t.replace(/\u0000THE(\d+)\u0000/g, (_, i) => {
    const goc = the[Number(i)] ?? "";
    if (/^#nova/i.test(goc)) return goc;
    return DETECT.test(goc.slice(1)) || THE_KHONG_DAU.test(goc.slice(1)) ? "" : goc;
  }).replace(/[ \t]{2,}/g, " ");
  return t.replace(/\u0000RAO(\d+)\u0000/g, (_, i) => kho[Number(i)] ?? "");
}

export function findBanned(text: string): string[] {
  const hits = new Set<string>();
  const t = boRao(text);
  for (const { re } of BANNED_REPLACEMENTS) { const m = t.match(new RegExp(re.source, "gi")); if (m) m.forEach(x => hits.add(x.toLowerCase())); }
  return [...hits];
}
