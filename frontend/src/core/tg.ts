export const Telegram = (window as any).Telegram;

export function initTelegram() {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
}