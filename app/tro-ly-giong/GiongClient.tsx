"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, MicOff, Volume2, Square, MessageSquareText, X, Send, Trash2 } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { dichSo } from "@/lib/i18n";
import { thoiGianCho, laTiengVong, lamSachDeDoc, catCauXong, nenNgat, laLenhDung } from "@/lib/tro-ly-giong";
import QuaCau from "./QuaCau";
import { PhienLive } from "./phien-live";

type Giong = { id: string; ten: string; mota: string };
type Turn = { role: "user" | "model"; text: string };
type TrangThai = "nghi" | "nghe" | "dang-nghi" | "dang-noi" | "ghi-am";

const KHOA_LICH_SU = "tro-ly-giong-lich-su";
const KHOA_GIONG = "tro-ly-giong-chon";

const KHOA_GIONG_LIVE = "tro-ly-giong-live-2";

export default function GiongClient({ giong, coElevenLabs, giongLive }: { giong: Giong[]; coElevenLabs: boolean; giongLive: Array<{ id: string; ten: string }> }) {
  const { t, locale } = useLang();

  const tiengMay = locale === "en" ? "en" : "vi";
  const [trangThai, setTrangThai] = useState<TrangThai>("nghi");
  const [dangGoi, setDangGoi] = useState(false);
  const [tatMic, setTatMic] = useState(false);
  const [nhap, setNhap] = useState("");
  const [lichSu, setLichSu] = useState<Turn[]>([]);
  const [loi, setLoi] = useState("");

  const [choBam, setChoBam] = useState(false);
  const [chanTieng, setChanTieng] = useState(false);
  const [chonGiong, setChonGiong] = useState(giong[0]?.id || "");
  const [ngheDuoc, setNgheDuoc] = useState(true);
  const [giay, setGiay] = useState(0);
  const [cauDangDoc, setCauDangDoc] = useState("");
  const [moHoiThoai, setMoHoiThoai] = useState(false);

  const [cheDo, setCheDo] = useState<"live" | "cu">("live");
  const [chonLive, setChonLive] = useState(giongLive[0]?.id || "");
  const phien = useRef<PhienLive | null>(null);
  const [dangLam, setDangLam] = useState("");
  const [elOk, setElOk] = useState<boolean | null>(null);
  const [dsMay, setDsMay] = useState<Array<{ ten: string; nhan: string }>>([]);

  const nhanDang = useRef<any>(null);
  const boDem = useRef<ReturnType<typeof setTimeout> | null>(null);
  const daChot = useRef("");
  const dangGoiRef = useRef(false);
  const tatMicRef = useRef(false);
  const lichSuRef = useRef<Turn[]>([]);
  const hangDoc = useRef<{ huy: boolean; cau: string }>({ huy: false, cau: "" });
  const amThanh = useRef<HTMLAudioElement | null>(null);
  const khoaManHinh = useRef<any>(null);
  const ghiAm = useRef<MediaRecorder | null>(null);
  const chonGiongRef = useRef(chonGiong);
  chonGiongRef.current = chonGiong;

  const elevenHong = useRef(false);
  const mucAm = useRef(0);
  const doAm = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null);

  const batDoAm = useCallback(async (stream?: MediaStream) => {
    if (doAm.current) return;
    const s = stream || await navigator.mediaDevices?.getUserMedia({ audio: true }).catch(() => null);
    if (!s) return;
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    ctx.createMediaStreamSource(s).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const vong = () => {
      an.getByteTimeDomainData(buf);
      let tong = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; tong += v * v; }
      mucAm.current = Math.min(1, Math.sqrt(tong / buf.length) * 5);
      if (doAm.current) doAm.current.raf = requestAnimationFrame(vong);
    };
    doAm.current = { stream: s, ctx, raf: requestAnimationFrame(vong) };
  }, []);
  const tatDoAm = useCallback((dungStream = true) => {
    const d = doAm.current;
    if (!d) return;
    doAm.current = null;
    cancelAnimationFrame(d.raf);
    if (dungStream) d.stream.getTracks().forEach((tr) => tr.stop());
    d.ctx.close().catch(() => {});
    mucAm.current = 0;
  }, []);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setNgheDuoc(!!SR);
    try { const s = JSON.parse(sessionStorage.getItem(KHOA_LICH_SU) || "[]"); if (Array.isArray(s)) { setLichSu(s); lichSuRef.current = s; } } catch {}
    const gl = localStorage.getItem(KHOA_GIONG_LIVE); if (gl && giongLive.some((x) => x.id === gl)) setChonLive(gl);

    fetch("/api/tro-ly-giong/live").catch(() => {});
    fetch("/api/tro-ly-giong/hoi").catch(() => {});

    const napGiongMay = () => {
      const ds = window.speechSynthesis?.getVoices().filter((v) => v.lang?.toLowerCase().startsWith(tiengMay) && (tiengMay === "vi" || /^en-us/i.test(v.lang))) || [];
      const tot = /natural|online|premium|enhanced|google us english|samantha/i;
      ds.sort((a, b) => Number(tot.test(b.name)) - Number(tot.test(a.name)));
      setDsMay(ds.map((v) => ({ ten: v.name, nhan: v.name.replace(/^Microsoft\s+/, "").replace(/\s*-\s*Vietnamese.*$/i, "") })));
    };
    napGiongMay();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = napGiongMay;

    if (coElevenLabs) {
      fetch("/api/tro-ly-giong/doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Dạ", giong: giong[0]?.id }) })
        .then((r) => { const ok = !!r && r.ok && r.status !== 204; setElOk(ok); if (!ok) elevenHong.current = true; })
        .catch(() => { setElOk(false); elevenHong.current = true; });
    } else setElOk(false);
    return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giong, coElevenLabs]);

  useEffect(() => {
    if (elOk === null) return;
    const hopLe = (g: string) => (elOk && giong.some((x) => x.id === g)) || (g.startsWith("may:") && dsMay.some((v) => `may:${v.ten}` === g));
    const cu = localStorage.getItem(KHOA_GIONG) || "";
    if (hopLe(cu)) { setChonGiong(cu); return; }
    if (!hopLe(chonGiongRef.current)) setChonGiong(elOk ? giong[0]?.id || "" : dsMay[0] ? `may:${dsMay[0].ten}` : "");
  }, [elOk, dsMay, giong]);

  useEffect(() => {
    if (!dangGoi) return;
    const id = setInterval(() => setGiay((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [dangGoi]);

  const luuLichSu = (ds: Turn[]) => {
    lichSuRef.current = ds; setLichSu(ds);
    try { sessionStorage.setItem(KHOA_LICH_SU, JSON.stringify(ds.slice(-40))); } catch {}
  };

  const hangCau = useRef<Array<{ cau: string; mp3: Promise<Blob | null> }>>([]);
  const dangChayDoc = useRef(false);
  const streamXong = useRef(true);
  const hetDocLuc = useRef(0);
  const vuaDoc = useRef("");

  const dungDoc = useCallback(() => {
    hangDoc.current.huy = true; hangDoc.current.cau = ""; setCauDangDoc("");
    hangCau.current = [];
    amThanh.current?.pause(); amThanh.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const docBangMay = useCallback((cau: string) => new Promise<void>((xong) => {
    const u = new SpeechSynthesisUtterance(cau);
    u.lang = tiengMay === "en" ? "en-US" : "vi-VN"; u.rate = tiengMay === "en" ? 1 : 1.05;
    const ds = window.speechSynthesis.getVoices();
    const ten = chonGiongRef.current.startsWith("may:") ? chonGiongRef.current.slice(4) : "";
    const v = ds.find((x) => x.name === ten && x.lang?.toLowerCase().startsWith(tiengMay)) || ds.find((x) => x.lang?.toLowerCase().startsWith(u.lang.toLowerCase())) || ds.find((x) => x.lang?.toLowerCase().startsWith(tiengMay));
    if (v) u.voice = v;
    u.onend = () => xong(); u.onerror = () => xong();
    window.speechSynthesis.speak(u);
  }), [tiengMay]);

  const docMotCau = useCallback(async (cau: string, mp3: Promise<Blob | null>) => {
    hangDoc.current.cau = cau;
    setCauDangDoc(cau);
    const blob = await mp3;
    if (hangDoc.current.huy) return;
    if (blob) {
      await new Promise<void>((xong) => {
        const a = new Audio(URL.createObjectURL(blob));
        amThanh.current = a;
        a.onended = () => xong(); a.onerror = () => xong(); a.onpause = () => xong();
        a.play().catch(() => xong());
      });
      return;
    }
    await docBangMay(cau);
  }, [docBangMay]);

  const layMp3 = useCallback(async (cau: string): Promise<Blob | null> => {
    if (!coElevenLabs || elevenHong.current || chonGiongRef.current.startsWith("may:")) return null;
    const r = await fetch("/api/tro-ly-giong/doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: cau, giong: chonGiongRef.current }) }).catch(() => null);
    if (!r || r.status === 204) return null;
    if (!r.ok) { elevenHong.current = true; setElOk(false); return null; }
    return r.blob();
  }, [coElevenLabs]);

  const veNghe = useCallback(() => setTrangThai(dangGoiRef.current ? "nghe" : "nghi"), []);

  const chayDoc = useCallback(async () => {
    if (dangChayDoc.current) return;
    dangChayDoc.current = true;
    while (hangCau.current.length && !hangDoc.current.huy) {
      const { cau, mp3 } = hangCau.current.shift()!;
      setTrangThai("dang-noi");
      await docMotCau(cau, mp3);
    }
    dangChayDoc.current = false;
    if (hangDoc.current.huy) return;
    if (streamXong.current) {
      hangDoc.current.cau = ""; setCauDangDoc(""); hetDocLuc.current = Date.now();
      veNghe();
    } else setTrangThai("dang-nghi");
  }, [docMotCau, veNghe]);

  const napCau = useCallback((cau: string) => {
    const sach = lamSachDeDoc(cau);
    if (!sach) return;
    hangCau.current.push({ cau: sach, mp3: layMp3(sach) });
    chayDoc();
  }, [layMp3, chayDoc]);

  const hoi = useCallback(async (text: string) => {
    const cau = text.trim();
    if (!cau) return;
    dungDoc();
    setLoi(""); setDangLam("");
    const truoc = lichSuRef.current;
    luuLichSu([...truoc, { role: "user", text: cau }]);
    setTrangThai("dang-nghi");
    hangDoc.current = { huy: false, cau: "" };
    streamXong.current = false;
    const r = await fetch("/api/tro-ly-giong/hoi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: cau, history: truoc.slice(-16) }) }).catch(() => null);
    if (!r || !r.ok || !r.body) {
      const j = r ? await r.json().catch(() => ({})) : {};
      streamXong.current = true;
      setLoi(j.error || t("Mất kết nối, anh hỏi lại giúp em"));
      veNghe();
      return;
    }
    let toanBo = "", dem = "", du = "", loiStream = "";
    const doc = r.body.getReader();
    const giai = new TextDecoder();
    try {
      for (;;) {
        const { value, done } = await doc.read();
        if (done) break;
        du += giai.decode(value, { stream: true });
        let i: number;
        while ((i = du.indexOf("\n")) >= 0) {
          const dong = du.slice(0, i); du = du.slice(i + 1);
          let e: any; try { e = JSON.parse(dong); } catch { continue; }
          if (e.t === "chu") {
            toanBo += e.v; dem += e.v;
            const { xong, con } = catCauXong(dem); dem = con;
            if (!hangDoc.current.huy) xong.forEach(napCau);
          } else if (e.t === "viec") setDangLam(String(e.v || ""));
          else if (e.t === "loi") loiStream = String(e.v || "");
        }
      }
    } catch { loiStream = loiStream || t("Mất kết nối giữa chừng, anh hỏi lại giúp em"); }
    streamXong.current = true;
    setDangLam("");
    if (dem.trim() && !hangDoc.current.huy) napCau(dem.trim());
    if (toanBo.trim()) { luuLichSu([...lichSuRef.current, { role: "model", text: toanBo.trim() }]); vuaDoc.current = toanBo; }
    if (loiStream && !toanBo) setLoi(loiStream);
    if (!dangChayDoc.current && !hangCau.current.length) veNghe();
  }, [dungDoc, napCau, veNghe, t]);

  const guiPhanDaNghe = useCallback(() => {
    const cau = daChot.current.trim();
    daChot.current = ""; setNhap("");
    if (cau) hoi(cau);
  }, [hoi]);

  const batNghe = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = tiengMay === "en" ? "en-US" : "vi-VN"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      let tam = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const s = e.results[i][0].transcript;
        if (e.results[i].isFinal) daChot.current += ` ${s}`; else tam += s;
      }
      const dangNghe = `${daChot.current} ${tam}`.trim();

      if (hangDoc.current.cau && !hangDoc.current.huy) {
        if (!nenNgat(dangNghe, hangDoc.current.cau)) { daChot.current = ""; return; }
        dungDoc(); veNghe();
        if (laLenhDung(dangNghe)) { daChot.current = ""; setNhap(""); return; }
      }

      if (Date.now() - hetDocLuc.current < 2500 && laTiengVong(dangNghe, vuaDoc.current)) { daChot.current = ""; return; }
      setNhap(dangNghe);
      if (boDem.current) clearTimeout(boDem.current);
      const cho = thoiGianCho(dangNghe);
      if (Number.isFinite(cho)) boDem.current = setTimeout(guiPhanDaNghe, cho);
    };
    r.onerror = (e: any) => { if (e.error === "not-allowed") { setLoi(t("Trình duyệt chưa cho dùng micro. Anh bấm biểu tượng ổ khoá trên thanh địa chỉ để cho phép.")); ketThuc(); } };

    r.onend = () => { if (dangGoiRef.current && !tatMicRef.current) { try { r.start(); } catch {} } };
    try { r.start(); } catch {}
    nhanDang.current = r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungDoc, guiPhanDaNghe, t]);

  const ketThuc = useCallback(() => {
    phien.current?.tat(); phien.current = null;
    setDangLam(""); setCauDangDoc(""); setChanTieng(false);
    dangGoiRef.current = false; setDangGoi(false);
    tatMicRef.current = false; setTatMic(false);
    if (boDem.current) clearTimeout(boDem.current);
    try { nhanDang.current?.stop(); } catch {}
    nhanDang.current = null;
    dungDoc();
    khoaManHinh.current?.release?.().catch?.(() => {}); khoaManHinh.current = null;
    tatDoAm();
    daChot.current = ""; setNhap("");
    setTrangThai("nghi");
  }, [dungDoc, tatDoAm]);

  const batDau = useCallback(async () => {
    setLoi(""); setGiay(0); setChoBam(false);
    dangGoiRef.current = true; setDangGoi(true);
    setTrangThai("nghe");
    try { khoaManHinh.current = await (navigator as any).wakeLock?.request?.("screen"); } catch {}
    if (cheDo === "live" && typeof AudioWorkletNode !== "undefined") {
      setTrangThai("dang-nghi");
      const p = new PhienLive({
        trangThai: (st) => setTrangThai(st),
        nghe: (txt) => setNhap(txt),
        noi: (txt) => { setNhap(""); setCauDangDoc(txt); },
        xongLuot: (anh, em) => {
          const ds = [...lichSuRef.current];
          if (anh) ds.push({ role: "user", text: anh });
          if (em) ds.push({ role: "model", text: em });
          luuLichSu(ds); setNhap(""); setCauDangDoc("");
        },
        viec: (ten) => setDangLam(ten),
        loi: (msg) => setLoi(dichSo(t, msg)),
        chanTieng: (bi) => setChanTieng(bi),
        mucAm,
      });
      phien.current = p;
      if (await p.bat(chonLive)) return;

      p.tat(); phien.current = null;
      if (!dangGoiRef.current) return;
      setCheDo("cu");
      setLoi((cu) => `${cu ? cu + ". " : ""}${t("Em tạm chuyển sang chế độ nghe cũ.")}`);
      if (!ngheDuoc) { dangGoiRef.current = false; setDangGoi(false); setTrangThai("nghi"); return; }
      setTrangThai("nghe");
    }
    batNghe();
    batDoAm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batNghe, batDoAm, cheDo, chonLive, ngheDuoc, t]);

  const doiMic = () => {
    const tat = !tatMicRef.current;
    tatMicRef.current = tat; setTatMic(tat);
    if (phien.current) { phien.current.datTatMic(tat); return; }
    if (tat) { try { nhanDang.current?.stop(); } catch {} } else batNghe();
  };

  const doiGhiAm = async () => {
    if (ghiAm.current) { ghiAm.current.stop(); return; }
    setLoi("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) { setLoi(t("Trình duyệt chưa cho dùng micro.")); return; }
    dungDoc();
    const rec = new MediaRecorder(stream);
    const manh: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && manh.push(e.data);
    rec.onstop = async () => {
      tatDoAm(false);
      stream.getTracks().forEach((tr) => tr.stop());
      ghiAm.current = null;
      setTrangThai("dang-nghi");
      const blob = new Blob(manh, { type: rec.mimeType || "audio/webm" });
      const b64 = await new Promise<string>((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(blob); });
      const r = await fetch("/api/tro-ly-giong/nghe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: b64, mime: blob.type }) }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok || !j.text) { setLoi(j.error || t("Chưa nghe được, anh nói lại giúp em")); setTrangThai("nghi"); return; }
      hoi(j.text);
    };
    rec.start();
    batDoAm(stream);
    ghiAm.current = rec;
    setTrangThai("ghi-am");
  };

  useEffect(() => {
    const phim = (e: KeyboardEvent) => { if (e.key === "Escape" && dangGoiRef.current) ketThuc(); };
    window.addEventListener("keydown", phim);
    return () => { window.removeEventListener("keydown", phim); ketThuc(); };
  }, [ketThuc]);

  const ngatDoc = useCallback(() => {
    if (phien.current) { phien.current.ngat(); return; }
    dungDoc(); hetDocLuc.current = Date.now(); veNghe();
  }, [dungDoc, veNghe]);
  const trangThaiRef = useRef(trangThai);
  trangThaiRef.current = trangThai;
  const batDauRef = useRef(batDau);
  batDauRef.current = batDau;
  const ngatDocRef = useRef(ngatDoc);
  ngatDocRef.current = ngatDoc;
  useEffect(() => {

    const phim = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const o = e.target as HTMLElement | null;
      if (o && (o.tagName === "INPUT" || o.tagName === "TEXTAREA" || o.tagName === "SELECT" || o.isContentEditable)) return;
      e.preventDefault();
      phien.current?.batTieng();
      if (phien.current) { if (trangThaiRef.current === "dang-noi") ngatDocRef.current(); return; }
      if (hangDoc.current.cau && !hangDoc.current.huy) ngatDocRef.current();
      else if (!dangGoiRef.current) batDauRef.current();
    };
    window.addEventListener("keydown", phim);

    if (new URLSearchParams(window.location.search).get("goi") === "1") {
      window.history.replaceState(null, "", window.location.pathname);
      const daBam = (navigator as any).userActivation ? (navigator as any).userActivation.hasBeenActive : true;
      if (!daBam) setChoBam(true);
      else setTimeout(() => { if (!dangGoiRef.current) batDauRef.current(); }, 300);
    }
    return () => window.removeEventListener("keydown", phim);
  }, []);

  const doiGiongLive = (g: string) => {
    setChonLive(g);
    try { localStorage.setItem(KHOA_GIONG_LIVE, g); } catch {}
    phien.current?.doiGiong(g);
  };
  const doiGiong = (g: string) => {
    setChonGiong(g); chonGiongRef.current = g;
    try { localStorage.setItem(KHOA_GIONG, g); } catch {}

    dungDoc();
    hangDoc.current = { huy: false, cau: "" };
    napCau(t("Dạ, em là Trợ lý AI, anh nghe giọng này được không ạ?"));
  };
  const TEN_VIEC: Record<string, string> = {
    giao_viec: t("Em đang giao việc"), xem_tien_do: t("Em đang xem tiến độ"), cap_nhat_du_an: t("Em đang cập nhật dự án"), soat_may: t("Em đang soát máy"),
    tim_web: t("Em đang tra trên mạng"), soan_cham_soc: t("Em đang soạn tin"), len_chien_dich: t("Em đang lên chiến dịch"),
    giao_claude_code: t("Em đang gửi việc cho Claude Code"), cao_misa: t("Em đang đặt lệnh cào MISA"), yeu_cau_skill: t("Em đang ghi yêu cầu"),
  };

  const nhanTrangThai: Record<TrangThai, string> = {
    nghi: dangGoi ? t("Sẵn sàng") : t("Chưa gọi"), nghe: tatMic ? t("Đã tắt micro") : t("Em đang nghe"), "dang-nghi": dangLam ? TEN_VIEC[dangLam] || t("Em đang làm") : t("Em đang nghĩ"), "dang-noi": t("Em đang nói, bấm quả cầu hoặc nói \"dừng\" để ngắt"), "ghi-am": t("Đang ghi âm, bấm lần nữa để gửi"),
  };
  const dongHo = `${Math.floor(giay / 60)}:${String(giay % 60).padStart(2, "0")}`;
  const mauCham = trangThai === "dang-noi" ? "bg-yellow-400" : trangThai === "dang-nghi" ? "bg-indigo-400" : trangThai === "ghi-am" ? "bg-red-400" : dangGoi ? "bg-emerald-400" : "bg-slate-500";
  const cauCuoi = [...lichSu].reverse().find((m) => m.role === "model")?.text || "";
  const phuDe = nhap || cauDangDoc || (trangThai === "dang-nghi" ? "" : cauCuoi);
  const dangGhi = trangThai === "ghi-am";
  const goiDuoc = ngheDuoc || cheDo === "live";

  return (
    <div className="relative flex h-[calc(100dvh-5.5rem)] min-h-[560px] overflow-hidden rounded-lg bg-[#070B0A] text-white ring-1 ring-white/5" data-testid="man-goi">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(16,185,129,0.14),transparent_60%)]" />

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {dangGoi && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${mauCham}`} />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${mauCham}`} />
            </span>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-base font-semibold leading-tight">{t("Trợ lý AI")}<span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">AI</span></h1>
              <p className="truncate text-xs text-white/50">{dangGoi ? `${t("Đang gọi")} · ${dongHo}` : t("Trợ lý giọng nói · Option+J để gọi")}</p>
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-white/60">
            <Volume2 className="h-4 w-4" />
            <select
              aria-label={t("Chọn giọng")}
              className="max-w-[9rem] rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white/80 outline-none focus:border-emerald-400/60"
              value={cheDo === "live" ? chonLive : chonGiong}
              onChange={(e) => (cheDo === "live" ? doiGiongLive(e.target.value) : doiGiong(e.target.value))}
            >
              {cheDo === "live" && giongLive.map((g) => <option key={g.id} value={g.id} className="text-slate-900">{t(g.ten)}</option>)}
              {cheDo === "cu" && elOk && giong.map((g) => <option key={g.id} value={g.id} className="text-slate-900">{g.ten} ({t(g.mota)})</option>)}
              {cheDo === "cu" && dsMay.map((v) => <option key={v.ten} value={`may:${v.ten}`} className="text-slate-900">{v.nhan}</option>)}
              {cheDo === "cu" && !elOk && !dsMay.length && <option value="" className="text-slate-900">{t("Giọng mặc định của máy")}</option>}
            </select>
          </label>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="h-[min(56vw,340px)] w-full max-w-[820px] cursor-pointer" onClick={() => { if (trangThai === "dang-noi") ngatDoc(); else if (!dangGoi && goiDuoc) batDau(); }} title={trangThai === "dang-noi" ? t("Bấm để ngắt") : undefined}>
            <QuaCau trangThai={trangThai} mucAm={mucAm} />
          </div>
          {((choBam && !dangGoi) || chanTieng) && (
            <button type="button" data-testid="bam-bat-tieng"
              onClick={() => { if (chanTieng) phien.current?.batTieng(); else { setChoBam(false); batDau(); } }}
              className="mt-1 rounded-lg bg-emerald-500 px-5 py-2.5 text-base font-semibold text-white shadow-[0_0_24px_-6px_rgba(16,185,129,0.8)] transition hover:bg-emerald-400">
              {chanTieng ? t("Bấm để bật tiếng") : t("Bấm để bắt đầu gọi")}
            </button>
          )}
          <p className="mt-2 text-sm font-medium text-white/55" aria-live="polite">{nhanTrangThai[trangThai]}</p>
          <p className={`mt-3 line-clamp-3 min-h-[5.25rem] max-w-xl text-center text-lg leading-7 md:text-xl ${nhap ? "text-white" : "text-white/80"}`} data-testid="phu-de">
            {phuDe || (!lichSu.length && !dangGoi && !dangGhi ? t("Bấm nút micro rồi hỏi tự nhiên, ví dụ: hôm nay bán được bao nhiêu, sale nào đang chậm, món nào sắp hết hàng.") : "")}
          </p>
          {loi && <p className="mt-2 max-w-xl rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200" role="alert">{loi}</p>}
        </div>

        <div className="flex items-center justify-center gap-5 pb-8 pt-4">
          {goiDuoc && dangGoi ? (
            <button type="button" onClick={doiMic} aria-label={tatMic ? t("Bật micro") : t("Tắt micro")}
              className={`flex h-14 w-14 items-center justify-center rounded-full border transition ${tatMic ? "border-white bg-white text-slate-900" : "border-white/15 bg-white/10 text-white hover:bg-white/15"}`}>
              {tatMic ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
          ) : <span className="h-14 w-14" />}

          {goiDuoc ? (
            <button type="button" onClick={dangGoi ? ketThuc : batDau} aria-label={dangGoi ? t("Kết thúc") : t("Bắt đầu nói")}
              className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-white shadow-lg transition ${dangGoi ? "bg-red-600 shadow-red-900/40 hover:bg-red-500" : "bg-emerald-500 shadow-emerald-900/50 hover:bg-emerald-400"}`}>
              {dangGoi ? <PhoneOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </button>
          ) : (
            <button type="button" onClick={doiGhiAm} aria-label={dangGhi ? t("Gửi") : t("Bấm để nói")}
              className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-white shadow-lg transition ${dangGhi ? "bg-red-600 hover:bg-red-500" : "bg-emerald-500 hover:bg-emerald-400"}`}>
              {dangGhi ? <Square className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </button>
          )}

          <button type="button" onClick={() => setMoHoiThoai((v) => !v)} aria-label={t("Hội thoại")}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 lg:hidden">
            <MessageSquareText className="h-6 w-6" />
          </button>
          <span className="hidden h-14 w-14 lg:block" />
        </div>
      </section>

      <aside className={`${moHoiThoai ? "flex" : "hidden"} absolute inset-0 z-10 flex-col bg-[#0a1119] lg:static lg:flex lg:w-[360px] lg:border-l lg:border-white/10 lg:bg-white/[0.02]`} data-testid="hoi-thoai">
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="text-sm font-semibold text-white/80">{t("Hội thoại")}</h2>
          <div className="flex items-center gap-1">
            {lichSu.length > 0 && !dangGoi && (
              <button type="button" onClick={() => luuLichSu([])} aria-label={t("Xoá")} className="rounded-md p-2 text-white/40 hover:bg-white/5 hover:text-white/80"><Trash2 className="h-4 w-4" /></button>
            )}
            <button type="button" onClick={() => setMoHoiThoai(false)} aria-label={t("Đóng")} className="rounded-md p-2 text-white/40 hover:bg-white/5 hover:text-white/80 lg:hidden"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {!lichSu.length && <p className="text-sm text-white/35">{t("Câu hỏi và câu trả lời sẽ hiện ở đây.")}</p>}
          {lichSu.map((m, i) => (
            <div key={i} className={m.role === "user" ? "rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm leading-6 text-white/85" : "rounded-lg border border-emerald-400/15 bg-emerald-500/[0.07] px-3 py-2.5 text-sm leading-6 text-white/90"}>
              <div className={`mb-0.5 text-xs font-medium ${m.role === "user" ? "text-white/45" : "text-emerald-300"}`}>{m.role === "user" ? t("Anh") : t("Trợ lý AI")}</div>
              {m.text}
            </div>
          ))}
        </div>
        <form className="flex gap-2 p-4" onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem("go") as HTMLInputElement); if (!phien.current?.guiChu(v.value)) hoi(v.value); v.value = ""; }}>
          <input name="go" placeholder={t("Hoặc gõ câu hỏi...")} className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-emerald-400/60" />
          <button type="submit" aria-label={t("Gửi")} className="rounded-md bg-emerald-500 px-3 text-white hover:bg-emerald-400"><Send className="h-4 w-4" /></button>
        </form>
      </aside>
    </div>
  );
}
