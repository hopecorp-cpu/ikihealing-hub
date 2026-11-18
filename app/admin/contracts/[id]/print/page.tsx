import { requireAdmin } from "@/lib/auth-server";
import { getT } from "@/lib/i18n-server";
import { getContract } from "../../actions";
import { redirect } from "next/navigation";
import { fmtVND } from "@/lib/payroll";
import { PrintButton } from "./print-button";
import { truSoTheoNgay } from "@/lib/tru-so";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  thu_viec: "thử việc",
  xac_dinh_1_nam: "xác định thời hạn 12 tháng",
  xac_dinh_2_nam: "xác định thời hạn 24 tháng",
  khong_xac_dinh: "không xác định thời hạn",
  ctv: "cộng tác viên",
  khoan_viec: "khoán việc",
};

function fmtVNDate(s: string | null) {
  if (!s) return "....";
  const [y, m, d] = s.split("-");
  return `ngày ${d} tháng ${m} năm ${y}`;
}

function fmtNgay(s: string | null | undefined) {
  if (!s) return null;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function vndToWords(n: number): string {

  const million = Math.floor(n / 1_000_000);
  const remainder = n % 1_000_000;
  const thousand = Math.floor(remainder / 1000);
  let text = "";
  if (million > 0) text += `${million} triệu `;
  if (thousand > 0) text += `${thousand} nghìn `;
  return text.trim() + " đồng";
}

export default async function PrintContractPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const { t } = getT();
  const c = await getContract(params.id);
  if (!c) redirect("/admin/contracts");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .contract-page { padding: 1cm !important; max-width: 100% !important; }
          aside, header, nav, .Topbar { display: none !important; }
        }
        @page { size: A4; margin: 1.5cm; }
      ` }} />

      <div className="no-print fixed top-4 right-4 z-50">
        <PrintButton />
      </div>

      <div className="contract-page max-w-[210mm] mx-auto bg-white text-black p-8 text-[13px] leading-relaxed" style={{ fontFamily: "Times, 'Times New Roman', serif" }}>
        <div className="text-center mb-6">
          <div className="font-bold uppercase">{t("Cộng hoà xã hội chủ nghĩa Việt Nam")}</div>
          <div className="font-semibold underline">{t("Độc lập - Tự do - Hạnh phúc")}</div>
          <div className="mt-2 italic">{t("Hải Phòng,")} {fmtVNDate(c.effective_date)}</div>
        </div>

        <div className="text-center my-6">
          <div className="text-xl font-bold uppercase">{t("Hợp đồng lao động")}</div>
          <div className="text-sm">{t("Số:")} <b>{c.contract_number}</b></div>
        </div>

        <div className="space-y-1 mb-4">
          <div><i>{t("Căn cứ Bộ luật Lao động số 45/2019/QH14 ngày 20/11/2019;")}</i></div>
          <div><i>{t("Căn cứ nhu cầu và năng lực của hai bên,")}</i></div>
        </div>

        <p className="mb-4">{t("Hôm nay,")} {fmtVNDate(c.effective_date)}, {t("chúng tôi gồm:")}</p>

        <div className="mb-4">
          <div className="font-bold uppercase">{t("BÊN A — Người sử dụng lao động:")}</div>
          <table className="w-full mt-1">
            <tbody>
              <tr><td className="pr-2 w-40">{t("Tên doanh nghiệp:")}</td><td className="font-semibold">{t("Công ty Cổ phần ACME")}</td></tr>
              <tr><td>{t("Địa chỉ trụ sở:")}</td><td>{truSoTheoNgay(c.effective_date)}</td></tr>
              <tr><td>{t("Người đại diện:")}</td><td>{t("Ông")} <b>{t("NGUYỄN VĂN AN")}</b></td></tr>
              <tr><td>{t("Chức vụ:")}</td><td>{t("Tổng Giám đốc")}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mb-4">
          <div className="font-bold uppercase">{t("BÊN B — Người lao động:")}</div>
          <table className="w-full mt-1">
            <tbody>
              <tr><td className="pr-2 w-40">{t("Họ và tên:")}</td><td className="font-semibold uppercase">{c.user?.full_name}</td></tr>
              <tr><td>{t("Ngày sinh:")}</td><td>{fmtNgay(c.user?.dob) || "............................"}</td></tr>
              <tr><td>{t("Số CCCD/CMND:")}</td><td>
                {c.user?.cccd || "............................"}
                {c.user?.cccd_issued_date && <> — {t("cấp ngày")} {fmtNgay(c.user.cccd_issued_date)}</>}
                {c.user?.cccd_issued_place && <> — {t("nơi cấp:")} {c.user.cccd_issued_place}</>}
              </td></tr>
              <tr><td>{t("Địa chỉ thường trú:")}</td><td>{c.user?.address || "............................"}</td></tr>
              <tr><td>{t("Số điện thoại:")}</td><td>{c.user?.phone || "............................"}</td></tr>
              <tr><td>{t("Email:")}</td><td>{c.user?.email}</td></tr>
            </tbody>
          </table>
        </div>

        <p className="mb-3">{t("Hai bên thoả thuận ký kết hợp đồng lao động này với các điều khoản như sau:")}</p>

        <div className="mb-3">
          <div className="font-bold">{t("Điều 1. Loại hợp đồng và thời hạn")}</div>
          <div className="pl-4">
            <div>{t("1.1. Loại hợp đồng:")} <b>{t(TYPE_LABEL[c.contract_type]) ? t(TYPE_LABEL[c.contract_type]) : c.contract_type}</b></div>
            <div>{t("1.2. Thời hạn hợp đồng:")}
              {c.end_date ? <> {t("từ")} <b>{c.effective_date}</b> {t("đến")} <b>{c.end_date}</b></>
                          : <> {t("từ")} <b>{c.effective_date}</b>, {t("không xác định thời hạn")}</>}
            </div>
            {c.probation_end_date && (
              <div>{t("1.3. Thời gian thử việc: từ")} <b>{c.effective_date}</b> {t("đến")} <b>{c.probation_end_date}</b> ({c.salary_pct}{t("% lương chính thức)")}</div>
            )}
          </div>
        </div>

        <div className="mb-3">
          <div className="font-bold">{t("Điều 2. Công việc, địa điểm và thời giờ làm việc")}</div>
          <div className="pl-4">
            <div>{t("2.1. Chức danh:")} <b>{c.position}</b></div>
            <div>{t("2.2. Phòng/Bộ phận:")} <b>{c.department?.name || "—"}</b></div>
            <div>{t("2.3. Địa điểm làm việc:")} {c.work_location}</div>
            <div>{t("2.4. Thời giờ làm việc:")} {c.work_hours} {t("(8 giờ/ngày, nghỉ trưa 1h30')")}</div>
            <div>{t("2.5. Ngày nghỉ: Chủ nhật và các ngày lễ Tết theo quy định Nhà nước; phép năm 12 ngày/năm.")}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="font-bold">{t("Điều 3. Lương và các khoản phụ cấp")}</div>
          <div className="pl-4">
            <div>{t("3.1. Mức lương cơ bản:")} <b>{fmtVND(c.base_salary)}</b> ({vndToWords(c.base_salary)}){t("/tháng")}
              {c.salary_pct < 100 && <> {t("— bằng")} <b>{c.salary_pct}%</b> {t("mức lương chính thức")} ({fmtVND(Math.round(c.base_salary / c.salary_pct * 100))})</>}
            </div>
            <div>{t("3.2. Lương đóng BHXH-BHYT-BHTN:")} <b>{fmtVND(c.insurance_salary)}</b>{t("/tháng")}</div>
            {c.allowance > 0 && <div>{t("3.3. Phụ cấp (ăn trưa, đi lại):")} <b>{fmtVND(c.allowance)}</b>{t("/tháng")}</div>}
            {c.bonus_max > 0 && <div>{t("3.4. Thưởng KPI tối đa:")} <b>{fmtVND(c.bonus_max)}</b>{t("/tháng (theo Quy chế lương thưởng của Công ty)")}</div>}
            <div>{t("3.5. Hình thức trả lương: Chuyển khoản ngân hàng vào ngày 5-10 hàng tháng.")}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="font-bold">{t("Điều 4. Bảo hiểm và phúc lợi")}</div>
          <div className="pl-4">
            <div>{t("4.1. Bên A đóng đầy đủ BHXH, BHYT, BHTN cho Bên B theo quy định pháp luật.")}</div>
            <div>{t("4.2. Bên B được tham gia các chương trình đào tạo nội bộ, sự kiện công ty.")}</div>
            <div>{t("4.3. Trợ cấp thôi việc theo Bộ luật Lao động.")}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="font-bold">{t("Điều 5. Nghĩa vụ và quyền của Bên B (NLĐ)")}</div>
          <div className="pl-4">
            <div>{t("5.1. Hoàn thành công việc đã thoả thuận trong HĐ; chấp hành nội quy lao động, mệnh lệnh điều hành SXKD của Bên A.")}</div>
            <div>{t("5.2. Bảo mật tuyệt đối thông tin khách hàng, công thức sản phẩm, danh sách nhà cung cấp, dữ liệu nội bộ. Không được tiết lộ cho bên thứ 3 ngay cả khi đã chấm dứt HĐ (thời hạn bảo mật: 24 tháng).")}</div>
            <div>{t("5.3. Không làm thêm cho công ty cạnh tranh trực tiếp trong thời gian làm việc tại ACME Corp.")}</div>
            <div>{t("5.4. Được hưởng đầy đủ lương, thưởng, các chế độ theo HĐ; được quyền đơn phương chấm dứt HĐ theo quy định pháp luật.")}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="font-bold">{t("Điều 6. Nghĩa vụ và quyền của Bên A (NSDLĐ)")}</div>
          <div className="pl-4">
            <div>{t("6.1. Trả lương đầy đủ, đúng hạn; thanh toán các khoản BHXH, BHYT, BHTN theo quy định.")}</div>
            <div>{t("6.2. Đảm bảo môi trường làm việc an toàn, công cụ làm việc cần thiết.")}</div>
            <div>{t("6.3. Có quyền điều chuyển công việc của Bên B trong phạm vi năng lực chuyên môn; có quyền chấm dứt HĐ theo quy định pháp luật trong trường hợp Bên B vi phạm nội quy lao động.")}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="font-bold">{t("Điều 7. Chấm dứt hợp đồng")}</div>
          <div className="pl-4">
            <div>{t("7.1. HĐ chấm dứt khi: hết thời hạn; hai bên thoả thuận chấm dứt; Bên B nghỉ hưu; Bên B vi phạm nội quy bị sa thải; các trường hợp khác theo Bộ luật Lao động.")}</div>
            <div>{t("7.2. Đơn phương chấm dứt HĐ: phải thông báo trước ít nhất 30 ngày (đối với HĐ xác định thời hạn) hoặc 45 ngày (đối với HĐ không xác định thời hạn).")}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="font-bold">{t("Điều 8. Điều khoản chung")}</div>
          <div className="pl-4">
            <div>{t("8.1. Mọi sửa đổi, bổ sung HĐ phải được lập thành văn bản và có chữ ký của cả hai bên.")}</div>
            <div>{t("8.2. HĐ này được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.")}</div>
            <div>{t("8.3. HĐ có hiệu lực kể từ")} <b>{c.effective_date}</b>.</div>
            {c.notes && <div className="mt-2"><i>{t("Ghi chú thêm:")}</i> {c.notes}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-10 text-center">
          <div>
            <div className="font-bold uppercase">{t("Bên B — Người lao động")}</div>
            <div className="italic text-xs">{t("(Ký và ghi rõ họ tên)")}</div>
            <div className="h-24"></div>
            <div className="font-bold uppercase">{c.user?.full_name}</div>
            {c.employee_signed_at && (
              <div className="text-xs text-emerald-700 mt-1">
                {t("✓ Đã ký điện tử")} {new Date(c.employee_signed_at).toLocaleString("vi-VN")}
              </div>
            )}
          </div>
          <div>
            <div className="font-bold uppercase">{t("Bên A — Đại diện công ty")}</div>
            <div className="italic text-xs">{t("(Ký, ghi rõ họ tên và đóng dấu)")}</div>
            <div className="h-24"></div>
            <div className="font-bold uppercase">{t("NGUYỄN VĂN AN")}</div>
            <div className="text-xs">{t("Tổng Giám đốc")}</div>
            {c.employer_signed_at && (
              <div className="text-xs text-emerald-700 mt-1">
                {t("✓ Đã ký điện tử")} {new Date(c.employer_signed_at).toLocaleString("vi-VN")}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
