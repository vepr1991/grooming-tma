import { apiFetch } from '../core/api';
import { initTelegram, Telegram } from '../core/tg';

initTelegram();

// --- PROFILE LOGIC ---
const els = {
    name: document.getElementById('salon-name') as HTMLInputElement,
    address: document.getElementById('address') as HTMLInputElement,
    phone: document.getElementById('phone') as HTMLInputElement,
    desc: document.getElementById('description') as HTMLTextAreaElement,
    btnSave: document.getElementById('btn-save-profile') as HTMLButtonElement
};

async function loadProfile() {
    try {
        const data = await apiFetch('/me');
        if (data.profile) {
            els.name.value = data.profile.salon_name || '';
            els.address.value = data.profile.address || '';
            els.phone.value = data.profile.phone || '';
            els.desc.value = data.profile.description || '';
        }
    } catch (e) {
        console.error(e);
    }
}

els.btnSave.onclick = async () => {
    els.btnSave.textContent = 'Сохранение...';
    try {
        await apiFetch('/me/profile', {
            method: 'PATCH',
            body: JSON.stringify({
                salon_name: els.name.value,
                address: els.address.value,
                phone: els.phone.value,
                description: els.desc.value
            })
        });
        Telegram.WebApp.showAlert('Профиль сохранен!');
    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка сохранения');
    } finally {
        els.btnSave.textContent = 'Сохранить профиль';
    }
};

// --- SERVICES LOGIC ---
const srvList = document.getElementById('services-list')!;
const btnAddSrv = document.getElementById('btn-add-service') as HTMLButtonElement;

async function loadServices() {
    try {
        const services = await apiFetch('/me/services');
        srvList.innerHTML = ''; // Очистка контейнера допустима, если мы в него ничего пользовательского не вставляем
        
        services.forEach((s: any) => {
            const div = document.createElement('div');
            div.className = 'bg-surface-dark p-4 rounded-xl border border-border-dark/40 flex justify-between items-center shadow-sm';

            // Левая колонка
            const leftDiv = document.createElement('div');
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'font-bold text-white text-base';
            nameDiv.textContent = s.name;
            
            const durDiv = document.createElement('div');
            durDiv.className = 'text-text-secondary text-sm flex items-center gap-1';
            
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-[14px]';
            icon.textContent = 'schedule';
            
            const timeText = document.createTextNode(` ${s.duration_min} мин`);
            
            durDiv.appendChild(icon);
            durDiv.appendChild(timeText);
            
            leftDiv.appendChild(nameDiv);
            leftDiv.appendChild(durDiv);

            // Правая колонка
            const rightDiv = document.createElement('div');
            rightDiv.className = 'flex items-center gap-4';

            const priceDiv = document.createElement('div');
            priceDiv.className = 'font-bold text-primary text-lg';
            priceDiv.textContent = `${s.price} ₸`;

            const delBtn = document.createElement('button');
            delBtn.className = 'text-red-400/70 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white/5 flex items-center';
            
            const delIcon = document.createElement('span');
            delIcon.className = 'material-symbols-outlined';
            delIcon.textContent = 'delete';
            
            delBtn.appendChild(delIcon);
            delBtn.onclick = () => deleteService(s.id);

            rightDiv.appendChild(priceDiv);
            rightDiv.appendChild(delBtn);

            div.appendChild(leftDiv);
            div.appendChild(rightDiv);
            srvList.appendChild(div);
        });
    } catch (e) {
        srvList.textContent = 'Ошибка загрузки услуг';
    }
}

async function createService() {
    const nameInput = document.getElementById('new-srv-name') as HTMLInputElement;
    const priceInput = document.getElementById('new-srv-price') as HTMLInputElement;
    const durInput = document.getElementById('new-srv-dur') as HTMLInputElement;

    if (!nameInput.value || !priceInput.value) return;

    btnAddSrv.disabled = true;
    try {
        await apiFetch('/me/services', {
            method: 'POST',
            body: JSON.stringify({
                name: nameInput.value,
                price: parseFloat(priceInput.value),
                duration_min: parseInt(durInput.value) || 60
            })
        });
        nameInput.value = '';
        priceInput.value = '';
        loadServices();
    } catch(e) {
        Telegram.WebApp.showAlert('Ошибка создания');
    } finally {
        btnAddSrv.disabled = false;
    }
}
btnAddSrv.onclick = createService;

async function deleteService(id: number) {
    if(!confirm('Удалить услугу?')) return;
    await apiFetch(`/me/services/${id}`, { method: 'DELETE' });
    loadServices();
}

// --- APPOINTMENTS LOGIC (SAFE NO INNERHTML) ---
const appList = document.getElementById('appointments-list')!;

(window as any).loadAppointments = async () => {
    appList.innerHTML = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-center text-text-secondary';
    loadingDiv.textContent = 'Загрузка...';
    appList.appendChild(loadingDiv);

    try {
        const apps = await apiFetch('/me/appointments');
        appList.innerHTML = '';
        
        if (apps.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'text-center text-text-secondary py-8 bg-surface-dark rounded-xl border border-border-dark/30';
            emptyDiv.textContent = 'Записей пока нет';
            appList.appendChild(emptyDiv);
            return;
        }

        apps.forEach((a: any) => {
            const card = document.createElement('div');
            card.className = 'bg-surface-dark p-4 rounded-xl border border-border-dark/40 space-y-3 shadow-md';
            
            const dateStr = new Date(a.starts_at).toLocaleString('ru-RU', {
                month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit'
            });

            // --- Header: Date and Status ---
            const header = document.createElement('div');
            header.className = 'flex justify-between items-start border-b border-border-dark/30 pb-2';

            const dateGroup = document.createElement('div');
            dateGroup.className = 'flex items-center gap-2';
            
            const calendarIcon = document.createElement('span');
            calendarIcon.className = 'material-symbols-outlined text-primary';
            calendarIcon.textContent = 'calendar_month';
            
            const dateText = document.createElement('div');
            dateText.className = 'font-bold text-white capitalize';
            dateText.textContent = dateStr;
            
            dateGroup.appendChild(calendarIcon);
            dateGroup.appendChild(dateText);

            const statusBadge = document.createElement('div');
            const statusClass = a.status === 'confirmed' ? 'text-green-400 bg-green-400/10' : 'text-orange-400 bg-orange-400/10';
            statusBadge.className = `px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${statusClass}`;
            statusBadge.textContent = a.status;

            header.appendChild(dateGroup);
            header.appendChild(statusBadge);

            // --- Body: Info Grid ---
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-2 gap-4 text-sm pt-1';

            // Left: Client
            const clientCol = document.createElement('div');
            
            const clientLabel = document.createElement('div');
            clientLabel.className = 'text-[11px] text-text-secondary uppercase';
            clientLabel.textContent = 'Клиент';
            
            const clientPhone = document.createElement('div');
            clientPhone.className = 'text-white font-medium';
            clientPhone.textContent = a.client_phone;
            
            const petName = document.createElement('div');
            petName.className = 'text-white font-bold mt-1';
            petName.textContent = a.pet_name; // Safe from XSS

            clientCol.appendChild(clientLabel);
            clientCol.appendChild(clientPhone);
            clientCol.appendChild(petName);

            // Right: Service
            const serviceCol = document.createElement('div');
            serviceCol.className = 'text-right';
            
            const serviceLabel = document.createElement('div');
            serviceLabel.className = 'text-[11px] text-text-secondary uppercase';
            serviceLabel.textContent = 'Услуга';
            
            const serviceName = document.createElement('div');
            serviceName.className = 'text-white font-medium truncate';
            serviceName.textContent = a.services?.name || '---';

            serviceCol.appendChild(serviceLabel);
            serviceCol.appendChild(serviceName);

            grid.appendChild(clientCol);
            grid.appendChild(serviceCol);

            card.appendChild(header);
            card.appendChild(grid);

            // --- Footer: Action Button ---
            if (a.status === 'pending') {
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'w-full mt-2 bg-primary/10 text-primary py-2.5 rounded-lg font-bold text-sm hover:bg-primary/20 transition-all border border-primary/20';
                confirmBtn.textContent = 'Подтвердить запись';
                confirmBtn.onclick = async () => {
                    confirmBtn.textContent = 'Обработка...';
                    confirmBtn.disabled = true;
                    await apiFetch(`/me/appointments/${a.id}/confirm`, { method: 'POST' });
                    (window as any).loadAppointments();
                };
                card.appendChild(confirmBtn);
            }
            
            appList.appendChild(card);
        });
    } catch (e) {
        appList.textContent = 'Ошибка загрузки записей';
    }
};

// --- SCHEDULE LOGIC ---
const scheduleContainer = document.getElementById('schedule-container')!;
const btnSaveSchedule = document.getElementById('btn-save-schedule') as HTMLButtonElement;
const globalSlotDuration = document.getElementById('global-slot-duration') as HTMLSelectElement;

const daysMap = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

async function loadSchedule() {
    scheduleContainer.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'p-4 text-center text-text-secondary';
    loading.textContent = 'Загрузка...';
    scheduleContainer.appendChild(loading);

    try {
        const existing = await apiFetch('/me/working-hours');
        if (existing && existing.length > 0) {
            globalSlotDuration.value = existing[0].slot_minutes.toString();
        }
        renderScheduleForm(existing);
    } catch (e) {
        scheduleContainer.textContent = 'Ошибка загрузки графика';
    }
}

function renderScheduleForm(existingData: any[]) {
    scheduleContainer.innerHTML = '';

    for (let i = 1; i <= 7; i++) {
        const dayData = existingData.find((d: any) => d.day_of_week === i);
        const isActive = !!dayData;

        // Row container
        const row = document.createElement('div');
        row.className = `group flex items-center gap-3 bg-background-dark px-4 py-4 min-h-[64px] hover:bg-surface-dark transition-colors ${!isActive ? 'opacity-50' : ''}`;

        // Left side
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

        // Right side
        const settingsDiv = document.createElement('div');
        settingsDiv.className = `flex items-center gap-2 shrink-0 transition-all ${!isActive ? 'pointer-events-none grayscale opacity-50' : ''}`;

        const createTimeInput = (val: string, cls: string) => {
            const inp = document.createElement('input');
            inp.type = 'time';
            inp.className = `${cls} bg-[#1c2936] border border-border-dark/50 text-white text-sm font-semibold px-2 py-1.5 rounded-lg w-[76px] text-center focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all`;
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

        // Event listener
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

btnSaveSchedule.onclick = async () => {
    btnSaveSchedule.disabled = true;
    const originalContent = btnSaveSchedule.innerHTML;
    // Безопасный спиннер через createElement
    btnSaveSchedule.textContent = '';
    const spinner = document.createElement('span');
    spinner.className = 'material-symbols-outlined animate-spin mr-2 align-middle';
    spinner.textContent = 'progress_activity';
    btnSaveSchedule.appendChild(spinner);
    btnSaveSchedule.appendChild(document.createTextNode(' Сохранение...'));

    const payload: any[] = [];
    const slotMin = parseInt(globalSlotDuration.value) || 60;

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
        await apiFetch('/me/working-hours', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        Telegram.WebApp.showAlert('График успешно обновлен!');
    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка сохранения графика');
    } finally {
        btnSaveSchedule.innerHTML = ''; // Сброс
        // Восстанавливаем оригинальный HTML кнопки (или можно пересоздать элементы)
        // Для простоты вернем HTML, так как это константа внутри кода, а не user input
        btnSaveSchedule.innerHTML = originalContent; 
        btnSaveSchedule.disabled = false;
    }
};

// Init
loadProfile();
loadServices();
loadSchedule();
(window as any).loadAppointments();
