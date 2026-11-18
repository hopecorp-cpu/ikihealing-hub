import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isBodRole, isManagerOrAbove } from "@/lib/auth";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Báo cáo tháng | IKIHEALING Hub") };
}

export default async function BaoCaoThangPage({ searchParams }: { searchParams: { m?: string } }) {
  const { t: tDich } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role) && !isBodRole(user.role)) redirect("/?denied=bao-cao-thang");

  const sb = getServiceClient();
  const { data: keys } = await sb.from("config").select("key").like("key", "bao_cao_thang_%");
  const thangs = (keys || []).map((k: any) => k.key.replace("bao_cao_thang_", ""))
    .filter((m: string) => /^\d{4}-\d{2}$/.test(m)).sort().reverse();

  const m = searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : thangs[0];
  let bc: { thang: string; taoLuc: string; md: string } | null = null;
  if (m) {
    const { data } = await sb.from("config").select("value").eq("key", `bao_cao_thang_${m}`).maybeSingle();
    try { bc = data?.value ? JSON.parse(data.value) : null; } catch { bc = null; }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">{tDich("Báo cáo tháng")}</h1>
        <div className="flex gap-2 flex-wrap">
          {thangs.slice(0, 8).map((t: string) => (
            <Link key={t} href={`/bao-cao-thang?m=${t}`}
              className={`px-3 py-1 rounded-md text-sm border ${t === m ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"}`}>
              {t.slice(5, 7)}/{t.slice(0, 4)}
            </Link>
          ))}
        </div>
      </div>

      {!bc ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">
          {tDich("Chưa có báo cáo nào được soạn. Máy tự soạn 9:15 sáng ngày 1 hằng tháng cho tháng vừa xong.")}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="prose-sm max-w-none [&_table]:w-full [&_table]:text-sm"
            dangerouslySetInnerHTML={{ __html: renderMd(bc.md) }} />
          <p className="text-xs text-gray-400 mt-6">{tDich("Máy soạn lúc")} {new Date(bc.taoLuc).toLocaleString("vi-VN")}{tDich(". Muốn soạn lại tháng này: chạy cron bao-cao-thang với tham số m=")}{bc.thang}.</p>
        </div>
      )}
    </div>
  );
}

function renderMd(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  const inline = (s: string) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>');
  while (i < lines.length) {
    const l = lines[i];
    if (/^\|.+\|$/.test(l) && /^\|[\s:|-]+\|$/.test(lines[i + 1] || "")) {
      const head = l.split("|").slice(1, -1).map(c => `<th class="text-left px-2 py-1 border-b border-gray-200 font-semibold">${inline(c.trim())}</th>`).join("");
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i])) {
        rows.push("<tr>" + lines[i].split("|").slice(1, -1).map(c => `<td class="px-2 py-1 border-b border-gray-100">${inline(c.trim())}</td>`).join("") + "</tr>");
        i++;
      }
      out.push(`<div class="overflow-x-auto my-3"><table><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`);
      continue;
    }
    if (/^### /.test(l)) out.push(`<h3 class="text-base font-bold mt-5 mb-1">${inline(l.slice(4))}</h3>`);
    else if (/^## /.test(l)) out.push(`<h2 class="text-lg font-bold mt-6 mb-2">${inline(l.slice(3))}</h2>`);
    else if (/^# /.test(l)) out.push(`<h1 class="text-xl font-bold mb-2">${inline(l.slice(2))}</h1>`);
    else if (/^- /.test(l)) out.push(`<div class="ml-4 text-sm text-gray-800 py-0.5">&bull; ${inline(l.slice(2))}</div>`);
    else if (/^---/.test(l)) out.push('<hr class="my-4 border-gray-200" />');
    else if (l.trim()) out.push(`<p class="text-sm text-gray-800 py-0.5">${inline(l)}</p>`);
    i++;
  }
  return out.join("\n");
}
