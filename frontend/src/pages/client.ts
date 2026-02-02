/**
 * (c) 2026 Vladimir Kovalenko
 */
import { apiFetch } from '../core/api';
import { Telegram, initTelegram } from '../core/tg';

declare const IMask: any;

initTelegram();

// -- STATE --
const urlParams = new URLSearchParams(window.location.search);
const masterId = urlParams.get('start_param') || '579214945'; // Тестовый ID

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
    statusDot: document.getElementById('status-dot')!,
    statusTextDot: document.getElementById('status-text-dot')!,
    servicesList: document.getElementById('services-list')!,
    btnExpandDesc: document.getElementById('btn-expand-desc')!,
    
    // Carousel
    carouselTrack: document.getElementById('client-carousel-track')!,
    carouselIndicators: document.getElementById('client-carousel-indicators')!,

    // Booking
    selectedServiceName: document.getElementById('selected-service-name')!,
    calMonth: document.getElementById('cal-month')!,
    calGrid: document.getElementById('cal-grid')!,
    btnPrevMonth: document.getElementById('btn-prev-month')!,
    btnNextMonth: document.getElementById('btn-next-month')!,
    slotsContainer: document.getElementById('slots-container')!,
    slotsGrid: document.getElementById('slots-grid')!,
    bookingForm: document.getElementById('booking-form')!,
    
    // Inputs
    inpName: document.getElementById('inp-client-name') as HTMLInputElement,
    inpPhone: document.getElementById('inp-phone') as HTMLInputElement,
    inpPetName: document.getElementById('inp-pet-name') as HTMLInputElement,
    inpPetBreed: document.getElementById('inp-pet-breed') as HTMLInputElement,
    inpComment: document.getElementById('inp-comment') as HTMLInputElement
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

// -- LOAD MASTER INFO & CAROUSEL --
async function loadMasterInfo() {
    try {
        masterData = await apiFetch(`/masters/${masterId}`);
        
        // 1. Text Info
        els.heroTitle.textContent = masterData.salon_name || 'Мастер';
        
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

        // 2. Carousel Logic (Отображаем фото из массива)
        renderClientCarousel();

        // 3. Status logic
        if (masterData.timezone) {
            checkOpenStatus(masterData.timezone);
        }

    } catch (e) {
        console.error(e);
        els.heroTitle.textContent = 'Мастер не найден';
        els.heroStatus.textContent = 'Ошибка';
    }
}

function renderClientCarousel() {
    if (!els.carouselTrack) return;
    els.carouselTrack.innerHTML = '';
    
    // Получаем массив фото. Если это JSON-строка (как в БД), парсим её.
    let photos: string[] = [];
    
    if (masterData.photos) {
        if (Array.isArray(masterData.photos)) {
            photos = masterData.photos;
        } else if (typeof masterData.photos === 'string') {
            try {
                photos = JSON.parse(masterData.photos);
            } catch (e) {
                // Если не парсится, возможно это просто одна ссылка?
                photos = [masterData.photos]; 
            }
        }
    }
    
    // Фоллбэк на старую аватарку
    if (photos.length === 0 && masterData.avatar_url) {
        photos = [masterData.avatar_url];
    }

    // Если совсем пусто
    if (photos.length === 0) {
        els.carouselTrack.innerHTML = `
            <div class="flex-shrink-0 w-full h-full snap-center bg-[#182430] flex flex-col items-center justify-center text-secondary/30">
                <span class="material-symbols-rounded text-6xl mb-2">storefront</span>
            </div>`;
        return;
    }

    // Рендер фото
    photos.forEach((url, index) => {
        const slide = document.createElement('div');
        slide.className = 'flex-shrink-0 w-full h-full snap-center';
        slide.innerHTML = `<img src="${url}" alt="Salon Photo ${index}" class="w-full h-full object-cover">`;
        els.carouselTrack.appendChild(slide);
    });

    // Точки (индикаторы)
    if (els.carouselIndicators) {
        els.carouselIndicators.innerHTML = '';
        if (photos.length > 1) {
            photos.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.className = `h-1.5 rounded-full transition-all duration-300 ${i === 0 ? 'bg-[#3899fa] w-3' : 'bg-[#8eadcc]/30 w-1.5'}`;
                els.carouselIndicators.appendChild(dot);
            });

            els.carouselTrack.addEventListener('scroll', () => {
                const scrollPos = els.carouselTrack.scrollLeft;
                const width = els.carouselTrack.clientWidth;
                const index = Math.round(scrollPos / width);
                Array.from(els.carouselIndicators.children).forEach((dot, i) => {
                    dot.className = `h-1.5 rounded-full transition-all duration-300 ${i === index ? 'bg-[#3899fa] w-3' : 'bg-[#8eadcc]/30 w-1.5'}`;
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

async function loadServices() {
    try {
        services = await apiFetch(`/masters/${masterId}/services`);
        els.servicesList.innerHTML = '';
        
        if (services.length === 0) {
            els.servicesList.innerHTML = '<div class="text-center text-secondary py-4">Нет услуг</div>';
            return;
        }

        services.forEach(srv => {
            const el = document.createElement('div');
            el.className = 'bg-surface p-4 rounded-2xl border border-border/50 flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-black/5 hover:border-primary/30';
            el.innerHTML = `
                <div class="flex flex-col gap-1 overflow-hidden pr-4">
                    <span class="text-white font-bold text-base truncate">${srv.name}</span>
                    <span class="text-secondary text-xs">${srv.duration_min} мин</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-primary font-bold text-base whitespace-nowrap">${srv.price} ₸</span>
                    <span class="material-symbols-rounded text-secondary/50 text-xl">chevron_right</span>
                </div>
            `;
            el.onclick = () => openBooking(srv);
            els.servicesList.appendChild(el);
        });
    } catch (e) {
        els.servicesList.innerHTML = '<div class="text-center text-error">Ошибка загрузки</div>';
    }
}

function openBooking(service: any) {
    selectedService = service;
    els.selectedServiceName.textContent = `${service.name} • ${service.price} ₸`;
    views.home.classList.add('hidden');
    views.booking.classList.remove('hidden');
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(goBack);
    initCalendar();
}

(window as any).goBack = goBack;
function goBack() {
    views.booking.classList.add('hidden');
    views.home.classList.remove('hidden');
    Telegram.WebApp.BackButton.hide();
    Telegram.WebApp.MainButton.hide();
    selectedDate = null;
    selectedSlot = null;
    els.slotsContainer.classList.add('hidden');
    els.bookingForm.classList.add('hidden');
}

let calDate = new Date();
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
        const dateStr = date.toISOString().split('T')[0];
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
        slots.forEach((isoTime: string) => {
            const time = new Date(isoTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: masterData.timezone });
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
    Telegram.WebApp.MainButton.setText(`ЗАПИСАТЬСЯ • ${selectedService.price} ₸`);
    Telegram.WebApp.MainButton.show();
}

async function onMainButtonClick() {
    const name = els.inpName.value.trim();
    const phone = els.inpPhone.value.trim();
    
    if (!name || phone.length < 10) {
        Telegram.WebApp.showAlert('Введите имя и телефон');
        return;
    }

    Telegram.WebApp.MainButton.showProgress();
    
    try {
        // Prepare Payload - ВАЖНО: имена полей соответствуют новой схеме
        const payload = {
            master_telegram_id: parseInt(masterId),
            service_id: selectedService.id,
            starts_at: selectedSlot,
            client_name: name,
            client_phone: phone,
            client_username: Telegram.WebApp.initDataUnsafe?.user?.username || null, // Отправляем null если нет
            pet_name: els.inpPetName.value.trim(),
            pet_breed: els.inpPetBreed.value.trim() || null,
            comment: els.inpComment.value.trim() || null
        };

        await apiFetch('/appointments', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        views.booking.classList.add('hidden');
        views.success.classList.remove('hidden');
        Telegram.WebApp.MainButton.hide();
        
    } catch (e) {
        Telegram.WebApp.showAlert('Ошибка записи. Попробуйте другое время.');
        Telegram.WebApp.MainButton.hideProgress();
    }
}

// Start
init();
