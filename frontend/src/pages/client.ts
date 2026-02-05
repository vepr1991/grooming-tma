/**
 * (c) 2026 Vladimir Kovalenko
 */
import { initTelegram, Telegram } from '../core/tg';
import { $, show, hide } from '../core/dom';
import { apiFetch } from '../core/api';
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
            // Callback when returning from booking
        });
    });

    // 6. [NEW] My Appointments Logic
    const btnMyApps = $('btn-open-my-appointments');
    if (btnMyApps) {
        btnMyApps.onclick = openMyAppointments;
    }
}

// [NEW] Функция загрузки и отображения записей
async function openMyAppointments() {
    hide('view-home');
    hide('view-booking');
    show('view-my-appointments');

    // Переопределяем кнопку Назад
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(() => {
        hide('view-my-appointments');
        show('view-home');
        Telegram.WebApp.BackButton.hide();
    });

    const list = $('my-appointments-list');
    if (!list) return;

    list.innerHTML = '<div class="text-center text-secondary py-10 animate-pulse">Загрузка...</div>';

    try {
        const apps = await apiFetch<any[]>('/my-appointments');
        list.innerHTML = '';

        if (apps.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 opacity-50">
                    <span class="material-symbols-rounded text-6xl text-secondary mb-4">history_toggle_off</span>
                    <p class="text-secondary font-bold">История пуста</p>
                </div>
            `;
            return;
        }

        apps.forEach(a => {
            const card = document.createElement('div');
            card.className = "bg-surface border border-border rounded-xl p-4 flex gap-4";

            // Статус цвета
            let statusColor = "bg-primary";
            let statusText = "Ожидает";
            if (a.status === 'confirmed') { statusColor = "bg-success"; statusText = "Подтверждено"; }
            if (a.status === 'cancelled') { statusColor = "bg-error"; statusText = "Отменено"; }
            if (a.status === 'completed') { statusColor = "bg-secondary"; statusText = "Завершено"; }

            // Дата
            const dateObj = new Date(a.starts_at);
            const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

            card.innerHTML = `
                <div class="flex flex-col items-center justify-center w-14 h-14 bg-bg rounded-lg border border-border shrink-0">
                    <span class="text-xs font-bold text-secondary uppercase">${dateStr.split(' ')[1]}</span>
                    <span class="text-xl font-black text-white">${dateStr.split(' ')[0]}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <h4 class="text-white font-bold text-sm truncate">${a.services?.name || 'Услуга'}</h4>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${statusColor}">${statusText}</span>
                    </div>
                    <p class="text-xs text-primary font-bold mt-0.5">${timeStr} • ${a.services?.price} ₸</p>
                    <p class="text-xs text-secondary mt-1 truncate">🐶 ${a.pet_name}</p>
                    <div class="mt-2 pt-2 border-t border-border/30 flex items-center gap-1 text-xs text-secondary">
                        <span class="material-symbols-rounded text-sm">store</span>
                        <span class="truncate">${a.masters?.salon_name || 'Салон'}</span>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (e) {
        list.innerHTML = '<div class="text-center text-error py-10">Ошибка загрузки</div>';
    }
}

init();