"use client";

import { useLang } from "@/components/lang-provider";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Clock, Phone, Copy, Check, ExternalLink, AlertTriangle, Users,
  ShoppingBag, Heart, UserCog, ClipboardList, Loader2, MessageSquare, WifiOff,
  CheckSquare, PhoneCall, Send, Activity, Gift, X, Tag, Undo2, Flame, FileText, Sparkles, Paperclip,
} from "lucide-react";
import { ZaloThanhTren, ZaloMenuNgang } from "../ZaloMobile";
import seedingPlan from "@/data/seeding-plan.json";
import {
  chuDau, doTre, gioVN, ngayVN, tienVN, NHAN_THE, tachLink,
  type HopThuKhach, type HopThuNick, type HopThuTin, type HoSoKhach, type TrangThaiKho,
  type HoatDong, type TheKhach, chamDiemKhach, mucDiem,
} from "@/lib/hop-thu-zalo";

type Loc = "moi" | "tat-ca" | "dang-cho" | "cua-toi" | "chua-doc" | "nhom" | "nong" | "thu-hoi";

const NGUONG_MOI = 7 * 24;
const NGUONG_CU = 30 * 24;

const khoa = (k: { ownId: string; uid: string } | null) => (k ? `${k.ownId}|${k.uid}` : "");

export default function HopThuClient({
  khach, nick, kho, quanLy, toi, banDau,
}: {
  khach: HopThuKhach[];
  nick: HopThuNick[];
  kho: TrangThaiKho;
  quanLy: boolean;
  toi: string;

  banDau?: { khach: HopThuKhach; tin: HopThuTin[]; hoSo: HoSoKhach; hoatDong: HoatDong[] } | null;
}) {
  const { t: tDich } = useLang();
  const [loc, setLoc] = useState<Loc>("moi");

  const [nickLoc, setNickLoc] = useState<string>("");
  const [q, setQ] = useState("");
  const [chon, setChon] = useState<HopThuKhach | null>(banDau?.khach ?? null);
  const [tin, setTin] = useState<HopThuTin[]>(banDau?.tin ?? []);
  const [hoSo, setHoSo] = useState<HoSoKhach | null>(banDau?.hoSo ?? null);
  const [hoatDong, setHoatDong] = useState<HoatDong[]>(banDau?.hoatDong ?? []);
  const [oViec, setOViec] = useState(false);
  const [bao, setBao] = useState("");
  const [bangNhan, setBangNhan] = useState<{ id: number; ten: string; mau: string | null }[]>([]);
  const [moNhan, setMoNhan] = useState(false);
  const [nhanMoi, setNhanMoi] = useState("");
  const [nhanTaiCho, setNhanTaiCho] = useState<Record<string, string[]>>({});

  const daNap = useRef(khoa(banDau?.khach ?? null));
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");
  const [daCopy, setDaCopy] = useState("");
  const cuoiRef = useRef<HTMLDivElement>(null);

  const [rongTrai, setRongTrai] = useState(336);
  const [rongPhai, setRongPhai] = useState(312);
  const [manLon, setManLon] = useState(false);
  const keoRef = useRef<{ ben: "trai" | "phai"; x0: number; w0: number } | null>(null);
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("hopthu_cot") || "{}");
      if (c.trai >= 240) setRongTrai(c.trai); if (c.phai >= 220) setRongPhai(c.phai);
    } catch {  }
    const doMan = () => setManLon(window.innerWidth >= 1024);
    doMan(); window.addEventListener("resize", doMan);
    const keo = (e: MouseEvent) => {
      const k = keoRef.current; if (!k) return;
      const dx = e.clientX - k.x0;
      if (k.ben === "trai") setRongTrai(Math.min(560, Math.max(240, k.w0 + dx)));
      else setRongPhai(Math.min(520, Math.max(220, k.w0 - dx)));
    };
    const tha = () => {
      if (!keoRef.current) return;
      keoRef.current = null; document.body.style.cursor = ""; document.body.style.userSelect = "";
      setRongTrai((t) => { setRongPhai((p) => { try { localStorage.setItem("hopthu_cot", JSON.stringify({ trai: t, phai: p })); } catch {} return p; }); return t; });
    };
    window.addEventListener("mousemove", keo); window.addEventListener("mouseup", tha);
    return () => { window.removeEventListener("resize", doMan); window.removeEventListener("mousemove", keo); window.removeEventListener("mouseup", tha); };
  }, []);
  const batDauKeo = (ben: "trai" | "phai") => (e: React.MouseEvent) => {
    keoRef.current = { ben, x0: e.clientX, w0: ben === "trai" ? rongTrai : rongPhai };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
  };
  const ThanhKeo = ({ ben }: { ben: "trai" | "phai" }) => (
    <div
      onMouseDown={batDauKeo(ben)}
      onDoubleClick={() => (ben === "trai" ? setRongTrai(336) : setRongPhai(312))}
      title={tDich("Kéo để chỉnh bề rộng · bấm đúp để về mặc định")}
      className="group absolute inset-y-0 z-20 hidden w-2 -translate-x-1/2 cursor-col-resize lg:block"
      style={ben === "trai" ? { left: rongTrai } : { right: rongPhai - 4 }}
    >
      <div className="mx-auto h-full w-px bg-transparent transition group-hover:bg-[#0068FF]/60" />
    </div>
  );

  const nickTheoId = useMemo(
    () => Object.fromEntries(nick.map((n) => [n.ownId, n])),
    [nick]
  );
  const nickChet = nick.filter((n) => n.song === false);

  const diemCua = useMemo(() => {
    const m = new Map<string, { diem: number; lyDo: string[] }>();
    for (const k of khach) m.set(`${k.ownId}|${k.uid}`, chamDiemKhach(k));
    return m;
  }, [khach]);
  const soNong = useMemo(() => khach.filter((k) => !k.laNhom && (diemCua.get(`${k.ownId}|${k.uid}`)?.diem ?? 0) >= 70).length, [khach, diemCua]);

  const hien = useMemo(() => {
    const tuKhoa = q.trim().toLowerCase();
    const ds = khach.filter((k) => {
      if (nickLoc && k.ownId !== nickLoc) return false;
      if (loc !== "nhom" && loc !== "thu-hoi" && k.laNhom) return false;
      if (loc === "nhom" && !k.laNhom) return false;
      if (loc === "dang-cho" && !k.dangCho) return false;
      if (loc === "chua-doc" && !k.chuaDoc) return false;
      if (loc === "moi" && !(k.dangCho && (k.choGio ?? 1e9) <= NGUONG_MOI)) return false;
      if (loc === "cua-toi" && String(k.sale || "").toLowerCase() !== toi.toLowerCase()) return false;
      if (loc === "nong" && (diemCua.get(`${k.ownId}|${k.uid}`)?.diem ?? 0) < 70) return false;
      if (loc === "thu-hoi" && !k.thuHoiSo) return false;
      if (!tuKhoa) return true;
      return `${k.ten} ${k.phone || ""} ${k.cauCuoi}`.toLowerCase().includes(tuKhoa);
    });

    if (loc === "nong") return [...ds].sort((a, b) => (diemCua.get(`${b.ownId}|${b.uid}`)?.diem ?? 0) - (diemCua.get(`${a.ownId}|${a.uid}`)?.diem ?? 0));
    if (loc === "thu-hoi") return [...ds].sort((a, b) => String(b.thuHoiLuc || "").localeCompare(String(a.thuHoiLuc || "")));
    return ds;
  }, [khach, loc, q, toi, diemCua, nickLoc]);

  const le = khach.filter((k) => !k.laNhom);
  const cho = le.filter((k) => k.dangCho);
  const soDangCho = cho.length;
  const soMoi = cho.filter((k) => (k.choGio ?? 1e9) <= NGUONG_MOI).length;
  const soThuHoi = khach.filter((k) => k.thuHoiSo > 0).length;
  const soCu = cho.filter((k) => (k.choGio ?? 0) > NGUONG_CU).length;
  const soChuaDoc = le.filter((k) => k.chuaDoc).length;
  const soNhom = khach.filter((k) => k.laNhom).length;

  useEffect(() => {
    if (!chon) return;
    if (daNap.current === khoa(chon)) return;
    daNap.current = khoa(chon);
    let huy = false;
    setDangTai(true); setLoi(""); setTin([]); setHoSo(null); setHoatDong([]);
    const p = new URLSearchParams({ own: chon.ownId, uid: chon.uid, ten: chon.ten });
    if (chon.phone) p.set("phone", chon.phone);
    fetch(`/api/hop-thu-zalo/doan-chat?${p}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.loi || `Lỗi ${r.status}`);
        return j;
      })
      .then((j) => {
        if (huy) return;
        setTin(j.tin || []); setHoSo(j.hoSo || null); setHoatDong(j.hoatDong || []);
      })
      .catch((e) => { if (!huy) setLoi(String(e.message || e)); })
      .finally(() => { if (!huy) setDangTai(false); });
    return () => { huy = true; };
  }, [chon]);

  const [dangTaiThem, setDangTaiThem] = useState(false);
  const [hetTinCu, setHetTinCu] = useState(false);
  async function taiThemTinCu() {
    if (!chon || dangTaiThem || hetTinCu) return;
    const cuNhat = tin.find((t) => t.luc)?.luc;
    if (!cuNhat) return;
    setDangTaiThem(true);
    try {
      const p = new URLSearchParams({ own: chon.ownId, uid: chon.uid, truoc: cuNhat });
      const r = await fetch(`/api/hop-thu-zalo/doan-chat?${p}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.loi || `Lỗi ${r.status}`);
      const them: HopThuTin[] = j.tin || [];
      if (!them.length) { setHetTinCu(true); return; }
      setTin((cu) => [...them, ...cu]);
    } catch (e: any) {
      setLoi(String(e?.message || e));
    } finally { setDangTaiThem(false); }
  }

  useEffect(() => { setHetTinCu(false); }, [chon]);

  const [tuCapNhat, setTuCapNhat] = useState(true);
  const [dayHong, setDayHong] = useState(false);
  const mocDs = useRef<string>(new Date().toISOString());
  const truotLienTiep = useRef(0);

  useEffect(() => {
    if (!tuCapNhat) return;
    let dungLai = false;

    async function motLuot() {
      if (dungLai || document.visibilityState !== "visible") return;
      try {
        const p = new URLSearchParams({ tuLuc: mocDs.current });
        const tinCuoi = tin.length ? tin[tin.length - 1].luc : null;
        if (chon && tinCuoi) { p.set("own", chon.ownId); p.set("uid", chon.uid); p.set("sau", tinCuoi); }
        const r = await fetch(`/api/hop-thu-zalo/moi?${p}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.loi || `Lỗi ${r.status}`);
        if (dungLai) return;

        truotLienTiep.current = 0;
        setDayHong(false);
        mocDs.current = j.luc || mocDs.current;

        if (Array.isArray(j.tin) && j.tin.length) {
          setTin((cu) => {
            const da = new Set(cu.map((t) => t.id));
            const them = (j.tin as HopThuTin[]).filter((t) => !da.has(t.id));
            return them.length ? [...cu, ...them] : cu;
          });
        }

      } catch {
        truotLienTiep.current += 1;
        if (truotLienTiep.current >= 3 && !dungLai) setDayHong(true);
      }
    }

    const h = setInterval(motLuot, 10000);
    const khiHien = () => { if (document.visibilityState === "visible") motLuot(); };
    document.addEventListener("visibilitychange", khiHien);
    return () => { dungLai = true; clearInterval(h); document.removeEventListener("visibilitychange", khiHien); };
  }, [tuCapNhat, chon, tin]);

  useEffect(() => { cuoiRef.current?.scrollIntoView({ block: "end" }); }, [tin]);

  useEffect(() => {
    fetch("/api/hop-thu-zalo/nhan").then((r) => r.json()).then((j) => setBangNhan(j?.nhan || [])).catch(() => {});
  }, []);

  const doiNhan = async (ten: string, bat: boolean) => {
    if (!chon) return;
    const key = khoa(chon);
    const hienTai = nhanTaiCho[key] ?? chon.nhanSale;

    setNhanTaiCho((m) => ({ ...m, [key]: bat ? [...hienTai, ten] : hienTai.filter((x) => x !== ten) }));
    try {
      const r = await fetch("/api/hop-thu-zalo/nhan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ own: chon.ownId, uid: chon.uid, ten, bat }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.loi || `Lỗi ${r.status}`);
      setNhanTaiCho((m) => ({ ...m, [key]: j.nhan || [] }));
      setBao(bat ? `Đã gắn "${ten}"` : `Đã gỡ "${ten}"`);
      if (bat && !bangNhan.some((n) => n.ten.toLowerCase() === ten.toLowerCase())) {
        fetch("/api/hop-thu-zalo/nhan").then((r) => r.json()).then((j2) => setBangNhan(j2?.nhan || [])).catch(() => {});
      }
    } catch (e: any) {
      setNhanTaiCho((m) => ({ ...m, [key]: hienTai }));
      setBao("Không đổi được nhãn: " + String(e.message || e));
    }
    setTimeout(() => setBao(""), 3000);
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setDaCopy(key);
      setTimeout(() => setDaCopy(""), 2000);
    } catch {  }
  };

  const cauKhachHoi = [...tin].reverse().find((t) => t.huong === "in")?.noiDung || "";

  const [soan, setSoan] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [loiGui, setLoiGui] = useState("");

  const [choTuChoi, setChoTuChoi] = useState(false);
  const guiTin = async (boQuaTuChoi = false) => {
    if (!chon || !soan.trim() || dangGui) return;
    const noiDung = soan.trim();
    setDangGui(true); setLoiGui(""); setChoTuChoi(false);
    try {
      const r = await fetch("/api/hop-thu-zalo/gui", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ own: chon.ownId, uid: chon.uid, noiDung, ...(boQuaTuChoi ? { boQuaTuChoi: true } : {}) }),
      });
      const j = await r.json();
      if (r.status === 409 && j?.tuChoi) { setChoTuChoi(true); throw new Error(j.loi); }
      if (!r.ok) throw new Error(j?.loi || `Lỗi ${r.status}`);
      setTin((cu) => [...cu, { id: j.id, huong: "out", noiDung, luc: j.luc, dangGui: true }]);
      setSoan("");
    } catch (e: any) {
      setLoiGui(String(e.message || e));
    } finally { setDangGui(false); }
  };
  const nickDangOff = !!chon && nickTheoId[chon.ownId]?.song === false;

  const [mauTin, setMauTin] = useState<{ id: string; ten: string; noiDung: string; nhom: string; ngung?: boolean }[]>([]);
  const [moMau, setMoMau] = useState(false);
  useEffect(() => { fetch("/api/hop-thu-zalo/mau-tin").then((r) => r.json()).then((j) => setMauTin((j?.mau || []).filter((m: any) => !m.ngung))).catch(() => {}); }, []);
  const tenGoi = (t: string) => { const p = String(t || "").replace(/\d[\d .-]{7,}/g, "").trim().split(/\s+/); return p[p.length - 1] || "chị"; };
  const chenVaoOSoan = (txt: string) => {
    const t = txt.replace(/\{ten\}/g, chon ? tenGoi(chon.ten) : "chị");
    setSoan((cu) => (cu.trim() ? cu + "\n" + t : t)); setMoMau(false);
  };

  const goiYKichBan = useMemo(() => {
    const care = hoSo?.care; if (!care?.flow) return null;
    const cf: any = (seedingPlan as any).careFlows || {};

    const buoc: any[] = (cf[care.flow] || []).filter((b: any) => Number.isFinite(Number(b.day)) && b.message); if (!buoc.length) return null;
    const ngay = care.ngay ?? 0;
    let chon: any = buoc[0];
    for (const b of buoc) if (Number(b.day) <= ngay) chon = b;
    return {
      flow: care.flow, day: chon.day, goal: chon.goal, message: chon.message as string,
      huongDan: (chon.huongDan || "") as string,
      neuKhach: (Array.isArray(chon.neuKhach) ? chon.neuKhach : []) as { khach: string; dap: string }[],
    };
  }, [hoSo]);
  const diemChon = chon ? chamDiemKhach(chon) : null;

  const hanhDong = async (than: Record<string, unknown>, khiXong: string) => {
    if (!chon) return;
    setBao("...");
    try {
      const r = await fetch("/api/hop-thu-zalo/hanh-dong", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ own: chon.ownId, uid: chon.uid, ten: chon.ten, phone: chon.phone, sale: chon.sale, ...than }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.loi || `Lỗi ${r.status}`);
      setBao(khiXong);
      if (than.viec === "ghi-cham") {
        setHoatDong((cu) => [{
          luc: new Date().toISOString(), loai: than.kieu === "call" ? "goi" : "cham",
          tieuDe: than.kieu === "call" ? "Gọi điện" : "Chăm sóc qua zalo",
          chiTiet: (than.ghiChu as string) || null, nguoi: toi,
        }, ...cu]);
      }
    } catch (e: any) {
      setBao("Không ghi được: " + String(e.message || e));
    }
    setTimeout(() => setBao(""), 4000);
  };

  return (
    <div className="flex h-full flex-col">
      {!chon && <ZaloThanhTren tieuDe={tDich("Tin nhắn")} />}
      {!chon && <ZaloMenuNgang />}
      <div className="hidden items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-4 py-1.5 text-[11px] lg:flex">
        <span className="text-slate-500">
          {khach.length} {tDich("hội thoại ·")} <span className="font-medium text-rose-600">{soMoi} {tDich("cần trả lời trong tuần")}</span>
          {" · "}{soDangCho} {tDich("đang chờ tính cả tồn đọng")}{soCu > 0 ? ` (${soCu} người đã quá 30 ngày)` : ""}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            kho.ok && (kho.gioTre ?? 99) < 6
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
          title={tDich(kho.note) || ""}
        >
          <Clock className="h-3.5 w-3.5" />
          {kho.at ? `Kho cập nhật ${doTre(kho.gioTre)} trước` : tDich("Kho chưa có lượt đổ nào")}
          {dayHong ? (
            <span className="ml-2 font-medium text-rose-600" title={tDich("Ba lượt làm mới liên tiếp đều trượt — tin mới có thể không hiện. Tải lại trang.")}>
              {tDich("· tự cập nhật ĐANG HỎNG")}
            </span>
          ) : (
            <span className="ml-2 text-emerald-600" title={tDich("Màn hình tự xin tin mới 10 giây một lượt, không cần F5")}>
              {tDich("· tự cập nhật 10s")}
            </span>
          )}
        </span>
        {nickChet.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
            <WifiOff className="h-3.5 w-3.5" />
            {nickChet.length} {tDich("nick mất kết nối:")} {nickChet.map((n) => n.sale || n.ownId).join(", ")}
          </span>
        )}
      </div>

      <div
        className="relative grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[21rem_minmax(0,1fr)_19.5rem]"
        style={manLon ? { gridTemplateColumns: `${rongTrai}px minmax(0,1fr) ${rongPhai}px` } : undefined}
      >
        <ThanhKeo ben="trai" />
        <ThanhKeo ben="phai" />
        <aside className={`flex min-h-0 flex-col border-r border-slate-200 bg-white ${chon ? "hidden lg:flex" : "flex"}`}>
          <div className="hidden items-center justify-between gap-2 px-4 pt-4 lg:flex">
            <h2 className="text-lg font-bold text-slate-900">{tDich("Tin nhắn")}</h2>
            {nick.length > 1 && (
              <select value={nickLoc} onChange={(e) => setNickLoc(e.target.value)} title={tDich("Lọc theo tài khoản Zalo")}
                className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0068FF]">
                <option value="">{tDich("Tất cả tài khoản (")}{nick.length})</option>
                {nick.map((n) => (
                  <option key={n.ownId} value={n.ownId}>{n.song === false ? "(OFF) " : ""}{n.tenZalo || n.sale || n.ownId}{n.sale && n.tenZalo ? ` · ${n.sale}` : ""}</option>
                ))}
              </select>
            )}
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0068FF] text-white" title={tDich("Soạn tin — chưa mở (máy chưa cầm đường gửi)")}><MessageSquare className="h-4 w-4" /></span>
          </div>
          <div className="space-y-2 border-b border-slate-100 p-3">
            {nick.length > 1 && (
              <select value={nickLoc} onChange={(e) => setNickLoc(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 lg:hidden">
                <option value="">{tDich("Tất cả tài khoản (")}{nick.length})</option>
                {nick.map((n) => <option key={n.ownId} value={n.ownId}>{n.song === false ? "(OFF) " : ""}{n.tenZalo || n.sale || n.ownId}</option>)}
              </select>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tDich("Tìm kiếm trong tin nhắn")}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-300 focus:bg-white"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {([
                ["tat-ca", `Tất cả (${le.length})`],
                ...(soNong ? [["nong", `Nóng (${soNong})`] as const] : []),
                ...(soChuaDoc ? [["chua-doc", `Chưa đọc (${soChuaDoc})`] as const] : []),
                ...(quanLy ? [] : [["cua-toi", tDich("Cá nhân")] as const]),
                ...(soNhom ? [["nhom", `Nhóm (${soNhom})`] as const] : []),
                ...(soThuHoi ? [["thu-hoi", `Thu hồi (${soThuHoi})`] as const] : []),
                ["moi", `Chờ trong tuần (${soMoi})`],
                ["dang-cho", `Cả tồn (${soDangCho})`],
              ] as const).map(([k, nhan]) => (
                <button
                  key={k}
                  onClick={() => setLoc(k as Loc)}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    loc === k ? "bg-[#0068FF] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {nhan}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {hien.length === 0 && (
              <p className="p-4 text-sm text-slate-500">{tDich("Không có hội thoại nào khớp bộ lọc.")}</p>
            )}
            {hien.map((k) => {
              const n = nickTheoId[k.ownId];
              const dangChon = chon?.ownId === k.ownId && chon?.uid === k.uid;
              return (
                <button
                  key={`${k.ownId}|${k.uid}`}
                  onClick={() => setChon(k)}
                  className={`flex w-full gap-2.5 border-b border-slate-50 p-3 text-left transition hover:bg-slate-50 ${
                    dangChon ? "bg-[#EAF2FF] hover:bg-[#EAF2FF]" : ""
                  }`}
                >
                  <span className={`relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold ${
                    k.laNhom ? "bg-indigo-100 text-indigo-700" : "bg-[#DCEBFF] text-[#0068FF]"
                  }`}>
                    {k.laNhom ? <Users className="h-4 w-4" /> : chuDau(tDich(k.ten))}
                    {k.anh && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={k.anh} alt="" loading="lazy" referrerPolicy="no-referrer"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        className="absolute inset-0 h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{tDich(k.ten)}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">{doTre(k.choGio ?? null) || ""}</span>
                        {k.chuaDoc > 0 && (
                          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                            {k.chuaDoc > 99 ? "99+" : k.chuaDoc}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      {k.huongCuoi === "out" && <span className="text-slate-400">{tDich("Mình:")}</span>}
                      <span className="truncate">{k.cauCuoi || tDich("(chưa có nội dung)")}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {(() => { const d = diemCua.get(`${k.ownId}|${k.uid}`); const mu = d ? mucDiem(d.diem) : "nguoi";
                        return d && !k.laNhom && mu !== "nguoi" ? (
                          <span title={d.lyDo.join(" · ")} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${mu === "nong" ? "bg-orange-100 text-orange-700" : "bg-amber-50 text-amber-700"}`}>
                            <Flame className="h-2.5 w-2.5" /> {d.diem}
                          </span>) : null; })()}
                      {k.dangCho && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">{tDich("Đang chờ")}</span>
                      )}
                      {k.thuHoiSo > 0 && (
                        <span title={`${k.thuHoiSo} tin đã bị thu hồi — nội dung gốc vẫn xem được trong hội thoại`}
                          className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 ring-1 ring-inset ring-rose-200">
                          <Undo2 className="h-2.5 w-2.5" /> {k.thuHoiSo}
                        </span>
                      )}
                      {k.the.map((t) => (
                        <span key={t} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${NHAN_THE[t as TheKhach]?.lop || ""}`}>
                          {NHAN_THE[t as TheKhach]?.chu || t}
                        </span>
                      ))}
                      {k.nhanSale.slice(0, 2).map((t) => (
                        <span key={t} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">{t}</span>
                      ))}
                      {n?.song === false && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Nick OFF</span>
                      )}
                      {quanLy && k.sale && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{k.sale}</span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={`flex min-h-0 flex-col bg-white ${chon ? "flex" : "hidden lg:flex"}`}>
          {!chon ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">{tDich("Chọn một hội thoại bên trái để đọc.")}</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-blue-100 bg-[#F3F8FF] p-3">
                <button onClick={() => setChon(null)} className="text-sm text-slate-500 lg:hidden">{tDich("Quay lại")}</button>
                <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0068FF] text-xs font-semibold text-white">
                  {chuDau(tDich(chon.ten))}
                  {chon.anh && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={chon.anh} alt="" referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{tDich(chon.ten)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {chon.phone || tDich("chưa có số")}
                    {chon.sale ? ` · nick ${chon.sale}` : ""}
                    {chon.dangCho && chon.choGio != null ? ` · khách chờ ${doTre(chon.choGio)}` : ""}
                  </p>
                </div>
                {diemChon && !chon.laNhom && (
                  <span title={diemChon.lyDo.join(" · ") || tDich("chưa có tín hiệu")} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${mucDiem(diemChon.diem) === "nong" ? "bg-orange-100 text-orange-700" : mucDiem(diemChon.diem) === "am" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    <Flame className="h-3.5 w-3.5" /> {diemChon.diem} {tDich("điểm")}
                  </span>
                )}
                {nickTheoId[chon.ownId]?.song === false && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> {tDich("Nick mất kết nối")}
                  </span>
                )}
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
                {dangTai && (
                  <p className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> {tDich("Đang tải đoạn chat...")}
                  </p>
                )}
                {loi && (
                  <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{tDich("Không tải được đoạn chat:")} {loi}</p>
                )}
                {!dangTai && !loi && tin.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">
                    {tDich("Kho chưa có tin của hội thoại này. Chạy lại máy đổ nếu cần:")} <code className="rounded bg-slate-200 px-1">node scripts/zalo-hop-thu.mjs</code>
                  </p>
                )}
                {tin.length >= 200 && (
                  <div className="py-2 text-center">
                    <button type="button" onClick={taiThemTinCu} disabled={dangTaiThem}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#0068FF] hover:text-[#0068FF] disabled:opacity-50">
                      {dangTaiThem ? tDich("Đang tải…") : hetTinCu ? tDich("Đã hết tin cũ") : tDich("Tải thêm tin cũ")}
                    </button>
                  </div>
                )}
                {tin.map((t, i) => {
                  const ngayNay = ngayVN(t.luc);
                  const ngayTruoc = i > 0 ? ngayVN(tin[i - 1].luc) : "";
                  return (
                    <div key={t.id}>
                      {ngayNay && ngayNay !== ngayTruoc && (
                        <p className="my-3 text-center text-[11px] font-medium text-slate-400">{ngayNay}</p>
                      )}
                      <div className={`flex ${t.huong === "out" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[70%] ${
                            t.huong === "out"
                              ? "rounded-br-sm bg-[#DCEBFF] text-slate-900"
                              : "rounded-bl-sm bg-white text-slate-800 shadow-sm"
                          } ${t.thuHoi ? "border border-dashed border-rose-300" : ""}`}
                        >
                          {t.thuHoi && (
                            <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600" title={`${t.thuHoi.boi || tDich("Người gửi")} đã thu hồi lúc ${gioVN(t.thuHoi.luc)} — kho vẫn giữ nội dung gốc`}>
                              <Undo2 className="h-3 w-3" /> {tDich("Đã thu hồi")} {gioVN(t.thuHoi.luc)}{t.thuHoi.boi ? ` · ${t.thuHoi.boi}` : ""} {tDich("— nội dung gốc:")}
                            </p>
                          )}
                          {t.media?.daTai && (t.media.loai === "anh" || t.media.loai === "sticker") ? (

                            <a href={`/api/hop-thu-zalo/anh?msg=${encodeURIComponent(t.id)}`} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={`/api/hop-thu-zalo/anh?msg=${encodeURIComponent(t.id)}&thumb=1`}
                                alt={tDich(t.media.ten) || tDich("Ảnh trong tin nhắn")}
                                loading="lazy"
                                className="max-h-64 w-auto rounded-lg border border-slate-200 object-contain"
                              />
                            </a>
                          ) : t.media?.daTai && t.media.loai === "video" ? (
                            <video src={`/api/hop-thu-zalo/anh?msg=${encodeURIComponent(t.id)}`} controls preload="none"
                              className="max-h-64 w-auto rounded-lg border border-slate-200" />
                          ) : t.media?.daTai && t.media.loai === "ghiam" ? (
                            <audio src={`/api/hop-thu-zalo/anh?msg=${encodeURIComponent(t.id)}`} controls preload="none" className="w-56" />
                          ) : t.media?.daTai ? (
                            <a href={`/api/hop-thu-zalo/anh?msg=${encodeURIComponent(t.id)}`} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 text-sm font-medium text-[#0068FF] underline">
                              <Paperclip className="h-3.5 w-3.5" /> {tDich(t.media.ten) || tDich("Tải tệp")}
                            </a>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">
                              {tachLink(tDich(t.noiDung)).map((m, j) =>
                                m.laLink ? (
                                  <a key={j} href={m.chu} target="_blank" rel="noreferrer noopener"
                                    className={`underline underline-offset-2 ${t.huong === "out" ? "text-[#0047B3]" : "text-[#0068FF]"}`}>
                                    {m.chu}
                                  </a>
                                ) : (
                                  <span key={j}>{m.chu}</span>
                                ),
                              )}
                            </p>
                          )}
                          {t.media && !t.media.daTai && (

                            <p className="mt-0.5 text-[10px] italic text-slate-400">
                              {t.media.quaTran
                                ? tDich("tệp quá lớn nên kho không giữ — mở Zalo để xem")
                                : t.media.loai === "sticker"
                                  ? tDich("sticker — Zalo không cho tải về")
                                  : tDich("tin cũ (trước 02/10/2026) — hồi đó kho chưa lưu tệp, nay link Zalo đã hết hạn")}
                            </p>
                          )}
                          <p className={`mt-1 flex items-center gap-1 text-[10px] ${t.huong === "out" ? "text-[#0068FF]/70" : "text-slate-400"}`}>
                            {gioVN(t.luc)}
                            {t.dangGui && <span className="inline-flex items-center gap-0.5 text-slate-500" title={tDich("Đang chờ cầu nối gửi")}><Clock className="h-3 w-3" /> {tDich("đang gửi")}</span>}
                            {t.guiLoi && <span className="inline-flex items-center gap-0.5 text-rose-600" title={tDich("Gửi hỏng — gửi tay trong Zalo")}><AlertTriangle className="h-3 w-3" /> {tDich("gửi hỏng")}</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={cuoiRef} />
              </div>

              <footer className="border-t border-slate-100 p-2.5">
                {moNhan && (
                  <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 lg:hidden">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{tDich("Gắn nhãn cho")} {tDich(chon.ten)}</p>
                    <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                      {bangNhan.map((n) => {
                        const co = (nhanTaiCho[khoa(chon)] ?? chon.nhanSale).includes(tDich(n.ten));
                        return (
                          <button key={n.id} onClick={() => doiNhan(tDich(n.ten), !co)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium shadow-sm ${co ? "bg-violet-600 text-white" : "border border-white bg-white text-slate-700"}`}
                            style={!co && n.mau ? { borderLeft: `3px solid ${n.mau}` } : undefined}>
                            {tDich(n.ten)}{co ? " ×" : ""}
                          </button>
                        );
                      })}
                    </div>
                    <form className="mt-1.5 flex gap-1" onSubmit={(e) => { e.preventDefault(); const t = nhanMoi.trim(); if (t) { doiNhan(t, true); setNhanMoi(""); } }}>
                      <input value={nhanMoi} onChange={(e) => setNhanMoi(e.target.value)} placeholder={tDich("Tạo nhãn mới rồi gắn...")} maxLength={40}
                        className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-[#0068FF]" />
                      <button type="submit" disabled={!nhanMoi.trim()} className="rounded bg-[#0068FF] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40">{tDich("+ Nhãn")}</button>
                    </form>
                  </div>
                )}
                {moMau && (
                  <div className="mb-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{tDich("Mẫu tin nhanh — bấm để chèn (")}{mauTin.length}{tDich(") · quản lý sửa ở mục Mẫu tin nhanh")}</p>
                    {!mauTin.length && <p className="text-xs text-slate-500">{tDich("Đang tải...")}</p>}
                    <div className="space-y-1">
                      {mauTin.map((m) => (
                        <button key={m.id} type="button" onClick={() => chenVaoOSoan(tDich(m.noiDung))} className="block w-full rounded-md border border-white bg-white px-2 py-1.5 text-left shadow-sm hover:border-[#0068FF]">
                          <span className="block text-xs font-semibold text-slate-800">{tDich(m.ten)} <span className="font-normal text-slate-400">· {tDich(m.nhom)}</span></span>
                          <span className="block truncate text-[11px] text-slate-500">{tDich(m.noiDung)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {goiYKichBan && !soan && (
                  <div className="mb-2">
                    <button type="button" onClick={() => chenVaoOSoan(goiYKichBan.message)}
                      className="flex w-full items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left hover:border-emerald-400" title={tDich("Câu theo kịch bản chăm sóc đang chạy — bấm để chèn, sửa rồi gửi")}>
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{tDich("Kịch bản")} {goiYKichBan.flow === "bought" ? "sau mua" : goiYKichBan.flow === "reorder" ? tDich("mua lại") : tDich("chưa mua")} {tDich("· ngày")} {goiYKichBan.day} · {tDich(goiYKichBan.goal)}</span>
                        <span className="block truncate text-xs text-emerald-900">{goiYKichBan.message}</span>
                      </span>
                    </button>
                    {(goiYKichBan.huongDan || goiYKichBan.neuKhach.length > 0) && (
                      <details className="mt-1 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-1.5">
                        <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          {tDich("Kịch bản chi tiết")}{goiYKichBan.neuKhach.length ? ` — ${goiYKichBan.neuKhach.length} nhánh khách hay nói` : ""}
                        </summary>
                        {goiYKichBan.huongDan && <p className="mt-1 text-[11px] italic text-emerald-900/80">{goiYKichBan.huongDan}</p>}
                        <div className="mt-1.5 space-y-1">
                          {goiYKichBan.neuKhach.map((n, i) => (
                            <button key={i} type="button" onClick={() => chenVaoOSoan(n.dap)}
                              className="block w-full rounded border border-emerald-200 bg-white px-2 py-1.5 text-left hover:border-emerald-400" title={tDich("Bấm để chèn câu đáp vào ô soạn — sửa rồi mới gửi")}>
                              <span className="block text-[10px] font-medium text-slate-500">{n.khach}</span>
                              <span className="block text-xs text-emerald-900">{n.dap}</span>
                            </button>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
                {loiGui && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{loiGui}</p>}
                {choTuChoi && (
                  <button type="button" onClick={() => guiTin(true)} className="mb-2 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                    {tDich("Khách đang hỏi, đây là câu trả lời — gửi")}
                  </button>
                )}
                {nickDangOff && !loiGui && (
                  <p className="mb-2 text-[11px] text-amber-700">{tDich("Nick này đang mất kết nối — tin sẽ nằm chờ, nick nối lại là gửi.")}</p>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex shrink-0 items-center gap-0.5 pb-1.5 text-slate-400">
                    <button type="button" onClick={() => setMoNhan((v) => !v)} className="rounded p-1.5 hover:bg-slate-100 hover:text-[#0068FF]" title={tDich("Gắn nhãn cho khách này")}><Tag className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setMoMau((v) => !v)} className={`rounded p-1.5 hover:bg-slate-100 hover:text-[#0068FF] ${moMau ? "text-[#0068FF]" : ""}`} title={tDich("Mẫu tin nhanh — chèn vào ô soạn")}><FileText className="h-4 w-4" /></button>
                    <button type="button" onClick={() => copy(cauKhachHoi, "cau")} disabled={!cauKhachHoi} className="hidden rounded p-1.5 hover:bg-slate-100 hover:text-[#0068FF] disabled:opacity-30 lg:block" title={tDich("Chép câu khách hỏi")}>
                      {daCopy === "cau" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                    {chon.phone && (
                      <button type="button" onClick={() => copy(chon.phone!, "sdt")} className="hidden rounded p-1.5 hover:bg-slate-100 hover:text-[#0068FF] lg:block" title={`Chép số ${chon.phone}`}>
                        {daCopy === "sdt" ? <Check className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                      </button>
                    )}
                    <a href="https://chat.zalo.me/" target="_blank" rel="noreferrer" className="hidden rounded p-1.5 hover:bg-slate-100 hover:text-[#0068FF] lg:block" title={tDich("Mở Zalo Web")}><ExternalLink className="h-4 w-4" /></a>
                  </div>
                  <textarea
                    value={soan}
                    onChange={(e) => setSoan(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); guiTin(); } }}
                    rows={1}
                    placeholder={tDich("Nhập tin nhắn...")}
                    className="max-h-32 min-h-[2.5rem] flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#0068FF] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => guiTin()}
                    disabled={!soan.trim() || dangGui}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#0068FF] px-4 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {dangGui ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {tDich("Gửi")}
                  </button>
                </div>
                <p className="mt-1.5 hidden text-[10px] text-slate-400 lg:block">{tDich("Enter gửi · Shift+Enter xuống dòng · tin đi qua cửa từ cấm thực phẩm bổ sung trước khi tới khách; cầu nối Zalo trên máy công ty gửi thật — chấm xám là đang chờ gửi.")}</p>
              </footer>
            </>
          )}
        </section>

        <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-slate-200 bg-white lg:flex">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{tDich("Thông tin khách hàng")}</h2>
          </div>
          {!chon ? (
            <p className="p-4 text-sm text-slate-500">{tDich("Hồ sơ khách hiện ở đây khi mở một hội thoại.")}</p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DCEBFF] text-sm font-bold text-[#0068FF]">
                  {chuDau(tDich(chon.ten))}
                  {chon.anh && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={chon.anh} alt="" referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{tDich(hoSo?.ten) || tDich(chon.ten)}</p>
                {chon.tenZalo && chon.tenZalo !== tDich(chon.ten) && (
                  <p className="text-[11px] text-slate-400">{tDich("Tên Zalo:")} {chon.tenZalo}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-500">{hoSo?.phone || chon.phone || tDich("chưa có số điện thoại")}</p>
                {chon.ngaySinh && <p className="text-xs text-slate-500">Sinh {chon.ngaySinh}</p>}
                {chon.trangThai && (
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-[11px] text-slate-500" title={chon.trangThai}>
                    {chon.trangThai}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {chon.the.map((t) => (
                    <span key={t} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${NHAN_THE[t as TheKhach]?.lop || ""}`}>
                      {NHAN_THE[t as TheKhach]?.chu || t}
                    </span>
                  ))}
                  {(nhanTaiCho[khoa(chon)] ?? chon.nhanSale).map((n) => (
                    <button
                      key={n}
                      onClick={() => doiNhan(n, false)}
                      title={tDich("Bấm để gỡ nhãn này")}
                      className="group inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 hover:bg-violet-100"
                    >
                      {n}<X className="h-2.5 w-2.5 opacity-40 group-hover:opacity-100" />
                    </button>
                  ))}
                  <button
                    onClick={() => setMoNhan((v) => !v)}
                    className="rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:border-[#0068FF] hover:text-[#0068FF]"
                  >
                    {tDich("+ Gắn nhãn")}
                  </button>
                  {chon.laBanBe && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-[#0068FF]">{tDich("Đã kết bạn")}</span>
                  )}
                  {!!hoSo?.tags?.length && hoSo.tags.slice(0, 4).map((t) => (
                    <span key={"ai-" + t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600" title={tDich("AI chấm tư vấn gắn")}>{t}</span>
                  ))}
                </div>
                </div>
                {moNhan && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {tDich("Nhãn — bấm để gắn")}{bangNhan.length ? "" : tDich(" (đang tải...)")}
                    </p>
                    <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                      {bangNhan
                        .filter((n) => !(nhanTaiCho[khoa(chon)] ?? chon.nhanSale).includes(tDich(n.ten)))
                        .map((n) => (
                          <button
                            key={n.id}
                            onClick={() => doiNhan(tDich(n.ten), true)}
                            className="rounded border border-white bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm hover:border-[#0068FF]"
                            style={n.mau ? { borderLeft: `3px solid ${n.mau}` } : undefined}
                          >
                            {tDich(n.ten)}
                          </button>
                        ))}
                    </div>
                    <form className="mt-1.5 flex gap-1" onSubmit={(e) => { e.preventDefault(); const t = nhanMoi.trim(); if (t) { doiNhan(t, true); setNhanMoi(""); } }}>
                      <input value={nhanMoi} onChange={(e) => setNhanMoi(e.target.value)} placeholder={tDich("Tạo nhãn mới rồi gắn...")} maxLength={40}
                        className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-[#0068FF]" />
                      <button type="submit" disabled={!nhanMoi.trim()} className="rounded bg-[#0068FF] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40">{tDich("+ Nhãn")}</button>
                    </form>
                    <p className="mt-1.5 text-[10px] text-slate-400">{tDich("Nhãn ghi vào kho ngay. Nhãn cũ của Salework vẫn dùng được; nhãn mới sống trong CRM.")}</p>
                  </div>
                )}
              </div>

              {!chon.phone && (
                <p className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500">
                  {tDich("Khách chưa để lại số nên chưa nối được sang đơn hàng. Đây là chuyện thường ở inbox, không phải lỗi.")}
                </p>
              )}

              {hoSo && hoSo.soDon > 0 && (
                <section>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <ShoppingBag className="h-3.5 w-3.5" /> {tDich("Đơn hàng")}
                  </p>
                  <p className="text-sm text-slate-900">
                    {hoSo.soDon} {tDich("đơn ·")} <span className="font-semibold">{tienVN(hoSo.tongChi)}đ</span>
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {hoSo.donGanDay.map((d, i) => (
                      <li key={i} className="text-[11px] text-slate-500">
                        <span className="text-slate-400">{d.ngay || "—"}</span> · {d.sanPham || tDich("(không rõ mặt hàng)")} · {tienVN(d.khachTra)}đ
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {hoSo?.care && (
                <section>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Heart className="h-3.5 w-3.5" /> {tDich("Chăm sóc")}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {hoSo.care.flow || "—"}{hoSo.care.ngay != null ? ` · ngày ${hoSo.care.ngay}` : ""}
                    {hoSo.care.trangThai ? ` · ${hoSo.care.trangThai}` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {tDich("Lần cuối")} {hoSo.care.lanCuoi || "—"} {tDich("· hạn kế")} {hoSo.care.hanKe || "—"}
                  </p>
                </section>
              )}

              {hoSo?.lead && (
                <section>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <ClipboardList className="h-3.5 w-3.5" /> Lead
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {hoSo.lead.nguon || "—"}{hoSo.lead.trangThai ? ` · ${hoSo.lead.trangThai}` : ""}
                  </p>
                </section>
              )}

              {hoSo?.diemTuVan != null && (
                <section>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <UserCog className="h-3.5 w-3.5" /> {tDich("AI chấm tư vấn")}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{hoSo.diemTuVan}/100</p>
                  {hoSo.nhuCau && <p className="mt-0.5 text-[11px] text-slate-500">{hoSo.nhuCau}</p>}
                </section>
              )}

              <section className="border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold text-slate-700">{tDich("Hành động nhanh")}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setOViec(true)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <CheckSquare className="h-3.5 w-3.5" /> {tDich("Tạo việc")}
                  </button>
                  <button
                    onClick={() => hanhDong({ viec: "ghi-cham", kieu: "message" }, tDich("Đã ghi lượt chăm"))}
                    disabled={!chon.phone}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    title={chon.phone ? "" : tDich("Khách chưa có số nên chưa ghi được")}
                  >
                    <Send className="h-3.5 w-3.5" /> {tDich("Đã nhắn")}
                  </button>
                  <button
                    onClick={() => hanhDong({ viec: "ghi-cham", kieu: "call" }, tDich("Đã ghi cuộc gọi"))}
                    disabled={!chon.phone}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> {tDich("Đã gọi")}
                  </button>
                  <button
                    onClick={() => hanhDong({ viec: "ghi-cham", kieu: "gift" }, tDich("Đã ghi tặng quà"))}
                    disabled={!chon.phone}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Gift className="h-3.5 w-3.5" /> {tDich("Tặng quà")}
                  </button>
                </div>
                {bao && (
                  <p className={`mt-2 rounded-lg px-2 py-1.5 text-[11px] ${
                    bao.startsWith("Không") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                  }`}>{bao}</p>
                )}
              </section>

              {hoatDong.length > 0 && (
                <section className="border-t border-slate-100 pt-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Activity className="h-3.5 w-3.5" /> {tDich("Hoạt động gần đây")}
                  </p>
                  <ul className="space-y-2">
                    {hoatDong.slice(0, 6).map((h, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                          h.loai === "don" ? "bg-emerald-500" : h.loai === "goi" ? "bg-blue-500" : "bg-slate-300"
                        }`} />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-medium text-slate-700">{tDich(h.tieuDe)}</span>
                          {h.chiTiet && <span className="block truncate text-[11px] text-slate-500">{h.chiTiet}</span>}
                          <span className="block text-[10px] text-slate-400">
                            {(h.luc || "").slice(0, 10)}{h.nguoi ? ` · ${h.nguoi}` : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold text-slate-700">{tDich("Mở ở trang khác")}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    ["/zalo/khach-hang", tDich("Khách Zalo")],
                    ["/khach-360", tDich("Khách 360")],
                    ["/ca-truc-ai", tDich("Ca trực AI")],
                    ["/chat-quality", tDich("AI chấm chat")],
                  ].map(([href, nhan]) => (
                    <a
                      key={href}
                      href={href}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {nhan}
                    </a>
                  ))}
                </div>
              </section>
            </div>
          )}
        </aside>
      </div>

      {oViec && chon && (
        <OTaoViec
          ten={tDich(chon.ten)}
          dong={() => setOViec(false)}
          gui={async (tieuDe, han, gap) => {
            await hanhDong({ viec: "tao-viec", tieuDe, han, gap }, tDich("Đã tạo việc trong /tasks"));
            setOViec(false);
          }}
        />
      )}
    </div>
  );
}

function OTaoViec({
  ten, dong, gui,
}: {
  ten: string;
  dong: () => void;
  gui: (tieuDe: string, han: string, gap: boolean) => Promise<void>;
}) {
  const { t: tDich } = useLang();
  const homNay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const [tieuDe, setTieuDe] = useState(`Trả lời khách ${ten}`);
  const [han, setHan] = useState(homNay);
  const [gap, setGap] = useState(false);
  const [dangGui, setDangGui] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={dong}>
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{tDich("Tạo việc")}</h2>
          <button onClick={dong} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <label className="block text-[11px] font-medium text-slate-600">{tDich("Việc cần làm")}</label>
        <input
          value={tieuDe} onChange={(e) => setTieuDe(e.target.value)} autoFocus
          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
        />
        <label className="mt-3 block text-[11px] font-medium text-slate-600">{tDich("Hạn")}</label>
        <input
          type="date" value={han} onChange={(e) => setHan(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
        />
        <label className="mt-3 flex items-center gap-2 text-[11px] text-slate-600">
          <input type="checkbox" checked={gap} onChange={(e) => setGap(e.target.checked)} /> {tDich("Việc gấp")}
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={dong} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">{tDich("Thôi")}</button>
          <button
            disabled={!tieuDe.trim() || dangGui}
            onClick={async () => { setDangGui(true); await gui(tieuDe.trim(), han, gap); setDangGui(false); }}
            className="rounded-lg bg-[#0068FF] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {dangGui ? tDich("Đang tạo...") : tDich("Tạo việc")}
          </button>
        </div>
      </div>
    </div>
  );
}
