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

// frontend/src/pages/admin.ts (внутри loadServices)

async function loadServices() {
    try {
        const services = await apiFetch('/me/services');
        srvList.innerHTML = '';
        services.forEach((s: any) => {
            const div = document.createElement('div');
            div.className = 'card';

            // Создаем структуру через элементы, а не через строку HTML
            // Это защищает от XSS (внедрения скриптов через название)
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';

            const info = document.createElement('span');
            // Безопасная вставка текста
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
};

// Инициализация при старте
loadProfile();
loadServices();
(window as any).loadAppointments();