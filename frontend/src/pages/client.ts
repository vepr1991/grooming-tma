/**
 * (c) 2026 Vladimir Kovalenko. All rights reserved.
 * Proprietary software. Unauthorized copying is strictly prohibited.
 */
import { apiFetch } from '../core/api';
import { initTelegram, Telegram } from '../core/tg';

declare const IMask: any; // Декларация глобальной переменной IMask

initTelegram();
Telegram.WebApp.expand();

const urlParams = new URLSearchParams(window.location.search);
const masterId = urlParams.get('start_param') || Telegram.WebApp.initDataUnsafe.start_param;

if (!masterId) {
    showToast("Ошибка: Ссылка не содержит ID мастера");
}

// --- GLOBAL STATE ---
let currentService: any = null;
let selectedDateStr: string | null = null;
let selectedSlot: string | null = null;
let calDate = new Date();
let masterSchedule: any[] = []; // Храним график работы
let masterProfile: any = null;  // Храним профиль (включая timezone)

const views = {
    home: document.getElementById('view-home')!,
    booking: document.getElementById('view-booking')!,
    success: document.getElementById('view-success')!
};

(window as any).goBack = () => {
    views.booking.classList.add('hidden');
    views.home.classList.remove('hidden');
    Telegram.WebApp.MainButton.hide();
    Telegram.WebApp.BackButton.hide();
};

async function init() {
    try {
        // 1. Загружаем профиль и сохраняем глобально
        masterProfile = await apiFetch(`/masters/${masterId}`);

        // Дефолтная таймзона для старых записей
        if (!masterProfile.timezone) masterProfile.timezone = 'Asia/Almaty';

        renderHero(masterProfile);

        // 2. Загружаем график
        masterSchedule = await apiFetch(`/masters/${masterId}/schedule`);

        // 3. Обновляем статус (Открыто/Закрыто) с учетом таймзоны
        updateShopStatus();

        const services = await apiFetch(`/masters/${masterId}/services`);
        renderServices(services);

        initPhoneMask();

    } catch (e) {
        console.error(e);
        showToast("Не удалось загрузить данные мастера");
    }
}

function initPhoneMask() {
    const element = document.getElementById('inp-phone');
    if (element && typeof IMask !== 'undefined') {
        IMask(element, {
            mask: '+{7} (000) 000-00-00'
        });
    }
}

function renderHero(master: any) {
    document.getElementById('hero-title')!.textContent = master.salon_name || 'Мастер';

    const descEl = document.getElementById('hero-desc')!;
    const descText = master.description || 'Описание отсутствует';
    descEl.textContent = descText;

    if (descText.length > 100) {
        const btnExpand = document.getElementById('btn-expand-desc')!;
        btnExpand.classList.remove('hidden');
        btnExpand.onclick = () => {
            if (descEl.classList.contains('desc-clamp')) {
                descEl.classList.remove('desc-clamp');
                descEl.classList.add('desc-expanded');
                btnExpand.textContent = 'Свернуть';
            } else {
                descEl.classList.add('desc-clamp');
                descEl.classList.remove('desc-expanded');
                btnExpand.textContent = 'Читать полностью';
            }
        };
    }

    if (master.avatar_url) {
        const img = document.getElementById('hero-avatar') as HTMLImageElement;
        img.src = master.avatar_url;
        img.classList.remove('hidden');
        document.getElementById('hero-avatar-placeholder')!.classList.add('hidden');
    }
}

function updateShopStatus() {
    if (!masterProfile || !masterSchedule) return;

    // Получаем текущее время В ГОРОДЕ МАСТЕРА (строка HH:MM)
    const masterTimeStr = new Date().toLocaleTimeString('en-US', {
        timeZone: masterProfile.timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });

    // Для упрощения берем текущий день недели (пока без учета перехода суток)
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 1-7
    const todaySchedule = masterSchedule.find((s: any) => s.day_of_week === dayOfWeek);

    const statusText = document.getElementById('hero-status')!;
    const statusDot = document.getElementById('status-dot')!;
    const statusTextDot = document.getElementById('status-text-dot')!;

    let isOpen = false;

    if (todaySchedule) {
        // Сравниваем строки времени: "14:30" >= "09:00" && "14:30" < "18:00"
        // Это надежно работает в формате 24h
        const start = todaySchedule.start_time.slice(0,5);
        const end = todaySchedule.end_time.slice(0,5);

        if (masterTimeStr >= start && masterTimeStr < end) {
            isOpen = true;
        }
    }

    if (isOpen) {
        statusText.textContent = `ОТКРЫТО • до ${todaySchedule.end_time.slice(0,5)}`;
        statusText.classList.add('text-success');
        statusText.classList.remove('text-secondary');

        statusDot.classList.replace('bg-gray-500', 'bg-success');
        statusTextDot.classList.replace('text-gray-500', 'text-success');
        statusTextDot.classList.add('animate-pulse');
    } else {
        statusText.textContent = 'ЗАКРЫТО';
        statusText.classList.remove('text-success');
        statusText.classList.add('text-secondary');

        statusDot.classList.replace('bg-success', 'bg-gray-500');
        statusTextDot.classList.replace('text-success', 'text-gray-500');
        statusTextDot.classList.remove('animate-pulse');
    }
}

function renderServices(services: any[]) {
    const container = document.getElementById('services-list')!;
    container.innerHTML = '';

    if (services.length === 0) {
        container.innerHTML = '<div class="text-center text-secondary py-4">Нет услуг</div>';
        return;
    }

    services.forEach(s => {
        const card = document.createElement('div');
        card.className = `relative w-full rounded-2xl transition-all duration-300 border-2 border-transparent bg-surface hover:bg-[#1c2a38] group cursor-pointer`;

        const content = document.createElement('div');
        content.className = 'w-full flex items-center gap-4 p-4 text-left';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 text-2xl font-bold text-white group-hover:bg-primary/20 group-hover:text-primary transition-colors';
        iconDiv.textContent = s.name.charAt(0).toUpperCase();

        const textDiv = document.createElement('div');
        textDiv.className = 'flex-1 overflow-hidden';
        textDiv.innerHTML = `
            <h4 class="text-white font-bold text-[15px] truncate mb-1 break-words whitespace-normal">${s.name}</h4>
            <div class="flex items-center gap-1.5 text-secondary text-xs font-medium">
                <span class="material-symbols-rounded text-[14px]">schedule</span>
                ${s.duration_min} мин
            </div>
        `;

        const endDiv = document.createElement('div');
        endDiv.className = 'flex flex-col items-end gap-1';
        endDiv.innerHTML = `
            <span class="text-primary font-bold text-base whitespace-nowrap">${s.price} ₸</span>
            <span class="material-symbols-rounded text-secondary/30 transition-transform duration-300 chevron">expand_more</span>
        `;

        content.appendChild(iconDiv);
        content.appendChild(textDiv);
        content.appendChild(endDiv);

        const descPanel = document.createElement('div');
        descPanel.className = 'overflow-hidden transition-all duration-300 ease-in-out px-4 max-h-0 opacity-0';
        if (s.description) {
            descPanel.innerHTML = `
                <div class="pt-2 pb-4 border-t border-white/5">
                    <p class="text-secondary text-sm leading-relaxed break-words whitespace-pre-wrap">${s.description}</p>
                </div>
            `;
        }

        const badge = document.createElement('div');
        badge.className = 'absolute -top-1.5 -right-1.5 bg-primary text-white rounded-full p-1 shadow-md z-10 hidden scale-0 transition-transform';
        badge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>';

        card.appendChild(content);
        card.appendChild(descPanel);
        card.appendChild(badge);

        card.onclick = () => {
            document.querySelectorAll('#services-list > div').forEach((el: any) => {
                if (el !== card) {
                    el.classList.remove('border-primary', 'bg-[#182430]', 'shadow-lg', 'scale-[1.02]');
                    el.classList.add('border-transparent');
                    el.querySelector('.chevron')?.classList.remove('rotate-180');
                    el.querySelector('.max-h-40')?.classList.remove('max-h-40', 'opacity-100');
                    el.querySelector('.opacity-100')?.classList.remove('max-h-40', 'opacity-100');
                    el.lastElementChild?.classList.add('hidden', 'scale-0');
                }
            });

            const isSelected = card.classList.contains('border-primary');

            if (!isSelected) {
                card.classList.remove('border-transparent');
                card.classList.add('border-primary', 'shadow-lg', 'scale-[1.02]');
                card.querySelector('.chevron')?.classList.add('rotate-180');
                if(s.description) {
                    descPanel.classList.remove('max-h-0', 'opacity-0');
                    descPanel.classList.add('max-h-40', 'opacity-100');
                }
                badge.classList.remove('hidden');
                setTimeout(() => badge.classList.remove('scale-0'), 50);

                currentService = s;
                Telegram.WebApp.MainButton.setText(`Выбрать: ${s.name}`);
                Telegram.WebApp.MainButton.show();
            }
        };

        container.appendChild(card);
    });
}

Telegram.WebApp.MainButton.onClick(() => {
    if (views.home.classList.contains('hidden') === false) {
        views.home.classList.add('hidden');
        views.booking.classList.remove('hidden');
        Telegram.WebApp.MainButton.hide();
        Telegram.WebApp.BackButton.show();
        Telegram.WebApp.BackButton.onClick((window as any).goBack);

        document.getElementById('selected-service-name')!.textContent = currentService.name;
        renderCalendar();
    } else {
        submitBooking();
    }
});

function renderCalendar() {
    const grid = document.getElementById('cal-grid')!;
    grid.innerHTML = '';

    const monthLabel = document.getElementById('cal-month')!;
    const monthName = calDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    monthLabel.textContent = monthName;

    const year = calDate.getFullYear();
    const month = calDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay() || 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

    const workingDays = masterSchedule.map((s: any) => s.day_of_week);

    for (let i = 1; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.textContent = d.toString();

        const current = new Date(year, month, d);
        const dayOfWeek = current.getDay() || 7;
        const dateStr = current.toLocaleDateString('en-CA');

        const isPast = dateStr < todayStr;
        const isWorkingDay = workingDays.includes(dayOfWeek);

        if (dateStr === todayStr) cell.classList.add('today');
        if (dateStr === selectedDateStr) cell.classList.add('selected');

        if (isPast || !isWorkingDay) {
            cell.classList.add('disabled');
        } else {
            cell.onclick = () => {
                document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                selectedDateStr = dateStr;
                selectedSlot = null;
                Telegram.WebApp.MainButton.hide();
                document.getElementById('booking-form')!.classList.add('hidden');
                loadSlots(dateStr);
            };
        }
        grid.appendChild(cell);
    }
}

document.getElementById('btn-prev-month')!.onclick = () => {
    calDate.setDate(1);
    calDate.setMonth(calDate.getMonth() - 1);
    renderCalendar();
};

document.getElementById('btn-next-month')!.onclick = () => {
    calDate.setDate(1);
    calDate.setMonth(calDate.getMonth() + 1);
    renderCalendar();
};

async function loadSlots(date: string) {
    const container = document.getElementById('slots-grid')!;
    const wrapper = document.getElementById('slots-container')!;

    wrapper.classList.remove('hidden');
    // Показываем спиннер во время загрузки
    container.innerHTML = `
        <div class="col-span-4 flex justify-center py-4">
            <span class="material-symbols-rounded animate-spin text-primary">progress_activity</span>
        </div>`;

    try {
        const slots = await apiFetch(`/masters/${masterId}/availability?date=${date}`);
        container.innerHTML = '';

        if (slots.length === 0) {
            container.innerHTML = '<div class="col-span-4 text-center text-secondary text-sm">Нет свободных мест</div>';
            return;
        }

        slots.forEach((iso: string) => {
            // ВАЖНО: Форматируем дату в таймзону МАСТЕРА для отображения на кнопке
            // iso содержит таймзону (напр +05:00), Date распарсит её корректно.
            // toLocaleTimeString покажет часы/минуты именно для этой таймзоны.
            const dateObj = new Date(iso);
            const timeStr = dateObj.toLocaleTimeString('ru-RU', {
                timeZone: masterProfile.timezone,
                hour: '2-digit',
                minute: '2-digit'
            });

            const btn = document.createElement('button');
            btn.className = 'slot-btn';
            btn.textContent = timeStr;
            btn.onclick = () => {
                document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedSlot = iso; // На бэкенд отправляем полный ISO

                const form = document.getElementById('booking-form')!;
                form.classList.remove('hidden');
                setTimeout(() => form.scrollIntoView({behavior: 'smooth'}), 100);

                Telegram.WebApp.MainButton.setText(`Записаться на ${timeStr}`);
                Telegram.WebApp.MainButton.show();
            };
            container.appendChild(btn);
        });

        // Подсказка для клиента
        if (!document.getElementById('tz-hint')) {
            const hint = document.createElement('p');
            hint.id = 'tz-hint';
            hint.className = 'col-span-4 text-center text-xs text-secondary/50 mt-2';
            hint.textContent = `Время салона (Местное)`;
            container.appendChild(hint);
        }

    } catch (e) {
        container.innerHTML = '<div class="col-span-4 text-center text-error text-sm">Ошибка загрузки слотов</div>';
    }
}

async function submitBooking() {
    const clientName = (document.getElementById('inp-client-name') as HTMLInputElement).value;
    const phone = (document.getElementById('inp-phone') as HTMLInputElement).value;
    const petName = (document.getElementById('inp-pet-name') as HTMLInputElement).value;
    const petBreed = (document.getElementById('inp-pet-breed') as HTMLInputElement).value;
    const comment = (document.getElementById('inp-comment') as HTMLTextAreaElement).value;

    if (!clientName || !phone || !petName) {
        Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        showToast("Заполните имя, телефон и кличку питомца");
        return;
    }

    Telegram.WebApp.MainButton.showProgress();

    try {
        await apiFetch('/appointments', {
            method: 'POST',
            body: JSON.stringify({
                master_tg_id: parseInt(masterId!),
                service_id: currentService.id,
                starts_at: selectedSlot,
                client_name: clientName,
                client_phone: phone,
                pet_name: petName,
                pet_breed: petBreed,
                comment: comment,
                idempotency_key: Date.now().toString()
            })
        });

        views.booking.classList.add('hidden');
        views.success.classList.remove('hidden');
        Telegram.WebApp.MainButton.hide();
        Telegram.WebApp.BackButton.hide();
        Telegram.WebApp.HapticFeedback.notificationOccurred('success');

    } catch (e: any) {
        Telegram.WebApp.MainButton.hideProgress();
        if (e.message && e.message.includes('409')) {
             showToast("Время уже занято. Выберите другое.");
             if(selectedDateStr) loadSlots(selectedDateStr);
        } else {
             showToast("Ошибка записи. Попробуйте еще раз.");
        }
    }
}

function showToast(msg: string) {
    const el = document.getElementById('toast')!;
    document.getElementById('toast-msg')!.textContent = msg;
    el.classList.remove('hidden');
    el.classList.remove('translate-y-[-100%]');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

init();