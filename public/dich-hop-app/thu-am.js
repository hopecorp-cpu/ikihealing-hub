class ThuAm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tiLe = sampleRate / 16000;
    this.viTri = 0;
    this.goi = new Int16Array(1600);
    this.n = 0;
    this.mucAm = 0;
  }
  process(inputs) {
    const kenh = inputs[0] && inputs[0][0];
    if (!kenh) return true;
    let dinh = 0;
    for (let i = 0; i < kenh.length; i++) {
      const v = kenh[i];
      if (Math.abs(v) > dinh) dinh = Math.abs(v);
      this.viTri += 1;
      if (this.viTri >= this.tiLe) {
        this.viTri -= this.tiLe;
        const s = Math.max(-1, Math.min(1, v));
        this.goi[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.n === this.goi.length) {
          this.port.postMessage({ pcm: this.goi.buffer, muc: this.mucAm }, [this.goi.buffer]);
          this.goi = new Int16Array(1600);
          this.n = 0;
          this.mucAm = 0;
        }
      }
    }
    this.mucAm = Math.max(this.mucAm, dinh);
    return true;
  }
}
registerProcessor("thu-am", ThuAm);
