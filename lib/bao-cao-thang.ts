import { layDoanhThu } from "@/lib/doanh-thu";
import { layKhoVanDong } from "@/lib/kho-van-dong";
import { layTonNoiBo } from "@/lib/kho-noi-bo";
import { getConfigValue } from "@/lib/app-config";

const money = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const so = (n: number) => (n || 0).toLocaleString("vi-VN");

async function docJson<T = any>(key: string): Promise<T | null> {
  try { const raw = await getConfigValue(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export type BaoCaoThang = { thang: string; taoLuc: string; md: string; tomTatTelegram: string };

export async function taoBaoCaoThang(sb: any, thang: string): Promise<BaoCaoThang> {
  const dim = new Date(+thang.slice(0, 4), +thang.slice(5, 7), 0).getDate();
  const tu = `${thang}-01`, den = `${thang}-${String(dim).padStart(2, "0")}`;
  const md: string[] = [`# Báo cáo tháng ${thang.slice(5, 7)}/${thang.slice(0, 4)} — ACME`, ``];
  const tele: string[] = [`BÁO CÁO THÁNG ${thang.slice(5, 7)}/${thang.slice(0, 4)}`];

  const dt = await layDoanhThu(sb, tu, den, { si: "loai" });
  const net = dt.rows.reduce((s: number, r) => s + (r.net_amount || 0), 0);
  const soDon = new Set(dt.rows.map(r => r.order_code)).size;
  md.push(`## 1. Doanh thu (bán lẻ, đã loại sỉ)`, ``,
    `- Doanh thu net: **${money(net)}** / ${so(soDon)} đơn`,
    `- Đơn sỉ (tách riêng): ${so(dt.donSi || 0)} đơn / ${money(dt.netSi || 0)}`);
  for (const c of dt.canhBao || []) md.push(`- Lưu ý nguồn số: ${c}`);
  md.push(``);
  tele.push(`Doanh thu net: ${money(net)} / ${so(soDon)} đơn (sỉ tách: ${money(dt.netSi || 0)})`);

  md.push(`## 2. Dòng tiền`, ``);
  const bank = await docJson<any>("bank_loop_status");
  if (bank?.closing != null) {
    md.push(`- Số dư ngân hàng (MB + TCB): **${money(bank.closing)}** (số liệu tới ${bank.dataTo || "?"}${bank.staleDays > 3 ? `, TRỄ ${bank.staleDays} ngày — sổ phụ tháng mới có thể chưa về` : ""})`);
    if (bank.banks) md.push(`  - MB: ${money(bank.banks.mb || 0)} · TCB: ${money(bank.banks.tcb || 0)}`);
    tele.push(`Số dư ngân hàng: ${money(bank.closing)} (tới ${bank.dataTo || "?"})`);
  } else {
    md.push(`- Ngân hàng: KHÔNG ĐỌC ĐƯỢC (bank_loop_status trống — vòng lặp sổ phụ chưa chạy). Không điền 0.`);
    tele.push(`Ngân hàng: không đọc được — kiểm tra bank-loop.`);
  }
  const cod = await docJson<any[]>("jt_cod_statements");
  if (Array.isArray(cod) && cod.length) {
    const trongThang = cod.filter((x: any) => String(x.date || x.ngay || "").startsWith(thang));
    const tongCod = trongThang.reduce((s, x: any) => s + (Number(x.amount ?? x.soTien) || 0), 0);
    md.push(trongThang.length
      ? `- COD J&T đối soát về trong tháng: **${money(tongCod)}** / ${so(trongThang.length)} phiên`
      : `- COD J&T: chưa thấy phiên đối soát nào ghi trong tháng này (xem /tai-chinh).`);
  }
  md.push(`- Nhắc luật đọc: tiền về đầu tháng phần lớn là COD của đơn cuối tháng trước (lệch pha 3-7 ngày) — đừng so thẳng với doanh thu tháng.`, ``);

  md.push(`## 3. Kho`, ``);
  const vd = await layKhoVanDong(sb, tu, den);
  md.push(`- Gửi đi trong tháng: **${so(vd.tong.shipped)} sp** / ${so(vd.soVanDon)} vận đơn · giao thành công ${so(vd.tong.delivered)} · hoàn về ${so(vd.tong.returned)} · đang đi ${so(vd.tong.transit)}`);
  const top = vd.products.slice(0, 10);
  if (top.length) {
    md.push(``, `| Sản phẩm | Gửi | Giao | Hoàn |`, `|---|---:|---:|---:|`);
    for (const p of top) md.push(`| ${p.name} | ${so(p.shipped)} | ${so(p.delivered)} | ${so(p.returned)} |`);
  }
  tele.push(`Kho: gửi ${so(vd.tong.shipped)} sp, hoàn ${so(vd.tong.returned)}, đang đi ${so(vd.tong.transit)}`);

  let ton = await layTonNoiBo(sb, den);
  let nhanTon = `tính tới ${den}`;
  if (ton.moc && ton.moc.tuNgay > den) {
    ton = await layTonNoiBo(sb);
    nhanTon = `TỒN HIỆN TẠI (mốc ${ton.moc?.tuNgay} nằm sau kỳ báo cáo nên không dựng lại được tồn cuối ${den})`;
  }
  if (ton.moc) {
    const tongTon = ton.items.reduce((s, x) => s + Math.max(0, x.ton), 0);
    const sapHet = ton.items.filter(x => x.ton > 0 && x.ton <= 10);
    const amKho = ton.items.filter(x => x.ton < 0);
    md.push(``, `### Tồn nội bộ máy tự trừ (mốc ${ton.moc.tuNgay} — ${ton.moc.nguon})`, ``,
      `Tồn = mốc + nhập ghi tay (${so(ton.soDotNhap)} đợt / ${so(ton.tongNhap)} sp) − gửi đi + hoàn về, ${nhanTon}.`,
      ``, `- Tổng tồn tính: **${so(tongTon)} sp**`,
      `- Sắp hết (còn 1-10): ${sapHet.length ? sapHet.map(x => `${x.name} (${so(x.ton)})`).join(", ") : "không có"}`);
    if (amKho.length) md.push(`- TỒN ÂM ${amKho.length} mã (gửi đi nhiều hơn sổ có — nhập chưa ghi hoặc mốc thiếu): ${amKho.slice(0, 6).map(x => `${x.name} (${so(x.ton)})`).join(", ")}`);
    const bang = ton.items.slice(0, 12);
    md.push(``, `| Sản phẩm | Mốc | Nhập | Gửi | Hoàn | Tồn tính |`, `|---|---:|---:|---:|---:|---:|`);
    for (const r of bang) md.push(`| ${r.name} | ${so(r.moc)} | ${so(r.nhap)} | ${so(r.guiDi)} | ${so(r.hoanVe)} | ${so(r.ton)} |`);
    for (const g of ton.ghiChu) md.push(`- ${g}`);
    tele.push(`Ton noi bo: ${so(tongTon)} sp · sap het ${sapHet.length} ma${amKho.length ? ` · TON AM ${amKho.length} ma can kiem` : ""}`);
  } else {
    md.push(``, `- Tồn nội bộ: ${ton.ghiChu.join(" ")}`);
    tele.push(`Ton kho: chua co moc — can kiem kho khai moc tren /kho.`);
  }
  md.push(``);

  md.push(`## 4. Nhân sự`, ``);
  const [{ count: dangLam }, { count: daNghi }] = await Promise.all([
    sb.from("users").select("*", { count: "exact", head: true }).eq("active", true),
    sb.from("users").select("*", { count: "exact", head: true }).eq("active", false),
  ]);
  md.push(`- Đầu người: **${so(dangLam || 0)} đang làm** · ${so(daNghi || 0)} đã nghỉ (luỹ kế)`);
  const { count: ngayCong } = await sb.from("attendance").select("id", { count: "exact", head: true }).gte("date", tu).lte("date", den);
  md.push(ngayCong != null ? `- Ngày công chấm trong tháng: ${so(ngayCong)} lượt check-in` : `- Chấm công: không đọc được bảng attendance.`);
  const [{ count: viecXong }, { count: viecTre }] = await Promise.all([
    sb.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done").gte("completed_at", tu + "T00:00:00").lte("completed_at", den + "T23:59:59"),
    sb.from("tasks").select("id", { count: "exact", head: true }).in("status", ["todo", "doing", "review", "blocked"]).lt("due_date", den),
  ]);
  md.push(`- Việc: ${so(viecXong || 0)} việc đóng xong trong tháng · ${so(viecTre || 0)} việc đang mở đã quá hạn`);
  md.push(`- Lương/hoa hồng: chốt ở đường riêng CEO-only, không nằm trong báo cáo này.`, ``);
  tele.push(`Nhan su: ${so(dangLam || 0)} nguoi · ${so(ngayCong || 0)} luot cong · viec xong ${so(viecXong || 0)}, qua han ${so(viecTre || 0)}`);

  md.push(`---`, `Máy soạn lúc ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}. Nguồn: một cửa doanh thu (Telegram/MISA tự chọn theo ngày), jt_waybills, sổ tồn nội bộ, bank_loop_status, attendance, tasks. Không dùng số MISA trực tiếp.`);
  return { thang, taoLuc: new Date().toISOString(), md: md.join("\n"), tomTatTelegram: tele.join("\n") };
}
