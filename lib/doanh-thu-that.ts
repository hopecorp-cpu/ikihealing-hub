import { getConfigValue } from "@/lib/app-config";
import { getServiceClient } from "@/lib/supabase-server";
import { VAT_RATE } from "@/lib/money";

const VAT_MUL = 1 + VAT_RATE;

const toNet = (gop: number): number => Math.round(gop / VAT_MUL);

export type LopThang = {
  thang: string;

  soDon: number | null;
  tienSoDon: number | null;

  nguonSoDon: "tg_orders" | "so-whatsapp" | null;

  vanDon: number | null;
  codJt: number | null;
  codDaThu: number | null;
  donCkTruoc: number | null;

  tienVeJt: number | null;
  tienVeTong: number | null;

  doanhThu: number | null;
  nguon: "so-don" | "jt" | "chua-co";

  khopJt: number | null;
  canhBao: string[];
};

export type DoanhThuThat = {
  thang: LopThang[];
  caveats: string[];

  tuoiNguon: { soDonToi: string | null; jtToi: string | null; nganHangToi: string | null };
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

type MbTx = { date?: string | null; amount?: number; type?: string; isJt?: boolean; ref?: string };

const FINANCING_REFS = new Set(["TT26028057212872", "TT26014229167333", "FT25349346000335"]);

async function docJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await getConfigValue(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function fetchAll<T>(q: (from: number, to: number) => any, step = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += step) {
    const { data, error } = await q(from, from + step - 1);
    if (error || !data || !data.length) break;
    out.push(...(data as T[]));
    if (data.length < step) break;
  }
  return out;
}

export async function doanhThuTheoThang(): Promise<DoanhThuThat> {
  const sb = getServiceClient();

  const [tgOrdersRaw, daLoaiCfg, soDonCfg, jtRows, mbTx, tcbTx] = await Promise.all([

    fetchAll<{ chat_id: string | null; message_id: number | null; ngay: string | null; khach_tra: number | null }>((f, t) =>
      sb.from("tg_orders").select("chat_id,message_id,ngay,khach_tra").range(f, t)
    ).catch(() => [] as Array<{ chat_id: string | null; message_id: number | null; ngay: string | null; khach_tra: number | null }>),

    docJson<Record<string, unknown>>("sale_excluded_orders"),

    sb.from("config").select("key,value").like("key", "wa_donhang_%").then((r: any) => (r.data || []) as Array<{ key: string; value: string }>),

    fetchAll<{ order_create_time: string | null; cod_value: number | null; real_cod_value: number | null; collect_time: string | null; is_void: boolean | null }>(
      (f, t) => sb.from("jt_waybills").select("order_create_time,cod_value,real_cod_value,collect_time,is_void").range(f, t)
    ),
    docJson<MbTx[]>("mb_transactions"),
    docJson<MbTx[]>("tcb_transactions"),
  ]);

  const thang = new Map<string, LopThang>();
  const at = (m: string): LopThang => {
    let x = thang.get(m);
    if (!x) {
      x = {
        thang: m, soDon: null, tienSoDon: null, nguonSoDon: null, vanDon: null, codJt: null,
        codDaThu: null, donCkTruoc: null, tienVeJt: null, tienVeTong: null, doanhThu: null,
        nguon: "chua-co", khopJt: null, canhBao: [],
      };
      thang.set(m, x);
    }
    return x;
  };

  const daLoai = new Set(Object.keys(daLoaiCfg || {}));
  const tgOrders = tgOrdersRaw.filter((r) => !daLoai.has(`TG-${r.chat_id}-${r.message_id}`));
  let soDonToi: string | null = null;
  for (const r of tgOrders) {
    const m = (r.ngay || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    const x = at(m);
    x.soDon = (x.soDon || 0) + 1;
    x.tienSoDon = (x.tienSoDon || 0) + num(r.khach_tra);
    x.nguonSoDon = "tg_orders";
    if (!soDonToi || m > soDonToi) soDonToi = m;
  }

  for (const c of soDonCfg) {
    if (c.key === "wa_donhang_hangdoi") continue;
    let v: { thang?: string; don?: number; tien?: number } | null = null;
    try {
      v = JSON.parse(c.value);
    } catch {
      continue;
    }
    const m = (v?.thang || c.key.replace("wa_donhang_", "").replace("_", "-")).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    const x = at(m);

    if (x.nguonSoDon === "tg_orders") continue;
    x.soDon = num(v?.don) || null;
    x.tienSoDon = num(v?.tien) || null;
    x.nguonSoDon = "so-whatsapp";
    if (!soDonToi || m > soDonToi) soDonToi = m;
  }

  let jtToi: string | null = null;
  for (const r of jtRows) {
    if (r.is_void === true) continue;
    const m = (r.order_create_time || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    const x = at(m);
    x.vanDon = (x.vanDon || 0) + 1;
    const cod = num(r.cod_value);
    x.codJt = (x.codJt || 0) + cod;
    if (!cod) x.donCkTruoc = (x.donCkTruoc || 0) + 1;
    if (r.collect_time) x.codDaThu = (x.codDaThu || 0) + num(r.real_cod_value);
    if (!jtToi || m > jtToi) jtToi = m;
  }

  let nganHangToi: string | null = null;
  for (const t of [...(mbTx || []), ...(tcbTx || [])]) {
    const m = (t.date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m) || t.type !== "credit") continue;
    if (FINANCING_REFS.has(t.ref || "")) continue;
    const x = at(m);
    x.tienVeTong = (x.tienVeTong || 0) + num(t.amount);
    if (t.isJt) x.tienVeJt = (x.tienVeJt || 0) + num(t.amount);
    if (!nganHangToi || m > nganHangToi) nganHangToi = m;
  }

  const thangCoJt = [...thang.values()].filter((x) => x.vanDon).map((x) => x.thang).sort();
  const jtDau = thangCoJt[0] || null;
  const thangNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);

  for (const x of thang.values()) {

    if (x.tienSoDon) {
      x.doanhThu = toNet(x.tienSoDon);
      x.nguon = "so-don";
      if (x.nguonSoDon === "so-whatsapp") {
        x.canhBao.push(
          "Lấy từ sổ WhatsApp bóc TAY (nguồn đã dừng), không phải sổ đơn Telegram tự động — " +
            "sổ tay thiếu đơn hơn, nên số này là mức SÀN."
        );
      }
    } else if (x.codJt) {
      x.doanhThu = toNet(x.codJt);
      x.nguon = "jt";
      x.canhBao.push(
        "Chưa bóc sổ đơn nhóm cho tháng này nên đang tạm dùng COD J&T. Số này THẤP HƠN THẬT vì " +
          `${x.donCkTruoc || 0} đơn khách chuyển khoản trước có COD bằng 0.`
      );
    } else {
      x.canhBao.push("Chưa có sổ đơn nhóm và chưa có vận đơn J&T — KHÔNG kết luận doanh thu tháng này.");
    }

    if (x.thang === thangNay) {
      x.canhBao.push(
        "THÁNG ĐANG CHẠY — chưa hết ngày. CẤM so thẳng với tháng đủ ngày và cấm đọc thành bán " +
          "chậm; muốn so thì so nhịp mỗi ngày, đừng so tổng tháng."
      );
    } else if (x.nguon === "jt" && jtDau && x.thang === jtDau) {
      x.canhBao.push(
        "THÁNG ĐẦU TIÊN CÓ VẬN ĐƠN J&T — hãng mới bắt đầu ghi giữa tháng nên số này CỤT, " +
          "thấp hơn thật khá nhiều. Chỉ dùng để biết có bán, không dùng để so tháng."
      );
    }

    if (x.tienSoDon && x.codJt) {
      x.khopJt = Math.round((x.codJt / x.tienSoDon) * 1000) / 10;

      if (x.khopJt < 60 && x.vanDon != null && x.soDon != null && x.vanDon < x.soDon * 0.6) {
        x.canhBao.push(
          `Vận đơn J&T (${x.vanDon}) ít hơn hẳn số đơn trong sổ (${x.soDon}) — nhiều khả năng ` +
            "MÁY CÀO J&T ĐANG ĐỨNG, KHÔNG phải mất đơn. Đừng đối soát tháng này khi chưa cào lại."
        );
      } else if (x.donCkTruoc) {
        x.canhBao.push(
          `${x.donCkTruoc} đơn khách chuyển khoản trước (COD bằng 0) — chênh giữa sổ đơn và COD J&T phần lớn là khoản này, không phải thất thoát.`
        );
      }
    }
    if (x.tienVeTong == null && x.doanhThu != null) {
      x.canhBao.push("Sổ phụ ngân hàng chưa có tháng này (ngân hàng gửi theo tháng, trễ tới ~30 ngày) — chưa chốt được tiền về.");
    }
  }

  const ds = [...thang.values()].sort((a, b) => (a.thang < b.thang ? -1 : 1));

  const caveats = [
    "NGUỒN DOANH THU: sổ đơn nhóm Telegram là số chốt · J&T để đối soát đơn và tiền thu hộ · " +
      "sổ phụ ngân hàng để chốt tiền về. KHÔNG dùng MISA làm số bán hàng.",
    "Đơn khách chuyển khoản trước có COD bằng 0 nên tổng COD J&T LUÔN thấp hơn tiền thật — " +
      "đừng đọc chênh lệch đó thành thất thoát.",
    "Tiền COD về lệch pha 3-7 ngày: tiền vào đầu tháng là của đơn cuối tháng trước. Cấm trừ " +
      "thẳng doanh thu và tiền về của cùng một tháng rồi kết luận.",
    "Sổ phụ ngân hàng về theo THÁNG, trễ tới ~30 ngày. Tháng gần nhất trống là BÌNH THƯỜNG, " +
      "không phải sự cố và không phải bán ế.",
    "Lớp 1 ưu tiên bảng `tg_orders` (webhook + cron bóc tin nhóm Telegram, tự chạy). Sổ WhatsApp " +
      "bóc tay trong config chỉ còn dùng cho tháng `tg_orders` chưa phủ, và nó THIẾU đơn hơn.",
    "SỐ CHỐT LÀ NET (đã trừ VAT 8%). Sổ đơn ghi số khách THỰC TRẢ và COD J&T cũng là số thực " +
      "thu — cả hai còn VAT, đã chia 1,08 trước khi đưa vào P&L. Đừng chia lần hai.",
    "THÁNG ĐANG CHẠY luôn thấp giả tạo (chưa hết ngày + chưa bóc sổ đơn) — cấm đem so với " +
      "tháng đủ ngày. Tháng đầu tiên có vận đơn J&T cũng cụt vì hãng mới ghi giữa tháng.",
  ];

  return { thang: ds, caveats, tuoiNguon: { soDonToi, jtToi, nganHangToi } };
}

export async function doanhThuChot(): Promise<{
  theoThang: Map<string, { doanhThu: number; nguon: LopThang["nguon"] }>;
  data: DoanhThuThat;
}> {
  const data = await doanhThuTheoThang();
  const theoThang = new Map<string, { doanhThu: number; nguon: LopThang["nguon"] }>();
  for (const x of data.thang) {
    if (x.doanhThu != null) theoThang.set(x.thang, { doanhThu: x.doanhThu, nguon: x.nguon });
  }
  return { theoThang, data };
}
