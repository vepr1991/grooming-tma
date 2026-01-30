import { apiFetch, BASE_URL } from '../core/api';
import { initTelegram, Telegram } from '../core/tg';

initTelegram();

// =============================================================================
// 1. PROFILE LOGIC
// =============================================================================

const els = {
    name: document.getElementById('salon-name') as HTMLInputElement,
    address: document.getElementById('address') as HTMLInputElement,
    phone: document.getElementById('phone') as HTMLInputElement,
    desc: document.getElementById('description') as HTMLTextAreaElement,

    // Buttons & Modes
    btnEditMode: document.getElementById('btn-edit-mode') as HTMLButtonElement,
    editActions: document.getElementById('edit-actions') as HTMLElement,
    btnCancel: document.getElementById('btn-cancel') as HTMLButtonElement,
    btnSave: document.getElementById('btn-save-profile') as HTMLButtonElement,

    // Avatar
    avatarInput: document.getElementById('avatar-input') as HTMLInputElement,
    avatarImg: document.getElementById('avatar-img') as HTMLImageElement,
    avatarPlaceholder: document.getElementById('avatar-placeholder') as HTMLElement,
    avatarContainer: document.getElementById('avatar-container') as HTMLElement,
    avatarHint: document.getElementById('avatar-hint') as HTMLElement,
    avatarOverlay: document.getElementById('avatar-overlay') as HTMLElement,

    // Toast
    successToast: document.getElementById('profile-success-toast') as HTMLElement,
};

let currentAvatarUrl: string | null = null;
let originalData = { name: '', address: '', phone: '', desc: '', avatarUrl: null as string | null };

function toggleEditMode(enable: boolean) {
    const inputs = [els.name, els.address, els.phone, els.desc];
    if (enable) {
        // Save state for cancel
        originalData = {
            name: els.name.value,
            address: els.address.value,
            phone: els.phone.value,
            desc: els.desc.value,
            avatarUrl: currentAvatarUrl
        };

        // Enable inputs
        inputs.forEach(inp => inp.removeAttribute('readonly'));
        els.name.focus();

        // Switch buttons
        els.btnEditMode.classList.add('hidden');
        els.editActions.classList.remove('hidden');
        els.editActions.classList.add('flex');

        // Enable avatar
        els.avatarContainer.classList.remove('pointer-events-none');
        els.avatarHint.classList.remove('opacity-0');
        els.avatarOverlay.classList.remove('hidden');
    } else {
        // Disable inputs
        inputs.forEach(inp => inp.setAttribute('readonly', 'true'));

        // Switch buttons
        els.editActions.classList.add('hidden');
        els.editActions.classList.remove('flex');
        els.btnEditMode.classList.remove('hidden');

        // Disable avatar
        els.avatarContainer.classList.add('pointer-events-none');
        els.avatarHint.classList.add('opacity-0');
        els.avatarOverlay.classList.add('hidden');
    }
}

// Event Listeners for Profile
if(els.btnEditMode) els.btnEditMode.onclick = () => toggleEditMode(true);

if(els.btnCancel) els.btnCancel.onclick = () => {
    els.name.value = originalData.name;
    els.address.value = originalData.address;
    els.phone.value = originalData.phone;
    els.desc.value = originalData.desc;
    if (originalData.avatarUrl) setAvatar(originalData.avatarUrl);
    toggleEditMode(false);
};

if(els.btnSave) els.btnSave.onclick = async () => {
    els.btnSave.disabled = true;
    const originalText = els.btnSave.innerHTML;
    els.btnSave.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>';
    try {
        await apiFetch('/me/profile', {
            method: 'PATCH',
            body: JSON.stringify({
                salon_name: els.name.value,
                address: els.address.value,
                phone: els.phone.value,
                description: els.desc.value,
                avatar_url: currentAvatarUrl
            })
        });
        showSuccessToast();
        toggleEditMode(false);
    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка сохранения');
    } finally {
        els.btnSave.innerHTML = originalText;
        els.btnSave.disabled = false;
    }
};

if(els.avatarInput) els.avatarInput.onchange = async () => {
    const file = els.avatarInput.files?.[0];
    if (!file) return;
    els.avatarImg.style.opacity = '0.5';
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch(`${BASE_URL}/uploads/avatar`, {
            method: 'POST',
            headers: { 'X-Tg-Init-Data': Telegram.WebApp.initData },
            body: formData
        });
        if (!response.ok) throw new Error();
        const res = await response.json();
        if (res.avatar_url) setAvatar(res.avatar_url);
    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка загрузки фото');
    } finally {
        els.avatarImg.style.opacity = '1';
    }
};

function setAvatar(url: string) {
    currentAvatarUrl = url;
    els.avatarImg.src = url;
    els.avatarImg.classList.remove('hidden');
    els.avatarPlaceholder.classList.add('hidden');
}

function showSuccessToast() {
    if (els.successToast) {
        els.successToast.classList.remove('hidden');
        setTimeout(() => els.successToast.classList.add('hidden'), 3000);
    } else {
        Telegram.WebApp.showAlert('Сохранено!');
    }
}

async function loadProfile() {
    try {
        const data = await apiFetch('/me');
        if (data.profile) {
            els.name.value = data.profile.salon_name || '';
            els.address.value = data.profile.address || '';
            els.phone.value = data.profile.phone || '';
            els.desc.value = data.profile.description || '';
            if (data.profile.avatar_url) setAvatar(data.profile.avatar_url);
        }
    } catch (e) { console.error(e); }
}


// =============================================================================
// 2. SERVICES LOGIC
// =============================================================================

const srvList = document.getElementById('services-list')!;
const addServiceForm = document.getElementById('add-service-form') as HTMLElement;
const btnToggleAdd = document.getElementById('btn-toggle-add-service') as HTMLButtonElement;
const btnCancelAdd = document.getElementById('btn-cancel-service') as HTMLButtonElement;
const btnSaveService = document.getElementById('btn-save-service') as HTMLButtonElement;

// Inputs
const inpName = document.getElementById('new-srv-name') as HTMLInputElement;
const inpDesc = document.getElementById('new-srv-desc') as HTMLTextAreaElement; // <--- Description Input
const inpPrice = document.getElementById('new-srv-price') as HTMLInputElement;
const inpDur = document.getElementById('new-srv-dur') as HTMLInputElement;

function toggleServiceForm(show: boolean) {
    if (show) {
        addServiceForm.classList.remove('hidden');
        addServiceForm.classList.add('flex');
        btnToggleAdd.classList.add('hidden');
        inpName.focus();
    } else {
        addServiceForm.classList.add('hidden');
        addServiceForm.classList.remove('flex');
        btnToggleAdd.classList.remove('hidden');
        // Clear inputs
        inpName.value = '';
        inpDesc.value = ''; // Clear description
        inpPrice.value = '';
        inpDur.value = '60';
    }
}
if(btnToggleAdd) btnToggleAdd.onclick = () => toggleServiceForm(true);
if(btnCancelAdd) btnCancelAdd.onclick = () => toggleServiceForm(false);

async function loadServices() {
    try {
        const services = await apiFetch('/me/services');
        srvList.innerHTML = '';

        if (services.length === 0) {
            srvList.innerHTML = '<div class="text-center text-text-secondary p-4 opacity-50">Список услуг пуст</div>';
            return;
        }

        services.forEach((s: any) => {
            const card = document.createElement('div');
            // w-full и mb-3
            card.className = 'w-full bg-surface-dark/40 border border-border-dark/50 rounded-xl overflow-hidden transition-all mb-3';

            // --- HEADER ---
            const header = document.createElement('div');
            header.className = 'p-4 flex justify-between items-center transition-colors min-h-[72px] relative';

            // Left Side
            const infoDiv = document.createElement('div');
            infoDiv.className = 'flex flex-col gap-1 pr-10 overflow-hidden';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'text-white font-bold text-base leading-tight truncate';
            nameSpan.textContent = s.name;

            const detailsSpan = document.createElement('span');
            detailsSpan.className = 'text-primary text-sm font-bold';
            detailsSpan.textContent = `${s.price} ₸ • ${s.duration_min} мин`;

            infoDiv.appendChild(nameSpan);
            infoDiv.appendChild(detailsSpan);

            // Right Side (Actions)
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2';

            const delBtn = document.createElement('button');
            delBtn.className = 'text-text-secondary/40 hover:text-red-400 p-2 rounded-full hover:bg-white/10 transition-colors z-20';
            delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteService(s.id);
            };
            actionsDiv.appendChild(delBtn);

            // Expand Arrow
            let chevron: HTMLElement | null = null;
            const hasDescription = s.description && s.description.trim() !== '';

            if (hasDescription) {
                const arrowBtn = document.createElement('div');
                arrowBtn.className = 'p-1 text-text-secondary/50';
                chevron = document.createElement('span');
                chevron.className = 'material-symbols-outlined transition-transform duration-200 block';
                chevron.textContent = 'expand_more';
                arrowBtn.appendChild(chevron);
                actionsDiv.appendChild(arrowBtn);

                header.classList.add('cursor-pointer', 'hover:bg-white/5');
            }

            header.appendChild(infoDiv);
            header.appendChild(actionsDiv);
            card.appendChild(header);

            // --- BODY (Description) ---
            if (hasDescription) {
                const body = document.createElement('div');
                body.className = 'hidden px-4 pb-4 pt-3 text-sm text-text-secondary/80 border-t border-border-dark/30 bg-white/5 break-words whitespace-normal w-full leading-relaxed';
                body.textContent = s.description;
                card.appendChild(body);

                header.onclick = () => {
                    const isHidden = body.classList.contains('hidden');
                    if (isHidden) {
                        body.classList.remove('hidden');
                        body.animate([{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' });
                        if (chevron) chevron.style.transform = 'rotate(180deg)';
                    } else {
                        body.classList.add('hidden');
                        if (chevron) chevron.style.transform = 'rotate(0deg)';
                    }
                };
            }

            srvList.appendChild(card);
        });
    } catch (e) {
        srvList.innerHTML = '<div class="text-center text-text-secondary p-4">Ошибка загрузки услуг</div>';
    }
}

if(btnSaveService) btnSaveService.onclick = async () => {
    if (!inpName.value || !inpPrice.value) {
        Telegram.WebApp.showAlert('Введите название и цену');
        return;
    }

    btnSaveService.disabled = true;
    const originalText = btnSaveService.textContent;
    btnSaveService.textContent = '...';

    try {
        await apiFetch('/me/services', {
            method: 'POST',
            body: JSON.stringify({
                name: inpName.value,
                description: inpDesc.value, // <--- Send Description
                price: parseFloat(inpPrice.value),
                duration_min: parseInt(inpDur.value) || 60
            })
        });
        await loadServices();
        toggleServiceForm(false);
    } catch(e) {
        Telegram.WebApp.showAlert('Ошибка сохранения');
    } finally {
        btnSaveService.disabled = false;
        btnSaveService.textContent = originalText;
    }
};

async function deleteService(id: number) {
    if(!confirm('Удалить эту услугу?')) return;
    try {
        await apiFetch(`/me/services/${id}`, { method: 'DELETE' });
        loadServices();
    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка удаления');
    }
}


// =============================================================================
// 3. SCHEDULE LOGIC
// =============================================================================

const scheduleContainer = document.getElementById('schedule-container')!;
const btnSaveSchedule = document.getElementById('btn-save-schedule') as HTMLButtonElement;
const daysMap = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

async function loadSchedule() {
    scheduleContainer.innerHTML = '';
    try {
        const existing = await apiFetch('/me/working-hours');
        renderScheduleForm(existing);
    } catch (e) { console.error(e); }
}

function renderScheduleForm(existingData: any[]) {
    scheduleContainer.innerHTML = '';
    for (let i = 1; i <= 7; i++) {
        const dayData = existingData.find((d: any) => d.day_of_week === i);
        const isActive = !!dayData;
        const row = document.createElement('div');
        row.className = `group flex items-center gap-3 bg-background-dark px-4 py-4 min-h-[64px] hover:bg-surface-dark transition-colors border-b border-border-dark/30 last:border-0 ${!isActive ? 'opacity-50' : ''}`;

        // Left Checkbox & Label
        const leftSide = document.createElement('div');
        leftSide.className = 'flex items-center gap-3 flex-1 min-w-0';

        const checkWrap = document.createElement('div');
        checkWrap.className = 'flex size-6 items-center justify-center shrink-0';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'h-5 w-5 rounded border-border-dark border-2 bg-transparent text-primary checked:bg-primary focus:ring-0 cursor-pointer transition-all';
        checkbox.dataset.day = i.toString();
        checkbox.checked = isActive;
        checkWrap.appendChild(checkbox);

        const label = document.createElement('p');
        label.className = `text-white text-base font-medium truncate transition-all ${!isActive ? 'line-through decoration-text-secondary text-text-secondary' : ''}`;
        label.textContent = daysMap[i - 1];

        leftSide.appendChild(checkWrap);
        leftSide.appendChild(label);

        // Time Inputs
        const settingsDiv = document.createElement('div');
        settingsDiv.className = `flex items-center gap-2 shrink-0 transition-all ${!isActive ? 'pointer-events-none grayscale opacity-50' : ''}`;

        const createTimeInput = (val: string, cls: string) => {
            const inp = document.createElement('input');
            inp.type = 'time';
            inp.className = `${cls} bg-[#182635] border border-border-dark/50 text-white text-sm font-semibold px-2 py-1.5 rounded-lg w-[76px] text-center focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all`;
            inp.value = val;
            return inp;
        };
        const timeStart = createTimeInput(dayData?.start_time?.slice(0, 5) || '09:00', 'time-start');
        const sep = document.createElement('span');
        sep.className = 'text-text-secondary font-medium';
        sep.textContent = '-';
        const timeEnd = createTimeInput(dayData?.end_time?.slice(0, 5) || '18:00', 'time-end');

        settingsDiv.appendChild(timeStart);
        settingsDiv.appendChild(sep);
        settingsDiv.appendChild(timeEnd);

        checkbox.onchange = () => {
            if (checkbox.checked) {
                row.classList.remove('opacity-50');
                settingsDiv.classList.remove('pointer-events-none', 'grayscale', 'opacity-50');
                label.classList.remove('line-through', 'decoration-text-secondary', 'text-text-secondary');
            } else {
                row.classList.add('opacity-50');
                settingsDiv.classList.add('pointer-events-none', 'grayscale', 'opacity-50');
                label.classList.add('line-through', 'decoration-text-secondary', 'text-text-secondary');
            }
        };
        row.appendChild(leftSide);
        row.appendChild(settingsDiv);
        scheduleContainer.appendChild(row);
    }
}

if(btnSaveSchedule) btnSaveSchedule.onclick = async () => {
    btnSaveSchedule.disabled = true;
    const originalContent = btnSaveSchedule.innerHTML;
    btnSaveSchedule.textContent = '';
    const spinner = document.createElement('span');
    spinner.className = 'material-symbols-outlined animate-spin text-[20px]';
    spinner.textContent = 'progress_activity';
    btnSaveSchedule.appendChild(spinner);

    const payload: any[] = [];
    const slotMin = 30; // Hardcoded slot duration (30 min)
    const checkboxes = document.querySelectorAll('#schedule-container input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((cb) => {
        if (cb.checked) {
            const row = cb.closest('.group');
            if (row) {
                const dayOfWeek = parseInt(cb.dataset.day || '0');
                const startInp = row.querySelector('.time-start') as HTMLInputElement;
                const endInp = row.querySelector('.time-end') as HTMLInputElement;
                payload.push({
                    day_of_week: dayOfWeek,
                    start_time: startInp.value,
                    end_time: endInp.value,
                    slot_minutes: slotMin
                });
            }
        }
    });

    try {
        await apiFetch('/me/working-hours', { method: 'POST', body: JSON.stringify(payload) });
        Telegram.WebApp.showAlert('График сохранен!');
    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка сохранения графика');
    } finally {
        btnSaveSchedule.innerHTML = originalContent;
        btnSaveSchedule.disabled = false;
    }
};


// =============================================================================
// 4. APPOINTMENTS LOGIC (UPDATED: Calendar + New Design)
// =============================================================================

const appList = document.getElementById('appointments-list')!;
const calendarContainer = document.getElementById('calendar-container')!;

// STATE
let selectedDate = new Date(); // Selected date
let viewDate = new Date();     // Currently viewed month
let busyDates: string[] = [];  // Dates with appointments (YYYY-MM-DD)

// CONSTANTS
const MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// --- CALENDAR RENDERER ---
function renderCalendar() {
    if (!calendarContainer) return;

    // 1. Calculations
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // First day of week (0=Mon, 6=Sun)
    let firstDay = new Date(year, month, 1).getDay() - 1;
    if (firstDay === -1) firstDay = 6;

    const todayStr = new Date().toDateString();
    const selectedStr = selectedDate.toDateString();

    // 2. HTML Generation
    let html = `
        <div class="px-4 pt-4 pb-2">
            <div class="flex justify-between items-center mb-3 px-2">
                <h2 class="text-lg font-bold text-white capitalize">
                    ${MONTH_NAMES[month]} ${year}
                </h2>
                <div class="flex gap-1">
                    <button id="cal-prev" class="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 active:bg-gray-700 transition-colors">
                        <span class="material-symbols-outlined text-[20px]">chevron_left</span>
                    </button>
                    <button id="cal-next" class="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 active:bg-gray-700 transition-colors">
                        <span class="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-7 gap-1 text-center mb-2">
                ${WEEK_DAYS.map(d => `<span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${d}</span>`).join('')}
            </div>

            <div class="grid grid-cols-7 gap-1">
    `;

    // Empty slots
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="h-9"></div>`;
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const currentDate = new Date(year, month, i);
        const currentStr = currentDate.toDateString();

        // YYYY-MM-DD for checking busyDates
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const isoDate = `${y}-${m}-${d}`;

        const isSelected = currentStr === selectedStr;
        const isToday = currentStr === todayStr;
        const hasRecords = busyDates.includes(isoDate);

        let classes = "h-9 flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all relative ";

        if (isSelected) {
            classes += "bg-primary text-white shadow-md shadow-primary/20 scale-105";
        } else if (isToday) {
            classes += "text-primary border border-primary/30";
        } else {
            classes += "text-gray-400 hover:bg-gray-800";
        }

        const dotColor = isSelected ? 'bg-white' : 'bg-primary';
        const dot = hasRecords ? `<span class="w-1 h-1 rounded-full absolute bottom-1.5 ${dotColor}"></span>` : '';

        html += `
            <button class="day-btn ${classes}" data-day="${i}">
                <span>${i}</span>
                ${dot}
            </button>
        `;
    }

    html += `</div></div>`;
    calendarContainer.innerHTML = html;

    // 3. Event Listeners
    const btnPrev = document.getElementById('cal-prev');
    const btnNext = document.getElementById('cal-next');
    if (btnPrev) btnPrev.onclick = () => changeMonth(-1);
    if (btnNext) btnNext.onclick = () => changeMonth(1);

    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const day = parseInt((e.currentTarget as HTMLElement).dataset.day!);
            selectedDate = new Date(year, month, day);
            renderCalendar();
            renderAppointmentsList((window as any).cachedAppointments || []);
        });
    });
}

function changeMonth(offset: number) {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    renderCalendar();
}

// --- APPOINTMENTS LOADING & RENDERING ---

// Cache appointments to filter on client side
(window as any).cachedAppointments = [];

(window as any).loadAppointments = async () => {
    if (!appList) return;
    appList.innerHTML = '<div class="text-center text-gray-500 py-8">Загрузка...</div>';

    try {
        const apps = await apiFetch('/me/appointments');
        (window as any).cachedAppointments = apps;

        // Update busyDates for calendar
        const datesSet = new Set<string>();
        apps.forEach((a: any) => {
             const d = new Date(a.starts_at);
             const y = d.getFullYear();
             const m = String(d.getMonth() + 1).padStart(2, '0');
             const day = String(d.getDate()).padStart(2, '0');
             datesSet.add(`${y}-${m}-${day}`);
        });
        busyDates = Array.from(datesSet);

        renderCalendar();
        renderAppointmentsList(apps);

    } catch (e) {
        appList.innerHTML = '<div class="text-center text-red-400">Ошибка сети</div>';
    }
};

function renderAppointmentsList(apps: any[]) {
    if (!appList) return;
    appList.innerHTML = '';

    // Filter by selectedDate
    const filtered = apps.filter((a: any) => {
        const d = new Date(a.starts_at);
        return d.toDateString() === selectedDate.toDateString();
    });

    if (filtered.length === 0) {
        appList.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 opacity-50">
                <span class="material-symbols-outlined text-5xl text-gray-600 mb-2">event_note</span>
                <p class="text-gray-400 text-sm">Нет записей на этот день</p>
            </div>`;
        return;
    }

    filtered.forEach((a: any) => {
        const cardHTML = createRecordCardHTML(a);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHTML;
        const cardEl = tempDiv.firstElementChild as HTMLElement;

        // Handlers
        const btnMsg = cardEl.querySelector('.btn-msg') as HTMLElement;
        if(btnMsg) btnMsg.onclick = () => {
            const phone = a.client_phone.replace(/\D/g, '');
            window.open(`https://wa.me/${phone}`, '_blank');
        };

        const btnConfirm = cardEl.querySelector('.btn-confirm') as HTMLButtonElement;
        if(btnConfirm && !btnConfirm.disabled) {
            btnConfirm.onclick = async () => {
                btnConfirm.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>';
                btnConfirm.disabled = true;
                try {
                    await apiFetch(`/me/appointments/${a.id}/confirm`, { method: 'POST' });
                    (window as any).loadAppointments();
                } catch (e) {
                    Telegram.WebApp.showAlert('Ошибка');
                    btnConfirm.textContent = 'Ошибка';
                }
            };
        }

        const btnCancel = cardEl.querySelector('.btn-cancel') as HTMLButtonElement;
        if(btnCancel) {
            btnCancel.onclick = async () => {
               if(confirm('Отменить запись?')) {
                   Telegram.WebApp.showAlert('Запрос на отмену отправлен');
               }
            };
        }

        appList.appendChild(cardEl);
    });
}

function createRecordCardHTML(record: any) {
    const isPending = record.status === 'pending';
    const dateObj = new Date(record.starts_at);
    const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // Design Logic
    const borderClass = isPending ? 'border-l-orange-500 shadow-orange-500/5' : 'border-l-green-500 shadow-green-500/5';
    const dotClass = isPending ? 'bg-orange-500 animate-pulse' : 'bg-green-500';
    const statusBg = isPending ? 'bg-orange-500 text-orange-500' : 'bg-green-500 text-green-500';
    const statusText = isPending ? 'ОЖИДАЕТ' : 'ГОТОВО';

    const confirmBtnStyle = isPending
        ? 'bg-primary text-white hover:bg-primary/90 shadow-primary/20 shadow-lg'
        : 'bg-green-600/20 text-green-400 border border-green-600/30 cursor-default shadow-none';

    const confirmBtnText = isPending ? 'Подтвердить' : 'Подтверждено';
    const confirmBtnDisabled = isPending ? '' : 'disabled';

    const avatarHTML = `
        <div class="w-16 h-16 rounded-2xl overflow-hidden bg-gray-800 flex-shrink-0 border border-gray-700 shadow-inner flex items-center justify-center text-3xl">
           🐶
        </div>
    `;

    return `
    <div class="relative bg-[#1a2632] rounded-2xl p-4 mb-3 border border-gray-800 flex flex-col gap-4 transition-all duration-300 border-l-4 shadow-lg ${borderClass}">

      <div class="flex justify-between items-center">
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
          <span class="text-gray-200 font-bold text-xs">${timeStr}</span>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-opacity-10 ${statusBg}">
          ${statusText}
        </span>
      </div>

      <div class="flex gap-4 items-center">
        ${avatarHTML}
        <div class="flex-grow min-w-0">
          <h3 class="text-lg font-bold truncate text-white leading-tight">${record.pet_name}</h3>
          <p class="text-gray-400 text-xs truncate mb-1.5">
            ${record.services?.name || 'Услуга'} • ${record.pet_breed || 'Порода'}
          </p>
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-gray-500 truncate font-medium">Клиент</span>
            <a href="tel:${record.client_phone}" class="text-primary text-[11px] font-bold hover:text-blue-300 flex items-center gap-1 transition-colors hover:underline">
              <span class="material-symbols-outlined text-[12px]">call</span>
              ${record.client_phone}
            </a>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex gap-2">
          <button class="btn-cancel flex-1 py-2.5 rounded-xl bg-gray-800/50 text-gray-400 font-bold text-xs hover:bg-red-900/20 hover:text-red-400 border border-gray-700 active:scale-[0.98] transition-all">
            Отменить
          </button>
          <button ${confirmBtnDisabled} class="btn-confirm flex-[2] py-2.5 rounded-xl font-bold text-xs active:scale-[0.98] transition-all ${confirmBtnStyle}">
            ${confirmBtnText}
          </button>
        </div>
        <button class="btn-msg w-full py-2.5 rounded-xl bg-gray-800/30 text-gray-300 font-bold text-xs border border-gray-700 flex items-center justify-center gap-2 hover:bg-gray-700 hover:text-white transition-all active:scale-[0.98]">
          <span class="material-symbols-outlined text-[14px] text-primary">chat</span>
          Написать
        </button>
      </div>
    </div>
    `;
}

// Initial Load
loadProfile();
loadServices();
loadSchedule();
(window as any).loadAppointments();