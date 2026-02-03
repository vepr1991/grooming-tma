import { $, setText } from '../../core/dom';
import { apiFetch } from '../../core/api';
import { showToast } from '../../ui/toast';
import { showConfirm } from '../../ui/modal';
import { getAppointmentSkeleton } from '../../ui/skeletons'; // NEW
import { ICONS } from '../../ui/icons';
import { Appointment } from '../../types';
import { Telegram } from '../../core/tg';

let appointmentsCache: Appointment[] = [];
let selectedDate = new Date();
let viewDate = new Date();
let activeTab: Appointment['status'] = 'pending';

const TABS = [
    { id: 'pending', label: 'Ожидает' },
    { id: 'confirmed', label: 'Подтвержденные' },
    { id: 'completed', label: 'Завершенные' },
    { id: 'cancelled', label: 'Отмененные' }
];

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export async function loadAppointments() {
    renderTabs();
    const list = $('appointments-list');

    // NEW: Скелетон
    if(list) list.innerHTML = getAppointmentSkeleton(3);

    try {
        appointmentsCache = await apiFetch<Appointment[]>('/me/appointments');
        renderCalendar();
        renderList();
    } catch {
        if(list) list.innerHTML = '<div class="text-center text-error">Ошибка сети</div>';
    }
}

// ... ОСТАЛЬНОЙ КОД ФУНКЦИЙ ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ ...
// (Чтобы сэкономить место, я не буду дублировать функции renderTabs, renderCalendar, renderList, createCard и updateStatus)
// (Они остаются такими же, как в предыдущем шаге "Refactor", просто не забудьте их оставить!)

function renderTabs() {
    const container = $('appointment-tabs');
    if (!container) return;
    container.innerHTML = '';
    TABS.forEach(tab => {
        const btn = document.createElement('button');
        const isActive = activeTab === tab.id;
        btn.className = `whitespace-nowrap pb-3 text-xs font-bold uppercase tracking-wider transition-all relative flex-shrink-0 ${isActive ? 'text-primary' : 'text-text-secondary hover:text-white'}`;
        btn.textContent = tab.label;
        if (isActive) btn.innerHTML += '<span class="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-full animate-in fade-in zoom-in duration-300"></span>';
        btn.onclick = () => { activeTab = tab.id as any; renderTabs(); renderList(); };
        container.appendChild(btn);
    });
}

function changeMonth(offset: number) {
    viewDate.setMonth(viewDate.getMonth() + offset);
    renderCalendar();
}

function renderCalendar() {
    const container = $('calendar-container');
    if (!container) return;

    const busyDates = new Set(appointmentsCache
        .filter(a => ['pending', 'confirmed'].includes(a.status))
        .map(a => a.starts_at.split('T')[0]));

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDay = new Date(year, month, 1).getDay() - 1;
    if (firstDay === -1) firstDay = 6;

    const todayStr = new Date().toDateString();
    const selectedStr = selectedDate.toDateString();

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

    for (let i = 0; i < firstDay; i++) {
        html += `<div class="h-9"></div>`;
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const currentDate = new Date(year, month, i);
        const currentStr = currentDate.toDateString();

        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const isoDate = `${y}-${m}-${d}`;

        const isSelected = currentStr === selectedStr;
        const isToday = currentStr === todayStr;
        const hasRecords = busyDates.has(isoDate);

        let classes = "h-9 flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all relative ";
        if (isSelected) classes += "bg-primary text-fixed-white shadow-md shadow-primary/20 scale-105";
        else if (isToday) classes += "text-primary border border-primary/30";
        else classes += "text-text-secondary hover:bg-surface-dark";

        const dotColor = isSelected ? 'bg-white' : 'bg-primary';
        const dot = hasRecords ? `<span class="w-1 h-1 rounded-full absolute bottom-1.5 ${dotColor}"></span>` : '';

        html += `<button class="day-btn ${classes}" data-day="${i}"><span>${i}</span>${dot}</button>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;

    const btnPrev = document.getElementById('cal-prev');
    const btnNext = document.getElementById('cal-next');
    if (btnPrev) btnPrev.onclick = () => changeMonth(-1);
    if (btnNext) btnNext.onclick = () => changeMonth(1);

    container.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const day = parseInt((e.currentTarget as HTMLElement).dataset.day!);
            selectedDate = new Date(year, month, day);
            renderCalendar();
            renderList();
        });
    });
}

function renderList() {
    const list = $('appointments-list');
    if (!list) return;
    list.innerHTML = '';

    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const filtered = appointmentsCache.filter(a => a.starts_at.startsWith(dateStr) && a.status === activeTab);

    setText('tab-label', TABS.find(t => t.id === activeTab)?.label || '');
    setText('tab-count', filtered.length.toString());

    if (filtered.length === 0) {
        list.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-center opacity-30 grayscale"><span class="material-symbols-outlined text-6xl text-text-secondary mb-4">event_note</span><p class="text-xs font-bold tracking-[0.3em] uppercase text-text-secondary">Нет записей</p></div>';
        return;
    }

    filtered.forEach(a => list.appendChild(createCard(a)));
}

function createCard(a: Appointment): HTMLElement {
    const el = document.createElement('div');
    const time = new Date(a.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const configs: any = {
        pending: { label: 'ОЖИДАЕТ', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-l-orange-500' },
        confirmed: { label: 'ПОДТВЕРЖДЕНО', color: 'text-primary', bg: 'bg-primary/10', border: 'border-l-primary' },
        completed: { label: 'ЗАВЕРШЕНО', color: 'text-success', bg: 'bg-success/10', border: 'border-l-success' },
        cancelled: { label: 'ОТМЕНЕНО', color: 'text-error', bg: 'bg-error/10', border: 'border-l-error' }
    };
    const c = configs[a.status];

    el.className = `relative bg-surface-dark rounded-2xl p-4 border border-border-dark flex flex-col gap-4 transition-all duration-300 border-l-4 ${c.border} animate-in fade-in slide-in-from-bottom-2`;

    el.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full ${a.status === 'pending' ? 'bg-orange-500 animate-pulse' : c.bg.replace('/10','')}"></span>
          <span class="text-white font-bold text-xs">${time}</span>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${c.bg} ${c.color}">${c.label}</span>
      </div>
      <div class="flex gap-4 items-start">
        <div class="w-20 h-20 rounded-2xl bg-background-dark flex-shrink-0 border border-border-dark shadow-inner flex items-center justify-center text-text-secondary/60">${ICONS.Pet}</div>
        <div class="flex-grow min-w-0 space-y-1">
            <div class="flex flex-col"><span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Кличка</span><h3 class="text-lg font-bold truncate text-white leading-tight">${a.pet_name}</h3></div>
            <div class="grid grid-cols-2 gap-2 mt-1">
                <div class="flex flex-col"><span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Услуга</span><p class="text-white text-[11px] font-medium truncate">${a.services?.name || '---'}</p></div>
                <div class="flex flex-col"><span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Порода</span><p class="text-white text-[11px] font-medium truncate">${a.pet_breed || '---'}</p></div>
            </div>
            <div class="pt-2 flex items-center gap-2">
                <span class="text-[11px] text-text-secondary truncate font-medium">${a.client_name}</span>
                <button class="btn-copy-phone text-primary text-[11px] font-bold hover:text-primary/80 flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer">${ICONS.Phone} ${a.client_phone}</button>
            </div>
        </div>
      </div>
      ${a.comment ? `<div class="bg-background-dark/50 rounded-xl p-3 border border-border-dark/50 mt-1 w-full overflow-hidden"><span class="text-[10px] text-primary font-bold uppercase tracking-wider block mb-1">Комментарий</span><p class="text-xs text-text-secondary leading-relaxed break-words whitespace-pre-wrap">${a.comment}</p></div>` : ''}
      <div class="flex flex-col gap-2 actions-area"></div>
    `;

    const copyBtn = el.querySelector('.btn-copy-phone') as HTMLElement;
    if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(a.client_phone).then(() => showToast('Скопировано'));
        });
    }

    const actions = el.querySelector('.actions-area')!;
    const btnBox = document.createElement('div');
    btnBox.className = 'flex gap-2';

    const createBtn = (text: string, cls: string, onClick: () => void) => {
        const b = document.createElement('button');
        b.className = `flex-1 py-2.5 rounded-xl font-bold text-xs active:scale-[0.98] transition-all shadow-lg ${cls}`;
        b.textContent = text;
        b.onclick = async (e) => {
            const t = e.target as HTMLButtonElement;
            t.disabled = true;
            t.innerHTML = '...';
            await onClick();
        };
        return b;
    };

    if (a.status === 'pending') {
        btnBox.appendChild(createBtn('Отменить', 'bg-background-dark text-text-secondary hover:text-error border border-border-dark', async () => updateStatus(a.id, 'cancel')));
        btnBox.appendChild(createBtn('Подтвердить', 'bg-primary text-fixed-white hover:brightness-110 shadow-primary/20 flex-[2]', async () => updateStatus(a.id, 'confirm')));
    } else if (a.status === 'confirmed') {
        btnBox.appendChild(createBtn('Отменить', 'bg-background-dark text-text-secondary hover:text-error border border-border-dark', async () => updateStatus(a.id, 'cancel')));
        btnBox.appendChild(createBtn('Завершить', 'bg-success text-fixed-white hover:brightness-110 shadow-success/20 flex-[2]', async () => updateStatus(a.id, 'complete')));
    }

    if (a.status === 'pending' || a.status === 'confirmed') actions.appendChild(btnBox);

    const msgBtn = document.createElement('button');
    msgBtn.className = 'w-full py-2.5 rounded-xl bg-background-dark text-text-secondary font-bold text-xs border border-border-dark flex items-center justify-center gap-2 hover:bg-surface-dark hover:text-white transition-all active:scale-[0.98]';
    const isTg = !!a.client_username;
    msgBtn.innerHTML = `<span class="${isTg ? 'text-[#29b6f6]' : 'text-success'}">${isTg ? ICONS.Telegram : ICONS.WhatsApp}</span> ${isTg ? 'Telegram' : 'WhatsApp'}`;
    msgBtn.onclick = () => {
        if (isTg) Telegram.WebApp.openTelegramLink(`https://t.me/${a.client_username}`);
        else Telegram.WebApp.openLink(`https://wa.me/${a.client_phone.replace(/\D/g, '')}`);
    };
    actions.appendChild(msgBtn);

    return el;
}

async function updateStatus(id: number, action: 'confirm' | 'cancel' | 'complete') {
    if (action !== 'confirm' && !(await showConfirm(action === 'cancel' ? 'Отменить запись?' : 'Завершить услугу?'))) {
        renderList();
        return;
    }
    try {
        await apiFetch(`/me/appointments/${id}/${action}`, { method: 'POST' });
        showToast(action === 'cancel' ? 'Отменено' : 'Успешно');
        loadAppointments();
    } catch { showToast('Ошибка', 'error'); renderList(); }
}