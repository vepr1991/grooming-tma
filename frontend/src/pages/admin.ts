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
        els.btnSave.textContent = 'Сохранить';
    }
};

// --- SERVICES LOGIC ---
const srvList = document.getElementById('services-list')!;
const btnAddSrv = document.getElementById('btn-add-service') as HTMLButtonElement;

async function loadServices() {
    try {
        const services = await apiFetch('/me/services');
        srvList.innerHTML = '';
        services.forEach((s: any) => {
            const div = document.createElement('div');
            div.className = 'card';

            // Создаем структуру через элементы (защита от XSS)
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';

            const info = document.createElement('span');
            const bName = document.createElement('b');
            bName.textContent = s.name;
            info.appendChild(bName);
            info.append(` (${s.duration_min} мин)`);

            const price = document.createElement('b');
            price.textContent = `${s.price} ₸`;

            row.appendChild(info);
            row.appendChild(price);

            const btn = document.createElement('button');
            btn.className = 'btn-danger-text';
            btn.textContent = 'Удалить';
            btn.onclick = () => deleteService(s.id);

            div.appendChild(row);
            div.appendChild(btn);

            srvList.appendChild(div);
        });
    } catch (e) {
        srvList.textContent = 'Ошибка загрузки услуг';
    }
}

async function createService() {
    const name = (document.getElementById('new-srv-name') as HTMLInputElement).value;
    const price = (document.getElementById('new-srv-price') as HTMLInputElement).value;
    const dur = (document.getElementById('new-srv-dur') as HTMLInputElement).value;

    if (!name || !price) return;

    btnAddSrv.disabled = true;
    try {
        await apiFetch('/me/services', {
            method: 'POST',
            body: JSON.stringify({
                name,
                price: parseFloat(price),
                duration_min: parseInt(dur) || 60
            })
        });
        // Очистка полей
        (document.getElementById('new-srv-name') as HTMLInputElement).value = '';
        loadServices();
    } catch(e) {
        alert('Ошибка создания');
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

// --- APPOINTMENTS LOGIC ---
const appList = document.getElementById('appointments-list')!;

// Делаем функцию глобальной, чтобы вызывать из HTML
(window as any).loadAppointments = async () => {
    appList.innerHTML = 'Загрузка...';
    try {
        const apps = await apiFetch('/me/appointments');
        appList.innerHTML = '';
        if (apps.length === 0) {
            appList.innerHTML = '<p>Записей пока нет</p>';
            return;
        }

        apps.forEach((a: any) => {
            const div = document.createElement('div');
            div.className = 'card';
            // Форматируем дату
            const date = new Date(a.starts_at).toLocaleString('ru-RU', {
                month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit'
            });

            const isPending = a.status === 'pending';

            div.innerHTML = `
                <div>Running: <b>${date}</b></div>
                <div>Клиент: ${a.client_phone}</div>
                <div>Питомец: <b>${a.pet_name}</b> (${a.services?.name})</div>
                <div style="margin-top:5px; color: ${a.status === 'confirmed' ? 'green' : 'orange'}">
                    Статус: ${a.status}
                </div>
                ${isPending ? `<button class="btn-primary-small" style="margin-top:5px">Подтвердить</button>` : ''}
            `;

            if(isPending) {
                div.querySelector('button')!.onclick = async () => {
                    await apiFetch(`/me/appointments/${a.id}/confirm`, { method: 'POST' });
                    (window as any).loadAppointments();
                };
            }
            appList.appendChild(div);
        });
    } catch (e) {
        appList.textContent = 'Ошибка загрузки записей';
    }
}; // <--- ВАЖНО: Здесь закрывается функция loadAppointments

// --- SCHEDULE LOGIC ---
const scheduleContainer = document.getElementById('schedule-container')!;
const btnSaveSchedule = document.getElementById('btn-save-schedule') as HTMLButtonElement;

const daysMap = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']; // 1..7

async function loadSchedule() {
    scheduleContainer.innerHTML = 'Загрузка...';
    try {
        // Получаем текущий график из базы
        const existing = await apiFetch('/me/working-hours'); // Вернет массив объектов
        renderScheduleForm(existing);
    } catch (e) {
        scheduleContainer.textContent = 'Ошибка загрузки графика';
    }
}

function renderScheduleForm(existingData: any[]) {
    scheduleContainer.innerHTML = '';

    // Создаем строки для дней с 1 (Пн) по 7 (Вс)
    for (let i = 1; i <= 7; i++) {
        // Ищем, есть ли настройки для этого дня в базе
        const dayData = existingData.find((d: any) => d.day_of_week === i);
        const isActive = !!dayData;

        const row = document.createElement('div');
        row.className = 'card';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '10px';

        // HTML для одного дня
        row.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between;">
                <label style="font-weight:bold; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="day-check" data-day="${i}" ${isActive ? 'checked' : ''}>
                    ${daysMap[i-1]}
                </label>
            </div>

            <div class="day-settings" style="display: ${isActive ? 'flex' : 'none'}; gap: 10px; flex-wrap: wrap;">
                <div style="flex:1">
                    <span style="font-size:12px">С</span>
                    <input type="time" class="input-full time-start" value="${dayData?.start_time?.slice(0,5) || '10:00'}">
                </div>
                <div style="flex:1">
                    <span style="font-size:12px">До</span>
                    <input type="time" class="input-full time-end" value="${dayData?.end_time?.slice(0,5) || '20:00'}">
                </div>
                <div style="width: 80px">
                    <span style="font-size:12px">Слот (мин)</span>
                    <input type="number" class="input-full slot-dur" value="${dayData?.slot_minutes || 60}">
                </div>
            </div>
        `;

        // Логика: если убрали галочку, скрываем настройки
        const checkbox = row.querySelector('.day-check') as HTMLInputElement;
        const settingsDiv = row.querySelector('.day-settings') as HTMLElement;
        checkbox.onchange = () => {
            settingsDiv.style.display = checkbox.checked ? 'flex' : 'none';
        };

        scheduleContainer.appendChild(row);
    }
}

btnSaveSchedule.onclick = async () => {
    btnSaveSchedule.textContent = 'Сохраняю...';
    btnSaveSchedule.disabled = true;

    const payload: any[] = [];

    // Собираем данные со всех 7 дней
    document.querySelectorAll('.day-check').forEach((cb: any) => {
        if (cb.checked) {
            const row = cb.closest('.card');
            const dayOfWeek = parseInt(cb.dataset.day);
            const startTime = (row.querySelector('.time-start') as HTMLInputElement).value;
            const endTime = (row.querySelector('.time-end') as HTMLInputElement).value;
            const slotMin = parseInt((row.querySelector('.slot-dur') as HTMLInputElement).value) || 60;

            payload.push({
                day_of_week: dayOfWeek,
                start_time: startTime,
                end_time: endTime,
                slot_minutes: slotMin
            });
        }
    });

    try {
        await apiFetch('/me/working-hours', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        Telegram.WebApp.showAlert('График обновлен!');
    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка сохранения');
    } finally {
        btnSaveSchedule.textContent = 'Сохранить график';
        btnSaveSchedule.disabled = false;
    }
};

// Инициализация при старте
loadProfile();
loadServices();
loadSchedule();
(window as any).loadAppointments();