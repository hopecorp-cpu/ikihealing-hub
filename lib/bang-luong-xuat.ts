import * as XLSX from "xlsx";

const d = (n: any) => new Intl.NumberFormat("vi-VN").format(Math.round(Number(n) || 0));
const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type BangLuongXuat = {
  thang: string;
  html: string;
  xlsx: Buffer;
  tenHtml: string;
  tenXlsx: string;
  soNguoi: number;
  tongThucLinh: number;
  tongChiPhi: number;
  tongHoaHong: number;
  trangThai: string[];

  tomTat: string[];

  canhBao: string[];
};

export async function dungBangLuongKeToan(sb: any, thang: string, xtSan?: any): Promise<BangLuongXuat> {
  const { xemTruocLuongThang } = await import("@/lib/luong-thang");
  const { LAW_2026 } = await import("@/lib/payroll");
  const VAT = 1 + LAW_2026.vatSanPhamA;

  const { data: pr } = await sb.from("payroll").select("*").eq("month", thang).order("total_income", { ascending: false });
  if (!pr?.length) throw new Error(`Không có dòng lương nào cho ${thang} — chạy máy tính lương trước khi xuất bản kế toán.`);

  const { data: us } = await sb.from("users").select("id,email,full_name,position,contract_type,department_id");
  const { data: deps } = await sb.from("departments").select("id,name");
  const dn = Object.fromEntries((deps ?? []).map((x: any) => [x.id, x.name]));
  const un = Object.fromEntries((us ?? []).map((u: any) => [u.id, u]));

  const xt = xtSan || (await xemTruocLuongThang(sb, thang));
  const hh: any = xt.hoaHong;

  const thuongTay: Record<string, Array<{ tien: number; lyDo: string }>> = {};
  try {
    const { data: cf } = await sb.from("config").select("value").eq("key", `luong_thuong_tay_${thang}`).maybeSingle();
    for (const [k, v] of Object.entries(JSON.parse((cf as any)?.value || "{}"))) {
      const ds = (Array.isArray(v) ? v : [v]).filter((x: any) => x && Number(x.tien)).map((x: any) => ({ tien: Math.round(Number(x.tien)), lyDo: String(x.lyDo || "") }));
      if (ds.length) thuongTay[k.toLowerCase().trim()] = ds;
    }
  } catch {  }
  const tayCua = (email?: string) => thuongTay[String(email || "").toLowerCase().trim()] || [];

  const lech: string[] = [];
  for (const r of pr) {
    const s = hh?.theoSale.find((x: any) => x.userId === r.user_id);
    if (!s) continue;
    const ghi = Number(r.bonus_amount || 0) + Number(r.group_bonus_share || 0);
    const tay = tayCua(un[r.user_id]?.email).reduce((a: number, x: any) => a + x.tien, 0);
    const nay = s.hoaHong + s.thuongNhom + tay;
    if (Math.abs(ghi - nay) > 1000)
      lech.push(`${un[r.user_id]?.full_name}: bảng lương ghi ${d(ghi)}đ, tính lại hôm nay ra ${d(nay)}đ (chênh ${d(nay - ghi)}đ) — nguồn J&T có thể vừa cập nhật thêm, hoặc có khoản sửa tay chưa ghi vào config.`);
  }

  const COT: Array<[string, (r: any, u: any) => any, boolean]> = [
    ["Họ tên", (_r, u) => u.full_name || "(không rõ)", false],
    ["Phòng ban", (_r, u) => dn[u.department_id] || "-", false],
    ["Vị trí", (_r, u) => u.position || "-", false],
    ["Loại HĐ", (_r, u) => u.contract_type || "-", false],
    ["Lương HĐ", (r) => r.gross_salary, true],
    ["Công", (r) => `${r.working_days_actual}/${r.working_days_standard}`, false],
    ["Lương theo công", (r) => r.salary_by_workdays, true],
    ["Hoa hồng / thưởng", (r) => r.bonus_amount, true],
    ["Thưởng nhóm", (r) => r.group_bonus_share, true],
    ["Thưởng livestream", (r) => r.livestream_bonus, true],
    ["TỔNG THU NHẬP", (r) => r.total_income, true],
    ["BHXH NLĐ trừ", (r) => -r.employee_insurance, true],
    ["Thuế TNCN", (r) => -r.personal_income_tax, true],
    ["Tạm ứng", (r) => -r.advance_payment, true],
    ["Khấu trừ khác", (r) => -r.deduction_penalty, true],
    ["THỰC LĨNH", (r) => r.net_salary, true],
    ["BHXH công ty", (r) => r.employer_insurance, true],
    ["TỔNG CHI PHÍ DN", (r) => r.total_company_cost, true],
  ];
  const rows = pr.map((r: any) => ({ r, u: un[r.user_id] || {} }));
  const tong: Record<string, number> = {};
  for (const [ten, f, so] of COT) if (so) tong[ten] = rows.reduce((s: number, x: any) => s + (Number(f(x.r, x.u)) || 0), 0);

  const td = (v: any, so: boolean, manh = false) => so
    ? `<td class="so${Number(v) < 0 ? " am" : ""}${manh ? " manh" : ""}">${Number(v) ? d(v) : "—"}</td>`
    : `<td${manh ? ' class="manh"' : ""}>${esc(v)}</td>`;

  const bangA = `<table><thead><tr>${COT.map(([t]) => `<th>${esc(t)}</th>`).join("")}</tr></thead>
<tbody>${rows.map(({ r, u }: any) => `<tr>${COT.map(([t, f, so]) => td(f(r, u), so, /TỔNG|THỰC/.test(t))).join("")}</tr>`).join("\n")}</tbody>
<tfoot><tr>${COT.map(([t, , so]) => so ? `<td class="so">${d(tong[t])}</td>` : `<td>${t === "Họ tên" ? `TỔNG ${rows.length} người` : ""}</td>`).join("")}</tr></tfoot></table>`;

  const sales = (hh?.theoSale ?? []).filter((s: any) => s.loai !== "none");
  const lechNac: string[] = [];
  const nacCua = (s: any) => {
    const netMoiDon = Math.round(s.khachTra / VAT);
    const netDonTinh = netMoiDon - s.hoan.tienNet - s.chuaXacMinh.tienNet;
    const netThangNay = s.netKpi - s.thangTruocVe.tienNet;
    const quaTinh = netDonTinh - netThangNay - s.ship;
    const nac: Array<[string, number, string, boolean]> = [
      ["Số đơn bán trong tháng", s.soDon, "đơn", false],
      ["Khách trả, mọi đơn (còn VAT 8%)", s.khachTra, "đ", false],
      [`Doanh thu NET mọi đơn (chia ${String(VAT).replace(".", ",")})`, netMoiDon, "đ net", false],
      [`− Đơn HOÀN VỀ (${s.hoan.don} đơn)`, -s.hoan.tienNet, "đ net", false],
      [`− Đơn CHƯA XÁC MINH (${s.chuaXacMinh.don} đơn) → chuyển tháng sau, KHÔNG mất`, -s.chuaXacMinh.tienNet, "đ net", false],
      ["= Doanh thu NET của đơn được tính", netDonTinh, "đ net", true],
      [`− Quà tặng của đơn được tính (tổng giá vốn, đã gồm VAT)`, -quaTinh, "đ", false],
      ["− Phí ship J&T", -s.ship, "đ", false],
      [`+ Đơn tháng trước nay đã có vận đơn (${s.thangTruocVe.don} đơn)`, s.thangTruocVe.tienNet, "đ net", false],
      ["= NET TÍNH KPI", s.netKpi, "đ", true],
    ];

    const congDoc = netDonTinh - quaTinh - s.ship + s.thangTruocVe.tienNet;
    if (Math.abs(congDoc - s.netKpi) > 1000)
      lechNac.push(`${s.ten}: cộng dọc các nấc ra ${d(congDoc)}đ nhưng NET hệ thống là ${d(s.netKpi)}đ (chênh ${d(congDoc - s.netKpi)}đ)`);
    return nac;
  };
  const nacMoiSale = new Map<string, Array<[string, number, string, boolean]>>(sales.map((s: any) => [s.ten, nacCua(s)]));
  const bangB = sales.map((s: any) => `
<h3>${esc(s.ten)} — ${esc(s.viTri)} · mốc KPI ${d(s.target)}đ</h3>
<table class="hep"><tbody>
${(nacMoiSale.get(s.ten) || []).map(([t, v, dv, manh]) => `<tr><td${manh ? ' class="manh"' : ""}>${esc(t)}</td>${td(v, true, manh)}<td class="dv">${esc(dv)}</td></tr>`).join("\n")}
<tr><td>Đạt</td><td class="so manh">${s.kpiPct.toFixed(0)}%</td><td class="dv">KPI</td></tr>
<tr><td>Bậc áp dụng</td><td colspan="2">${esc(s.bac)}</td></tr>
<tr><td>Cách tính</td><td colspan="2">${esc(s.congThuc)}</td></tr>
<tr><td class="manh">HOA HỒNG</td>${td(s.hoaHong, true, true)}<td class="dv">đ</td></tr>
${s.thuongNhom ? `<tr><td class="manh">Thưởng nhóm</td>${td(s.thuongNhom, true, true)}<td class="dv">đ</td></tr>` : ""}
${tayCua(un[s.userId!]?.email).map((x: any) => `<tr><td>${x.tien < 0 ? "Khoản TRỪ tay" : "Thưởng tay"} — ${esc(x.lyDo)}</td>${td(x.tien, true)}<td class="dv">đ</td></tr>`).join("")}
${tayCua(un[s.userId!]?.email).length ? `<tr><td class="manh">CỘNG VÀO LƯƠNG THÁNG NÀY</td>${td(s.hoaHong + s.thuongNhom + tayCua(un[s.userId!]?.email).reduce((a: number, x: any) => a + x.tien, 0), true, true)}<td class="dv">đ</td></tr>` : ""}
</tbody></table>
${s.ghiChu?.length ? `<div class="luu">${s.ghiChu.map((g: string) => `• ${esc(g)}`).join("<br>")}</div>` : ""}`).join("\n");

  const dsDon = (ds: any[]) => ds.length
    ? `<table class="hep"><thead><tr><th>Ngày</th><th>Khách</th><th>SĐT</th><th>Khách trả</th><th>Vận đơn</th></tr></thead><tbody>
${ds.map((x: any) => `<tr><td>${esc(x.ngay?.slice(0, 10) || "")}</td><td>${esc(x.khach || x.ten || "")}</td><td>${esc(x.sdt || "")}</td>${td(x.khachTra, true)}<td>${esc(x.vanDon || "—")}</td></tr>`).join("\n")}
</tbody></table>` : `<div class="luu">Không có.</div>`;

  const bangC = sales.map((s: any) => `
<h3>${esc(s.ten)}</h3>
<div class="nho">Đơn chưa xác minh (chưa có vận đơn / chưa thấy tiền về) — <b>chuyển sang tháng sau, không mất</b>:</div>
${dsDon(s.chuaXacMinh.ds || [])}
<div class="nho">Đơn tháng trước nay đã có vận đơn, đã cộng vào tháng này:</div>
${dsDon((s.thangTruocVe.ds || []).map((x: any) => ({ ngay: "", khach: x.khach, sdt: "", khachTra: x.khachTra, vanDon: x.vanDon })))}`).join("\n");

  const trangThai = [...new Set(pr.map((x: any) => String(x.status)))] as string[];

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>Lương + hoa hồng ${thang}</title><style>
:root{--muc:#2E6B2D}
body{font-family:-apple-system,"Segoe UI",system-ui,sans-serif;margin:24px;color:#1b1b1b;background:#fff;max-width:1500px}
h1{font-size:21px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--muc)}
h3{font-size:14px;margin:18px 0 6px}
.phu{color:#666;font-size:13px}
table{border-collapse:collapse;font-size:13px;width:100%;margin-bottom:4px}
table.hep{width:auto;min-width:520px}
th,td{border:1px solid #ddd;padding:6px 8px;white-space:nowrap}
th{background:#f3f6f3;text-align:left}
.so{text-align:right;font-variant-numeric:tabular-nums}.am{color:#b3261e}.manh{font-weight:600}
.dv{color:#888;font-size:12px}
tbody tr:nth-child(even) td{background:#fafafa}
tfoot td{background:#f3f6f3;font-weight:700;border-top:2px solid var(--muc)}
.luu,.nho{font-size:12px;color:#666;line-height:1.6;margin:6px 0}
.canh{background:#fff4f4;border:1px solid #f0c0c0;padding:10px 12px;border-radius:6px;font-size:13px;margin:12px 0}
.ok{background:#f3f8f3;border:1px solid #cfe0cf;padding:10px 12px;border-radius:6px;font-size:13px;margin:12px 0}
ol,ul{font-size:13px;line-height:1.7}
</style></head><body>
<h1>Lương và hoa hồng tháng ${thang}</h1>
<div class="phu">${rows.length} người · trạng thái ${esc(trangThai.join(", "))} · xuất ${new Date().toLocaleString("vi-VN")}<br>
Thực lĩnh <b>${d(tong["THỰC LĨNH"])}đ</b> · tổng chi phí doanh nghiệp <b>${d(tong["TỔNG CHI PHÍ DN"])}đ</b> · hoa hồng và thưởng <b>${d(tong["Hoa hồng / thưởng"] + tong["Thưởng nhóm"])}đ</b></div>

${lech.length
  ? `<div class="canh"><b>CẦN KIỂM — hoa hồng tính lại hôm nay khác số đã ghi trong bảng lương:</b><br>${lech.map(esc).join("<br>")}</div>`
  : `<div class="ok">Đã đối chiếu: hoa hồng trong bảng lương khớp với số tính lại từ sổ đơn hôm nay.</div>`}
${hh?.canhBao?.length ? `<div class="canh"><b>Cảnh báo từ nguồn số:</b><br>${hh.canhBao.map(esc).join("<br>")}</div>` : ""}

<h2>A. Bảng lương cấu thành đầy đủ</h2>
${bangA}
<div class="luu">Chênh giữa <b>TỔNG CHI PHÍ DN</b> và <b>THỰC LĨNH</b> là phần công ty nộp thêm: BHXH doanh nghiệp 21,5% cộng thuế TNCN và BHXH đã trừ của người lao động.</div>

<h2>B. Hoa hồng sale — từng nấc trừ</h2>
<div class="luu">Nguồn: sổ đơn nhóm Telegram ${esc(hh?.tu || "")} → ${esc(hh?.den || "")} · ${d(hh?.nguon.soDon)} đơn · đối chiếu vận đơn J&amp;T (${d(hh?.nguon.jtSoVanDon)} vận đơn, tới ${esc(hh?.nguon.jtToi || "?")}) và sao kê ngân hàng (tới ${esc(hh?.nguon.nhToi || "?")}) · phí ship trung bình ${d(hh?.shipTB)}đ/đơn.</div>
${bangB}
<div class="luu">Bậc hoa hồng (mẫu): đạt 100% KPI trở lên thì 10% phần KPI cộng 15% phần vượt; vượt 200% thì phần vượt thêm tính 20%. <b>Chưa đạt 100% KPI thì không có hoa hồng</b>. Thưởng nhóm cho Leader (mẫu): 10% phần đội vượt mốc net.</div>

<h2>C. Đơn bị loại khỏi kỳ này — liệt kê đích danh</h2>
${bangC}
<div class="luu">Đơn chưa xác minh là đơn <b>chưa có vận đơn J&amp;T hoặc chưa thấy tiền về</b> tới ngày chốt — <b>chuyển sang tháng sau</b>, sale đưa được mã vận đơn thì tháng sau cộng lại, không ai bị mất đơn.</div>

<h2>D. Phần đã tách khỏi doanh số tính hoa hồng</h2>
<table class="hep"><tbody>
<tr><td>Đơn chưa rõ sale (không có chữ ký trong tin)</td>${td(hh?.chuaRo.don, true)}<td class="dv">đơn</td>${td(hh?.chuaRo.khachTra, true)}<td class="dv">đ khách trả</td></tr>
<tr><td>Đơn sỉ / đại lý (giá đã chiết khấu, không tính KPI bán lẻ)</td>${td(hh?.si.don, true)}<td class="dv">đơn</td>${td(hh?.si.khachTra, true)}<td class="dv">đ khách trả</td></tr>
<tr><td class="manh">Tổng NET của đội sale (để xét thưởng nhóm)</td>${td(hh?.tongNetKpiSale, true, true)}<td class="dv">đ</td><td colspan="2"></td></tr>
</tbody></table>
${hh?.chuaRo.don ? `<div class="nho">Đơn chưa rõ sale — nếu là của ai thì gán ở /gan-don rồi tính lại, không gán thì tiền này không về ai:</div>${dsDon(hh.chuaRo.ds || [])}` : ""}

<h2>Kế toán kiểm giúp bốn việc</h2>
<ol>
<li>Lương theo công: đối chiếu cột <b>Công</b> với bảng chấm công. Ngày nghỉ lễ ăn nguyên lương — người theo chấm công phải được cộng lại những ngày lễ trong tháng.</li>
<li>Khoản <b>Khấu trừ khác</b> và thưởng/phạt tay: có đúng lý do đã duyệt không.</li>
<li>Hoa hồng: cộng lại từng nấc ở bảng B. Riêng số quà chỉ ghi TỔNG theo giá vốn (giá vốn là số bảo mật, cần soi chi tiết thì xem trực tiếp trong hệ thống).</li>
<li>Thuế TNCN và BHXH: giảm trừ bản thân 15,5tr, người phụ thuộc 6,2tr/người; làm dưới 14 công trong tháng thì tháng đó không đóng BHXH.</li>
</ol>
<div class="luu"><b>CEO-only + kế toán</b> — không đẩy Drive phòng ban, không gửi chung cho nhân viên (một file để cả đội thấy lương của nhau). Nhân viên chỉ xem phiếu của mình sau khi CEO duyệt.</div>
</body></html>`;

  const SO_FMT = "#,##0";

  const oSo = (v: any, cong?: string) => ({ t: "n", v: Math.round(Number(v) || 0), z: SO_FMT, ...(cong ? { f: cong } : {}) });
  const oChu = (v: any) => ({ t: "s", v: String(v ?? "") });

  const wb = XLSX.utils.book_new();

  const dauA = ["Họ tên","Phòng ban","Vị trí","Loại HĐ","Lương HĐ","Công","Lương theo công","Hoa hồng/thưởng","Thưởng nhóm","Thưởng livestream","TỔNG THU NHẬP","BHXH NLĐ trừ","Thuế TNCN","Tạm ứng","Khấu trừ khác","THỰC LĨNH","BHXH công ty","TỔNG CHI PHÍ DN"];
  const wsA: any = {};
  const dat = (c: number, r: number, o: any) => { wsA[XLSX.utils.encode_cell({ c, r })] = o; };
  dauA.forEach((t, i) => dat(i, 0, oChu(t)));
  const lechNet: string[] = [];
  rows.forEach(({ r, u }: any, i: number) => {
    const d0 = i + 2;
    dat(0, i + 1, oChu(u.full_name)); dat(1, i + 1, oChu(dn[u.department_id] || "-"));
    dat(2, i + 1, oChu(u.position || "-")); dat(3, i + 1, oChu(u.contract_type || "-"));
    dat(4, i + 1, oSo(r.gross_salary));
    dat(5, i + 1, oChu(`${r.working_days_actual}/${r.working_days_standard}`));
    dat(6, i + 1, oSo(r.salary_by_workdays));
    dat(7, i + 1, oSo(r.bonus_amount)); dat(8, i + 1, oSo(r.group_bonus_share)); dat(9, i + 1, oSo(r.livestream_bonus));
    dat(10, i + 1, oSo(r.total_income, `G${d0}+H${d0}+I${d0}+J${d0}`));
    dat(11, i + 1, oSo(-r.employee_insurance)); dat(12, i + 1, oSo(-r.personal_income_tax));
    dat(13, i + 1, oSo(-r.advance_payment)); dat(14, i + 1, oSo(-r.deduction_penalty));
    dat(15, i + 1, oSo(r.net_salary, `K${d0}+L${d0}+M${d0}+N${d0}+O${d0}`));
    dat(16, i + 1, oSo(r.employer_insurance));
    dat(17, i + 1, oSo(r.total_company_cost, `K${d0}+Q${d0}`));

    const netCongThuc = Number(r.salary_by_workdays || 0) + Number(r.bonus_amount || 0) + Number(r.group_bonus_share || 0)
      + Number(r.livestream_bonus || 0) - Number(r.employee_insurance || 0) - Number(r.personal_income_tax || 0)
      - Number(r.advance_payment || 0) - Number(r.deduction_penalty || 0);
    if (Math.abs(netCongThuc - Number(r.net_salary || 0)) > 1)
      lechNet.push(`${u.full_name}: công thức Excel ra ${d(netCongThuc)}đ, hệ thống ghi thực lĩnh ${d(r.net_salary)}đ`);
  });
  const dTong = rows.length + 2;
  dat(0, rows.length + 1, oChu(`TỔNG ${rows.length} người`));
  for (const c of [4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
    const ch = XLSX.utils.encode_col(c);
    dat(c, rows.length + 1, oSo(tong[dauA[c]] ?? 0, `SUM(${ch}2:${ch}${dTong - 1})`));
  }
  wsA["!ref"] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 17, r: rows.length + 1 } });
  wsA["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 26 }, { wch: 20 }, ...Array(14).fill({ wch: 15 })];
  wsA["!freeze"] = { xSplit: 1, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsA, "Luong");

  const nhan = ["", ...sales.map((s: any) => `${s.ten} (${s.viTri})`)];
  const nacTen = (nacMoiSale.get(sales[0]?.ten) || []).map(([t]) => t);
  const dongHH: any[][] = [
    nhan,
    ["Mốc KPI", ...sales.map((s: any) => s.target)],
    ...nacTen.map((t, i) => [t, ...sales.map((s: any) => (nacMoiSale.get(s.ten) || [])[i][1])]),
    ["Đạt % KPI", ...sales.map((s: any) => Math.round(s.kpiPct))],
    ["Bậc áp dụng", ...sales.map((s: any) => s.bac)],
    ["Cách tính", ...sales.map((s: any) => s.congThuc)],
    ["HOA HỒNG", ...sales.map((s: any) => s.hoaHong)],
    ["Thưởng nhóm", ...sales.map((s: any) => s.thuongNhom)],
    ["Khoản thưởng/phạt tay", ...sales.map((s: any) => tayCua(un[s.userId!]?.email).reduce((a: number, x: any) => a + x.tien, 0))],
    ["Lý do khoản tay", ...sales.map((s: any) => tayCua(un[s.userId!]?.email).map((x: any) => x.lyDo).join(" · "))],
  ];
  const wsB = XLSX.utils.aoa_to_sheet(dongHH);

  const iNetMoiDon = nacTen.findIndex((t) => t.startsWith("Doanh thu NET mọi đơn"));
  const iNetTinh = nacTen.findIndex((t) => t.startsWith("= Doanh thu NET của đơn được tính"));
  const iNetKpi = nacTen.findIndex((t) => t.startsWith("= NET TÍNH KPI"));
  const hangCua = (i: number) => i + 3;
  const rKiem = dongHH.length + 1;
  wsB[XLSX.utils.encode_cell({ c: 0, r: rKiem - 1 })] = oChu(`KIỂM: cộng các nấc (bỏ dòng tổng trung gian) = phải khớp dòng ${hangCua(iNetKpi)}`);
  sales.forEach((sx: any, i: number) => {
    const ch = XLSX.utils.encode_col(i + 1);
    const nac = nacMoiSale.get(sx.ten) || [];
    const congThuc = nac.map((n, j) => ({ n, j }))
      .filter(({ j }) => j >= iNetMoiDon && j < iNetKpi && j !== iNetTinh)
      .map(({ j }) => `${ch}${hangCua(j)}`).join("+");
    const giaTri = nac.filter((_n, j) => j >= iNetMoiDon && j < iNetKpi && j !== iNetTinh).reduce((a, n) => a + n[1], 0);
    wsB[XLSX.utils.encode_cell({ c: i + 1, r: rKiem - 1 })] = oSo(giaTri, congThuc);
  });
  wsB["!ref"] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: sales.length, r: rKiem - 1 } });
  wsB["!cols"] = [{ wch: 52 }, ...Array(Math.max(1, sales.length)).fill({ wch: 26 })];
  for (let r = 1; r < rKiem; r++) for (let c = 1; c <= sales.length; c++) {
    const o = wsB[XLSX.utils.encode_cell({ c, r })];
    if (o && o.t === "n") o.z = SO_FMT;
  }
  XLSX.utils.book_append_sheet(wb, wsB, "Hoa hong sale");

  const dongDon: any[][] = [["Sale", "Nhóm", "Ngày", "Khách", "SĐT", "Khách trả", "Vận đơn"]];
  for (const s of sales) {
    for (const x of s.chuaXacMinh.ds || []) dongDon.push([s.ten, "Chưa xác minh (chuyển tháng sau)", (x.ngay || "").slice(0, 10), x.khach || "", x.sdt || "", Math.round(x.khachTra || 0), x.vanDon || ""]);
    for (const x of s.thangTruocVe.ds || []) dongDon.push([s.ten, "Tháng trước nay đã có vận đơn", "", x.khach || "", "", Math.round(x.khachTra || 0), x.vanDon || ""]);
  }
  for (const x of hh?.chuaRo.ds || []) dongDon.push(["(không có chữ ký)", "Chưa rõ sale — gán ở /gan-don", (x.ngay || "").slice(0, 10), x.khach || "", x.sdt || "", Math.round(x.khachTra || 0), x.vanDon || ""]);
  const wsC = XLSX.utils.aoa_to_sheet(dongDon);
  wsC["!cols"] = [{ wch: 20 }, { wch: 32 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
  for (let r = 1; r < dongDon.length; r++) { const o = wsC[XLSX.utils.encode_cell({ c: 5, r })]; if (o) o.z = SO_FMT; }
  XLSX.utils.book_append_sheet(wb, wsC, "Don bi loai");

  const ghi: any[][] = [
    [`LƯƠNG VÀ HOA HỒNG THÁNG ${thang} — bản gửi kế toán kiểm`],
    [`Xuất ${new Date().toLocaleString("vi-VN")} · ${rows.length} người · trạng thái ${trangThai.join(", ")}`],
    [],
    ["NGUỒN SỐ"],
    ["Lương", "đọc thẳng từ hệ thống (bảng payroll) — là số sẽ trả"],
    ["Hoa hồng", `sổ đơn nhóm Telegram ${hh?.tu || ""} → ${hh?.den || ""}, ${hh?.nguon.soDon || 0} đơn`],
    ["Đối chiếu", `vận đơn J&T ${hh?.nguon.jtSoVanDon || 0} vận đơn tới ${hh?.nguon.jtToi || "?"} · sao kê ngân hàng tới ${hh?.nguon.nhToi || "?"}`],
    ["Phí ship", `trung bình ${d(hh?.shipTB)}đ/đơn`],
    [],
    ["KẾ TOÁN KIỂM GIÚP BỐN VIỆC"],
    ["1", "Lương theo công: đối chiếu cột Công với bảng chấm công. Ngày nghỉ lễ ăn nguyên lương — người theo chấm công phải được cộng lại những ngày lễ trong tháng."],
    ["2", "Khoản Khấu trừ khác và thưởng/phạt tay: đúng lý do đã duyệt chưa (xem sheet Hoa hong sale, dòng Lý do khoản tay)."],
    ["3", "Hoa hồng: cộng lại từng nấc ở sheet Hoa hong sale — dòng KIỂM đã có công thức SUM, phải khớp dòng NET TÍNH KPI."],
    ["4", "Thuế TNCN và BHXH: giảm trừ bản thân 15.500.000đ, người phụ thuộc 6.200.000đ/người. Làm dưới 14 công trong tháng thì tháng đó không đóng BHXH."],
    [],
    ["LƯU Ý"],
    ["", "Quà tặng chỉ ghi TỔNG theo giá vốn. Giá vốn từng món là số bảo mật, cần soi chi tiết thì xem trực tiếp trong hệ thống."],
    ["", "Đơn chưa xác minh = chưa có vận đơn J&T hoặc chưa thấy tiền về tới ngày chốt. Chuyển sang tháng sau, KHÔNG mất đơn của sale."],
    ["", "Bậc hoa hồng (mẫu): đạt 100% KPI thì 10% phần KPI + 15% phần vượt; vượt 200% thì phần vượt thêm 20%. Chưa đạt 100% KPI thì không có hoa hồng."],
    ["", "Thưởng nhóm Leader (mẫu): 10% phần đội vượt mốc net."],
    ["", "Tài liệu CEO-only và kế toán. Không đẩy Drive phòng ban, không gửi chung cho nhân viên."],
    [],
    ["ĐỐI CHIẾU MÁY TỰ CHẠY"],
    ["Hoa hồng", lech.length ? "CẦN KIỂM: " + lech.join(" | ") : "Khớp giữa bảng lương và số tính lại hôm nay."],
    ["Thực lĩnh", lechNet.length ? "CẦN KIỂM: " + lechNet.join(" | ") : "Công thức Excel cho ra đúng số hệ thống sẽ trả."],
    ["Nấc hoa hồng", lechNac.length ? "CẦN KIỂM: " + lechNac.join(" | ") : "Cộng dọc các nấc ra đúng NET tính KPI của hệ thống."],
    ...(hh?.canhBao?.length ? [["Cảnh báo nguồn", hh.canhBao.join(" | ")]] : []),
  ];
  const wsD = XLSX.utils.aoa_to_sheet(ghi);
  wsD["!cols"] = [{ wch: 16 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, wsD, "Ghi chu");

  const xlsx: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const tomTat = [
    `BẢNG LƯƠNG + HOA HỒNG ${thang} — ${rows.length} người`,
    `Thực lĩnh ${d(tong["THỰC LĨNH"])}đ · chi phí DN ${d(tong["TỔNG CHI PHÍ DN"])}đ · hoa hồng+thưởng ${d(tong["Hoa hồng / thưởng"] + tong["Thưởng nhóm"])}đ`,
    ...sales.map((s: any) => `  ${s.ten}: ${s.soDon} đơn · NET ${d(s.netKpi)}đ (${s.kpiPct.toFixed(0)}% KPI) · hoa hồng ${d(s.hoaHong + s.thuongNhom)}đ — ${s.bac}`),
  ];

  return {
    thang, html, xlsx,
    tenHtml: `Bang-luong-${thang}_ke-toan-check.html`,
    tenXlsx: `Bang-luong-${thang}_ke-toan-check.xlsx`,
    soNguoi: rows.length,
    tongThucLinh: tong["THỰC LĨNH"] || 0,
    tongChiPhi: tong["TỔNG CHI PHÍ DN"] || 0,
    tongHoaHong: (tong["Hoa hồng / thưởng"] || 0) + (tong["Thưởng nhóm"] || 0),
    trangThai,
    tomTat,
    canhBao: [...lech, ...lechNet, ...lechNac, ...(hh?.canhBao || [])],
  };
}
