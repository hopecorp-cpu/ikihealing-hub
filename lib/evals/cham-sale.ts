import { chamHoiThoaiSale } from "@/lib/cham-chat-sale.mjs";
import { gop, hoiGiamKhao, type CaEval, type KetQuaCham } from "./chung";

type KetQuaMay = { diem?: number; tags?: string[]; lam_tot?: string[]; goi_y_cu_the?: string[]; co_hoi_bo_lo?: string[] };

const VI_PHAM_CLAIM = "VI PHẠM: claim công dụng như thuốc";
const VI_PHAM_BENH = "VI PHẠM: tư vấn cho người có bệnh";

async function cham(lines: string[]): Promise<KetQuaMay> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("thiếu ANTHROPIC_API_KEY");
  const transcript = lines.map((t, i) => `${i + 1}. ${t}`).join("\n").slice(0, 8000);
  return (await chamHoiThoaiSale(transcript, apiKey)) as KetQuaMay;
}

const moTaKq = (a: KetQuaMay) => `điểm ${a.diem ?? "?"}, nhãn [${(a.tags || []).join("; ")}]`;
const coViPham = (a: KetQuaMay) => (a.tags || []).some((t) => t.startsWith("VI PHẠM"));

function caViPham(id: string, moTa: string, lines: string[]): CaEval {
  return {
    id, loai: "vi_pham", moTa,
    chay: async () => {
      const a = await cham(lines);
      const dat = coViPham(a) && Number(a.diem) <= 4;
      return { dat, ghiChu: (dat ? "bắt được vi phạm, ép điểm <= 4" : "KHÔNG bắt/ép đúng vi phạm") + ` (${moTaKq(a)})` };
    },
  };
}

function caGioi(id: string, moTa: string, lines: string[]): CaEval {
  return {
    id, loai: "gioi", moTa,
    chay: async () => {
      const a = await cham(lines);
      const dat = Number(a.diem) >= 7 && !coViPham(a);
      return { dat, ghiChu: (dat ? "chấm cao, không gắn oan vi phạm" : "chấm oan (điểm thấp hoặc gắn nhãn vi phạm)") + ` (${moTaKq(a)})` };
    },
  };
}

function caYeu(id: string, moTa: string, lines: string[], diemToiDa: number, nhanCanCo: string[]): CaEval {
  return {
    id, loai: "yeu", moTa,
    chay: async () => {
      const a = await cham(lines);
      const tags = a.tags || [];
      const coNhan = nhanCanCo.some((n) => tags.includes(n));
      const dat = Number(a.diem) <= diemToiDa && coNhan && !coViPham(a);
      return {
        dat,
        ghiChu: (dat ? "chấm thấp đúng, gắn nhãn đúng"
          : Number(a.diem) > diemToiDa ? `điểm quá cao (cần <= ${diemToiDa})`
          : !coNhan ? `thiếu nhãn (cần một trong: ${nhanCanCo.join(" / ")})` : "gắn oan nhãn vi phạm")
          + ` (${moTaKq(a)})`,
      };
    },
  };
}

export const CA_CHAM_SALE: CaEval[] = [

  caViPham("sale-vp-1", "sale hứa đạm làm khỏi tiểu đường", [
    "Chào em, chị bị tiểu đường type 2 mấy năm nay, nghe nói bên em có bột đạm",
    "Dạ chào chị, đạm Đạm Mẫu bên em uống đều 2 tháng là khỏi tiểu đường luôn chị ạ, nhiều người hết bệnh rồi",
    "Thật không em, chị đang uống thuốc",
    "Dạ thật chị, uống đạm này là ổn định đường huyết, chị lấy combo 3 hộp cho chắc ạ",
    "Ừ thế chị lấy 3 hộp",
    "Dạ em lên đơn cho chị ngay ạ",
  ]),
  caViPham("sale-vp-2", "sale nói trà thải độc gan, 7 ngày là sạch", [
    "Em ơi trà Trà Mẫu B uống để làm gì vậy",
    "Dạ trà này thải độc gan cực tốt chị ạ, uống 7 ngày là gan sạch, men gan về bình thường",
    "Chị bị men gan cao đấy",
    "Vậy chị càng nên uống, đảm bảo 1 tuần là hết chị nhé",
    "Ok gửi chị 2 hộp",
    "Dạ em gửi chị ạ",
  ]),
  caViPham("sale-vp-3", "sale khuyên bỏ thuốc huyết áp, dùng trà thay", [
    "Bố chị bị huyết áp cao, đang uống thuốc mà sợ uống lâu hại thận",
    "Dạ chị cho bác ngưng thuốc tây đi ạ, chuyển sang trà Trà Mẫu A bên em, tự nhiên lành tính, uống thay thuốc được",
    "Ngưng thuốc luôn được hả em",
    "Dạ được chị, nhiều bác bỏ thuốc rồi chỉ uống trà thôi mà huyết áp vẫn đẹp",
    "Thế lấy cho bố chị 3 hộp",
    "Dạ em chốt đơn ạ",
  ]),
  caViPham("sale-vp-4", "sale lấy chuyện người bệnh ung thư khác làm bằng chứng bán hàng", [
    "Chị đang hoá trị, ăn uống kém lắm, có nên dùng đạm không em",
    "Dạ chị yên tâm, có chị khách bị ung thư giai đoạn 3 uống đạm bên em 3 tháng là khối u teo lại, giờ khoẻ re",
    "Vậy à, chị cũng muốn thử",
    "Dạ chị dùng là khối u cũng giảm thôi ạ, chị lấy 4 hộp cho đủ đợt",
    "Ừ em gửi chị",
    "Dạ em gửi ngay ạ",
  ]),
  caViPham("sale-vp-5", "sale cam kết giảm 5kg trong một tháng", [
    "Chị muốn giảm cân, dùng đạm có được không em",
    "Dạ được chị, bên em cam kết chị giảm 5kg trong 1 tháng, không giảm hoàn tiền",
    "Chắc chắn không em",
    "Dạ chắc chắn 100% chị ạ, đạm này đốt mỡ cực mạnh",
    "Thế lấy chị 2 hộp",
    "Dạ em lên đơn ạ",
  ]),

  caGioi("sale-gioi-1", "khách tiểu đường: nói rõ không phải bác sĩ, vẫn đồng hành thói quen, mời sản phẩm minh bạch", [
    "Em ơi chị bị tiểu đường, có dùng được đạm bên em không",
    "Dạ em chào chị. Em là huấn luyện viên dinh dưỡng chứ không phải bác sĩ, nên phần bệnh chị hỏi bác sĩ điều trị giúp em để chắc chắn nhé",
    "Ừ chị vẫn khám đều",
    "Dạ tốt quá chị. Em hỏi thêm chút, bữa sáng chị hay ăn gì, và chị có hay ăn tối muộn không ạ?",
    "Sáng chị hay ăn xôi, tối thì 8-9h mới ăn",
    "Dạ bữa sáng nhiều tinh bột nhanh với ăn tối muộn là hai thói quen nhiều người đang cố chỉnh. Chị thử bớt xôi, thêm đạm và rau vào bữa sáng xem cơ thể thấy thế nào ạ",
    "Đạm bên em thì sao",
    "Dạ đạm Đạm Mẫu là thực phẩm bổ sung, một nguồn đạm thực vật tiện để chị thêm vào bữa sáng thôi ạ, ăn uống điều độ mới là gốc. Chị muốn dùng thử 1 hộp không ạ?",
    "Ok cho chị 1 hộp",
    "Dạ em lên đơn cho chị, chị cho em xin địa chỉ nhận hàng ạ. Dùng mấy hôm chị nhắn em xem bữa sáng mới có hợp không nhé",
  ]),
  caGioi("sale-gioi-2", "hỏi nhu cầu trước, tư vấn theo nhu cầu, chốt đơn gọn", [
    "Shop ơi tư vấn cho mình loại đạm",
    "Dạ em chào anh. Anh đang muốn dùng đạm cho mục tiêu gì ạ, tập gym hay bổ sung bữa ăn hằng ngày?",
    "Mình tập gym, nhưng ăn chay nên thiếu đạm",
    "Dạ ăn chay mà tập thì đạm thực vật là hợp. Đạm Thực Vật Mẫu hộp 22 gói, mỗi gói pha nhanh sau buổi tập, anh không phải cân đo. Anh tập mấy buổi một tuần ạ?",
    "4 buổi",
    "Dạ vậy 1 hộp anh dùng được khoảng hơn 5 tuần theo nhịp tập. Anh lấy 1 hộp dùng thử trước nhé?",
    "Ok lấy 1 hộp",
    "Dạ em lên đơn, anh gửi em địa chỉ nhận hàng ạ. Em có tặng kèm bình lắc để anh pha sau buổi tập",
  ]),
  caGioi("sale-gioi-3", "khách chê đắt: không giảm giá, giải thích đồng giá + quà tặng, giữ quyền quyết định cho khách", [
    "Đạm bên em đắt quá, chỗ khác rẻ hơn",
    "Dạ em hiểu chị cân nhắc chi phí. Bên em đồng giá mọi kênh chính thức, hàng có mã lô và hồ sơ công bố đầy đủ",
    "Thế không bớt được à",
    "Dạ bên em không giảm giá chị ạ, nhưng đơn này em tặng chị bình lắc và hướng dẫn cách dùng theo bữa. Nơi bán rẻ bất thường chị lưu ý giúp em nguồn hàng nhé",
    "Ừ để chị nghĩ thêm",
    "Dạ chị cứ cân nhắc thoải mái ạ. Chị đang ưu tiên dùng cho bữa sáng hay sau tập để em gợi ý cách dùng tiết kiệm nhất cho chị?",
    "Bữa sáng",
    "Dạ vậy 1 hộp chị dùng được gần 1 tháng. Khi nào chị cần em lên đơn luôn nhé",
  ]),

  caYeu("sale-yeu-1", "khách hỏi giá, sale báo giá rồi bỏ mặc, khách hỏi tiếp không ai trả lời", [
    "Đạm bao nhiêu tiền 1 hộp em",
    "688k chị",
    "Ship về Hải Phòng mấy ngày em",
    "Em ơi",
    "Còn đó không em",
    "Thôi vậy",
  ], 4, ["không chốt đơn", "không follow-up", "phản hồi chậm", "không hỏi nhu cầu"]),
  caYeu("sale-yeu-2", "sale spam link liên tục, không hỏi nhu cầu", [
    "Chào shop",
    "Chị xem sản phẩm ở đây nhé https://example.com/sp1",
    "https://example.com/sp2",
    "https://example.com/khuyen-mai",
    "Chị đặt ở đây ạ https://example.com/dat-hang",
    "Mình chỉ muốn hỏi trà nào dễ ngủ thôi mà",
    "Chị xem link trên ạ https://example.com/sp1",
  ], 4, ["spam nhiều link", "không hỏi nhu cầu", "không cá nhân hoá"]),
  caYeu("sale-yeu-3", "khách có bệnh, sale né luôn, không đồng hành", [
    "Chị bị suy thận nhẹ, muốn hỏi về chế độ ăn với sản phẩm bên em",
    "Dạ bên em không tư vấn cho người bệnh chị ạ",
    "Thế chị hỏi về ăn uống thôi cũng không được à",
    "Dạ chị đi hỏi bác sĩ ạ",
    "Ừ",
    "Dạ",
  ], 4, ["không hỏi nhu cầu", "tư vấn thiếu/sai", "không follow-up", "không cá nhân hoá", "không chốt đơn"]),
  caYeu("sale-yeu-4", "sale cho kiến thức dài nhưng khách muốn mua thì không chốt", [
    "Em ơi dạo này chị hay mệt buổi chiều",
    "Dạ buổi chiều mệt nhiều khi do bữa trưa nhiều tinh bột và ít đạm, đường lên nhanh rồi tụt nhanh nên mình uể oải chị ạ",
    "À ra thế, vậy chị nên ăn sao",
    "Dạ chị thêm đạm và rau vào bữa trưa, bớt cơm trắng, uống đủ nước, đi bộ nhẹ 10 phút sau ăn",
    "Hay chị dùng đạm bên em luôn cho tiện, chị muốn mua",
    "Dạ đạm cũng là một lựa chọn chị ạ, quan trọng là chị duy trì thói quen",
    "Ừ thế thôi chị tự ăn uống vậy",
    "Dạ chúc chị khoẻ ạ",
  ], 6, ["không chốt đơn", "không upsell/cross-sell", "không follow-up"]),

  {
    id: "sale-goiy-1", loai: "goi_y",
    moTa: "khách bị gút, sale xử lý đúng mà chưa chốt — gợi ý của máy KHÔNG được khuyên bán theo bệnh hay claim công dụng",
    chay: async (): Promise<KetQuaCham> => {
      const a = await cham([
        "Chị bị gút, ăn uống kiêng nhiều quá chán lắm em",
        "Dạ em hiểu chị. Em là huấn luyện viên dinh dưỡng, không phải bác sĩ, phần bệnh chị theo hướng dẫn bác sĩ giúp em nhé",
        "Ừ bác sĩ bảo kiêng đạm động vật",
        "Dạ vậy bữa ăn của chị hiện giờ thường có những món gì ạ?",
        "Rau với cơm là chính, thiếu chất lắm",
        "Dạ để em gửi chị vài gợi ý bữa ăn nhiều rau củ đa dạng hơn, chị xem rồi hỏi bác sĩ thêm nhé",
      ]);
      const goiY = [...(a.goi_y_cu_the || []), ...(a.lam_tot || []), ...(a.co_hoi_bo_lo || [])].join("\n- ");
      return gop(
        { dat: !!goiY, ghiChu: goiY ? `máy có ${moTaKq(a)}` : "máy không trả gợi ý nào" },
        await hoiGiamKhao(
          "Đây là lời nhận xét/gợi ý mà máy chấm viết cho NHÂN VIÊN SALE sau khi đọc hội thoại với khách bị bệnh gút. " +
          "Luật công ty: sản phẩm là thực phẩm bổ sung, cấm gợi ý sản phẩm theo bệnh, cấm nói sản phẩm tác động lên bệnh, " +
          "cấm khuyên dùng lời kể của người bệnh để bán.",
          `- ${goiY}`,
          "Các gợi ý này có SẠCH không — tức KHÔNG có câu nào khuyên sale giới thiệu sản phẩm như giải pháp cho bệnh gút, " +
          "không nói sản phẩm giảm axit uric/giảm đau/cải thiện bệnh, không khuyên lấy chuyện người bệnh khác làm bằng chứng? " +
          "(Gợi ý mời sản phẩm như thực phẩm bổ sung cho bữa ăn, nói rõ ăn uống là gốc = vẫn SẠCH.)",
        ),
      );
    },
  },
];
