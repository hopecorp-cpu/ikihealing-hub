export const TTS_API_BASE = "https://open-api.tiktokglobalshop.com";
export const TTS_AUTH_BASE = "https://auth.tiktok-shops.com";

export const TTS_SELLER_CENTER = "https://seller-vn.tiktok.com";

export const TTS_VERSION = {
  shops: "202309",
  orderSearch: "202309",
  orderDetail: "202507",
  fulfillment: "202309",
  customerService: "202309",
} as const;

export const TTS_WEBHOOK_TYPE: Record<number, string> = {
  1: "ORDER_STATUS_CHANGE",
  2: "REVERSE_STATUS_UPDATE",
  3: "RECIPIENT_ADDRESS_UPDATE",
  4: "PACKAGE_UPDATE",
  5: "PRODUCT_STATUS_CHANGE",
  6: "SELLER_DEAUTHORIZATION",
  7: "UPCOMING_AUTHORIZATION_EXPIRATION",
  11: "CANCELLATION_STATUS_CHANGE",
  12: "RETURN_STATUS_CHANGE",
  13: "NEW_CONVERSATION",
  14: "NEW_MESSAGE",
};

export const TTS_ORDER_STATUS = {
  UNPAID: "UNPAID",
  ON_HOLD: "ON_HOLD",
  AWAITING_SHIPMENT: "AWAITING_SHIPMENT",
  AWAITING_COLLECTION: "AWAITING_COLLECTION",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  CANCEL: "CANCEL",
} as const;
export type TtsOrderStatus = (typeof TTS_ORDER_STATUS)[keyof typeof TTS_ORDER_STATUS];

const env = (k: string) => (process.env[k] || "").trim();
const laBat = (k: string) => env(k).toLowerCase() === "true";

export type TtsConfig = {
  appKey: string;
  appSecret: string;
  serviceId: string;
  telegramGroupId: string;
  tienChatId: string;
  autoShip: boolean;
  csEnabled: boolean;
  csAutoSend: boolean;
  shipDelayMinutes: number;
  handoverMethod: "PICKUP" | "DROP_OFF";
};

export function ttsConfig(): TtsConfig {
  const delay = Number(env("TTS_SHIP_DELAY_MINUTES"));
  const hm = env("TTS_HANDOVER_METHOD").toUpperCase();
  return {
    appKey: env("TTS_APP_KEY"),
    appSecret: env("TTS_APP_SECRET"),
    serviceId: env("TTS_SERVICE_ID"),
    telegramGroupId: env("TTS_TELEGRAM_GROUP_ID"),
    tienChatId: env("TTS_TIEN_CHAT_ID"),
    autoShip: laBat("TTS_AUTO_SHIP"),
    csEnabled: laBat("TTS_CS_ENABLED"),
    csAutoSend: laBat("TTS_CS_AUTO_SEND"),
    shipDelayMinutes: Number.isFinite(delay) && delay >= 0 ? delay : 60,
    handoverMethod: hm === "DROP_OFF" ? "DROP_OFF" : "PICKUP",
  };
}

export function ttsConfigured(): boolean {
  const c = ttsConfig();
  return !!c.appKey && !!c.appSecret;
}

export function ttsAuthorizeUrl(state = ""): string {
  const c = ttsConfig();
  const qs = new URLSearchParams({ service_id: c.serviceId });
  if (state) qs.set("state", state);
  return `https://services.tiktokshop.com/open/authorize?${qs.toString()}`;
}
