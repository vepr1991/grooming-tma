import { apiFetch } from '../core/api';
import { initTelegram, Telegram } from '../core/tg';

initTelegram();

// --- STATE ---
const urlParams = new URLSearchParams(window.location.search);
const masterId = urlParams.get('start_param') || Telegram.WebApp.initDataUnsafe.start_param;

if (!masterId) {
    showToast("Ошибка: Не передан ID мастера");
}

let currentService: any = null;
let selectedDateStr: string | null = null; // YYYY-MM-DD
let selectedSlot: string | null = null;    // ISO string (UTC)

// Календарь состояние
let calDate = new Date(); // Текущий отображаемый месяц

// --- DOM ELEMENTS ---
const views = {
    profile: document.getElementById('view-profile')!,
    booking: document.getElementById('view-booking')!,
    success: document.getElementById('view-success')!
};

// --- TOAST ---
function showToast(msg: string) {
    const el = document.getElementById('toast');
    if(!el) { alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

// --- INIT LOADING ---
async function loadMaster() {
    try {
        const master = await apiFetch(`/masters/${masterId}`);
        document.getElementById('m-name')!.textContent = master.salon_name || 'Салон';
        document.getElementById('m-desc')!.textContent = master.description || '';
        if(master.avatar_url) (document.getElementById('m-img') as HTMLImageElement).src = master.avatar_url;

        const services = await apiFetch(`/masters/${masterId}/services`);
        renderServices(services);
    } catch (e) {
        showToast("Ошибка загрузки профиля");
    }
}

// frontend/src/pages/client.ts

function renderServices(services: any[]) {
    const container = document.getElementById('services-list')!;
    container.innerHTML = '';
    services.forEach(s => {
        const btn = document.createElement('div');
        btn.className = 'card service-card';

        // --- Безопасное создание DOM ---

        // Левая часть: Название и время
        const infoDiv = document.createElement('div');
        infoDiv.className = 'service-info';

        const nameB = document.createElement('b');
        nameB.textContent = s.name; // Safe

        const metaDiv = document.createElement('div');
        metaDiv.className = 'service-meta';
        metaDiv.textContent = `${s.duration_min} мин`;

        infoDiv.appendChild(nameB);
        infoDiv.appendChild(metaDiv);

        // Правая часть: Цена
        const priceDiv = document.createElement('div');
        priceDiv.className = 'service-price';
        priceDiv.textContent = `${s.price} ₸`; // Safe

        btn.appendChild(infoDiv);
        btn.appendChild(priceDiv);
        // -------------------------------

        btn.onclick = () => selectService(s);
        container.appendChild(btn);
    });
}

function selectService(service: any) {
    currentService = service;
    views.profile.style.display = 'none';
    views.booking.style.display = 'block';

    // Инициализируем календарь
    renderCalendar();
}

// --- CALENDAR LOGIC ---
const monthLabel = document.getElementById('calendar-month-label')!;
const calGrid = document.getElementById('calendar-grid')!;

const btnPrev = document.getElementById('btn-prev-month');
if(btnPrev) btnPrev.onclick = () => changeMonth(-1);

const btnNext = document.getElementById('btn-next-month');
if(btnNext) btnNext.onclick = () => changeMonth(1);

function changeMonth(delta: number) {
    calDate.setMonth(calDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    calGrid.innerHTML = '';

    const year = calDate.getFullYear();
    const month = calDate.getMonth(); // 0-11

    const monthName = calDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    monthLabel.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);

    // Пустые ячейки до 1 числа
    for (let i = 1; i < startDayOfWeek; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        calGrid.appendChild(empty);
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.textContent = day.toString();

        // --- ИСПРАВЛЕНИЕ: Формируем дату без сдвига поясов ---
        const cellDate = new Date(year, month, day);

        // Ручное форматирование YYYY-MM-DD
        const yStr = cellDate.getFullYear();
        const mStr = String(cellDate.getMonth() + 1).padStart(2, '0');
        const dStr = String(cellDate.getDate()).padStart(2, '0');
        const cellDateStr = `${yStr}-${mStr}-${dStr}`;
        // ----------------------------------------------------

        // Проверка: это сегодня?
        if (cellDate.getTime() === today.getTime()) {
            cell.classList.add('today');
        }

        // Проверка: выбрана ли эта дата?
        if (selectedDateStr === cellDateStr) {
            cell.classList.add('selected');
        }

        // Проверка: дата в прошлом?
        if (cellDate < today) {
            cell.classList.add('disabled');
        } else {
            cell.onclick = () => {
                document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected'));
                cell.classList.add('selected');

                selectedDateStr = cellDateStr;

                // Сброс слота при смене даты
                selectedSlot = null;
                Telegram.WebApp.MainButton.hide();

                document.getElementById('slots-title')!.style.display = 'block';
                document.getElementById('form-title')!.style.display = 'none';
                document.getElementById('form-block')!.style.display = 'none';

                loadSlots(selectedDateStr);
            };
        }

        calGrid.appendChild(cell);
    }
}

// --- SLOTS LOGIC ---
async function loadSlots(date: string) {
    const container = document.getElementById('slots-grid')!;
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center;">Загрузка...</div>';

    try {
        const slots = await apiFetch(`/masters/${masterId}/availability?date=${date}`);
        container.innerHTML = '';

        if(slots.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#999">Нет мест на этот день</div>';
            return;
        }

        slots.forEach((isoTime: string) => {
            // isoTime приходит в UTC (напр. ...T14:00:00+00:00)
            const dateObj = new Date(isoTime);
            // Браузер сам переведет UTC в локальное время пользователя
            const timeStr = dateObj.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});

            const btn = document.createElement('button');
            btn.className = 'slot-btn';
            btn.textContent = timeStr;

            btn.onclick = () => {
                document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                selectedSlot = isoTime; // Отправляем обратно тот же UTC

                document.getElementById('form-title')!.style.display = 'block';
                document.getElementById('form-block')!.style.display = 'block';
                setTimeout(() => document.getElementById('form-block')!.scrollIntoView({behavior:'smooth'}), 100);

                Telegram.WebApp.MainButton.setText(`Записаться на ${timeStr}`);
                Telegram.WebApp.MainButton.show();
            };
            container.appendChild(btn);
        });
    } catch (e) {
        container.textContent = "Ошибка загрузки слотов";
    }
}

// --- SUBMIT ---
Telegram.WebApp.MainButton.onClick(async () => {
    if (!selectedSlot || !currentService) return;

    const petName = (document.getElementById('pet-name') as HTMLInputElement).value;
    const phone = (document.getElementById('phone') as HTMLInputElement).value;

    if(!petName || !phone) {
        Telegram.WebApp.showAlert("Заполните кличку и телефон");
        return;
    }

    Telegram.WebApp.MainButton.showProgress();

    try {
        await apiFetch('/appointments', {
            method: 'POST',
            body: JSON.stringify({
                master_tg_id: parseInt(masterId),
                service_id: currentService.id,
                starts_at: selectedSlot,
                client_phone: phone,
                pet_name: petName,
                idempotency_key: Date.now().toString()
            })
        });

        views.booking.style.display = 'none';
        views.success.style.display = 'block';
        Telegram.WebApp.MainButton.hide();
    } catch (e: any) {
        Telegram.WebApp.MainButton.hideProgress();
        if (e.message && e.message.includes('409')) {
             Telegram.WebApp.showAlert("Упс! Время занято. Выберите другое.");
             if(selectedDateStr) loadSlots(selectedDateStr);
        } else {
             Telegram.WebApp.showAlert("Ошибка записи.");
        }
    }
});

loadMaster();