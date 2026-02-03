/**
 * (c) 2026 Vladimir Kovalenko
 * Refactored Entry Point
 */
import { initTelegram, Telegram } from '../core/tg';
import { $ } from '../core/dom';
import { loadMasterInfo, loadServices } from '../features/client/home';
import { setupBooking, openBooking } from '../features/client/booking';

declare const IMask: any;

initTelegram();

// Global init
const urlParams = new URLSearchParams(window.location.search);
const masterId = urlParams.get('start_param') || '579214945'; // Fallback ID

async function init() {
    // 1. Setup inputs
    const phoneInput = $('inp-phone');
    if (typeof IMask !== 'undefined' && phoneInput) {
        IMask(phoneInput, { mask: '+{7} (000) 000-00-00', lazy: false });
    }

    // 2. Pre-fill name if available
    const user = Telegram.WebApp.initDataUnsafe?.user;
    if (user) {
        const nameInput = $('inp-client-name') as HTMLInputElement;
        if (nameInput) nameInput.value = `${user.first_name} ${user.last_name || ''}`.trim();
    }

    // 3. Load Data
    const masterProfile = await loadMasterInfo(masterId);

    // 4. Init Booking Module with timezone
    const tz = masterProfile?.timezone || 'Asia/Almaty';
    setupBooking(masterId, tz);

    // 5. Load Services & Bind Booking Flow
    await loadServices(masterId, (service) => {
        openBooking(service, () => {
            // Callback when returning from booking (optional)
        });
    });
}

init();