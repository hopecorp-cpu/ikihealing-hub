"use client";
import { useLang } from "@/components/lang-provider";
import { useMemo, useState } from "react";
import { Card, SectionCard, Badge } from "@/components/ui/kit";
import { ShieldAlert, RotateCcw, Sparkles, Users, Armchair, Printer } from "lucide-react";
import {
  CAU_HOI, NHOM, RAO, chamNhom, tinhThanSo, deXuatGhe, SO_NGHIA,
  type MaNhom, type KetQuaNhom, type KetQuaThanSo,
} from "@/lib/nhan-su-cong-cu";

const MA: MaNhom[] = ["D", "I", "S", "C"];

export default function Client() {
  const { t: tDich } = useLang();
  const [chon, setChon] = useState<Array<number | undefined>>(() => Array(CAU_HOI.length).fill(undefined));
  const [hoTen, setHoTen] = useState("");
  const [ngaySinh, setNgaySinh] = useState("");

  const daLam = chon.filter((x) => x != null).length;

  const kqNhom: KetQuaNhom | null = daLam >= Math.ceil(CAU_HOI.length / 2) ? chamNhom(chon) : null;
  const kqSo: KetQuaThanSo | null = useMemo(() => tinhThanSo(hoTen, ngaySinh), [hoTen, ngaySinh]);
  const ghe = useMemo(() => (kqNhom || kqSo ? deXuatGhe(kqNhom, kqSo) : []), [kqNhom, kqSo]);

  const datLai = () => { setChon(Array(CAU_HOI.length).fill(undefined)); setHoTen(""); setNgaySinh(""); };

  return (
    <div className="space-y-5">
      <Card className="border-amber-300 bg-amber-50">
        <div className="flex gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1 text-sm text-amber-900">
            <p className="font-semibold">{tDich("Đọc trước khi dùng")}</p>
            <ul className="list-disc space-y-0.5 pl-5">{RAO.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title={<span className="flex items-center gap-2"><Users className="h-4 w-4" /> {tDich("Bốn nhóm tính cách")}</span>}
          desc={`Mỗi dòng chọn MỘT từ giống người đó nhất. Đã chọn ${daLam}/${CAU_HOI.length}.`}
          right={<button onClick={datLai} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"><RotateCcw className="h-3.5 w-3.5" /> {tDich("Làm lại")}</button>}
        >
          <div className="space-y-2.5">
            {CAU_HOI.map((c, i) => (
              <div key={i} className="grid grid-cols-4 gap-1.5">
                {c.tu.map((t, j) => {
                  const active = chon[i] === j;
                  return (
                    <button
                      key={j}
                      onClick={() => setChon((cu) => { const m = [...cu]; m[i] = active ? undefined : j; return m; })}
                      className={`rounded-lg border px-2 py-2 text-xs leading-tight transition ${active ? "border-transparent font-semibold text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"}`}
                      style={active ? { background: NHOM[MA[j]].mau } : undefined}
                    >{t}</button>
                  );
                })}
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> {tDich("Thần số học")}</span>}
            desc={tDich("Tính từ họ tên đầy đủ và ngày sinh. Độ tin cậy thấp hơn hẳn phần bên trái — xem lại phần rào ở trên.")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-gray-500">{tDich("Họ tên đầy đủ")}</span>
                <input value={hoTen} onChange={(e) => setHoTen(e.target.value)} placeholder={tDich("Nguyễn Văn A")}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-500">{tDich("Ngày sinh")}</span>
                <input type="date" value={ngaySinh} onChange={(e) => setNgaySinh(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </label>
            </div>

            {kqSo && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([[tDich("Chủ đạo"), kqSo.chuDao], [tDich("Sứ mệnh"), kqSo.suMenh], [tDich("Linh hồn"), kqSo.linhHon], [tDich("Nhân cách"), kqSo.nhanCach]] as const).map(([ten, so]) => (
                  <div key={ten} className="rounded-xl border bg-gray-50 p-3 text-center">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">{ten}</div>
                    <div className="text-2xl font-bold text-gray-800">{so}</div>
                  </div>
                ))}
              </div>
            )}
            {kqSo && SO_NGHIA[kqSo.chuDao] && (
              <div className="mt-3 space-y-1.5 rounded-xl border bg-white p-3 text-sm">
                <p className="font-semibold text-gray-700">{tDich("Số chủ đạo")} {kqSo.chuDao} {tDich("— đọc theo hướng công việc")}</p>
                <p><span className="text-gray-500">{tDich("Chỗ mạnh:")} </span>{SO_NGHIA[kqSo.chuDao].manh}</p>
                <p><span className="text-gray-500">{tDich("Chỗ dễ hụt:")} </span>{SO_NGHIA[kqSo.chuDao].deHut}</p>
                <p><span className="text-gray-500">{tDich("Hợp việc:")} </span>{SO_NGHIA[kqSo.chuDao].hopViec}</p>
              </div>
            )}
            {ngaySinh && !kqSo && <p className="mt-3 text-sm text-red-600">{tDich("Ngày sinh chưa hợp lệ.")}</p>}
          </SectionCard>

          {kqNhom && (
            <SectionCard title={tDich("Kết quả bốn nhóm")} desc={tDich(kqNhom.moTa)}>
              <div className="space-y-2">
                {MA.map((m) => (
                  <div key={m} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-gray-600">{tDich(NHOM[m].ten)}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${kqNhom.phanTram[m]}%`, background: NHOM[m].mau }} />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold text-gray-700">{kqNhom.phanTram[m]}%</span>
                  </div>
                ))}
              </div>
              {kqNhom.canhBao.map((c) => (
                <p key={c} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{c}</p>
              ))}
              <div className="mt-4 space-y-1.5 rounded-xl border bg-white p-3 text-sm">
                <p className="font-semibold text-gray-700">{tDich("Nhóm trội:")} {tDich(NHOM[kqNhom.troi].ten)}</p>
                <p><span className="text-gray-500">{tDich("Nhận ra qua:")} </span>{NHOM[kqNhom.troi].nhanDien}</p>
                <p><span className="text-gray-500">{tDich("Chỗ mạnh:")} </span>{NHOM[kqNhom.troi].manh}</p>
                <p><span className="text-gray-500">{tDich("Chỗ dễ hụt:")} </span>{NHOM[kqNhom.troi].deHut}</p>
                <p><span className="text-gray-500">{tDich("Nói chuyện với họ:")} </span>{NHOM[kqNhom.troi].noiChuyen}</p>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {ghe.length > 0 && (
        <SectionCard
          title={<span className="flex items-center gap-2"><Armchair className="h-4 w-4" /> {tDich("Ghế nào hợp hơn")}</span>}
          desc={tDich("Gợi ý CHỖ NGỒI, không phải điểm chấm người. Mỗi ghế có lý do kèm theo để anh chị cãi lại được.")}
          right={<button onClick={() => window.print()} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"><Printer className="h-3.5 w-3.5" /> In</button>}
        >
          <div className="grid gap-2 md:grid-cols-2">
            {ghe.map((g) => (
              <div key={tDich(g.ten)} className={`rounded-xl border p-3 ${g.diem >= 2 ? "border-emerald-200 bg-emerald-50" : "bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800">{tDich(g.ten)}</span>
                  <span className="flex gap-1">
                    {g.hopNhom && <Badge tone="green">{tDich("hợp nhóm tính cách")}</Badge>}
                    {g.hopSo && <Badge tone="gray">{tDich("hợp số")}</Badge>}
                    {g.diem === 0 && <Badge tone="gray">{tDich("chưa thấy dấu hiệu hợp")}</Badge>}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{g.vi}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {tDich("Ghế xếp trên không có nghĩa là người này giỏi hơn ở đó — chỉ có nghĩa cách làm việc của họ\n            ít phải gồng hơn. Người ngồi ghế &quot;chưa thấy dấu hiệu hợp&quot; vẫn làm tốt được nếu họ muốn\n            và được hướng dẫn; đừng lấy bảng này chặn đường ai.")}
          </p>
        </SectionCard>
      )}
    </div>
  );
}
