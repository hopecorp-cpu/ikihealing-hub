export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://ops-hub.example.com").replace(/\/+$/, "");

export const APP_HOST = APP_URL.replace(/^https?:\/\//, "");

export const appLink = (path = "/") => `${APP_URL}${path.startsWith("/") ? path : "/" + path}`;
