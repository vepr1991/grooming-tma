import { $, setText } from '../../core/dom';
import { showToast } from '../../ui/toast';
import { apiFetch } from '../../core/api';

let currentStatus = 'pending';

export async function loadAppointments() {
    const list = $('appointments-list');
    if (!list) return;

    list.innerHTML = '<div class="text-center py-10"><span class="loader"></span></div>';

    try {
        const allAppointments = await apiFetch<any[]>('/me/appointments');

        const filtered = allAppointments.filter(a => a.status === currentStatus);

        setText('tab-count', filtered.length.toString());
        setText('tab-label', getStatusLabel(currentStatus));

        list.innerHTML = '';

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-text-secondary opacity-50">
                    <span class="material-symbols-outlined text-4xl mb-2">event_busy</span>
                    <p class="text-sm font-bold">Нет записей</p>
                </div>
            `;
            return;
        }

        filtered.forEach(appt => {
            const card = createAppointmentCard(appt);
            list.appendChild(card);
        });

    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="text-error text-center py-4">Ошибка загрузки</p>';
    }
}

function createAppointmentCard(appt: any) {
    const card = document.createElement('div');
    card.className = "bg-surface-dark border border-border-dark p-4 rounded-2xl space-y-3 relative overflow-hidden";

    const statusColor = getStatusColor(appt.status);
    const borderLeft = document.createElement('div');
    borderLeft.className = `absolute left-0 top-0 bottom-0 w-1 ${statusColor}`;
    card.appendChild(borderLeft);

    const timeRow = document.createElement('div');
    timeRow.className = "flex justify-between items-center mb-1";

    const dateObj = new Date(appt.starts_at);
    const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });

    const timeEl = document.createElement('div');
    timeEl.className = "flex items-baseline gap-2";

    const timeBig = document.createElement('span');
    timeBig.className = "text-2xl font-black text-white tracking-tight";
    timeBig.textContent = timeStr;

    const dateSmall = document.createElement('span');
    dateSmall.className = "text-xs font-bold text-text-secondary uppercase";
    dateSmall.textContent = dateStr;

    timeEl.appendChild(timeBig);
    timeEl.appendChild(dateSmall);
    timeRow.appendChild(timeEl);

    const priceBadge = document.createElement('div');
    priceBadge.className = "bg-background-dark px-2 py-1 rounded-lg border border-border-dark";
    const priceText = document.createElement('span');
    priceText.className = "text-xs font-bold text-primary";
    const price = appt.services?.price || 0;
    priceText.textContent = `${price} ₸`;
    priceBadge.appendChild(priceText);

    timeRow.appendChild(priceBadge);
    card.appendChild(timeRow);

    const serviceName = document.createElement('h3');
    serviceName.className = "text-white font-bold text-sm leading-tight";
    serviceName.textContent = appt.services?.name || 'Услуга удалена';
    card.appendChild(serviceName);

    const clientBlock = document.createElement('div');
    clientBlock.className = "bg-background-dark/50 p-3 rounded-xl border border-border-dark/50 flex flex-col gap-1";

    const clientRow = document.createElement('div');
    clientRow.className = "flex items-center gap-2";
    clientRow.innerHTML = '<span class="material-symbols-outlined text-[16px] text-text-secondary">person</span>';

    const clientName = document.createElement('span');
    clientName.className = "text-sm font-bold text-white";
    clientName.textContent = appt.client_name || 'Клиент без имени';

    if (appt.client_username) {
        const tgLink = document.createElement('a');
        tgLink.href = `https://t.me/${appt.client_username}`;
        tgLink.target = "_blank";
        tgLink.className = "text-xs text-primary hover:underline ml-1";
        tgLink.textContent = `@${appt.client_username}`;
        clientName.appendChild(tgLink);
    }
    clientRow.appendChild(clientName);
    clientBlock.appendChild(clientRow);

    const phoneRow = document.createElement('div');
    phoneRow.className = "flex items-center gap-2";
    phoneRow.innerHTML = '<span class="material-symbols-outlined text-[16px] text-text-secondary">call</span>';

    const phoneLink = document.createElement('a');
    phoneLink.href = `tel:${appt.client_phone}`;
    phoneLink.className = "text-xs font-mono text-text-secondary font-bold hover:text-white transition-colors";
    phoneLink.textContent = appt.client_phone;

    phoneRow.appendChild(phoneLink);
    clientBlock.appendChild(phoneRow);

    card.appendChild(clientBlock);

    if (appt.pet_name || appt.comment) {
        const extraBlock = document.createElement('div');
        extraBlock.className = "flex flex-col gap-1 pl-1";

        if (appt.pet_name) {
            const petRow = document.createElement('div');
            petRow.className = "flex items-center gap-2 text-xs text-text-secondary";
            petRow.innerHTML = '<span class="material-symbols-outlined text-[14px]">pets</span>';
            const petText = document.createElement('span');
            petText.textContent = `${appt.pet_name} ${appt.pet_breed ? `(${appt.pet_breed})` : ''}`;
            petRow.appendChild(petText);
            extraBlock.appendChild(petRow);
        }

        if (appt.comment) {
            const commentRow = document.createElement('div');
            commentRow.className = "flex items-start gap-2 text-xs text-text-secondary italic mt-1";
            commentRow.innerHTML = '<span class="material-symbols-outlined text-[14px] mt-0.5">chat</span>';
            const commentText = document.createElement('span');
            commentText.textContent = appt.comment;
            commentRow.appendChild(commentText);
            extraBlock.appendChild(commentRow);
        }
        card.appendChild(extraBlock);
    }

    const actions = document.createElement('div');
    actions.className = "grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border-dark/30";

    if (appt.status === 'pending') {
        const btnCancel = createBtn('Отказать', 'bg-surface-dark border border-border-dark text-white', () => action(appt.id, 'cancel'));
        const btnConfirm = createBtn('Подтвердить', 'bg-primary text-fixed-white shadow-lg shadow-primary/20', () => action(appt.id, 'confirm'));
        actions.appendChild(btnCancel);
        actions.appendChild(btnConfirm);
    } else if (appt.status === 'confirmed') {
        const btnCancel = createBtn('Отменить', 'bg-surface-dark border border-border-dark text-error', () => action(appt.id, 'cancel'));
        const btnComplete = createBtn('Завершить', 'bg-success text-fixed-white shadow-lg shadow-success/20', () => action(appt.id, 'complete'));
        actions.appendChild(btnCancel);
        actions.appendChild(btnComplete);
    } else {
        actions.remove();
        return card;
    }

    card.appendChild(actions);
    return card;
}

function createBtn(text: string, classes: string, onClick: () => void) {
    const btn = document.createElement('button');
    btn.className = `py-3 rounded-xl text-sm font-bold active:scale-[0.98] transition-all ${classes}`;
    btn.textContent = text;
    btn.onclick = onClick;
    return btn;
}

async function action(id: number, type: 'confirm' | 'cancel' | 'complete') {
    if (type === 'cancel' && !confirm('Точно отменить запись?')) return;
    if (type === 'complete' && !confirm('Завершить запись?')) return;

    try {
        await apiFetch(`/me/appointments/${id}/${type}`, { method: 'POST' });
        showToast('Статус обновлен');
        loadAppointments();
    } catch (e) {
        showToast('Ошибка обновления', 'error');
    }
}

function getStatusLabel(status: string) {
    switch(status) {
        case 'pending': return 'ОЖИДАЕТ';
        case 'confirmed': return 'АКТИВНЫЕ';
        case 'completed': return 'АРХИВ';
        case 'cancelled': return 'ОТМЕНА';
        default: return '';
    }
}

function getStatusColor(status: string) {
    switch(status) {
        case 'pending': return 'bg-primary';
        case 'confirmed': return 'bg-success';
        case 'cancelled': return 'bg-error';
        default: return 'bg-text-secondary';
    }
}

export function initAppointmentHandlers() {
    const tabs = document.getElementById('appointment-tabs');
    if (!tabs) return;

    const states = [
        { id: 'pending', label: 'Заявки', icon: 'notifications_active' },
        { id: 'confirmed', label: 'Записи', icon: 'event' },
        { id: 'completed', label: 'История', icon: 'history' },
        { id: 'cancelled', label: 'Отмены', icon: 'cancel' }
    ];

    tabs.innerHTML = '';
    states.forEach(s => {
        const btn = document.createElement('button');
        btn.className = `flex items-center gap-1 px-4 py-2 rounded-full border border-border-dark text-xs font-bold transition-all whitespace-nowrap ${currentStatus === s.id ? 'bg-primary text-fixed-white border-primary' : 'bg-surface-dark text-text-secondary'}`;
        btn.innerHTML = `<span class="material-symbols-outlined text-sm">${s.icon}</span> ${s.label}`;

        btn.onclick = () => {
            currentStatus = s.id;
            Array.from(tabs.children).forEach((child: any) => {
                child.className = `flex items-center gap-1 px-4 py-2 rounded-full border border-border-dark text-xs font-bold transition-all whitespace-nowrap bg-surface-dark text-text-secondary`;
            });
            btn.className = `flex items-center gap-1 px-4 py-2 rounded-full border border-primary text-fixed-white text-xs font-bold transition-all whitespace-nowrap bg-primary`;

            loadAppointments();
        };
        tabs.appendChild(btn);
    });

    (tabs.children[0] as HTMLElement).click();
}