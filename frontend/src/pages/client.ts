import { apiFetch } from '../core/api';
import { initTelegram, Telegram } from '../core/tg';

initTelegram();
Telegram.WebApp.expand();

// --- STATE ---
const urlParams = new URLSearchParams(window.location.search);
const masterId = urlParams.get('start_param') || Telegram.WebApp.initDataUnsafe.start_param;

if (!masterId) {
    showToast("Ошибка: Ссылка не содержит ID мастера");
}

let currentService: any = null;
let selectedDateStr: string | null = null;
let selectedSlot: string | null = null;
let calDate = new Date();

const views = {
    home: document.getElementById('view-home')!,
    booking: document.getElementById('view-booking')!,
    success: document.getElementById('view-success')!
};

// --- NAVIGATION ---
(window as any).goBack = () => {
    views.booking.classList.add('hidden');
    views.home.classList.remove('hidden');
    Telegram.WebApp.MainButton.hide();
    Telegram.WebApp.BackButton.hide();
};

// --- INIT ---
async function init() {
    try {
        // 1. Load Master Info
        const profile = await apiFetch(`/masters/${masterId}`);
        renderHero(profile);

        // 2. Load Services
        const services = await apiFetch(`/masters/${masterId}/services`);
        renderServices(services);

    } catch (e) {
        console.error(e);
        showToast("Не удалось загрузить данные мастера");
    }
}

function renderHero(master: any) {
    document.getElementById('hero-title')!.textContent = master.salon_name || 'Мастер';
    document.getElementById('hero-desc')!.textContent = master.description || 'Описание отсутствует';

    if (master.avatar_url) {
        const img = document.getElementById('hero-avatar') as HTMLImageElement;
        img.src = master.avatar_url;
        img.classList.remove('hidden');
        document.getElementById('hero-avatar-placeholder')!.classList.add('hidden');
    }

    // Simple status logic (можно усложнить проверкой working-hours)
    // Пока просто ставим "Открыто"
}

// --- SERVICES LIST (Accordion Style) ---
function renderServices(services: any[]) {
    const container = document.getElementById('services-list')!;
    container.innerHTML = '';

    if (services.length === 0) {
        container.innerHTML = '<div class="text-center text-secondary py-4">Нет услуг</div>';
        return;
    }

    services.forEach(s => {
        // Card Container
        const card = document.createElement('div');
        card.className = `relative w-full rounded-2xl transition-all duration-300 border-2 border-transparent bg-surface hover:bg-[#1c2a38] group cursor-pointer`;

        // Main Content (Clickable)
        const content = document.createElement('div');
        content.className = 'w-full flex items-center gap-4 p-4 text-left';

        // Icon (First letter)
        const iconDiv = document.createElement('div');
        iconDiv.className = 'flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 text-2xl font-bold text-white group-hover:bg-primary/20 group-hover:text-primary transition-colors';
        iconDiv.textContent = s.name.charAt(0).toUpperCase();

        // Text Info
        const textDiv = document.createElement('div');
        textDiv.className = 'flex-1 overflow-hidden';
        textDiv.innerHTML = `
            <h4 class="text-white font-bold text-[15px] truncate mb-1">${s.name}</h4>
            <div class="flex items-center gap-1.5 text-secondary text-xs font-medium">
                <span class="material-symbols-rounded text-[14px]">schedule</span>
                ${s.duration_min} мин
            </div>
        `;

        // Price & Chevron
        const endDiv = document.createElement('div');
        endDiv.className = 'flex flex-col items-end gap-1';
        endDiv.innerHTML = `
            <span class="text-primary font-bold text-base whitespace-nowrap">${s.price} ₸</span>
            <span class="material-symbols-rounded text-secondary/30 transition-transform duration-300 chevron">expand_more</span>
        `;

        content.appendChild(iconDiv);
        content.appendChild(textDiv);
        content.appendChild(endDiv);

        // Description Panel (Hidden by default)
        const descPanel = document.createElement('div');
        descPanel.className = 'overflow-hidden transition-all duration-300 ease-in-out px-4 max-h-0 opacity-0';
        if (s.description) {
            descPanel.innerHTML = `
                <div class="pt-2 pb-4 border-t border-white/5">
                    <p class="text-secondary text-sm leading-relaxed">${s.description}</p>
                </div>
            `;
        }

        // Selection Indicator (Hidden)
        const badge = document.createElement('div');
        badge.className = 'absolute -top-1.5 -right-1.5 bg-primary text-white rounded-full p-1 shadow-md z-10 hidden scale-0 transition-transform';
        badge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>';

        card.appendChild(content);
        card.appendChild(descPanel);
        card.appendChild(badge);

        // Click Handler
        card.onclick = () => {
            // 1. Reset visual state of all other cards
            document.querySelectorAll('#services-list > div').forEach((el: any) => {
                if (el !== card) {
                    el.classList.remove('border-primary', 'bg-[#182430]', 'shadow-lg', 'scale-[1.02]');
                    el.classList.add('border-transparent');
                    el.querySelector('.chevron')?.classList.remove('rotate-180');
                    el.querySelector('.max-h-0')?.classList.remove('max-h-40', 'opacity-100'); // Close desc
                    el.lastElementChild?.classList.add('hidden', 'scale-0'); // Hide badge
                }
            });

            // 2. Toggle current card
            const isSelected = card.classList.contains('border-primary');

            if (!isSelected) {
                // Select
                card.classList.remove('border-transparent');
                card.classList.add('border-primary', 'shadow-lg', 'scale-[1.02]');
                card.querySelector('.chevron')?.classList.add('rotate-180');
                if(s.description) {
                    descPanel.classList.remove('max-h-0', 'opacity-0');
                    descPanel.classList.add('max-h-40', 'opacity-100');
                }
                badge.classList.remove('hidden');
                setTimeout(() => badge.classList.remove('scale-0'), 50);

                // Set Main Button
                currentService = s;
                Telegram.WebApp.MainButton.setText(`Выбрать: ${s.name}`);
                Telegram.WebApp.MainButton.show();
            } else {
                // Deselect (optional behavior, maybe we want to keep it selected)
                // card.classList.remove('border-primary', 'scale-[1.02]'); ...
                // For now, let's keep it selected until another is clicked
            }
        };

        container.appendChild(card);
    });
}

// --- MAIN BUTTON HANDLER ---
Telegram.WebApp.MainButton.onClick(() => {
    if (views.home.classList.contains('hidden') === false) {
        // Step 1: Service Selected -> Go to Booking
        views.home.classList.add('hidden');
        views.booking.classList.remove('hidden');
        Telegram.WebApp.MainButton.hide(); // Hide until slot selected
        Telegram.WebApp.BackButton.show();
        Telegram.WebApp.BackButton.onClick((window as any).goBack);

        document.getElementById('selected-service-name')!.textContent = currentService.name;
        renderCalendar();
    } else {
        // Step 2: Slot Selected -> Submit
        submitBooking();
    }
});


// --- CALENDAR & SLOTS (Adapted from previous code) ---
// (Logic remains similar but mapped to new DOM elements)

function renderCalendar() {
    const grid = document.getElementById('cal-grid')!;
    grid.innerHTML = '';

    const monthLabel = document.getElementById('cal-month')!;
    const monthName = calDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    monthLabel.textContent = monthName;

    const year = calDate.getFullYear();
    const month = calDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay() || 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    // Padding
    for (let i = 1; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.textContent = d.toString();

        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

        if (dateStr === todayStr) cell.classList.add('today');
        if (dateStr < todayStr) cell.classList.add('disabled');
        if (dateStr === selectedDateStr) cell.classList.add('selected');

        if (!cell.classList.contains('disabled')) {
            cell.onclick = () => {
                document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                selectedDateStr = dateStr;
                selectedSlot = null;
                Telegram.WebApp.MainButton.hide();
                document.getElementById('booking-form')!.classList.add('hidden');
                loadSlots(dateStr);
            };
        }
        grid.appendChild(cell);
    }
}

document.getElementById('btn-prev-month')!.onclick = () => {
    calDate.setMonth(calDate.getMonth() - 1);
    renderCalendar();
};
document.getElementById('btn-next-month')!.onclick = () => {
    calDate.setMonth(calDate.getMonth() + 1);
    renderCalendar();
};

async function loadSlots(date: string) {
    const container = document.getElementById('slots-grid')!;
    const wrapper = document.getElementById('slots-container')!;

    wrapper.classList.remove('hidden');
    container.innerHTML = '<div class="col-span-4 text-center text-secondary text-sm">Поиск времени...</div>';

    try {
        const slots = await apiFetch(`/masters/${masterId}/availability?date=${date}`);
        container.innerHTML = '';

        if (slots.length === 0) {
            container.innerHTML = '<div class="col-span-4 text-center text-secondary text-sm">Нет свободных мест</div>';
            return;
        }

        slots.forEach((iso: string) => {
            const time = new Date(iso).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
            const btn = document.createElement('button');
            btn.className = 'slot-btn';
            btn.textContent = time;
            btn.onclick = () => {
                document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedSlot = iso;

                // Show Form
                const form = document.getElementById('booking-form')!;
                form.classList.remove('hidden');
                // Scroll to form
                setTimeout(() => form.scrollIntoView({behavior: 'smooth'}), 100);

                Telegram.WebApp.MainButton.setText(`Записаться на ${time}`);
                Telegram.WebApp.MainButton.show();
            };
            container.appendChild(btn);
        });
    } catch (e) {
        container.innerHTML = '<div class="col-span-4 text-center text-error text-sm">Ошибка</div>';
    }
}

// --- SUBMIT ---
async function submitBooking() {
    const phone = (document.getElementById('inp-phone') as HTMLInputElement).value;
    const petName = (document.getElementById('inp-pet-name') as HTMLInputElement).value;
    const petBreed = (document.getElementById('inp-pet-breed') as HTMLInputElement).value; // NEW
    const comment = (document.getElementById('inp-comment') as HTMLTextAreaElement).value;   // NEW

    if (!phone || !petName) {
        Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        showToast("Заполните телефон и имя питомца");
        return;
    }

    Telegram.WebApp.MainButton.showProgress();

    try {
        await apiFetch('/appointments', {
            method: 'POST',
            body: JSON.stringify({
                master_tg_id: parseInt(masterId!),
                service_id: currentService.id,
                starts_at: selectedSlot,
                client_phone: phone,
                pet_name: petName,
                pet_breed: petBreed, // Sending new field
                comment: comment     // Sending new field
            })
        });

        views.booking.classList.add('hidden');
        views.success.classList.remove('hidden');
        Telegram.WebApp.MainButton.hide();
        Telegram.WebApp.BackButton.hide();
        Telegram.WebApp.HapticFeedback.notificationOccurred('success');

    } catch (e) {
        Telegram.WebApp.MainButton.hideProgress();
        showToast("Ошибка записи. Попробуйте другое время.");
    }
}

function showToast(msg: string) {
    const el = document.getElementById('toast')!;
    document.getElementById('toast-msg')!.textContent = msg;
    el.classList.remove('hidden');
    el.classList.remove('translate-y-[-100%]');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

// Start
init();