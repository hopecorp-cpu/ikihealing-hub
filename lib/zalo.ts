export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "84" + p.slice(1);
  if (!p.startsWith("84")) p = "84" + p;
  return p;
}

export function timSdtVN(text: string | null | undefined): string | null {
  const gon = String(text || "").replace(/(\d)[\s.\-](?=\d)/g, "$1");
  const m = gon.match(/(?<!\d)(?:\+?84|0)([35789]\d{8})(?!\d)/);
  return m ? "0" + m[1] : null;
}

export function zaloChatLink(phone: string | null | undefined): string | null {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  return `https://zalo.me/${norm}`;
}

export function zaloMessageLink(phone: string, message: string): string | null {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  return `https://zalo.me/${norm}?msg=${encodeURIComponent(message)}`;
}

export function credentialsMessage(opts: {
  fullName: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  return `Chào ${opts.fullName.split(" ").slice(-1)[0]},

Em/Anh gửi tài khoản IKIHEALING Hub:

Link: ${opts.loginUrl}
Email: ${opts.email}
Pass: ${opts.password}

Vào link, đăng nhập, bấm "Quên mật khẩu?" để đặt lại password riêng nhé.`;
}

const ZALO_OA_API = "https://openapi.zalo.me/v3.0/oa/message";

export async function sendOAMessage(zaloUserId: string, content: string, accessToken?: string) {
  const token = accessToken || process.env.ZALO_OA_ACCESS_TOKEN;
  if (!token) {
    console.warn("[Zalo OA] No access token configured — skipping");
    return { success: false, error: "Zalo OA chưa cấu hình" };
  }

  try {
    const res = await fetch(`${ZALO_OA_API}/cs`, {
      method: "POST",
      headers: {
        "access_token": token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipient: { user_id: zaloUserId },
        message: { text: content }
      })
    });
    const data = await res.json();
    if (data.error) {
      return { success: false, error: data.message || data.error };
    }
    return { success: true, messageId: data.data?.message_id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendZNS(opts: {
  phone: string;
  templateId: string;
  params: Record<string, string>;
  accessToken?: string;
}) {
  const token = opts.accessToken || process.env.ZALO_OA_ACCESS_TOKEN;
  if (!token) return { success: false, error: "Zalo OA chưa cấu hình" };

  const norm = normalizePhone(opts.phone);
  if (!norm) return { success: false, error: "SĐT không hợp lệ" };

  try {
    const res = await fetch("https://business.openapi.zalo.me/message/template", {
      method: "POST",
      headers: { "access_token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: norm,
        template_id: opts.templateId,
        template_data: opts.params,
        tracking_id: `acme-${Date.now()}`
      })
    });
    const data = await res.json();
    return data.error
      ? { success: false, error: data.message || data.error }
      : { success: true, messageId: data.data?.msg_id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
