import { apiFetch, BASE_URL } from '../core/api'
import { initTelegram, Telegram } from '../core/tg'

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
            // Главный контейнер
            const card = document.createElement('div');
            // w-full важен, чтобы карточка не сжималась
            card.className = 'w-full bg-surface-dark/40 border border-border-dark/50 rounded-xl overflow-hidden transition-all mb-3';

            // --- ВЕРХНЯЯ ЧАСТЬ ---
            const header = document.createElement('div');
            header.className = 'p-4 flex justify-between items-center transition-colors min-h-[72px] relative';

            // Левая часть
            const infoDiv = document.createElement('div');
            infoDiv.className = 'flex flex-col gap-1 pr-10 overflow-hidden'; // pr-10 чтобы текст не наехал на стрелку

            const nameSpan = document.createElement('span');
            nameSpan.className = 'text-white font-bold text-base leading-tight truncate'; // truncate обрежет слишком длинное название
            nameSpan.textContent = s.name;

            const detailsSpan = document.createElement('span');
            detailsSpan.className = 'text-primary text-sm font-bold';
            detailsSpan.textContent = `${s.price} ₸ • ${s.duration_min} мин`;

            infoDiv.appendChild(nameSpan);
            infoDiv.appendChild(detailsSpan);

            // Правая часть (Кнопки)
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2';

            // Кнопка удаления
            const delBtn = document.createElement('button');
            delBtn.className = 'text-text-secondary/40 hover:text-red-400 p-2 rounded-full hover:bg-white/10 transition-colors z-20';
            delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteService(s.id);
            };
            actionsDiv.appendChild(delBtn);

            // Стрелочка (если есть описание)
            let chevron: HTMLElement | null = null;
            const hasDescription = s.description && s.description.trim() !== '';

            if (hasDescription) {
                // Добавляем иконку стрелки
                const arrowBtn = document.createElement('div');
                arrowBtn.className = 'p-1 text-text-secondary/50';
                chevron = document.createElement('span');
                chevron.className = 'material-symbols-outlined transition-transform duration-200 block';
                chevron.textContent = 'expand_more';
                arrowBtn.appendChild(chevron);
                actionsDiv.appendChild(arrowBtn);

                // Делаем шапку кликабельной
                header.classList.add('cursor-pointer', 'hover:bg-white/5');
            }

            header.appendChild(infoDiv);
            header.appendChild(actionsDiv);
            card.appendChild(header);

            // --- НИЖНЯЯ ЧАСТЬ (ОПИСАНИЕ) ---
            if (hasDescription) {
                const body = document.createElement('div');
                // ВАЖНО: break-words и w-full исправляют вылет за границы
                body.className = 'hidden px-4 pb-4 pt-3 text-sm text-text-secondary/80 border-t border-border-dark/30 bg-white/5 break-words whitespace-normal w-full leading-relaxed';
                body.textContent = s.description;

                card.appendChild(body);

                // Логика клика
                header.onclick = () => {
                    const isHidden = body.classList.contains('hidden');
                    if (isHidden) {
                        body.classList.remove('hidden');
                        // Небольшая анимация появления
                        body.animate([
                            { opacity: 0, transform: 'translateY(-5px)' },
                            { opacity: 1, transform: 'translateY(0)' }
                        ], { duration: 200, easing: 'ease-out' });

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
// 4. APPOINTMENTS LOGIC
// =============================================================================

const appList = document.getElementById('appointments-list')!;

(window as any).loadAppointments = async () => {
    appList.innerHTML = '<div class="text-center text-text-secondary py-4">Загрузка...</div>';
    try {
        const apps = await apiFetch('/me/appointments');
        appList.innerHTML = '';
        if (apps.length === 0) {
            appList.innerHTML = '<div class="text-center text-text-secondary py-8 bg-surface-dark/40 rounded-xl border border-border-dark/50">Записей пока нет</div>';
            return;
        }
        apps.forEach((a: any) => {
            const card = document.createElement('div');
            card.className = 'bg-surface-dark/40 p-4 rounded-xl border border-border-dark/50 space-y-3 shadow-sm';

            const dateStr = new Date(a.starts_at).toLocaleString('ru-RU', { month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' });

            // Card Header
            const header = document.createElement('div');
            header.className = 'flex justify-between items-start border-b border-border-dark/30 pb-2';
            const dateGroup = document.createElement('div');
            dateGroup.className = 'flex items-center gap-2';
            dateGroup.innerHTML = `<span class="material-symbols-outlined text-primary">calendar_month</span><div class="font-bold text-white capitalize">${dateStr}</div>`;
            const statusClass = a.status === 'confirmed' ? 'text-green-400 bg-green-400/10' : 'text-orange-400 bg-orange-400/10';
            header.innerHTML += `<div class="${statusClass} px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide">${a.status}</div>`;
            header.prepend(dateGroup);

            // Card Grid
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-2 gap-4 text-sm pt-1';
            grid.innerHTML = `
                <div>
                    <div class="text-[11px] text-text-secondary uppercase mb-1">Клиент</div>
                    <div class="text-white font-medium">${a.client_phone}</div>
                    <div class="text-white font-bold mt-1">${a.pet_name}</div>
                </div>
                <div class="text-right">
                    <div class="text-[11px] text-text-secondary uppercase mb-1">Услуга</div>
                    <div class="text-white font-medium truncate">${a.services?.name || '---'}</div>
                </div>
            `;

            card.appendChild(header);
            card.appendChild(grid);

            // Confirm Button (if pending)
            if (a.status === 'pending') {
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'w-full mt-2 bg-primary/10 text-primary py-2.5 rounded-lg font-bold text-sm hover:bg-primary/20 transition-all border border-primary/20';
                confirmBtn.textContent = 'Подтвердить запись';
                confirmBtn.onclick = async () => {
                    confirmBtn.textContent = '...';
                    confirmBtn.disabled = true;
                    await apiFetch(`/me/appointments/${a.id}/confirm`, { method: 'POST' });
                    (window as any).loadAppointments();
                };
                card.appendChild(confirmBtn);
            }
            appList.appendChild(card);
        });
    } catch (e) {
        appList.innerHTML = 'Ошибка загрузки записей';
    }
};

// Initial Load
loadProfile();
loadServices();
loadSchedule();
(window as any).loadAppointments();