import { apiFetch } from '../core/api';
import { initTelegram, Telegram } from '../core/tg';

initTelegram();

const urlParams = new URLSearchParams(window.location.search);
// start_param приходит из бота ?start=12345
const masterId = Telegram.WebApp.initDataUnsafe.start_param || '123456789'; // Fallback for dev

let currentService: any = null;
let selectedSlot: string | null = null;

// DOM Elements
const views = {
    profile: document.getElementById('view-profile')!,
    booking: document.getElementById('view-booking')!,
    success: document.getElementById('view-success')!
};

async function loadMaster() {
    try {
        const master = await apiFetch(`/masters/${masterId}`);
        document.getElementById('m-name')!.textContent = master.salon_name || 'Салон';
        document.getElementById('m-desc')!.textContent = master.description || '';
        if(master.avatar_url) (document.getElementById('m-img') as HTMLImageElement).src = master.avatar_url; // + host if needed

        const services = await apiFetch(`/masters/${masterId}/services`);
        renderServices(services);
    } catch (e) {
        alert("Ошибка загрузки данных мастера");
    }
}

function renderServices(services: any[]) {
    const container = document.getElementById('services-list')!;
    container.innerHTML = '';
    services.forEach(s => {
        const btn = document.createElement('div');
        btn.className = 'card service-card';
        btn.innerHTML = `<b>${s.name}</b><br>${s.price} ₸ / ${s.duration_min} мин`;
        btn.onclick = () => selectService(s);
        container.appendChild(btn);
    });
}

async function selectService(service: any) {
    currentService = service;
    views.profile.style.display = 'none';
    views.booking.style.display = 'block';

    // Load slots for today
    const dateInput = document.getElementById('date-picker') as HTMLInputElement;
    dateInput.valueAsDate = new Date();
    dateInput.onchange = () => loadSlots(dateInput.value);
    loadSlots(dateInput.value);
}

async function loadSlots(date: string) {
    const container = document.getElementById('slots-grid')!;
    container.innerHTML = 'Загрузка...';
    try {
        const slots = await apiFetch(`/masters/${masterId}/availability?date=${date}`);
        container.innerHTML = '';
        if(slots.length === 0) container.textContent = "Нет свободных мест";

        slots.forEach((isoTime: string) => {
            const time = isoTime.split('T')[1].substring(0, 5);
            const btn = document.createElement('button');
            btn.className = 'slot-btn';
            btn.textContent = time;
            btn.onclick = () => {
                document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedSlot = isoTime;
                Telegram.WebApp.MainButton.setText(`Записаться на ${time}`);
                Telegram.WebApp.MainButton.show();
            };
            container.appendChild(btn);
        });
    } catch (e) {
        container.textContent = "Ошибка загрузки слотов";
    }
}

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
                idempotency_key: Date.now().toString() // Simple ID key
            })
        });

        views.booking.style.display = 'none';
        views.success.style.display = 'block';
        Telegram.WebApp.MainButton.hide();
    } catch (e) {
        Telegram.WebApp.showAlert("Ошибка записи. Возможно, слот уже занят.");
    } finally {
        Telegram.WebApp.MainButton.hideProgress();
    }
});

loadMaster();