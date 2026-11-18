function goRao(raw: string): string {
  const s = String(raw || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const i = s.search(/[[{]/);
  return i < 0 ? "" : s.slice(i);
}

function mocPhay(s: string): number[] {
  const out: number[] = [];
  let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === ",") out.push(i);
  }
  return out.reverse();
}

function dongNgoac(s: string): string {
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  let out = s;
  if (esc) out = out.slice(0, -1);
  if (inStr) out += '"';
  out = out.replace(/[\s,:]+$/, "");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i];
  return out;
}

function vaJsonCut<T>(s: string): T | null {
  const moc = [s.length, ...mocPhay(s)].slice(0, 61);
  for (const i of moc) {
    try {
      return JSON.parse(dongNgoac(s.slice(0, i))) as T;
    } catch {  }
  }
  return null;
}

function votObject(s: string): any[] {
  const out: any[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try { out.push(JSON.parse(s.slice(start, i + 1))); } catch {  }
        start = -1;
      }
    }
  }
  return out;
}

export function bocMang<T>(raw: string): T[] {
  const s = goRao(raw);
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v as T[];
  } catch {  }
  const vot = votObject(s);
  if (vot.length) return vot as T[];
  const va = vaJsonCut<any>(s);
  return Array.isArray(va) ? (va as T[]) : [];
}

export function bocObject<T>(raw: string): T | null {
  const s = goRao(raw);
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as T;
  } catch {  }
  return vaJsonCut<T>(s);
}
