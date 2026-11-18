"use client";

import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { MessageSquare, Gift, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { saveAutoReply, saveFlash, dangKyWebhookFanpage } from "./actions";

type Btn = { title: string; url: string };

export function AutoReplyForm({ init, pages }: { init: any; pages: { id: string; name: string }[] }) {
  const { t: t } = useLang();
  const [enabled, setEnabled] = useState(!!init.enabled);
  const [text, setText] = useState(String(init.text || ""));
  const [cooldown, setCooldown] = useState(Number(init.cooldownHours || 12));
  const [buttons, setButtons] = useState<Btn[]>(init.buttons?.length ? init.buttons : [{ title: "", url: "" }]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
  const { t: t } = useLang();
      const r = await saveAutoReply({ enabled, text, cooldownHours: cooldown, buttons });
      setMsg(r.ok ? { ok: true, text: t("Đã lưu.") } : { ok: false, text: r.error || "Lỗi không rõ" });
    });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] space-y-4">
      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
        <MessageSquare className="w-[18px] h-[18px] text-emerald-600" />
        {t("Trả lời tự động tin nhắn fanpage")}
      </h2>

      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
        <span className={enabled ? "font-semibold text-emerald-700" : "text-gray-600"}>
          {enabled ? t("ĐANG BẬT — khách nhắn fanpage sẽ nhận tin này") : t("Đang tắt")}
        </span>
      </label>

      <div>
        <div className="text-[13px] font-medium text-gray-700 mb-1">{t("Lời chào gửi khách")}</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono"
        />
        <div className="text-[12px] text-gray-400 mt-1">
          {t("Có nút bấm thì Facebook chỉ hiện tối đa 640 ký tự. Cấm từ chữa/trị/thải độc — lưu sẽ bị chặn.")}
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium text-gray-700 mb-1">{t("Nút bấm (tối đa 3, tiêu đề ≤20 ký tự)")}</div>
        {buttons.map((b, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              value={t(b.title)}
              maxLength={20}
              placeholder={t("Kiểm tra thể trạng")}
              onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-44"
            />
            <input
              value={b.url}
              placeholder="https://example.com/quiz"
              onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button onClick={() => setButtons(buttons.filter((_, j) => j !== i))} className="text-gray-400 text-sm px-2">{t("Xoá")}</button>
          </div>
        ))}
        {buttons.length < 3 && (
          <button onClick={() => setButtons([...buttons, { title: "", url: "" }])} className="text-sm text-emerald-700 font-medium">
            {t("+ Thêm nút")}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-700">{t("Mỗi khách chỉ nhận lại sau")}</span>
        <input
          type="number"
          value={cooldown || ""}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setCooldown(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 w-20 text-sm"
        />
        <span className="text-gray-700">{t("giờ")}</span>
      </div>

      <div className="text-[12px] text-gray-500 bg-gray-50 rounded-lg p-3">
        {t("Fanpage đang nối:")} {pages.length ? pages.map((p) => p.name).join(" · ") : t("chưa đọc được (kiểm FB_USER_TOKEN)")}
      </div>

      <DangKyButton />
      <Actions pending={pending} msg={msg} onSave={submit} />
    </div>
  );
}

export function FlashForm({ init }: { init: any }) {
  const { t: t } = useLang();
  const [d, setD] = useState({
    enabled: !!init.enabled,
    title: String(init.title || ""),
    gift: String(init.gift || ""),
    note: String(init.note || ""),
    endsAt: String(init.endsAt || "").slice(0, 16),
    slots: Number(init.slots || 0),
    claimed: Number(init.claimed || 0),
    ctaUrl: String(init.ctaUrl || ""),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (k: string, v: any) => setD({ ...d, [k]: v });
  const submit = () =>
    start(async () => {
  const { t: t } = useLang();
      const r = await saveFlash({ ...d, endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : "" });
      setMsg(r.ok ? { ok: true, text: t("Đã lưu. Web example.com tự cập nhật, không cần build lại.") } : { ok: false, text: r.error || "Lỗi không rõ" });
    });

  const remaining = d.slots > 0 ? Math.max(0, d.slots - d.claimed) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] space-y-4">
      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
        <Gift className="w-[18px] h-[18px] text-emerald-600" />
        {t("Flash quà trên example.com")}
      </h2>

      <div className="text-[13px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
        {t("Thứ đếm ngược là")} <b>{t("quà tặng và số suất")}</b>{t(", không phải giá. Viết chữ giảm giá / chiết khấu / xả kho là\n        lưu sẽ bị chặn — hạ giá niêm yết sẽ phá thang giá đại lý và dạy khách chờ đợt sau.")}
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" checked={d.enabled} onChange={(e) => set("enabled", e.target.checked)} className="w-4 h-4" />
        <span className={d.enabled ? "font-semibold text-emerald-700" : "text-gray-600"}>
          {d.enabled ? t("ĐANG BẬT — hiện trên web") : t("Đang tắt")}
        </span>
      </label>

      <Field label={t("Tên chương trình")} value={t(d.title)} onChange={(v) => set("title", v)} />
      <Field label={t("Quà tặng")} value={d.gift} onChange={(v) => set("gift", v)} placeholder={t("Tặng bình lắc ACME + cẩm nang 21 ngày")} />
      <Field label={t("Ghi chú nhỏ")} value={t(d.note)} onChange={(v) => set("note", v)} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[13px] font-medium text-gray-700 mb-1">{t("Kết thúc lúc")}</div>
          <input type="datetime-local" value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <div className="text-[13px] font-medium text-gray-700 mb-1">{t("Số suất (0 = không giới hạn)")}</div>
          <input
            type="number"
            value={d.slots || ""}
            onFocus={(e) => e.target.select()}
            onChange={(e) => set("slots", Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="text-sm text-gray-600">
        {t("Đã có")} <b>{d.claimed}</b> {t("khách nhận")}
        {remaining !== null && <> {t("· còn")} <b>{remaining}</b> {t("suất")}</>}
        {" · "}
        <button onClick={() => set("claimed", 0)} className="text-emerald-700 font-medium underline">{t("đặt lại về 0")}</button>
      </div>

      <Field label={t("Đường dẫn nút")} value={d.ctaUrl} onChange={(v) => set("ctaUrl", v)} />
      <Actions pending={pending} msg={msg} onSave={submit} />
    </div>
  );
}

function DangKyButton() {
  const { t: t } = useLang();
  const [rows, setRows] = useState<{ page: string; ok: boolean; error?: string }[] | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
      <button
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await dangKyWebhookFanpage();
            if (r.ok) setRows(r.rows || []);
            else setErr(r.error || t("Lỗi không rõ"));
          })
        }
        disabled={pending}
        className="text-sm font-medium border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? t("Đang đăng ký…") : t("Đăng ký fanpage nhận tin nhắn")}
      </button>
      <div className="text-[12px] text-gray-500">
        {t("Bấm sau khi đã khai webhook trong Meta App. Bấm lại nhiều lần không sao.")}
      </div>
      {err && <div className="text-[13px] text-red-600">{err}</div>}
      {rows && (
        <ul className="text-[13px] space-y-0.5">
          {rows.length === 0 && <li className="text-gray-500">{t("Không thấy fanpage nào — kiểm FB_USER_TOKEN.")}</li>}
          {rows.map((r) => (
            <li key={r.page} className={r.ok ? "text-emerald-700" : "text-red-600"}>
              {r.ok ? "Xong" : t("Hỏng")} — {r.page}
              {r.error ? `: ${r.error}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="text-[13px] font-medium text-gray-700 mb-1">{label}</div>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}

function Actions({ pending, msg, onSave }: { pending: boolean; msg: { ok: boolean; text: string } | null; onSave: () => void }) {
  const { t: t } = useLang();
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={onSave}
        disabled={pending}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg"
      >
        <Save className="w-4 h-4" />
        {pending ? t("Đang lưu…") : t("Lưu")}
      </button>
      {msg && (
        <span className={`text-sm flex items-center gap-1.5 ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </span>
      )}
    </div>
  );
}
