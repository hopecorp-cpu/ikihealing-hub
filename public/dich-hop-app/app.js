const $ = (id) => document.getElementById(id);
const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=";

const GIONG_NAM = ["Sadaltager", "Schedar", "Algieba", "Charon", "Algenib", "Orus", "Fenrir", "Puck"];
const GIONG_NU = ["Kore", "Sulafat", "Despina", "Erinome", "Aoede", "Leda", "Zephyr"];
const GIONG = [...GIONG_NAM, ...GIONG_NU];
const TEN_GIONG = {
  Sadaltager: "Sadaltager (nam, trầm, chín chắn)", Schedar: "Schedar (nam, đều, điềm tĩnh)", Algieba: "Algieba (nam, ấm, mượt)",
  Algenib: "Algenib (nam, trầm, hơi khàn)",
  Charon: "Charon (nam, rõ, kiểu thuyết trình)", Orus: "Orus (nam, vững vàng)", Fenrir: "Fenrir (nam, nhiều năng lượng)",
  Puck: "Puck (nam, trẻ trung)", Kore: "Kore (nữ, chắc, tự tin)", Erinome: "Erinome (nữ, rõ ràng)",
  Sulafat: "Sulafat (nữ, ấm áp)", Despina: "Despina (nữ, mượt)", Aoede: "Aoede (nữ, nhẹ nhàng)", Leda: "Leda (nữ, trẻ)", Zephyr: "Zephyr (nữ, tươi sáng)",
};
const CAU_NGHE_THU = "Xin chào mọi người, cảm ơn anh chị đã dành thời gian hôm nay. Tôi rất vui được chia sẻ kế hoạch năm tới của chúng tôi, và tôi tin đây là cơ hội hợp tác tốt cho cả hai bên.";
const NGUON_TAB = "__tab__";
const NGUON_GIA = "__gia__";
const CAU_GIA = [
  "Thank you for your time today. Could you briefly introduce your company?",
  "What is your current monthly revenue, and what is the gross margin?",
  "How do you plan to use the funds over the next eighteen months?",
  "Who are your biggest competitors in Vietnam, and why will customers choose you?",
  "We need the financial report before Friday. Is that possible?",
  "Sounds very interesting. Let's schedule another call next week to go into details.",
];
let soCauGia = 0;
const LUU = (k, v) => localStorage.setItem("dichhop-" + k, JSON.stringify(v));
const DOC = (k, d) => { try { const v = JSON.parse(localStorage.getItem("dichhop-" + k)); return v ?? d; } catch { return d; } };

let dangChay = false;
let batDauLuc = 0;
let cuocHop = null;
const kenh = {};

function viTat(ngonNgu) {
  return { English: "EN", Japanese: "JA", "Mandarin Chinese": "ZH", Korean: "KO" }[ngonNgu] || "EN";
}

function pcmSangBuffer(ctx, b64) {
  const nhiPhan = atob(b64);
  const n = nhiPhan.length >> 1;
  const buf = ctx.createBuffer(1, n, 24000);
  const kenhRa = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    let v = nhiPhan.charCodeAt(2 * i) | (nhiPhan.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    kenhRa[i] = v / 0x8000;
  }
  return buf;
}

async function moPhien(vai) {
  const giong = vai === "toi" ? $("giongToi").value : vai === "doitac" ? $("giongDoiTac").value : "Puck";
  const r = await fetch("/api/dich-hop/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ vai, ngonNgu: $("ngonNgu").value, giong, boiCanh: $("boiCanh").value.trim() }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error(j.error || `máy chủ trả mã ${r.status}`);
  return { ws: new WebSocket(WS_URL + encodeURIComponent(j.token)), setup: j.setup };
}

async function moPhienNgheThu() {
  const { ws, setup } = await moPhien("toi");
  ws.addEventListener("open", () => ws.send(JSON.stringify({ setup })));
  return ws;
}

let nhatKyCho = [];

function khopTiengVong(goc, cacBanDich) {
  if (/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(goc.normalize("NFC"))) return false;
  const tu = (s) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
  const nguon = tu(goc);
  if (nguon.size < 4) return false;

  if (![...nguon].some((t) => /^(i|we|you|our|your|the|a|an|is|are|have|has|will|can|to|in|for|of|and|it|this|that)$/.test(t))) return false;
  return cacBanDich.some((b) => {
    if (b.den < Date.now()) return false;
    const dich = tu(b.chu), chung = [...nguon].filter((t) => dich.has(t)).length;
    return chung >= 4 && chung / nguon.size >= 0.5 && chung / dich.size >= 0.5;
  });
}
function nk(vai, chu) {
  const dong = `${new Date().toLocaleString("vi-VN")} [${vai}] ${chu}`;
  nhatKyCho.push(dong);
  console.log(dong);
}
setInterval(() => {
  if (!nhatKyCho.length) return;
  const cu = DOC("nhatky", []);
  LUU("nhatky", cu.concat(nhatKyCho).slice(-3000));
  nhatKyCho = [];
}, 3000);
window.addEventListener("error", (e) => nk("trang", `lỗi JS: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => nk("trang", `lỗi chưa bắt: ${e.reason?.message || e.reason}`));

const SO_PHIEN = 3;
const NGUONG_TIENG = 0.02;
const CAT_SAU = 3;
const CAT_LANG = 0.2;
const HET_LANG = 0.35;
const TRAN_DOAN = 8;
const CHO_DOAN_RONG = 2500;
const CHO_DOAN_DO = 8000;

const DUOI_KHOA = 0.4;
function loaDangKeu() {
  const k = kenh.doitac;
  if (!$("loaNgoai").checked || !k?.ctxRa) return false;
  return Date.now() - k.tk.lanTieng < DUOI_KHOA * 1000
    || k.doanCho.length > 0
    || k.amDangPhat.size > 0
    || k.ctxRa.currentTime < k.dauPhat + DUOI_KHOA;
}
function datKhoaMic(khoa) {
  if (khoa === datKhoaMic.cu) return;
  datKhoaMic.cu = khoa;
  $("khoaMic").textContent = khoa ? "Micro tạm khoá: đối tác đang nói hoặc đang đọc bản dịch" : "";
  nk("Tôi", khoa ? "khoá micro (loa ngoài đang kêu)" : "mở micro");
}

class Kenh {
  constructor(vai) {
    this.vai = vai;
    this.dich = true;
    this.phien = [];
    this.doanCho = [];
    this.dangNoi = null;
    this.truocTieng = [];
    this.amDangPhat = new Set();
    this.banDichGanDay = [];
    this.mucEl = $(vai === "toi" ? "mucToi" : "mucDoiTac");
    this.tk = { gui: 0, nhan: 0, mucMax: 0, noiLai: 0, lanDich: 0, lanTieng: 0, loi: "" };
  }

  get sanSang() { return this.phien.some((p) => p.sanSang); }
  get ws() { return this.phien[0]?.ws || null; }

  ten() { return this.vai === "toi" ? "Tôi" : "Đối tác"; }
  hangCho() { return this.ctxRa ? Math.max(0, this.dauPhat - this.ctxRa.currentTime) : 0; }

  async layLuong() {
    this.tuGia = this.vai === "doitac" && $("nguonDoiTac").value === NGUON_GIA;
    if (this.tuGia) {
      this.ctxGia = new AudioContext({ sampleRate: 24000 });
      this.dichGia = this.ctxGia.createMediaStreamDestination();
      this.dauGia = 0;
      return this.dichGia.stream;
    }
    if (this.vai === "doitac" && $("nguonDoiTac").value === NGUON_TAB) {
      this.tuTab = true;
      const s = this.luongTab;
      this.luongTab = null;
      if (!s) throw new Error("chưa có tab họp được chia sẻ.");
      if (!s.getAudioTracks().length) {
        s.getTracks().forEach((t) => t.stop());
        throw new Error("Chưa lấy được tiếng: khi chọn tab họp nhớ tích ô \"Chia sẻ âm thanh của tab\".");
      }
      return s;
    }
    this.tuTab = false;
    const id = $(this.vai === "toi" ? "micToi" : "nguonDoiTac").value;
    return navigator.mediaDevices.getUserMedia({
      audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: this.vai === "toi", noiseSuppression: this.vai === "toi", autoGainControl: true },
    });
  }

  async batDau() {
    this.luong = await this.layLuong();
    this.theoDoiNguon();
    this.tk = { gui: 0, nhan: 0, mucMax: 0, noiLai: 0, lanDich: 0, lanTieng: 0, loi: "" };

    this.ctxVao = new AudioContext();
    await this.ctxVao.audioWorklet.addModule("thu-am.js");
    this.nguonVao = this.ctxVao.createMediaStreamSource(this.luong);
    this.thu = new AudioWorkletNode(this.ctxVao, "thu-am");
    this.thu.port.onmessage = (e) => this.guiAm(e.data);
    this.nguonVao.connect(this.thu);

    this.ctxRa = new AudioContext({ sampleRate: 24000 });
    await this.datLoaRa();
    this.diThang = this.ctxRa.createGain();
    this.nguonThang = this.ctxRa.createMediaStreamSource(this.luong);
    this.nguonThang.connect(this.diThang).connect(this.ctxRa.destination);
    this.dauPhat = 0;
    this.capNhatDiThang();

    await Promise.all([this.ctxVao.resume(), this.ctxRa.resume(), this.ctxGia?.resume()]);
    const tenChon = (id) => $(id).selectedOptions[0]?.textContent || "mặc định";
    nk(this.ten(), this.vai === "toi"
      ? `bắt đầu: micro="${tenChon("micToi")}" phát vào="${$("tuNghe").checked ? "loa mặc định (tự nghe)" : tenChon("raToi")}"`
      : `bắt đầu: nguồn="${tenChon("nguonDoiTac")}" nghe qua="${tenChon("raDoiTac")}" tắt tiếng gốc=${$("tatGoc").checked}`);
    this.ketNoi();
  }

  theoDoiNguon() {
    this.luong.getAudioTracks().forEach((t) => (t.onended = () => {
      nk(this.ten(), "nguồn tiếng đã ngắt");
      if (!dangChay) return;
      if (!this.tuTab && !this.tuGia) this.doiMicro();
      else { this.dung(); baoLoi(`Nguồn tiếng của ${this.ten()} đã dừng. Bấm Dừng rồi Bắt đầu để chia sẻ lại tab họp.`); }
    }));
  }

  async doiMicro() {
    if (!dangChay || !this.ctxVao || this.tuTab || this.tuGia) return;
    const lan = this.lanDoi = (this.lanDoi || 0) + 1;
    try {
      await napThietBi();
      const moi = await this.layLuong();
      if (lan !== this.lanDoi || !dangChay || !this.ctxVao) { moi.getTracks().forEach((t) => t.stop()); return; }
      const cu = this.luong;
      this.nguonVao.disconnect();
      this.nguonThang.disconnect();
      this.luong = moi;
      this.nguonVao = this.ctxVao.createMediaStreamSource(moi);
      this.nguonVao.connect(this.thu);
      this.nguonThang = this.ctxRa.createMediaStreamSource(moi);
      this.nguonThang.connect(this.diThang);
      this.theoDoiNguon();
      cu.getTracks().forEach((t) => { t.onended = null; t.stop(); });
      await Promise.all([this.ctxVao.resume(), this.ctxRa.resume()]);
      this.tk.loi = "";
      if (Object.values(kenh).every((k) => !k.tk.loi)) anLoi();
      nk(this.ten(), "đã chuyển sang micro đang chọn");
      veGoiY();
    } catch (e) {
      if (lan !== this.lanDoi || !dangChay) return;
      this.tk.loi = e.message;
      baoLoi(`${this.ten()}: không chuyển được micro. Chọn micro khác hoặc bấm Dừng rồi Bắt đầu. ${e.message}`);
    }
  }

  async datLoaRa() {
    if (!this.ctxRa?.setSinkId) return;
    const ra = this.vai === "toi" && $("tuNghe").checked ? "" : $(this.vai === "toi" ? "raToi" : "raDoiTac").value;
    await this.ctxRa.setSinkId(ra);
    veGoiY();
  }

  capNhatDiThang() {
    if (!this.diThang) return;

    const can = !this.dich && (this.vai === "toi" || this.tuGia || (this.tuTab && $("tatGoc").checked));
    this.diThang.gain.value = can ? 1 : 0;
  }

  ketNoi() {
    if (!this.phien.length) this.phien = Array.from({ length: SO_PHIEN }, (_, so) => ({ so, ws: null, sanSang: false, doan: [] }));
    for (const p of this.phien) this.ketNoiPhien(p);
  }

  async ketNoiPhien(p) {
    clearTimeout(p.henLai);
    if (p.ws) this.tk.noiLai++;
    nk(this.ten(), `mở kết nối Gemini ${p.so + 1}/${SO_PHIEN} (lần nối lại thứ ${this.tk.noiLai})`);
    p.sanSang = false;
    const cu = p.ws;
    p.ws = null;
    try { cu?.close(1000); } catch {}
    this.boDoanCuaPhien(p);
    const lan = (p.lanMo = (p.lanMo || 0) + 1);
    let phien;
    try { phien = await moPhien(this.vai); }
    catch (e) {
      nk(this.ten(), `không xin được phiên: ${e.message}`);
      this.tk.loi = e.message;
      if (dangChay && this.luong) { baoLoi(`${this.ten()}: ${e.message}`); p.henLai = setTimeout(() => dangChay && this.luong && this.phien.includes(p) && this.ketNoiPhien(p), 4000); }
      return;
    }

    if (lan !== p.lanMo || !dangChay || !this.luong || !this.phien.includes(p)) { try { phien.ws.close(1000); } catch {} return; }
    const ws = phien.ws;
    p.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ setup: phien.setup }));
    ws.onmessage = async (ev) => {
      const tho = typeof ev.data === "string" ? ev.data : await ev.data.text();
      let m; try { m = JSON.parse(tho); } catch { return; }
      if (p.ws !== ws || !dangChay) return;
      this.xuLy(p, m);
    };
    ws.onerror = () => nk(this.ten(), `lỗi websocket phiên ${p.so + 1}`);
    ws.onclose = (ev) => {
      nk(this.ten(), `kết nối ${p.so + 1} đóng: code=${ev.code} lý do="${ev.reason || ""}"${p.ws !== ws ? " (kết nối cũ)" : ""}`);
      if (p.ws !== ws) return;
      if (ev.code !== 1000) this.tk.loi = ev.reason || `mã ${ev.code}`;
      p.sanSang = false;
      this.boDoanCuaPhien(p);
      capNhatTrangThai();
      if (!dangChay) return;
      if (ev.code !== 1000 && ev.reason) baoLoi(`Gemini (${this.ten()}): ${ev.reason}`);
      p.henLai = setTimeout(() => dangChay && this.phien.includes(p) && this.ketNoiPhien(p), ev.code === 1000 ? 300 : 2000);
    };
  }

  phienRanh() {
    const san = this.phien.filter((p) => p.sanSang && p.ws?.readyState === 1);
    return san.find((p) => !p.doan.length) || san.sort((a, b) => a.doan.length - b.doan.length)[0] || null;
  }

  taoDoan(p) {
    const d = { p, curIn: "", curOut: "", am: [], amLuot: new Set(), xong: false, vong: false, choNguon: false, coPhanHoi: false, dongTam: null };
    p.doan.push(d);
    this.doanCho.push(d);
    return d;
  }

  henBoDoan(d) {
    clearTimeout(d.henBo);
    d.henBo = setTimeout(() => {
      if (d.xong) return;
      nk(this.ten(), d.coPhanHoi ? "đoạn chờ Gemini quá lâu, chốt để đọc tiếp" : "đoạn không có lời, bỏ qua");
      d.p.doan = d.p.doan.filter((x) => x !== d);
      d.xong = true;
      this.xa();
    }, d.coPhanHoi ? CHO_DOAN_DO : CHO_DOAN_RONG);
  }

  boDoanCuaPhien(p) {
    if (this.dangNoi?.p === p) this.dangNoi = null;
    for (const d of p.doan) d.xong = true;
    p.doan = [];
    this.xa();
  }

  xuLy(p, m) {
    if (m.setupComplete) { p.sanSang = true; this.tk.loi = ""; nk(this.ten(), `kết nối ${p.so + 1} xong, sẵn sàng dịch`); anLoi(); capNhatTrangThai(); return; }
    if (m.goAway) { nk(this.ten(), `Gemini báo sắp ngắt phiên ${p.so + 1} (còn ${m.goAway.timeLeft || "?"}), nối phiên mới`); this.ketNoiPhien(p); return; }
    if (m.error) nk(this.ten(), `Gemini báo lỗi: ${JSON.stringify(m.error)}`);
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) nk(this.ten(), "bản dịch bị ngắt giữa chừng (interrupted)");
    const am = (sc.modelTurn?.parts || []).filter((x) => x.inlineData?.data).map((x) => x.inlineData.data);
    if (!sc.inputTranscription?.text && !sc.outputTranscription?.text && !am.length && !sc.turnComplete) return;

    const d = p.doan[0] || this.taoDoan(p);
    d.coPhanHoi = true;
    if (d.daCat) this.henBoDoan(d);
    if (sc.inputTranscription?.text) d.curIn += sc.inputTranscription.text;
    if (sc.outputTranscription?.text) d.curOut += sc.outputTranscription.text;
    if (this.vai === "toi" && !d.vong && khopTiengVong(d.curIn, this.banDichGanDay)) {
      d.vong = true;
      d.am = [];

      for (const src of d.amLuot) { try { src.stop(); } catch {} this.amDangPhat.delete(src); }
      d.amLuot.clear();
      if (this.ctxRa) this.dauPhat = Math.max(this.ctxRa.currentTime, ...[...this.amDangPhat].map((s) => s.ketThuc));
    }
    if (!d.vong) d.am.push(...am);

    if (this.vai === "toi" && am.length && !d.curIn.trim() && !d.henCho) d.henCho = setTimeout(() => { d.choNguon = true; this.xa(); }, 200);
    if (!d.vong && (d.curIn || d.curOut)) d.dongTam = veDong(d.dongTam, this.vai, d.curIn, d.curOut, true);
    if (sc.turnComplete) { p.doan = p.doan.filter((x) => x !== d); d.xong = true; }
    this.xa();
  }

  xa() {
    while (this.doanCho.length) {
      const d = this.doanCho[0];
      if (!d.vong && d.am.length && (this.vai !== "toi" || d.curIn.trim() || d.choNguon || d.xong)) {
        for (const b of d.am) this.phat(b, d);
        d.am = [];
      }
      if (!d.xong) break;
      this.doanCho.shift();
      this.chotDong(d);
    }
  }

  chotDong(d) {
    clearTimeout(d.henCho); clearTimeout(d.henBo);
    const goc = d.curIn.trim(), dich = d.curOut.trim();
    if (d.vong) { d.dongTam?.remove(); nk(this.ten(), "bỏ qua tiếng vọng khớp bản dịch vừa phát"); return; }
    if (dich) this.banDichGanDay = this.banDichGanDay.filter((b) => b.den > Date.now()).concat({ chu: dich, den: Date.now() + (this.hangCho() + 20) * 1000 }).slice(-4);
    if (!goc && !dich) { d.dongTam?.remove(); return; }
    veDong(d.dongTam, this.vai, goc, dich, false);
    nk(this.ten(), `câu: "${goc}" => "${dich}" | hàng chờ ${this.hangCho().toFixed(1)}s`);
    luuDong({ t: Date.now(), ai: this.vai, goc, dich });
  }

  guiAm({ pcm, muc }) {
    this.mucEl.style.width = Math.min(100, muc * 140) + "%";
    this.tk.mucMax = Math.max(this.tk.mucMax, muc);
    if (muc > NGUONG_TIENG) this.tk.lanTieng = Date.now();
    if (this.vai === "toi") {
      const khoa = loaDangKeu();
      datKhoaMic(khoa);
      if (khoa) { this.catDoan(); this.truocTieng = []; return; }
    }
    if (!this.dich || !this.sanSang) { this.dangNoi = null; this.truocTieng = []; return; }
    const b = new Uint8Array(pcm);
    let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    const goi = btoa(s), to = muc > NGUONG_TIENG, t = performance.now() / 1000;
    let d = this.dangNoi;
    if (!d) {
      this.truocTieng.push(goi);
      if (this.truocTieng.length > 3) this.truocTieng.shift();
      if (!to) return;
      const p = this.phienRanh();
      if (!p) return;
      d = this.dangNoi = this.taoDoan(p);
      d.batDau = t;
      for (const x of this.truocTieng) this.guiPhien(p, { audio: { data: x, mimeType: "audio/pcm;rate=16000" } });
      this.truocTieng = [];
    } else this.guiPhien(d.p, { audio: { data: goi, mimeType: "audio/pcm;rate=16000" } });
    if (to) d.lanTo = t;
    const lang = t - d.lanTo, dai = t - d.batDau;
    if ((dai >= CAT_SAU && lang >= CAT_LANG) || lang >= HET_LANG || dai >= TRAN_DOAN) this.catDoan();
  }

  guiPhien(p, realtimeInput) {
    if (p.ws?.readyState !== 1) return;
    p.ws.send(JSON.stringify({ realtimeInput }));
    if (realtimeInput.audio) this.tk.gui++;
  }

  catDoan() {
    const d = this.dangNoi;
    if (!d) return;
    this.dangNoi = null;
    d.daCat = true;
    this.guiPhien(d.p, { audioStreamEnd: true });
    this.henBoDoan(d);
  }

  phat(b64, d) {
    if (!this.dich) return;
    this.tk.nhan++;
    this.tk.lanDich = Date.now();
    const buf = pcmSangBuffer(this.ctxRa, b64);
    const src = this.ctxRa.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctxRa.destination);
    this.amDangPhat.add(src);
    const luot = d?.amLuot;
    luot?.add(src);
    src.onended = () => { this.amDangPhat.delete(src); luot?.delete(src); src.disconnect(); };
    const luc = Math.max(this.dauPhat, this.ctxRa.currentTime + 0.03);
    src.start(luc);
    this.dauPhat = luc + buf.duration;
    src.ketThuc = this.dauPhat;
  }

  datDich(bat) {
    this.dich = bat;
    if (!bat) { this.dungAm(); this.chotHet(); }
    this.capNhatDiThang();
  }

  chotHet() {
    this.dangNoi = null;
    for (const p of this.phien) p.doan = [];
    const cho = this.doanCho;
    this.doanCho = [];
    for (const d of cho) { d.xong = true; d.am = []; this.chotDong(d); }
  }

  dungAm() {
    for (const src of this.amDangPhat) { try { src.stop(); } catch {} }
    this.amDangPhat.clear();
    this.dauPhat = 0;
    for (const d of this.doanCho) { d.am = []; d.amLuot.clear(); }
  }

  dung() {
    this.lanDoi = (this.lanDoi || 0) + 1;
    this.dungAm();
    if (this.luong) nk(this.ten(), "dừng");
    this.luongTab?.getTracks().forEach((t) => t.stop());
    this.luongTab = null;
    const cacPhien = this.phien;
    this.phien = [];
    for (const p of cacPhien) {
      clearTimeout(p.henLai);
      const ws = p.ws; p.ws = null; p.sanSang = false;
      try { ws?.close(1000); } catch {}
    }
    this.luong?.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    this.ctxVao?.close(); this.ctxRa?.close(); this.ctxGia?.close();
    this.ctxVao = this.ctxRa = this.ctxGia = this.dichGia = this.diThang = this.luong = null;
    this.mucEl.style.width = "0";
    this.chotHet();
  }
}

setInterval(() => {
  if (!dangChay) return;
  for (const k of Object.values(kenh)) {
    if (!k.luong) continue;
    nk(k.ten(), `nhịp: gửi ${k.tk.gui} gói, nhận ${k.tk.nhan} gói tiếng dịch, mức tiếng vào cao nhất ${k.tk.mucMax.toFixed(3)}, hàng chờ ${k.hangCho().toFixed(1)}s, phiên=${k.phien.map((p) => (p.sanSang ? "sẵn" : "chờ") + "/" + p.doan.length).join(" ")}, âm thanh vào=${k.ctxVao?.state} ra=${k.ctxRa?.state}, dịch=${k.dich ? "bật" : "tắt"}`);
    k.tk.gui = 0; k.tk.nhan = 0; k.tk.mucMax = 0;
  }
}, 10000);

function truoc(t) {
  if (!t) return "chưa có";
  const s = Math.round((Date.now() - t) / 1000);
  return s < 2 ? "vừa xong" : `${s} giây trước`;
}
setInterval(() => {
  $("tinhTrang").style.display = dangChay ? "block" : "none";
  if (!dangChay) return;
  for (const [id, k] of [["ttToi", kenh.toi], ["ttDoiTac", kenh.doitac]]) {
    const o = $(id).children;
    if (!k.luong) { o[1].innerHTML = `<span class="xau">Không chạy</span>`; for (let i = 2; i < 6; i++) o[i].textContent = ""; continue; }
    o[1].textContent = "";
    const trangThai = document.createElement("span");
    const conNguon = k.luong.getAudioTracks().some((t) => t.readyState === "live");
    trangThai.className = !conNguon ? "xau" : !k.dich ? "vua" : k.sanSang ? "tot" : "xau";
    trangThai.textContent = !conNguon ? "Mất nguồn tiếng" : !k.dich ? "Đang tắt dịch" : k.sanSang ? "Tốt" : `Đang nối lại${k.tk.loi ? ": " + k.tk.loi : ""}`;
    o[1].appendChild(trangThai);
    const imLau = Date.now() - k.tk.lanTieng > 15000;
    o[2].innerHTML = imLau ? `<span class="vua">Im lặng ${truoc(k.tk.lanTieng)}</span>` : `<span class="tot">Có tiếng</span>`;
    o[3].textContent = truoc(k.tk.lanDich);
    const hc = k.hangCho();
    o[4].innerHTML = `<span class="${hc > 4 ? "xau" : hc > 2 ? "vua" : "tot"}">${hc.toFixed(1)} giây</span>`;
    o[5].textContent = k.tk.noiLai;
  }
}, 1000);

function baoLoi(chu) { const el = $("baoloi"); el.textContent = chu; el.style.display = "block"; capNhatTrangThai(true); }
function anLoi() { $("baoloi").style.display = "none"; }

function capNhatTrangThai(coLoi) {
  const cham = $("cham"), tt = $("tt");
  cham.className = "cham";
  if (!dangChay) { tt.textContent = "Chưa chạy"; $("ttphu").textContent = ""; datKhoaMic.cu = undefined; $("khoaMic").textContent = ""; return; }
  const sanSang = Object.values(kenh).some((k) => k.sanSang);
  if (coLoi && !sanSang) { cham.classList.add("loi"); tt.textContent = "Lỗi kết nối"; }
  else if (!sanSang) { cham.classList.add("cho"); tt.textContent = "Đang kết nối"; }
  else { cham.classList.add("chay"); tt.textContent = "Đang dịch"; }
  $("ttphu").textContent = Object.values(kenh).map((k) => `${k.vai === "toi" ? "Tôi" : "Đối tác"}: ${!k.dich ? "không dịch" : k.sanSang ? "sẵn sàng" : "chờ"}`).join(" · ");
}

function veGoiY() {
  const nn = $("ngonNgu").value, vt = viTat(nn);
  const tenNN = $("ngonNgu").selectedOptions[0].textContent;
  $("nhanToi").textContent = kenh.toi.dich ? `VI → ${vt}` : "Nói thẳng";
  $("nhanDoiTac").textContent = kenh.doitac.dich ? `${vt} → VI` : "Tiếng gốc";
  document.querySelector('[data-vai="toi"][data-dich="0"]').textContent = `Tôi tự nói ${tenNN.replace("Tiếng ", "tiếng ")}`;
  $("goiyToi").textContent = kenh.toi.dich
    ? `Anh nói tiếng Việt, đối tác nghe ${tenNN.toLowerCase()}.`
    : `Giọng anh đi thẳng sang đối tác, không qua dịch, không tốn phí.`;
  $("goiyDoiTac").textContent = kenh.doitac.dich
    ? `Đối tác nói ${tenNN.toLowerCase()}, anh nghe tiếng Việt.`
    : `Anh nghe thẳng tiếng gốc của đối tác.`;

  if (dangChay) {
    const tenRa = (id) => (id ? $(id).selectedOptions[0]?.textContent : "") || "loa mặc định của máy";
    if (kenh.toi.ctxRa && kenh.toi.dich) {
      const tuNghe = $("tuNghe").checked;
      $("goiyToi").textContent = tuNghe
        ? `Bản dịch của anh đang phát ra loa mặc định để anh tự nghe thử.`
        : `Bản dịch của anh đang phát vào: ${tenRa("raToi")}. Anh sẽ không nghe thấy, chỉ đối tác nghe. Muốn tự nghe thì tích ô "Nghe bản dịch của tôi qua loa".`;
    }
    if (kenh.doitac.ctxRa && kenh.doitac.dich) $("goiyDoiTac").textContent += ` Đang phát ra: ${tenRa("raDoiTac")}.`;
  }
  document.querySelectorAll(".chedo button").forEach((b) => {
    b.classList.toggle("bat", kenh[b.dataset.vai].dich === (b.dataset.dich === "1"));
  });
  capNhatTrangThai();
}

function datCheDo(vai, bat) {
  kenh[vai].datDich(bat);
  LUU("dich-" + vai, bat);
  veGoiY();
}

function gio(t) { return new Date(t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); }

function veDong(el, ai, goc, dich, dang) {
  const khung = $("loiDich");
  khung.querySelector(".trong")?.remove();
  if (!el) {
    el = document.createElement("div");
    el.innerHTML = `<div><div class="gio"></div><div class="ai"></div></div><div><div class="dich"></div><div class="goc"></div></div>`;
    el.querySelector(".gio").textContent = gio(Date.now());
    el.querySelector(".ai").textContent = ai === "toi" ? "TÔI" : "HỌ";
    khung.appendChild(el);
  }
  el.className = `dong ${ai}${dang ? " dang" : ""}`;
  el.querySelector(".dich").textContent = dich || "…";
  el.querySelector(".goc").textContent = goc;
  khung.scrollTop = khung.scrollHeight;
  return el;
}

function luuDong(d) {
  if (!cuocHop) return;
  cuocHop.dong.push(d);
  const ds = DOC("lichsu", []);
  const i = ds.findIndex((c) => c.id === cuocHop.id);
  if (i >= 0) ds[i] = cuocHop; else ds.unshift(cuocHop);
  LUU("lichsu", ds.slice(0, 100));
}

async function chay() {
  anLoi();
  dangChay = true;
  $("nutChay").textContent = "Dừng"; $("nutChay").className = "nut dung";
  $("nutGiaNoi").disabled = false;
  cuocHop = { id: Date.now(), batDau: Date.now(), boiCanh: $("boiCanh").value.trim(), ngonNgu: $("ngonNgu").value, dong: [] };
  $("loiDich").innerHTML = "";
  batDauLuc = Date.now();
  capNhatTrangThai();

  let loiTab = null;
  if ($("nguonDoiTac").value === NGUON_TAB) {
    try {
      kenh.doitac.luongTab = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { suppressLocalAudioPlayback: $("tatGoc").checked, restrictOwnAudio: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        selfBrowserSurface: "exclude",
        preferCurrentTab: false,
      });
    } catch (e) { loiTab = e; }
  }
  for (const k of Object.values(kenh)) {
    try {
      if (k.vai === "doitac" && loiTab) throw loiTab;
      await k.batDau();
    } catch (e) {
      nk(k.ten(), `không bắt đầu được: ${e.name}: ${e.message}`);
      const biChan = e.name === "NotAllowedError";
      const goiY = k.vai === "doitac" && $("nguonDoiTac").value === NGUON_TAB
        ? "chưa chia sẻ được tab họp. Có thể anh đã bấm Huỷ ở bảng chọn tab, hoặc macOS chưa cho Chrome ghi màn hình (Cài đặt hệ thống > Quyền riêng tư và bảo mật > Ghi màn hình và âm thanh hệ thống > bật Google Chrome, rồi mở lại Chrome)."
        : "chưa được cấp quyền micro. Nếu đang mở trong khung xem trước của Claude thì hãy mở trang này bằng Chrome; nếu đang ở Chrome thì bấm biểu tượng ổ khoá trên thanh địa chỉ, cho phép Micro.";
      baoLoi(`${k.ten()}: ${biChan ? goiY : e.message || e}`);
      k.dung();
    }
  }
  if (!Object.values(kenh).some((k) => k.luong)) dung();
  napThietBi();
}

function dung() {
  dangChay = false;
  Object.values(kenh).forEach((k) => k.dung());
  $("nutChay").textContent = "Bắt đầu"; $("nutChay").className = "nut chinh";
  $("nutGiaNoi").disabled = true;
  capNhatTrangThai();
  veLichSu();
}

setInterval(() => {
  if (!dangChay) return;
  const s = Math.floor((Date.now() - batDauLuc) / 1000);
  $("dongho").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}, 500);

async function napThietBi() {
  let ds = await navigator.mediaDevices.enumerateDevices();
  if (ds.some((d) => d.kind === "audioinput" && !d.label)) {
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); } catch {}
    ds = await navigator.mediaDevices.enumerateDevices();
  }
  const vao = ds.filter((d) => d.kind === "audioinput");
  const ra = ds.filter((d) => d.kind === "audiooutput");
  const laCable = (d) => /cable|blackhole/i.test(d.label);
  const dien = (id, list, them, macDinh) => {
    const sel = $(id), cu = DOC("tb-" + id, "") || sel.value;
    sel.innerHTML = "";
    for (const [v, t] of them) sel.add(new Option(t, v));
    for (const d of list) sel.add(new Option(d.label || "Thiết bị chưa đặt tên", d.deviceId));
    const coCu = !!cu && [...sel.options].some((o) => o.value === cu);
    sel.value = coCu ? cu : macDinh?.(list) ?? sel.options[0]?.value ?? "";
  };
  dien("micToi", vao.filter((d) => !laCable(d)), [], (l) => l.find((d) => d.deviceId === "default")?.deviceId);
  dien("raToi", ra, [], (l) => l.find(laCable)?.deviceId ?? "");
  dien("nguonDoiTac", vao, [[NGUON_TAB, "Chia sẻ tab Chrome đang họp (khuyên dùng)"], [NGUON_GIA, "Đối tác giả (chế độ thử)"]], () => NGUON_TAB);
  dien("raDoiTac", ra.filter((d) => !laCable(d)), [], (l) => l.find((d) => d.deviceId === "default")?.deviceId);
  if (!ra.some(laCable)) $("goiyToi").textContent = "Chưa thấy VB-Cable trong danh sách loa ra. Kiểm tra lại VB-Cable.";
}

async function batDauThu() {
  if (dangChay) dung();
  $("nguonDoiTac").value = NGUON_GIA;
  $("tuNghe").checked = true;
  datCheDo("doitac", true);
  await chay();

  for (let i = 0; i < 40 && dangChay && !kenh.doitac.sanSang; i++) await new Promise((r) => setTimeout(r, 250));
  if (dangChay && kenh.doitac.sanSang) doiTacGiaNoi();
}

async function doiTacGiaNoi() {
  const k = kenh.doitac;
  if (!dangChay || !k.tuGia || !k.dichGia) return baoLoi('Bấm "Bắt đầu thử" trước, hoặc chọn nguồn "Đối tác giả" rồi bấm Bắt đầu.');
  const goTay = $("cauGia").value.trim();
  const cau = goTay || CAU_GIA[soCauGia++ % CAU_GIA.length];
  $("cauGia").value = "";
  $("nutGiaNoi").disabled = true;
  let phien;
  try { phien = await moPhien("gia"); }
  catch (e) { $("nutGiaNoi").disabled = !dangChay; return baoLoi(`Đối tác giả: ${e.message}`); }
  const ws = phien.ws;
  const xong = () => { $("nutGiaNoi").disabled = !dangChay; try { ws.close(1000); } catch {} };
  const henGio = setTimeout(xong, 20000);
  ws.onopen = () => ws.send(JSON.stringify({ setup: phien.setup }));
  ws.onmessage = async (ev) => {
    let m; try { m = JSON.parse(typeof ev.data === "string" ? ev.data : await ev.data.text()); } catch { return; }
    if (m.setupComplete) return ws.send(JSON.stringify({ realtimeInput: { text: `<line>${cau}</line>` } }));
    for (const p of m.serverContent?.modelTurn?.parts || []) {
      if (p.inlineData?.data && k.ctxGia) {
        const buf = pcmSangBuffer(k.ctxGia, p.inlineData.data);
        const src = k.ctxGia.createBufferSource();
        src.buffer = buf;
        src.connect(k.dichGia);
        const luc = Math.max(k.dauGia, k.ctxGia.currentTime + 0.03);
        src.start(luc);
        k.dauGia = luc + buf.duration;
      }
    }
    if (m.serverContent?.turnComplete) { clearTimeout(henGio); xong(); }
  };
  ws.onclose = () => { clearTimeout(henGio); $("nutGiaNoi").disabled = !dangChay; };
}

async function ngheThuGiong() {
  const nut = $("nutNgheGiong");
  nut.disabled = true;
  nut.textContent = "Đang đọc…";
  const ctx = new AudioContext({ sampleRate: 24000 });
  let dau = 0, ws = null;
  const xong = () => { nut.disabled = false; nut.textContent = "Nghe thử giọng"; try { ws?.close(1000); } catch {} setTimeout(() => ctx.close(), Math.max(0, (dau - ctx.currentTime) * 1000) + 500); };
  try {
    await ctx.resume();
    ws = await moPhienNgheThu();
  } catch (e) { xong(); return baoLoi(`Nghe thử giọng: ${e.message}`); }
  const henGio = setTimeout(xong, 25000);
  ws.onmessage = async (ev) => {
    let m; try { m = JSON.parse(typeof ev.data === "string" ? ev.data : await ev.data.text()); } catch { return; }
    if (m.setupComplete) return ws.send(JSON.stringify({ realtimeInput: { text: CAU_NGHE_THU } }));
    for (const p of m.serverContent?.modelTurn?.parts || []) {
      if (!p.inlineData?.data) continue;
      const buf = pcmSangBuffer(ctx, p.inlineData.data);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      const luc = Math.max(dau, ctx.currentTime + 0.05);
      src.start(luc);
      dau = luc + buf.duration;
    }
    if (m.serverContent?.turnComplete) { clearTimeout(henGio); xong(); }
  };
  ws.onclose = () => { clearTimeout(henGio); nut.disabled = false; nut.textContent = "Nghe thử giọng"; };
}

function luuGiongTaiKhoan(g) {
  fetch("/api/dich-hop/giong", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ giong: g }) })
    .then((r) => { if (!r.ok) nk("trang", `không lưu được giọng theo tài khoản (mã ${r.status})`); })
    .catch(() => nk("trang", "không lưu được giọng theo tài khoản (mất mạng)"));
}

function doiGiongToi(g, luuTaiKhoan = true) {
  if (!GIONG.includes(g)) return;
  $("giongToi").value = g;
  LUU("giongToi", g);
  veGioiTinh();
  if (dangChay && kenh.toi.luong) kenh.toi.ketNoi();
  if (luuTaiKhoan) luuGiongTaiKhoan(g);
}

function veGioiTinh() {
  const nu = GIONG_NU.includes($("giongToi").value);
  document.querySelectorAll(".chongiong button").forEach((b) => b.classList.toggle("bat", (b.dataset.gioi === "nu") === nu));
}

function vanBan(c) {
  return [`Cuộc họp ${new Date(c.batDau).toLocaleString("vi-VN")}`, c.boiCanh ? `Bối cảnh: ${c.boiCanh}` : "", ""]
    .concat(c.dong.map((d) => `[${gio(d.t)}] ${d.ai === "toi" ? "TÔI" : "HỌ"}: ${d.goc}\n        -> ${d.dich}`))
    .join("\n");
}

function veLichSu() {
  const ds = DOC("lichsu", []), khung = $("dsLichSu");
  khung.innerHTML = ds.length ? "" : `<div class="trong">Chưa có cuộc họp nào.</div>`;
  for (const c of ds) {
    const dong = document.createElement("div");
    dong.className = "ls";
    const ten = document.createElement("div");
    ten.innerHTML = `<b></b><div class="nho"></div>`;
    ten.querySelector("b").textContent = new Date(c.batDau).toLocaleString("vi-VN");
    ten.querySelector(".nho").textContent = `${c.dong.length} câu${c.boiCanh ? " · " + c.boiCanh.slice(0, 80) : ""}`;
    const nut = document.createElement("div");
    const xem = Object.assign(document.createElement("button"), { className: "nut", textContent: "Xem" });
    const tai = Object.assign(document.createElement("button"), { className: "nut", textContent: "Tải .txt" });
    tai.style.marginLeft = "6px";
    xem.onclick = () => { const x = $("xemLichSu"); x.style.display = "block"; x.innerHTML = ""; const pre = document.createElement("pre"); pre.style.whiteSpace = "pre-wrap"; pre.style.font = "inherit"; pre.textContent = vanBan(c); x.appendChild(pre); };
    tai.onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([vanBan(c)], { type: "text/plain;charset=utf-8" }));
      a.download = `dich-hop-${new Date(c.batDau).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`;
      a.click();
    };
    nut.append(xem, tai);
    dong.append(ten, nut);
    khung.appendChild(dong);
  }
}

async function khoiDong() {
  nk("trang", `mở trang (${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || navigator.userAgent})`);
  kenh.toi = new Kenh("toi");
  kenh.doitac = new Kenh("doitac");
  kenh.toi.dich = DOC("dich-toi", true);
  kenh.doitac.dich = DOC("dich-doitac", true);

  for (const id of ["giongToi", "giongDoiTac"]) {
    for (const [nhan, ds] of [["Giọng nam", GIONG_NAM], ["Giọng nữ", GIONG_NU]]) {
      const nhom = document.createElement("optgroup");
      nhom.label = nhan;
      for (const g of ds) nhom.appendChild(new Option(TEN_GIONG[g] || g, g));
      $(id).appendChild(nhom);
    }
  }
  $("giongToi").value = DOC("giongToi", "Sadaltager");
  $("giongDoiTac").value = DOC("giongDoiTac", "Erinome");
  $("ngonNgu").value = DOC("ngonNgu", "English");
  $("boiCanh").value = DOC("boiCanh", "");
  $("tatGoc").checked = DOC("tatGoc", true);
  $("loaNgoai").checked = DOC("loaNgoai", true);

  for (const id of ["giongDoiTac", "ngonNgu"]) $(id).addEventListener("change", () => { LUU(id, $(id).value); veGoiY(); if (dangChay) Object.values(kenh).forEach((k) => k.luong && k.ketNoi()); });
  $("giongToi").addEventListener("change", () => doiGiongToi($("giongToi").value));
  document.querySelectorAll(".chongiong button").forEach((b) => (b.onclick = () => {
    const ds = b.dataset.gioi === "nu" ? GIONG_NU : GIONG_NAM;
    if (!ds.includes($("giongToi").value)) doiGiongToi(ds[0]);
  }));
  veGioiTinh();
  for (const id of ["micToi", "raToi", "nguonDoiTac", "raDoiTac"]) $(id).addEventListener("change", async () => {
    LUU("tb-" + id, $(id).value);
    if (!dangChay) return;
    const k = id === "micToi" || id === "raToi" ? kenh.toi : kenh.doitac;
    if (id === "raToi" || id === "raDoiTac") {
      try { await k.datLoaRa(); } catch (e) { baoLoi(`Không chuyển được loa: ${e.message}`); }
    } else if (id === "nguonDoiTac") {
      baoLoi("Đã đổi nguồn đối tác. Bấm Dừng rồi Bắt đầu để lấy lại nguồn tiếng.");
    } else await k.doiMicro();
  });
  $("boiCanh").addEventListener("change", () => { LUU("boiCanh", $("boiCanh").value); if (dangChay) Object.values(kenh).forEach((k) => k.luong && k.ketNoi()); });
  $("tatGoc").addEventListener("change", () => { LUU("tatGoc", $("tatGoc").checked); kenh.doitac.capNhatDiThang(); });
  $("loaNgoai").addEventListener("change", () => { LUU("loaNgoai", $("loaNgoai").checked); nk("trang", `loa ngoài=${$("loaNgoai").checked}`); });

  document.querySelectorAll(".chedo button").forEach((b) => (b.onclick = () => datCheDo(b.dataset.vai, b.dataset.dich === "1")));
  document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => {
    document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("chon", x === b));
    document.querySelectorAll(".trang").forEach((s) => s.classList.toggle("hien", s.id === b.dataset.trang));
    if (b.dataset.trang === "lichsu") veLichSu();
  }));
  document.addEventListener("keydown", (e) => {
    if (e.target.matches?.("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "t") datCheDo("toi", !kenh.toi.dich);
    if (k === "d") datCheDo("doitac", !kenh.doitac.dich);
  });
  $("nutChay").onclick = () => (dangChay ? dung() : chay());
  $("nutThu").onclick = batDauThu;
  $("nutNgheGiong").onclick = ngheThuGiong;
  $("nutGiaNoi").onclick = doiTacGiaNoi;
  $("cauGia").addEventListener("keydown", (e) => e.key === "Enter" && doiTacGiaNoi());
  $("tuNghe").addEventListener("change", () => kenh.toi.datLoaRa());
  navigator.mediaDevices.addEventListener("devicechange", async () => {
    await napThietBi();
    if (!dangChay) return;
    for (const k of Object.values(kenh)) {
      if (!k.luong || k.tuGia) continue;
      const track = k.luong.getAudioTracks()[0];
      const id = $(k.vai === "toi" ? "micToi" : "nguonDoiTac").value;
      if (!k.tuTab && (track?.readyState === "ended" || id !== track?.getSettings().deviceId)) await k.doiMicro();
      try { await k.datLoaRa(); } catch (e) { baoLoi(`Thiết bị phát đã đổi: ${e.message}. Kiểm tra lại loa và micro trong Zoom.`); }
    }
  });

  veGoiY();
  veLichSu();
  napThietBi();
  fetch("/api/dich-hop/giong").then((r) => r.json()).then((j) => { if (j.giong && j.giong !== $("giongToi").value) doiGiongToi(j.giong, false); }).catch(() => {});
  $("nutTaiNhatKy").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([DOC("nhatky", []).concat(nhatKyCho).join("\n")], { type: "text/plain;charset=utf-8" }));
    a.download = `nhat-ky-dich-hop-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`;
    a.click();
  };
}

khoiDong();
