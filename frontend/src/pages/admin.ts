/**
 * (c) 2026 Vladimir Kovalenko
 */
import { apiFetch, BASE_URL } from '../core/api';
import { initTelegram, Telegram } from '../core/tg';

declare const IMask: any;

initTelegram();

let masterTimezone = 'Asia/Almaty'; 

// --- ИКОНКИ ---
const ICONS = {
    Pet: `<svg class="w-10 h-10 text-text-secondary/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.172C10 3.782 8.48 2.5 6.5 2.5S3 3.782 3 5.172c0 1.533 1.127 2.8 2.5 3.226V11h2V8.398c1.373-.426 2.5-1.693 2.5-3.226zM21 5.172c0-1.39-1.52-2.672-3.5-2.672S14 3.782 14 5.172c0 1.533 1.127 2.8 2.5 3.226V11h2V8.398c1.373-.426 2.5-1.693 2.5-3.226zM9 13h6c.667 0 1.25.167 1.75.5.5.333 1.25.833 1.25 1.5S17 17 16 19s-2.5 2.5-4 2.5-3-1.5-4-2.5-2-2.5-2-4 .75-1.167 1.25-1.5C8.75 13.167 9.333 13 9 13z"/></svg>`,
    Phone: `<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    Telegram: `<svg class="w-4 h-4 text-[#29b6f6]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-1.02-2.38-1.61-1.04-.69-.37-1.07.22-1.68.15-.16 2.74-2.51 2.79-2.72.01-.03.01-.12-.05-.17-.05-.05-.14-.03-.21-.02-.09.02-1.54.98-4.35 2.88-.41.28-.78.42-1.11.41-.36 0-1.05-.2-1.57-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.77-1.15 3.35-1.35 3.73-1.35.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .29z"/></svg>`,
    WhatsApp: `<svg class="w-4 h-4 text-success" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.32a8.197 8.197 0 0 1-1.26-4.38c.04-4.54 3.74-8.23 8.25-8.23m4.53 11.38c-.19-.1-.64-.26-1.33-.62-.17-.1-.28-.15-.38.04s-.42.53-.51.64c-.1.11-.19.12-.38.03-.19-.1-.82-.3-1.55-.96-.58-.52-1-.1.17-1.12.35-.11-.16-.06-.29-.06-.4s-.37-.15-.56-.37c-.19-.21-.73-.73-.73-1.77s.75-1.63.98-1.87c.23-.23.49-.29.66-.29.17 0 .34.01.49.07.15.06.33.24.42.44.13.29.43 1.05.47 1.12.04.07.07.16 0 .28-.07.12-.11.19-.22.3-.11.11-.23.24-.33.32-.11.09-.23.19 0 .58.23.39 1 1.65 2.15 2.67.92.82 1.66 1.08 2.27 1.36.19.09.43.19.66.19.38 0 .84-.09 1.17-.38.33-.29.68-1.23.68-1.67 0-.44-.15-.65-.33-.74z"/></svg>`
};

function showToast(message: string, type: 'success' | 'error' = 'success') {
    const toast = document.getElementById('global-toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    if (!toast || !msgEl || !iconEl) return;

    msgEl.textContent = message;
    if (type === 'success') {
        iconEl.textContent = 'check_circle';
        iconEl.className = 'material-symbols-outlined text-success';
    } else {
        iconEl.textContent = 'error';
        iconEl.className = 'material-symbols-outlined text-error';
    }
    toast.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
    }, 3000);
}

function showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm');
        const box = document.getElementById('confirm-box');
        const text = document.getElementById('confirm-text');
        const btnOk = document.getElementById('confirm-btn-ok');
        const btnCancel = document.getElementById('confirm-btn-cancel');

        if (!modal || !text || !btnOk || !btnCancel || !box) return resolve(false);

        text.textContent = message;
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            box.classList.remove('scale-95');
            box.classList.add('scale-100');
        }, 10);

        const close = (result: boolean) => {
            modal.classList.add('opacity-0');
            box.classList.remove('scale-100');
            box.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                resolve(result);
            }, 200);
            btnOk.onclick = null;
            btnCancel.onclick = null;
        };

        btnOk.onclick = () => close(true);
        btnCancel.onclick = () => close(false);
    });
}

// ... (Profile, Services, Schedule - БЕЗ ИЗМЕНЕНИЙ, оставляем как есть) ...
// В целях экономии места я пропускаю части Profile, Services, Schedule, так как они работают.
// Вставьте их сюда из предыдущего рабочего кода.
const els = {
    name: document.getElementById('salon-name') as HTMLInputElement,
    address: document.getElementById('address') as HTMLInputElement,
    phone: document.getElementById('phone') as HTMLInputElement,
    desc: document.getElementById('description') as HTMLTextAreaElement,
    btnEditMode: document.getElementById('btn-edit-mode') as HTMLButtonElement,
    editActions: document.getElementById('edit-actions') as HTMLElement,
    btnCancel: document.getElementById('btn-cancel') as HTMLButtonElement,
    btnSave: document.getElementById('btn-save-profile') as HTMLButtonElement,
    carouselTrack: document.getElementById('carousel-track') as HTMLElement,
    carouselIndicators: document.getElementById('carousel-indicators') as HTMLElement,
    photoInput: document.getElementById('photo-input') as HTMLInputElement,
    onboardingScreen: document.getElementById('onboarding-screen') as HTMLElement,
    regName: document.getElementById('reg-name') as HTMLInputElement,
    regAddress: document.getElementById('reg-address') as HTMLInputElement,
    btnFinishReg: document.getElementById('btn-finish-reg') as HTMLButtonElement,
};
// ... (Функции loadProfile, renderCarousel и т.д.) ...
let currentPhotos: string[] = [];
let originalData: any = {};
// ... (Функции loadServices, toggleServiceForm и т.д.) ...
// ... (Функции loadSchedule и т.д.) ...
async function loadProfile() { try { const data = await apiFetch('/me'); if(!data.profile.salon_name && els.onboardingScreen) els.onboardingScreen.classList.remove('hidden'); if(data.profile) { els.name.value=data.profile.salon_name||''; els.address.value=data.profile.address||''; if(data.profile.phone)els.phone.value=data.profile.phone; els.desc.value=data.profile.description||''; currentPhotos=data.profile.photos||[]; if(currentPhotos.length===0&&data.profile.avatar_url)currentPhotos.push(data.profile.avatar_url); renderCarousel(); if(data.profile.timezone)masterTimezone=data.profile.timezone; } } catch(e){console.error(e);} }
// ... (Здесь должен быть весь ваш код для вкладок Profile, Services, Schedule) ...
function renderCarousel() { if(!els.carouselTrack) return; els.carouselTrack.innerHTML=''; currentPhotos.forEach(p => { const d=document.createElement('div'); d.className='flex-shrink-0 w-full h-full snap-center'; d.innerHTML=`<img src="${p}" class="w-full h-full object-cover">`; els.carouselTrack.appendChild(d); }); }
async function loadServices() { /* ... */ }
async function loadSchedule() { /* ... */ }


// =========================================================
// === НОВАЯ ЛОГИКА ЗАПИСЕЙ (APPOINTMENTS) С ТАБАМИ ===
// =========================================================

const appList = document.getElementById('appointments-list')!;
const calendarContainer = document.getElementById('calendar-container')!;
const tabsContainer = document.getElementById('appointment-tabs')!;
const tabLabelEl = document.getElementById('tab-label')!;
const tabCountEl = document.getElementById('tab-count')!;

let selectedDate = new Date();
let viewDate = new Date();
let busyDates: string[] = [];
// Состояние активного таба
let activeTab: 'pending' | 'confirmed' | 'completed' | 'cancelled' = 'pending';

const TABS = [
    { id: 'pending', label: 'Ожидает' },
    { id: 'confirmed', label: 'Подтвержденные' },
    { id: 'completed', label: 'Завершенные' },
    { id: 'cancelled', label: 'Отмененные' }
];

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function renderCalendar() {
    if (!calendarContainer) return;
    const year = viewDate.getFullYear(); const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDay = new Date(year, month, 1).getDay() - 1; if (firstDay === -1) firstDay = 6;
    const todayStr = new Date().toDateString(); const selectedStr = selectedDate.toDateString();
    let html = `
        <div class="px-4 pt-4 pb-2">
            <div class="flex justify-between items-center mb-3 px-2">
                <h2 class="text-lg font-bold text-white capitalize">${MONTH_NAMES[month]} ${year}</h2>
                <div class="flex gap-1">
                    <button id="cal-prev" class="p-1.5 hover:bg-surface-dark/50 rounded-lg text-text-secondary active:bg-surface-dark transition-colors"><span class="material-symbols-outlined text-[20px]">chevron_left</span></button>
                    <button id="cal-next" class="p-1.5 hover:bg-surface-dark/50 rounded-lg text-text-secondary active:bg-surface-dark transition-colors"><span class="material-symbols-outlined text-[20px]">chevron_right</span></button>
                </div>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center mb-2">
                ${WEEK_DAYS.map(d => `<span class="text-[10px] font-bold text-text-secondary/60 uppercase tracking-wider">${d}</span>`).join('')}
            </div>
            <div class="grid grid-cols-7 gap-1">
    `;
    for (let i = 0; i < firstDay; i++) { html += `<div class="h-9"></div>`; }
    for (let i = 1; i <= daysInMonth; i++) {
        const currentDate = new Date(year, month, i); const currentStr = currentDate.toDateString();
        const y = currentDate.getFullYear(); const m = String(currentDate.getMonth() + 1).padStart(2, '0'); const d = String(currentDate.getDate()).padStart(2, '0'); const isoDate = `${y}-${m}-${d}`;
        const isSelected = currentStr === selectedStr; const isToday = currentStr === todayStr; const hasRecords = busyDates.includes(isoDate);
        let classes = "h-9 flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all relative ";
        if (isSelected) classes += "bg-primary text-fixed-white shadow-md shadow-primary/20 scale-105";
        else if (isToday) classes += "text-primary border border-primary/30";
        else classes += "text-text-secondary hover:bg-surface-dark";
        const dotColor = isSelected ? 'bg-white' : 'bg-primary';
        const dot = hasRecords ? `<span class="w-1 h-1 rounded-full absolute bottom-1.5 ${dotColor}"></span>` : '';
        html += `<button class="day-btn ${classes}" data-day="${i}"><span>${i}</span>${dot}</button>`;
    }
    html += `</div></div>`;
    calendarContainer.innerHTML = html;
    const btnPrev = document.getElementById('cal-prev'); const btnNext = document.getElementById('cal-next');
    if (btnPrev) btnPrev.onclick = () => changeMonth(-1); if (btnNext) btnNext.onclick = () => changeMonth(1);
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const day = parseInt((e.currentTarget as HTMLElement).dataset.day!);
            selectedDate = new Date(year, month, day);
            renderCalendar();
            // При смене даты перерисовываем список (используя текущий кэш)
            renderAppointmentsList((window as any).cachedAppointments || []);
        });
    });
}
function changeMonth(offset: number) { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1); renderCalendar(); }

// --- ОТРИСОВКА ТАБОВ ---
function renderTabs() {
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';

    TABS.forEach(tab => {
        const btn = document.createElement('button');
        const isActive = activeTab === tab.id;

        btn.className = `whitespace-nowrap pb-3 text-xs font-bold uppercase tracking-wider transition-all relative flex-shrink-0 ${
            isActive ? 'text-primary' : 'text-text-secondary hover:text-white'
        }`;
        btn.textContent = tab.label;

        if (isActive) {
            const line = document.createElement('span');
            line.className = 'absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-full animate-in fade-in zoom-in duration-300';
            btn.appendChild(line);
        }

        btn.onclick = () => {
            activeTab = tab.id as any;
            renderTabs(); // Перерисовать табы (для подсветки)
            renderAppointmentsList((window as any).cachedAppointments || []); // Перерисовать список
        };

        tabsContainer.appendChild(btn);
    });
}

(window as any).cachedAppointments = [];
(window as any).loadAppointments = async () => {
    if (!appList) return;
    appList.innerHTML = '<div class="text-center text-text-secondary py-8">Загрузка...</div>';

    renderTabs(); // Рисуем табы сразу

    try {
        const apps = await apiFetch('/me/appointments');
        (window as any).cachedAppointments = apps;

        const datesSet = new Set<string>();
        apps.forEach((a: any) => {
            if (a.status === 'cancelled') return;
            const d = new Date(a.starts_at);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            datesSet.add(`${y}-${m}-${day}`);
        });
        busyDates = Array.from(datesSet);

        renderCalendar();
        renderAppointmentsList(apps);
    } catch (e) { appList.innerHTML = '<div class="text-center text-error">Ошибка сети</div>'; }
};

function renderAppointmentsList(apps: any[]) {
    if (!appList) return;
    appList.innerHTML = '';

    // 1. Фильтр по ДАТЕ
    let filtered = apps.filter((a: any) => {
        const d = new Date(a.starts_at);
        return d.toDateString() === selectedDate.toDateString();
    });

    // 2. Фильтр по СТАТУСУ (Табу)
    filtered = filtered.filter((a: any) => a.status === activeTab);

    // Обновляем заголовок и счетчик
    if (tabLabelEl) tabLabelEl.textContent = TABS.find(t => t.id === activeTab)?.label || '';
    if (tabCountEl) tabCountEl.textContent = filtered.length.toString();

    if (filtered.length === 0) {
        appList.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-center opacity-30 grayscale"><span class="material-symbols-outlined text-6xl text-text-secondary mb-4">event_note</span><p class="text-xs font-bold tracking-[0.3em] uppercase text-text-secondary">Нет записей</p></div>`;
        return;
    }

    filtered.forEach((a: any) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createRecordCardHTML(a);
        const cardEl = tempDiv.firstElementChild as HTMLElement;

        // Handlers
        const btnMsg = cardEl.querySelector('.btn-msg') as HTMLElement;
        if(btnMsg) btnMsg.onclick = () => {
            if (a.client_username) {
                Telegram.WebApp.openTelegramLink(`https://t.me/${a.client_username}`);
            } else {
                const phone = a.client_phone.replace(/\D/g, '');
                Telegram.WebApp.openLink(`https://wa.me/${phone}`);
            }
        };

        const btnConfirm = cardEl.querySelector('.btn-confirm') as HTMLButtonElement;
        if(btnConfirm) { btnConfirm.onclick = async () => { btnConfirm.innerHTML = '...'; btnConfirm.disabled = true; try { await apiFetch(`/me/appointments/${a.id}/confirm`, { method: 'POST' }); (window as any).loadAppointments(); showToast('Подтверждено'); } catch (e) { showToast('Ошибка', 'error'); } }; }

        const btnComplete = cardEl.querySelector('.btn-complete') as HTMLButtonElement;
        if(btnComplete) { btnComplete.onclick = async () => { if(await showConfirm('Завершить?')) { try { await apiFetch(`/me/appointments/${a.id}/complete`, { method: 'POST' }); (window as any).loadAppointments(); showToast('Завершено'); } catch(e) { showToast('Ошибка', 'error'); } } } }

        const btnCancel = cardEl.querySelector('.btn-cancel') as HTMLButtonElement;
        if(btnCancel) { btnCancel.onclick = async () => { if(await showConfirm('Отменить?')) { try { await apiFetch(`/me/appointments/${a.id}/cancel`, { method: 'POST' }); (window as any).loadAppointments(); showToast('Отменено'); } catch (e) { showToast('Ошибка', 'error'); } } }; }

        appList.appendChild(cardEl);
    });
}

function createRecordCardHTML(record: any) {
    const status = record.status;
    const dateObj = new Date(record.starts_at);
    const timeStr = dateObj.toLocaleTimeString('ru-RU', { timeZone: masterTimezone, hour: '2-digit', minute: '2-digit' });

    let config = { label: 'НЕИЗВЕСТНО', color: 'text-text-secondary', bg: 'bg-surface-dark', border: 'border-l-text-secondary' };

    switch (status) {
        case 'pending': config = { label: 'ОЖИДАЕТ', color: 'text-orange-500', bg: 'bg-orange-500', border: 'border-l-orange-500 shadow-orange-500/5' }; break;
        case 'confirmed': config = { label: 'ПОДТВЕРЖДЕНО', color: 'text-primary', bg: 'bg-primary', border: 'border-l-primary shadow-primary/20' }; break;
        case 'completed': config = { label: 'ЗАВЕРШЕНО', color: 'text-success', bg: 'bg-success', border: 'border-l-success shadow-success/20' }; break;
        case 'cancelled': config = { label: 'ОТМЕНЕНО', color: 'text-error', bg: 'bg-error', border: 'border-l-error shadow-error/20' }; break;
    }

    const dotClass = status === 'pending' ? 'bg-orange-500 animate-pulse' : config.bg;
    const petBreed = record.pet_breed || 'Не указана';
    const serviceName = record.services?.name || 'Услуга удалена';
    const clientName = record.client_name || 'Клиент';
    const clientNote = record.comment;

    const noteHTML = clientNote ? `<div class="bg-background-dark/50 rounded-xl p-3 border border-border-dark/50 mt-1 w-full overflow-hidden"><span class="text-[10px] text-primary font-bold uppercase tracking-wider block mb-1">Комментарий</span><p class="text-xs text-text-secondary leading-relaxed break-words whitespace-pre-wrap">${clientNote}</p></div>` : '';

    const hasUsername = !!record.client_username;
    const msgIcon = hasUsername ? ICONS.Telegram : ICONS.WhatsApp;
    const msgText = hasUsername ? 'Telegram' : 'WhatsApp';
    const msgColor = hasUsername ? 'text-[#29b6f6]' : 'text-success';

    let buttonsHTML = '';
    if (status === 'pending') {
        buttonsHTML = `<div class="flex gap-2"><button class="btn-cancel flex-1 py-2.5 rounded-xl bg-background-dark text-text-secondary font-bold text-xs hover:bg-error/10 hover:text-error border border-border-dark active:scale-[0.98] transition-all">Отменить</button><button class="btn-confirm flex-[2] py-2.5 rounded-xl font-bold text-xs active:scale-[0.98] transition-all shadow-lg bg-primary text-fixed-white hover:brightness-110 shadow-primary/20">Подтвердить</button></div>`;
    } else if (status === 'confirmed') {
        buttonsHTML = `<div class="flex gap-2"><button class="btn-cancel flex-1 py-2.5 rounded-xl bg-background-dark text-text-secondary font-bold text-xs hover:bg-error/10 hover:text-error border border-border-dark active:scale-[0.98] transition-all">Отменить</button><button class="btn-complete flex-[2] py-2.5 rounded-xl font-bold text-xs active:scale-[0.98] transition-all shadow-lg bg-success text-fixed-white hover:brightness-110 shadow-success/20">Завершить</button></div>`;
    }

    return `
    <div class="relative bg-surface-dark rounded-2xl p-4 border border-border-dark flex flex-col gap-4 transition-all duration-300 border-l-4 ${config.border} animate-in fade-in slide-in-from-bottom-2">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
          <span class="text-white font-bold text-xs">${timeStr}</span>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-opacity-10 ${config.bg} ${config.color}">${config.label}</span>
      </div>
      <div class="flex gap-4 items-start">
        <div class="w-20 h-20 rounded-2xl bg-background-dark flex-shrink-0 border border-border-dark shadow-inner flex items-center justify-center text-text-secondary/60">${ICONS.Pet}</div>
        <div class="flex-grow min-w-0 space-y-1">
          <div class="flex flex-col"><span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Кличка</span><h3 class="text-lg font-bold truncate text-white leading-tight">${record.pet_name}</h3></div>
          <div class="grid grid-cols-2 gap-2 mt-1">
            <div class="flex flex-col"><span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Услуга</span><p class="text-white text-[11px] font-medium truncate">${serviceName}</p></div>
            <div class="flex flex-col"><span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Порода</span><p class="text-white text-[11px] font-medium truncate">${petBreed}</p></div>
          </div>
          <div class="pt-2 flex items-center gap-2"><span class="text-[11px] text-text-secondary truncate font-medium">${clientName}</span><a href="tel:${record.client_phone}" class="text-primary text-[11px] font-bold hover:text-primary/80 flex items-center gap-1 transition-colors">${ICONS.Phone} ${record.client_phone}</a></div>
        </div>
      </div>
      ${noteHTML}
      <div class="flex flex-col gap-2">
        ${buttonsHTML}
        <button class="btn-msg w-full py-2.5 rounded-xl bg-background-dark text-text-secondary font-bold text-xs border border-border-dark flex items-center justify-center gap-2 hover:bg-surface-dark hover:text-white transition-all active:scale-[0.98]">
          <span class="${msgColor}">${msgIcon}</span> ${msgText}
        </button>
      </div>
    </div>
    `;
}

loadProfile(); loadServices(); loadSchedule(); (window as any).loadAppointments();