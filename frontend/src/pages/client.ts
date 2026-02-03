/**
 * (c) 2026 Vladimir Kovalenko
 */
import { apiFetch } from '../core/api';
import { Telegram, initTelegram } from '../core/tg';

declare const IMask: any;

initTelegram();

// -- STATE --
const urlParams = new URLSearchParams(window.location.search);
const masterId = urlParams.get('start_param') || '579214945';

let masterData: any = null;
let services: any[] = [];
let selectedService: any = null;
let selectedDate: string | null = null;
let selectedSlot: string | null = null;

// -- DOM ELEMENTS --
const views = {
    home: document.getElementById('view-home')!,
    booking: document.getElementById('view-booking')!,
    success: document.getElementById('view-success')!
};

const els = {
    heroTitle: document.getElementById('hero-title')!,
    heroDesc: document.getElementById('hero-desc')!,
    heroStatus: document.getElementById('hero-status')!,
    heroPhone: document.getElementById('hero-phone')!,
    heroPhoneText: document.getElementById('hero-phone-text')!,
    statusDot: document.getElementById('status-dot')!,
    statusTextDot: document.getElementById('status-text-dot')!,
    servicesList: document.getElementById('services-list')!,
    btnExpandDesc: document.getElementById('btn-expand-desc')!,

    carouselTrack: document.getElementById('client-carousel-track')!,
    carouselIndicators: document.getElementById('client-carousel-indicators')!,

    selectedServiceName: document.getElementById('selected-service-name')!,
    calMonth: document.getElementById('cal-month')!,
    calGrid: document.getElementById('cal-grid')!,
    btnPrevMonth: document.getElementById('btn-prev-month')!,
    btnNextMonth: document.getElementById('btn-next-month')!,
    slotsContainer: document.getElementById('slots-container')!,
    slotsGrid: document.getElementById('slots-grid')!,
    bookingForm: document.getElementById('booking-form')!,

    inpName: document.getElementById('inp-client-name') as HTMLInputElement,
    inpPhone: document.getElementById('inp-phone') as HTMLInputElement,
    inpPetName: document.getElementById('inp-pet-name') as HTMLInputElement,
    inpPetBreed: document.getElementById('inp-pet-breed') as HTMLInputElement,
    inpComment: document.getElementById('inp-comment') as HTMLInputElement,

    successDate: document.getElementById('success-date')!,
    successService: document.getElementById('success-service')!
};

// -- INIT --
async function init() {
    if (typeof IMask !== 'undefined' && els.inpPhone) {
        IMask(els.inpPhone, { mask: '+{7} (000) 000-00-00', lazy: false });
    }

    if (Telegram.WebApp.initDataUnsafe?.user) {
        const u = Telegram.WebApp.initDataUnsafe.user;
        if (els.inpName) els.inpName.value = `${u.first_name} ${u.last_name || ''}`.trim();
    }

    Telegram.WebApp.MainButton.onClick(onMainButtonClick);

    await loadMasterInfo();
    await loadServices();
}

// -- LOAD MASTER INFO --
async function loadMasterInfo() {
    try {
        masterData = await apiFetch(`/masters/${masterId}`);
        els.heroTitle.textContent = masterData.salon_name || 'Мастер';

        if (masterData.phone && els.heroPhone) {
            els.heroPhone.classList.remove('hidden');
            els.heroPhone.classList.add('flex');
            els.heroPhoneText.textContent = masterData.phone;
            els.heroPhone.setAttribute('href', `tel:${masterData.phone}`);
        }

        if (masterData.description) {
            els.heroDesc.textContent = masterData.description;
            if (els.heroDesc.scrollHeight > els.heroDesc.clientHeight) {
                els.btnExpandDesc.classList.remove('hidden');
                els.btnExpandDesc.onclick = () => {
                    els.heroDesc.classList.remove('desc-clamp');
                    els.heroDesc.classList.add('desc-expanded');
                    els.btnExpandDesc.classList.add('hidden');
                };
            }
        } else {
            els.heroDesc.textContent = 'Нет описания';
        }

        renderClientCarousel();

        if (masterData.timezone) {
            checkOpenStatus(masterData.timezone);
        }

    } catch (e) {
        els.heroTitle.textContent = 'Мастер не найден';
        els.heroStatus.textContent = 'Ошибка';
    }
}

function renderClientCarousel() {
    if (!els.carouselTrack) return;
    els.carouselTrack.innerHTML = '';

    let photos: string[] = [];
    if (!masterData) return;

    if (masterData.photos) {
        if (Array.isArray(masterData.photos)) {
            photos = masterData.photos;
        } else if (typeof masterData.photos === 'string') {
            try { photos = JSON.parse(masterData.photos); } catch (e) { photos = [masterData.photos]; }
        }
    }

    if (photos.length === 0 && masterData.avatar_url) {
        photos = [masterData.avatar_url];
    }

    if (photos.length === 0) {
        els.carouselTrack.innerHTML = `
            <div class="flex-shrink-0 w-full h-full snap-center bg-surface flex flex-col items-center justify-center text-secondary/30">
                <span class="material-symbols-rounded text-6xl mb-2">storefront</span>
            </div>`;
        return;
    }

    photos.forEach((url, index) => {
        const slide = document.createElement('div');
        slide.className = 'flex-shrink-0 w-full h-full snap-center';
        slide.innerHTML = `<img src="${url}" alt="Salon Photo ${index}" class="w-full h-full object-cover">`;
        els.carouselTrack.appendChild(slide);
    });

    if (els.carouselIndicators) {
        els.carouselIndicators.innerHTML = '';
        if (photos.length > 1) {
            photos.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.className = `h-1.5 rounded-full transition-all duration-300 ${i === 0 ? 'bg-primary w-3' : 'bg-secondary/30 w-1.5'}`;
                els.carouselIndicators.appendChild(dot);
            });

            els.carouselTrack.addEventListener('scroll', () => {
                const scrollPos = els.carouselTrack.scrollLeft;
                const width = els.carouselTrack.clientWidth;
                const index = Math.round(scrollPos / width);
                Array.from(els.carouselIndicators.children).forEach((dot, i) => {
                    dot.className = `h-1.5 rounded-full transition-all duration-300 ${i === index ? 'bg-primary w-3' : 'bg-secondary/30 w-1.5'}`;
                });
            });
        }
    }
}

function checkOpenStatus(timezone: string) {
    try {
        const now = new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour12: false });
        const [h, m] = now.split(':').map(Number);
        const currentMinutes = h * 60 + m;
        const start = 9 * 60;
        const end = 21 * 60;

        if (currentMinutes >= start && currentMinutes < end) {
            els.heroStatus.textContent = "Открыто сейчас";
            els.heroStatus.className = "text-[#31b545] text-xs font-bold uppercase tracking-wider";
            els.statusDot.className = "absolute bottom-1 right-1 w-5 h-5 bg-[#31b545] border-4 border-bg rounded-full z-20";
            els.statusTextDot.className = "text-[#31b545] text-[10px]";
        } else {
            els.heroStatus.textContent = "Закрыто";
            els.heroStatus.className = "text-gray-400 text-xs font-bold uppercase tracking-wider";
            els.statusDot.className = "absolute bottom-1 right-1 w-5 h-5 bg-gray-500 border-4 border-bg rounded-full z-20";
            els.statusTextDot.className = "text-gray-500 text-[10px]";
        }
    } catch (e) { console.error(e); }
}

// === ЛОГИКА ВЫБОРА УСЛУГИ (КАК В REACT-ПРИМЕРЕ) ===
async function loadServices() {
    try {
        services = await apiFetch(`/masters/${masterId}/services`);
        els.servicesList.innerHTML = '';

        if (services.length === 0) {
            els.servicesList.innerHTML = '<div class="text-center text-secondary py-4">Нет услуг</div>';
            return;
        }

        // Рендерим каждую услугу
        services.forEach(srv => {
            // Элемент списка (кнопка)
            const btn = document.createElement('button');
            // Базовые стили + transition
            btn.className = `group w-full text-left bg-surface hover:bg-white/5 active:scale-[0.99] transition-all duration-300 p-4 rounded-xl shadow-sm border border-border flex flex-col gap-2`;

            // Иконка услуги (заглушка или из данных, если есть)
            // Генерируем цвет для иконки (просто для красоты, или фиксированный primary)
            const iconColor = "var(--c-primary)";

            btn.innerHTML = `
                <div class="flex items-center justify-between gap-4 w-full">
                    <div class="flex items-center gap-4 overflow-hidden">
                        <div class="flex items-center justify-center rounded-lg shrink-0 size-12 transition-transform duration-300 group-active:scale-95 bg-primary/10 text-primary">
                            <span class="material-symbols-outlined text-[26px]">content_cut</span>
                        </div>
                        <div class="flex flex-col justify-center overflow-hidden">
                            <p class="text-white text-[16px] font-bold leading-tight line-clamp-1 mb-0.5">${srv.name}</p>
                            <div class="flex items-center gap-1 text-secondary text-[12px]">
                                <span class="material-symbols-outlined text-[14px] align-middle">schedule</span>
                                <span class="font-medium">${srv.duration_min} мин</span>
                            </div>
                        </div>
                    </div>
                    <div class="shrink-0 flex flex-col items-end">
                        <p class="text-primary text-[16px] font-bold leading-normal">${srv.price.toLocaleString()} ₸</p>
                        <span id="chevron-${srv.id}" class="material-symbols-outlined text-secondary/40 text-[20px] transition-transform duration-300">chevron_right</span>
                    </div>
                </div>

                <div id="desc-wrapper-${srv.id}" class="grid transition-all duration-300 ease-in-out grid-rows-[0fr] opacity-0 mt-0">
                    <div class="overflow-hidden">
                        <p class="text-secondary text-[14px] leading-relaxed border-t border-border/50 pt-3">
                            ${srv.description || 'Нет описания'}
                        </p>
                    </div>
                </div>
            `;

            // Логика клика
            btn.onclick = () => handleServiceClick(srv, btn);
            els.servicesList.appendChild(btn);
        });
    } catch (e) {
        els.servicesList.innerHTML = '<div class="text-center text-error">Ошибка загрузки</div>';
    }
}

// Храним ссылку на текущую активную кнопку, чтобы сбрасывать стили
let currentActiveBtn: HTMLElement | null = null;

function handleServiceClick(service: any, btnElement: HTMLElement) {
    const isSame = selectedService?.id === service.id;

    // 1. Сброс предыдущего
    if (currentActiveBtn) {
        updateServiceItemVisuals(currentActiveBtn, false);
    }

    // 2. Если кликнули на того же - снимаем выделение
    if (isSame) {
        selectedService = null;
        currentActiveBtn = null;
        Telegram.WebApp.MainButton.hide();
    }
    // 3. Если кликнули на нового - выделяем
    else {
        selectedService = service;
        currentActiveBtn = btnElement;
        updateServiceItemVisuals(btnElement, true);

        // Показываем кнопку внизу
        Telegram.WebApp.MainButton.setText(`ВЫБРАТЬ • ${service.price} ₸`);
        Telegram.WebApp.MainButton.show();
        // При клике на MainButton переходим к календарю
        Telegram.WebApp.MainButton.onClick(() => openBooking(service));
    }
}

function updateServiceItemVisuals(btn: HTMLElement, isSelected: boolean) {
    const chevron = btn.querySelector('span[id^="chevron-"]') as HTMLElement;
    const descWrapper = btn.querySelector('div[id^="desc-wrapper-"]') as HTMLElement;

    if (isSelected) {
        // Добавляем рамку
        btn.classList.remove('border-border');
        btn.classList.add('border-primary', 'ring-1', 'ring-primary');

        // Поворачиваем стрелку и красим
        if(chevron) {
            chevron.classList.add('rotate-90', 'text-primary');
            chevron.classList.remove('text-secondary/40');
        }

        // Раскрываем описание
        if(descWrapper) {
            descWrapper.classList.remove('grid-rows-[0fr]', 'opacity-0', 'mt-0');
            descWrapper.classList.add('grid-rows-[1fr]', 'opacity-100', 'mt-2');
        }
    } else {
        // Убираем рамку
        btn.classList.add('border-border');
        btn.classList.remove('border-primary', 'ring-1', 'ring-primary');

        // Возвращаем стрелку
        if(chevron) {
            chevron.classList.remove('rotate-90', 'text-primary');
            chevron.classList.add('text-secondary/40');
        }

        // Скрываем описание
        if(descWrapper) {
            descWrapper.classList.add('grid-rows-[0fr]', 'opacity-0', 'mt-0');
            descWrapper.classList.remove('grid-rows-[1fr]', 'opacity-100', 'mt-2');
        }
    }
}

// Переход к календарю (вызывается кнопкой MainButton)
function openBooking(service: any) {
    // Отвязываем обработчик MainButton от выбора услуги
    Telegram.WebApp.MainButton.offClick(onMainButtonClick);

    views.home.classList.add('hidden');
    views.booking.classList.remove('hidden');

    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(goBack);
    Telegram.WebApp.MainButton.hide(); // Скрываем, пока не выберут время

    calDate = new Date();
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    selectedDate = `${y}-${m}-${d}`;

    initCalendar();

    if (masterData && masterData.timezone) loadSlots(selectedDate);
    else loadSlots(selectedDate);
}

// ... (Далее код календаря и слотов без изменений) ...

(window as any).goBack = goBack;
function goBack() {
    views.booking.classList.add('hidden');
    views.home.classList.remove('hidden');
    Telegram.WebApp.BackButton.hide();

    // Если вернулись назад, услуга всё еще выбрана, показываем кнопку
    if (selectedService) {
        Telegram.WebApp.MainButton.setText(`ВЫБРАТЬ • ${selectedService.price} ₸`);
        Telegram.WebApp.MainButton.show();
        Telegram.WebApp.MainButton.onClick(() => openBooking(selectedService));
    } else {
        Telegram.WebApp.MainButton.hide();
    }

    selectedDate = null;
    selectedSlot = null;
    els.slotsContainer.classList.add('hidden');
    els.bookingForm.classList.add('hidden');
}

function initCalendar() {
    renderCalendar();
    els.btnPrevMonth.onclick = () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); };
    els.btnNextMonth.onclick = () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); };
}

function renderCalendar() {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    els.calMonth.textContent = new Date(year, month).toLocaleString('ru', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay() || 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    els.calGrid.innerHTML = '';
    for (let i = 1; i < firstDay; i++) els.calGrid.appendChild(document.createElement('div'));

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const isPast = date < today;
        const isToday = date.getTime() === today.getTime();

        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;

        const isSelected = selectedDate === dateStr;

        const cell = document.createElement('div');
        cell.className = `day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isPast ? 'disabled' : ''}`;
        cell.textContent = d.toString();

        if (!isPast) {
            cell.onclick = () => {
                document.querySelector('.day-cell.selected')?.classList.remove('selected');
                cell.classList.add('selected');
                selectedDate = dateStr;
                loadSlots(dateStr);
            };
        }
        els.calGrid.appendChild(cell);
    }
}

async function loadSlots(date: string) {
    els.slotsContainer.classList.remove('hidden');
    els.slotsGrid.innerHTML = '<div class="col-span-4 text-center text-secondary text-sm py-4">Поиск окошек...</div>';
    els.bookingForm.classList.add('hidden');
    Telegram.WebApp.MainButton.hide();

    try {
        const slots = await apiFetch(`/masters/${masterId}/availability?date=${date}`);
        els.slotsGrid.innerHTML = '';

        if (slots.length === 0) {
            els.slotsGrid.innerHTML = '<div class="col-span-4 text-center text-secondary/50 text-sm py-2">Нет мест</div>';
            return;
        }

        const tz = (masterData && masterData.timezone) ? masterData.timezone : 'Asia/Almaty';

        slots.forEach((isoTime: string) => {
            const time = new Date(isoTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: tz });
            const btn = document.createElement('button');
            btn.className = 'slot-btn';
            btn.textContent = time;
            btn.onclick = () => {
                document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedSlot = isoTime;
                showBookingForm();
            };
            els.slotsGrid.appendChild(btn);
        });
    } catch (e) {
        els.slotsGrid.innerHTML = '<div class="col-span-4 text-center text-error text-sm">Ошибка</div>';
    }
}

function showBookingForm() {
    els.bookingForm.classList.remove('hidden');
    setTimeout(() => els.bookingForm.scrollIntoView({ behavior: 'smooth' }), 100);

    // Переназначаем обработчик на финальную запись
    Telegram.WebApp.MainButton.offClick(openBooking); // Убираем старый (если был)
    Telegram.WebApp.MainButton.onClick(onMainButtonClick); // Ставим новый

    Telegram.WebApp.MainButton.setText(`ЗАПИСАТЬСЯ • ${selectedService.price} ₸`);
    Telegram.WebApp.MainButton.show();
}

async function onMainButtonClick() {
    // Если мы на экране выбора услуг (selectedSlot еще нет) -> переходим в календарь
    if (!selectedSlot && selectedService) {
        openBooking(selectedService);
        return;
    }

    // Если мы в календаре и слот выбран -> записываемся
    const name = els.inpName.value.trim();
    const phone = els.inpPhone.value.trim();

    if (!name || phone.length < 10) {
        Telegram.WebApp.showAlert('Введите имя и телефон');
        return;
    }

    Telegram.WebApp.MainButton.showProgress();

    try {
        const payload = {
            master_telegram_id: parseInt(masterId),
            service_id: selectedService.id,
            starts_at: selectedSlot,
            client_name: name,
            client_phone: phone,
            client_username: Telegram.WebApp.initDataUnsafe?.user?.username || null,
            pet_name: els.inpPetName.value.trim(),
            pet_breed: els.inpPetBreed.value.trim() || null,
            comment: els.inpComment.value.trim() || null
        };

        await apiFetch('/appointments', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (selectedDate && selectedSlot) {
            const dateObj = new Date(selectedSlot);
            const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: masterData.timezone });
            const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

            if(els.successDate) els.successDate.textContent = `${dateStr} в ${timeStr}`;
            if(els.successService) els.successService.textContent = selectedService.name;
        }

        views.booking.classList.add('hidden');
        views.success.classList.remove('hidden');
        Telegram.WebApp.MainButton.hide();

    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка записи. Попробуйте другое время.');
        Telegram.WebApp.MainButton.hideProgress();
    }
}

init();