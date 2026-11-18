import { createElement as h, type ReactNode } from "react";
import { requireManager, requireUser } from "@/lib/auth-server";
import { isBodRole, isManagerOrAbove } from "@/lib/auth";
import { getConfigValue } from "@/lib/app-config";
import { getServiceClient } from "@/lib/supabase-server";
import { khoiDuocXem } from "@/lib/chi-so/quyen";
import { layBang, theoKhoi, viecUuTien } from "@/lib/chi-so/index";
import { fmtLucVN } from "@/lib/chi-so/khung";
import { hienSo } from "@/lib/chi-so/hien";
import { CHU } from "@/lib/chi-so/muc-tieu";
import type { Den, O } from "@/lib/chi-so/types";

const DEN: Record<Den, { cham: string; nhan: string }> = {
  xanh: { cham: "bg-emerald-500", nhan: "Ổn" },
  vang: { cham: "bg-amber-400", nhan: "Cần để ý" },
  do: { cham: "bg-red-500", nhan: "Cần xử lý" },
  xam: { cham: "bg-gray-300", nhan: "Chưa có" },
};

function tuChoi(): ReactNode {
  return h("main", { className: "max-w-3xl mx-auto p-6 bg-white" },
    h("h1", { className: "text-2xl font-bold text-gray-900" }, "Bảng chỉ số"),
    h("p", { className: "mt-3 text-gray-700" }, "Chỉ quản lý xem."),
  );
}

function The({ o }: { o: O }) {
  const den = DEN[o.den];
  const so = hienSo(o);
  return h("article", { className: "bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-1" },
    h("div", { className: "flex items-start gap-2" },
      h("h3", { className: "text-[14px] font-bold text-gray-900 leading-snug flex-1" }, o.ten),
      h("span", { className: "inline-flex items-center gap-1 shrink-0", title: den.nhan },
        h("span", { className: `inline-block w-2.5 h-2.5 rounded-[50%] ${den.cham}` }),
        h("span", { className: "text-[11px] text-gray-500 rounded-md bg-gray-100 px-1.5 py-0.5" }, den.nhan),
      ),
    ),
    h("div", { className: `${o.nhayCam ? "sensitive " : ""}text-[22px] font-bold text-gray-900 tabular-nums` }, so),
    h("div", { className: "text-[12px] text-gray-600" }, `Mục tiêu: ${o.mucTieu ?? CHU.chuaChot}`),
    h("div", { className: "text-[12px] text-gray-500" },
      `${o.nguon} · cập nhật ${fmtLucVN(o.capNhatLuc)} (giờ VN) · ${o.tanSuat}`),
    o.den !== "xanh" && o.lyDo ? h("p", { className: "text-[12px] text-gray-700" }, o.lyDo) : null,
  );
}

async function phongCua(sb: any, id: string | null): Promise<{ ma: string | null; name: string | null }> {
  if (!id) return { ma: null, name: null };
  const coMa = await sb.from("departments").select("name, ma").eq("id", id).maybeSingle();
  if (!coMa.error && coMa.data) return { ma: coMa.data.ma ?? null, name: coMa.data.name ?? null };
  const ten = await sb.from("departments").select("name").eq("id", id).maybeSingle();
  return { ma: null, name: ten.data?.name ?? null };
}

export default async function TrangChiSo() {
  const vao = await requireUser();
  const bod = isBodRole(vao.role);
  if (!bod && !isManagerOrAbove(vao.role)) return tuChoi();
  const user = bod ? vao : await requireManager();

  const sb = getServiceClient();
  const phong = await phongCua(sb, user.department_id);
  const duoc = khoiDuocXem({
    role: user.role,
    email: user.email,
    departmentMa: phong.ma,
    departmentName: phong.name,
  });
  if (!duoc) return tuChoi();

  const tat = await layBang(sb, { duoc, docCauHinh: getConfigValue });
  const khoi = theoKhoi(tat, duoc);

  return h("main", { className: "max-w-6xl mx-auto p-4 sm:p-6 bg-[#f7f8fa] min-h-full" },
    h("h1", { className: "text-2xl font-bold text-gray-900" }, "Bảng chỉ số"),
    h("p", { className: "text-sm text-gray-600 mt-1" },
      "Số tiền ẩn mặc định. Bấm Hiện số trên thanh trên để xem. Ô chưa có dữ liệu giữ khung và ghi lý do."),
    h("div", { className: "mt-4 space-y-6" },
      khoi.map((b) => h("section", { key: b.phong },
        h("div", { className: "flex items-baseline justify-between gap-3 flex-wrap mb-2" },
          h("h2", { className: "text-lg font-bold text-gray-900" }, b.phong),
        ),
        h("div", { className: "bg-white border border-gray-200 rounded-lg px-3 py-2 mb-3 text-[13px] text-gray-800" },
          h("span", { className: "font-bold" }, "Việc ưu tiên. "),
          viecUuTien(b.o),
        ),
        h("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" },
          b.o.map((o) => h(The, { key: o.key, o })),
        ),
      )),
    ),
  );
}
