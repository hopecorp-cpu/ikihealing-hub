"use client";

export type TrangThaiLive = "nghe" | "dang-nghi" | "dang-noi";

type GoiLai = {
  trangThai: (s: TrangThaiLive) => void;
  nghe: (text: string) => void;
  noi: (text: string) => void;
  xongLuot: (anh: string, em: string) => void;
  viec: (ten: string) => void;
  loi: (msg: string) => void;

  chanTieng?: (bi: boolean) => void;
  mucAm: { current: number };
};

const WS = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=";

const WORKLET = `class GomMic extends AudioWorkletProcessor {
  process(inputs) { const c = inputs[0] && inputs[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; }
}
registerProcessor("gom-mic", GomMic);`;

function sangBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
  return btoa(s);
}

function tuBase64(s: string): Int16Array {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new Int16Array(b.buffer, 0, b.length >> 1);
}

export class PhienLive {
  private ws: WebSocket | null = null;
  private mic: MediaStream | null = null;
  private ctxMic: AudioContext | null = null;
  private ctxPhat: AudioContext | null = null;
  private nguon: AudioBufferSourceNode[] = [];
  private phatToi = 0;
  private gom: Float32Array[] = [];
  private soMau = 0;

  private choGui: string[] = [];
  private handle = "";
  private giong = "";
  private dangMo = false;
  private sanSang = false;
  private tatMic = false;
  private anh = "";
  private em = "";
  private noiLai = 0;
  private hetPhat: ReturnType<typeof setTimeout> | null = null;

  constructor(private cb: GoiLai) {}

  async bat(giong: string): Promise<boolean> {
    this.giong = giong;
    this.dangMo = true;
    this.noiLai = 0;

    this.ctxPhat = new AudioContext({ sampleRate: 24000 });
    this.ctxPhat.onstatechange = () => this.kiemTieng();
    this.ctxPhat.resume().catch(() => {});
    try {

      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch {
      this.cb.loi("Trình duyệt chưa cho dùng micro. Anh bấm biểu tượng ổ khoá trên thanh địa chỉ để cho phép.");
      this.dangMo = false;
      return false;
    }
    this.ctxMic = new AudioContext({ sampleRate: 16000 });
    this.ctxMic.resume().catch(() => {});
    this.kiemTieng();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await this.ctxMic.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(this.ctxMic, "gom-mic");
    node.port.onmessage = (e) => this.nhanMau(e.data as Float32Array);
    this.ctxMic.createMediaStreamSource(this.mic).connect(node);
    return this.ketNoi();
  }

  private async ketNoi(): Promise<boolean> {
    const r = await fetch("/api/tro-ly-giong/live", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giong: this.giong, handle: this.handle || undefined }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok || !j.token) { this.cb.loi(j.error || "Chưa mở được phiên gọi, anh thử lại giúp em"); return false; }
    if (!this.dangMo) return false;
    this.sanSang = false;
    const ws = new WebSocket(WS + encodeURIComponent(j.token));
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ setup: j.setup }));
    ws.onmessage = (ev) => this.nhanTin(ev.data);
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null; this.sanSang = false;

      if (this.dangMo && this.noiLai < 3) { this.noiLai++; this.ketNoi(); }
      else if (this.dangMo) { this.cb.loi(`Mất kết nối (${ev.code}), anh bấm gọi lại giúp em`); this.tat(); }
    };
    return true;
  }

  private nhanMau(c: Float32Array) {
    let tong = 0;
    for (let i = 0; i < c.length; i++) tong += c[i] * c[i];
    this.cb.mucAm.current = Math.min(1, Math.sqrt(tong / c.length) * 5);
    if (!this.dangMo || this.tatMic) return;
    this.gom.push(c); this.soMau += c.length;
    if (this.soMau < 1600) return;
    const pcm = new Int16Array(this.soMau);
    let k = 0;
    for (const m of this.gom) for (let i = 0; i < m.length; i++) { const v = Math.max(-1, Math.min(1, m[i])); pcm[k++] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    this.gom = []; this.soMau = 0;
    const tin = JSON.stringify({ realtimeInput: { audio: { data: sangBase64(pcm.buffer), mimeType: "audio/pcm;rate=16000" } } });
    if (this.sanSang && this.ws?.readyState === WebSocket.OPEN) this.ws.send(tin);
    else { this.choGui.push(tin); if (this.choGui.length > 100) this.choGui.shift(); }
  }

  private kiemTieng() {
    const bi = !!this.ctxPhat && this.ctxPhat.state !== "running" && this.dangMo;
    this.cb.chanTieng?.(bi);
  }

  batTieng() {
    this.ctxPhat?.resume().catch(() => {});
    this.ctxMic?.resume().catch(() => {});
    setTimeout(() => this.kiemTieng(), 100);
  }

  private phat(b64: string) {
    const ctx = this.ctxPhat;
    if (!ctx) return;
    if (ctx.state !== "running") this.kiemTieng();
    const s = tuBase64(b64);
    const f = new Float32Array(s.length);
    for (let i = 0; i < s.length; i++) f[i] = s[i] / 0x8000;
    const buf = ctx.createBuffer(1, f.length, 24000);
    buf.copyToChannel(f, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    const luc = Math.max(ctx.currentTime + 0.03, this.phatToi);
    src.start(luc);
    this.phatToi = luc + buf.duration;
    this.nguon.push(src);
    src.onended = () => { this.nguon = this.nguon.filter((x) => x !== src); };
    this.cb.trangThai("dang-noi");
    if (this.hetPhat) clearTimeout(this.hetPhat);
    this.hetPhat = setTimeout(() => { if (this.dangMo) this.cb.trangThai("nghe"); }, (this.phatToi - ctx.currentTime) * 1000 + 150);
  }

  ngat() {
    for (const s of this.nguon) { try { s.stop(); } catch {} }
    this.nguon = []; this.phatToi = 0;
    if (this.hetPhat) clearTimeout(this.hetPhat);
    if (this.dangMo) this.cb.trangThai("nghe");
  }

  private async nhanTin(data: unknown) {
    const txt = typeof data === "string" ? data : await (data as Blob).text();
    let m: any; try { m = JSON.parse(txt); } catch { return; }
    if (m.setupComplete) {
      this.sanSang = true; this.noiLai = 0; this.cb.trangThai("nghe");
      for (const tin of this.choGui) this.ws?.send(tin);
      this.choGui = [];
      return;
    }
    if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) this.handle = m.sessionResumptionUpdate.newHandle;
    if (m.goAway) { const cu = this.ws; this.ws = null; cu?.close(1000); this.ketNoi(); return; }
    if (m.toolCall?.functionCalls?.length) { this.chayCongCu(m.toolCall.functionCalls); return; }
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) this.ngat();
    if (sc.inputTranscription?.text) {
      this.anh += sc.inputTranscription.text; this.cb.nghe(this.anh.trim());
      if (!this.nguon.length) this.cb.trangThai("dang-nghi");
    }
    if (sc.outputTranscription?.text) { this.em += sc.outputTranscription.text; this.cb.noi(this.em.trim()); }
    for (const p of sc.modelTurn?.parts || []) if (p.inlineData?.data) this.phat(p.inlineData.data);
    if (sc.turnComplete) {
      if (this.anh.trim() || this.em.trim()) this.cb.xongLuot(this.anh.trim(), this.em.trim());
      this.anh = ""; this.em = "";
    }
  }

  private async chayCongCu(calls: Array<{ id: string; name: string; args?: any }>) {
    const ketQua = [];
    for (const c of calls) {
      this.cb.viec(c.name);
      this.cb.trangThai("dang-nghi");
      const r = await fetch("/api/tro-ly-giong/cong-cu", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: c.name, args: c.args || {} }),
      }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      ketQua.push({ id: c.id, name: c.name, response: { result: String(j.result || j.error || "Công cụ lỗi, chưa làm được.") } });
    }
    this.cb.viec("");
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ toolResponse: { functionResponses: ketQua } }));
  }

  guiChu(text: string) {
    if (!this.ws || !this.sanSang) return false;
    this.ngat();
    this.anh = text;
    this.ws.send(JSON.stringify({ realtimeInput: { text } }));
    this.cb.trangThai("dang-nghi");
    return true;
  }

  datTatMic(tat: boolean) {
    this.tatMic = tat;
    if (tat && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }

  async doiGiong(giong: string) {
    this.giong = giong;
    if (!this.dangMo) return;
    const cu = this.ws; this.ws = null; cu?.close(1000);
    this.ngat();

    this.handle = "";
    await this.ketNoi();
  }

  get dangGoi() { return this.dangMo; }

  tat() {
    this.dangMo = false; this.sanSang = false;
    const cu = this.ws; this.ws = null; cu?.close(1000);
    this.ngat();
    this.mic?.getTracks().forEach((t) => t.stop()); this.mic = null;
    this.ctxMic?.close().catch(() => {}); this.ctxMic = null;
    this.ctxPhat?.close().catch(() => {}); this.ctxPhat = null;
    this.cb.mucAm.current = 0;
    this.handle = ""; this.choGui = [];
  }
}
