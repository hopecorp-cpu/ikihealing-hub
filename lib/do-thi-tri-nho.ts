import "server-only";
import { getServiceClient } from "@/lib/supabase-server";
import { AGENTS } from "@/lib/ai-map";
import { KHO_RIENG_CEO } from "@/lib/covan/rag";
import { SKILL_DECLS, QUYEN_SKILL } from "@/lib/brain-skills";
import { getFails } from "@/lib/campaign-memory";
import { listViecMay } from "@/lib/viec-may";
import { lamSachCanh, type Canh, type DoThi, type Nut } from "@/lib/do-thi-tri-nho-core";

const TEN_KHO: Record<string, string> = {
  core: "Playbook tăng trưởng", khoinghiep: "Khởi nghiệp", quantri: "Quản trị", scale: "Mở rộng quy mô",
  kenh: "Kênh bán & kịch bản từ chối", ruiro: "Rủi ro (vá lu)", taichinh: "Tài chính doanh nghiệp",
  dinhduong: "Dinh dưỡng", coaching: "Coaching", hdqt: "Hội đồng quản trị", taichinhcanhan: "Tài chính cá nhân CEO",
  goivon: "Gọi vốn thực chiến", "4hethong": "Bốn hệ thống", caykinhdoanh: "Cây kinh doanh", dockhach: "Đọc khách (DISC)",
  congthuc: "Công thức", dungnguoi: "Dùng người", bailam: "Bài làm", tochuc: "Tổ chức", discphongban: "DISC phòng ban",
  thansohoc: "Thần số học", phapnhan: "Pháp nhân & hợp đồng", luatkinhdoanh: "Luật kinh doanh", sanpham: "Sản phẩm",
  nhacungcap: "Nhà cung cấp & đại lý", khoahoc: "Khoá học", kenhnguoidan: "Kênh người dân", cochethuong: "Cơ chế thưởng",
  lichsuquyetdinh: "Lịch sử quyết định", luathethong: "Luật hệ thống", tamlyhanhvi: "Tâm lý hành vi MKT & sale",
};

const KHO_CHO_AGENT: Record<string, string[]> = { kenh: ["catruc"], dockhach: ["catruc"], tamlyhanhvi: ["catruc", "content"] };

const BI_DANH_HOC: Record<string, string> = { "may-truc": "catruc", director: "report", "the-gioi": "hocthegioi" };

const BO_QUA_KHO = new Set(["baihoc"]);

const rut = (s: string, n = 160) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export async function docDoThiTriNho(opts: { laAdmin: boolean }): Promise<DoThi> {
  const sb = getServiceClient();
  const nut: Nut[] = [];
  const canh: Canh[] = [];
  const nguonHong: string[] = [];
  const thu = async (ten: string, f: () => Promise<void>) => { try { await f(); } catch (e: any) { console.error(`[tri-nho] ${ten}:`, e?.message || e); nguonHong.push(ten); } };

  const theoRunKey = new Map<string, string>();
  for (const a of AGENTS) {
    nut.push({ id: `agent:${a.id}`, vung: "agent", ten: a.name, tom: a.role, link: a.link || null });
    if (a.runKey) theoRunKey.set(a.runKey, a.id);

    if (!a.hub) { const hub = AGENTS.find((x) => x.hub); if (hub) canh.push([`agent:${a.id}`, `agent:${hub.id}`]); }
  }
  const coAgent = (id: string) => AGENTS.some((a) => a.id === id);

  await Promise.all([

    thu("Kho cố vấn", async () => {
      const ma = Object.keys(TEN_KHO);
      const dem = await Promise.all(ma.map(async (k) => {
        const { count, error } = await sb.from("covan_knowledge").select("id", { count: "exact", head: true }).eq("source", k);
        if (error) throw new Error(error.message);
        return [k, count || 0] as const;
      }));
      for (const [k, so] of dem) {
        if (BO_QUA_KHO.has(k) || !so) continue;
        if (!opts.laAdmin && KHO_RIENG_CEO.includes(k)) continue;
        nut.push({ id: `kho:${k}`, vung: "kho", ten: TEN_KHO[k] || k, tom: `${so} đoạn đã nạp RAG${KHO_RIENG_CEO.includes(k) ? " · chỉ CEO đọc" : ""}`, so });
        canh.push([`kho:${k}`, "agent:report"]);
        for (const ag of KHO_CHO_AGENT[k] || []) canh.push([`kho:${k}`, `agent:${ag}`]);
      }
    }),

    thu("Bài học agent", async () => {
      const { data, error } = await sb.from("config").select("key,value").like("key", "agent_learnings_%").limit(100);
      if (error) throw new Error(error.message);
      for (const r of data || []) {
        const khoa = String(r.key).slice("agent_learnings_".length);
        const ag = BI_DANH_HOC[khoa] || khoa;
        let items: { lesson: string; kind: string; at: string }[] = [];
        try { items = JSON.parse(r.value || "{}")?.items || []; } catch { continue; }
        items.slice(0, 8).forEach((it, i) => {
          const id = `baihoc:${khoa}:${i}`;
          const loai = it.kind === "win" ? "Đã thắng" : it.kind === "fail" ? "Đã hỏng" : "Ghi nhận";
          nut.push({ id, vung: "baihoc", ten: rut(it.lesson, 70), tom: `${loai} · ${rut(it.lesson, 220)}`, luc: it.at, hong: it.kind === "fail" });
          if (coAgent(ag)) canh.push([id, `agent:${ag}`]);
        });
      }
    }),

    thu("Bài học cố vấn", async () => {
      const { data, error } = await sb.from("covan_knowledge").select("chunk_index,content,created_at").eq("source", "baihoc").order("created_at", { ascending: false }).limit(30);
      if (error) throw new Error(error.message);
      for (const r of data || []) {
        const id = `bhcv:${r.chunk_index}`;
        nut.push({ id, vung: "baihoc_covan", ten: rut(r.content, 70), tom: rut(r.content, 260), luc: r.created_at });
        canh.push([id, "agent:report"]);
      }
    }),

    thu("Bài bị loại", async () => {
      const fails = await getFails();
      fails.slice(0, 25).forEach((f, i) => {
        const id = `fail:${i}`;
        nut.push({ id, vung: "nho_fail", ten: rut(f.title, 70), tom: `Lý do: ${rut(f.reason, 200)}`, luc: f.at, hong: true });
        canh.push([id, "agent:campaign_memory"], [id, "agent:content"]);
      });
    }),

    thu("Nhật ký máy", async () => {
      const ds = await listViecMay({ limit: 40 });
      for (const r of ds) {
        const id = `run:${r.id}`;
        const kq = r.trang_thai === "hong" ? "HỎNG" : r.trang_thai === "khong_co_gi" ? "ra 0" : r.so_luong ? `${r.so_luong} ${r.don_vi || ""}`.trim() : "xong";
        nut.push({ id, vung: "nhatky", ten: rut(`${r.agent_ten || r.agent}: ${r.viec}`, 70), tom: `${rut(r.viec, 180)} → ${kq}`, luc: r.created_at, link: r.link || null, hong: r.trang_thai === "hong" });
        const ag = theoRunKey.get(r.agent) || (coAgent(r.agent) ? r.agent : null);
        if (ag) canh.push([id, `agent:${ag}`]);
      }
    }),
  ]);

  const QUYEN: Record<string, string> = { mo: "ai cũng gọi được", quanly: "quản lý trở lên", ceo: "chỉ CEO" };
  for (const k of SKILL_DECLS) {
    const id = `skill:${k.name}`;
    nut.push({ id, vung: "kynang", ten: k.name.replace(/_/g, " "), tom: `${rut(k.description, 200)} · Quyền: ${QUYEN[QUYEN_SKILL[k.name]] || "chưa khai"}` });
    canh.push([id, "agent:report"]);
  }

  return { nut, canh: lamSachCanh(nut, canh), nguonHong };
}
