/**
 * (c) 2026 Vladimir Kovalenko
 */
import { apiFetch, BASE_URL } from '../core/api';
import { initTelegram, Telegram } from '../core/tg';

declare const IMask: any;

initTelegram();

let masterTimezone = 'Asia/Almaty'; 

// Icons remain same...
const ICONS = {
    Pet: `<svg class="w-10 h-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.172C10 3.782 8.48 2.5 6.5 2.5S3 3.782 3 5.172c0 1.533 1.127 2.8 2.5 3.226V11h2V8.398c1.373-.426 2.5-1.693 2.5-3.226zM21 5.172c0-1.39-1.52-2.672-3.5-2.672S14 3.782 14 5.172c0 1.533 1.127 2.8 2.5 3.226V11h2V8.398c1.373-.426 2.5-1.693 2.5-3.226zM9 13h6c.667 0 1.25.167 1.75.5.5.333 1.25.833 1.25 1.5S17 17 16 19s-2.5 2.5-4 2.5-3-1.5-4-2.5-2-2.5-2-4 .75-1.167 1.25-1.5C8.75 13.167 9.333 13 9 13z"/></svg>`,
    Phone: `<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    Telegram: `<svg class="w-4 h-4 text-fixed-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-1.02-2.38-1.61-1.04-.69-.37-1.07.22-1.68.15-.16 2.74-2.51 2.79-2.72.01-.03.01-.12-.05-.17-.05-.05-.14-.03-.21-.02-.09.02-1.54.98-4.35 2.88-.41.28-.78.42-1.11.41-.36 0-1.05-.2-1.57-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.77-1.15 3.35-1.35 3.73-1.35.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .29z"/></svg>`,
    WhatsApp: `<svg class="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.32a8.197 8.197 0 0 1-1.26-4.38c.04-4.54 3.74-8.23 8.25-8.23m4.53 11.38c-.19-.1-.64-.26-1.33-.62-.17-.1-.28-.15-.38.04s-.42.53-.51.64c-.1.11-.19.12-.38.03-.19-.1-.82-.3-1.55-.96-.58-.52-1-.1.17-1.12.35-.11-.16-.06-.29-.06-.4s-.37-.15-.56-.37c-.19-.21-.73-.73-.73-1.77s.75-1.63.98-1.87c.23-.23.49-.29.66-.29.17 0 .34.01.49.07.15.06.33.24.42.44.13.29.43 1.05.47 1.12.04.07.07.16 0 .28-.07.12-.11.19-.22.3-.11.11-.23.24-.33.32-.11.09-.23.19 0 .58.23.39 1 1.65 2.15 2.67.92.82 1.66 1.08 2.27 1.36.19.09.43.19.66.19.38 0 .84-.09 1.17-.38.33-.29.68-1.23.68-1.67 0-.44-.15-.65-.33-.74z"/></svg>`
};

function showToast(message: string, type: 'success' | 'error' = 'success') {
    const toast = document.getElementById('global-toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    if (!toast || !msgEl || !iconEl) return;

    msgEl.textContent = message;
    if (type === 'success') {
        iconEl.textContent = 'check_circle';
        iconEl.className = 'material-symbols-outlined text-success';
    } else {
        iconEl.textContent = 'error';
        iconEl.className = 'material-symbols-outlined text-error';
    }
    toast.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
    }, 3000);
}

function showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm');
        const box = document.getElementById('confirm-box');
        const text = document.getElementById('confirm-text');
        const btnOk = document.getElementById('confirm-btn-ok');
        const btnCancel = document.getElementById('confirm-btn-cancel');

        if (!modal || !text || !btnOk || !btnCancel || !box) return resolve(false);

        text.textContent = message;
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            box.classList.remove('scale-95');
            box.classList.add('scale-100');
        }, 10);

        const close = (result: boolean) => {
            modal.classList.add('opacity-0');
            box.classList.remove('scale-100');
            box.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                resolve(result);
            }, 200);
            btnOk.onclick = null;
            btnCancel.onclick = null;
        };

        btnOk.onclick = () => close(true);
        btnCancel.onclick = () => close(false);
    });
}

// ... (Profile Logic same as before)
const els = {
    name: document.getElementById('salon-name') as HTMLInputElement,
    address: document.getElementById('address') as HTMLInputElement,
    phone: document.getElementById('phone') as HTMLInputElement,
    desc: document.getElementById('description') as HTMLTextAreaElement,
    btnEditMode: document.getElementById('btn-edit-mode') as HTMLButtonElement,
    editActions: document.getElementById('edit-actions') as HTMLElement,
    btnCancel: document.getElementById('btn-cancel') as HTMLButtonElement,
    btnSave: document.getElementById('btn-save-profile') as HTMLButtonElement,
    carouselTrack: document.getElementById('carousel-track') as HTMLElement,
    carouselIndicators: document.getElementById('carousel-indicators') as HTMLElement,
    photoInput: document.getElementById('photo-input') as HTMLInputElement,
    onboardingScreen: document.getElementById('onboarding-screen') as HTMLElement,
    regName: document.getElementById('reg-name') as HTMLInputElement,
    regAddress: document.getElementById('reg-address') as HTMLInputElement,
    btnFinishReg: document.getElementById('btn-finish-reg') as HTMLButtonElement,
};

let currentPhotos: string[] = [];
let originalData: any = {};

function renderCarousel() {
    if (!els.carouselTrack) return;
    els.carouselTrack.innerHTML = '';
    const isEditMode = !els.editActions.classList.contains('hidden');
    
    currentPhotos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = 'flex-shrink-0 w-full h-full snap-center relative group';
        slide.innerHTML = `
            <img src="${photo}" alt="Photo ${index + 1}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
        `;
        if (isEditMode) {
            const delBtn = document.createElement('button');
            delBtn.className = 'absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white backdrop-blur-sm hover:bg-red-500/80 transition-all';
            delBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
            delBtn.onclick = (e) => { e.stopPropagation(); removePhoto(index); };
            slide.appendChild(delBtn);
        }
        els.carouselTrack.appendChild(slide);
    });

    if (isEditMode && currentPhotos.length < 5) {
        const addSlide = document.createElement('div');
        addSlide.className = 'flex-shrink-0 w-full h-full snap-center bg-surface-dark flex items-center justify-center cursor-pointer hover:brightness-110 transition-colors border-2 border-dashed border-primary/30';
        addSlide.onclick = () => els.photoInput.click();
        addSlide.innerHTML = `
            <div class="flex flex-col items-center gap-2 text-primary">
                <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                <span class="text-sm font-medium">Добавить</span>
            </div>
        `;
        els.carouselTrack.appendChild(addSlide);
    } 
    else if (currentPhotos.length === 0) {
        els.carouselTrack.innerHTML = `
            <div class="flex-shrink-0 w-full h-full snap-center bg-surface-dark flex flex-col items-center justify-center text-text-secondary/50">
                <span class="material-symbols-outlined text-4xl mb-2 opacity-50">image_not_supported</span>
                <span class="text-xs">Нет фотографий</span>
            </div>`;
    }
    renderIndicators(0);
}

function renderIndicators(activeIndex: number) {
    if (!els.carouselIndicators) return;
    els.carouselIndicators.innerHTML = '';
    const isEditMode = !els.editActions.classList.contains('hidden');
    let totalSlides = currentPhotos.length;
    if (isEditMode && currentPhotos.length < 5) totalSlides++;
    if (totalSlides === 0) totalSlides = 1;

    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('div');
        const isActive = i === activeIndex;
        dot.className = `h-1.5 rounded-full transition-all duration-300 ${isActive ? 'bg-primary w-3' : 'bg-text-secondary/30 w-1.5'}`;
        els.carouselIndicators.appendChild(dot);
    }
}

if (els.carouselTrack) {
    els.carouselTrack.addEventListener('scroll', () => {
        const scrollPos = els.carouselTrack.scrollLeft;
        const width = els.carouselTrack.clientWidth;
        const index = Math.round(scrollPos / width);
        renderIndicators(index);
    });
}

if (els.photoInput) {
    els.photoInput.onchange = async () => {
        const file = els.photoInput.files?.[0];
        if (!file) return;
        showToast('Загрузка...');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch(`${BASE_URL}/me/upload-photo`, {
                method: 'POST',
                headers: { 'X-Tg-Init-Data': Telegram.WebApp.initData },
                body: formData
            });
            if (!response.ok) throw new Error();
            const res = await response.json();
            if (res.url) {
                currentPhotos.push(res.url);
                renderCarousel();
                setTimeout(() => {
                    els.carouselTrack.scrollTo({ left: els.carouselTrack.scrollWidth, behavior: 'smooth' });
                }, 100);
            }
        } catch (e) { showToast('Ошибка загрузки', 'error'); } finally { els.photoInput.value = ''; }
    };
}
function removePhoto(index: number) { currentPhotos.splice(index, 1); renderCarousel(); }
function initPhoneMask() { if (els.phone && typeof IMask !== 'undefined') { IMask(els.phone, { mask: '+{7} (000) 000-00-00', lazy: false }); } }
initPhoneMask();

function toggleEditMode(enable: boolean) {
    const inputs = [els.name, els.address, els.phone, els.desc];
    if (enable) {
        originalData = {
            name: els.name.value, address: els.address.value, phone: els.phone.value,
            desc: els.desc.value, photos: [...currentPhotos]
        };
        inputs.forEach(inp => inp.removeAttribute('readonly'));
        els.btnEditMode.classList.add('hidden');
        els.editActions.classList.remove('hidden');
        els.editActions.classList.add('flex');
    } else {
        inputs.forEach(inp => inp.setAttribute('readonly', 'true'));
        els.editActions.classList.add('hidden');
        els.editActions.classList.remove('flex');
        els.btnEditMode.classList.remove('hidden');
    }
    renderCarousel();
}
if(els.btnEditMode) els.btnEditMode.onclick = () => toggleEditMode(true);
if(els.btnCancel) els.btnCancel.onclick = () => {
    els.name.value = originalData.name; els.address.value = originalData.address; els.phone.value = originalData.phone; els.desc.value = originalData.desc; currentPhotos = originalData.photos || []; toggleEditMode(false);
};
if(els.btnSave) els.btnSave.onclick = async () => {
    els.btnSave.disabled = true; const originalText = els.btnSave.innerHTML; els.btnSave.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>';
    try {
        await apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify({ salon_name: els.name.value, address: els.address.value, phone: els.phone.value, description: els.desc.value, photos: currentPhotos }) });
        showToast('Профиль сохранен'); toggleEditMode(false);
    } catch (e) { showToast('Ошибка сохранения', 'error'); } finally { els.btnSave.innerHTML = originalText; els.btnSave.disabled = false; }
};
async function loadProfile() {
    try {
        const data = await apiFetch('/me');
        if (!data.profile.salon_name && els.onboardingScreen) els.onboardingScreen.classList.remove('hidden');
        if (data.profile) {
            els.name.value = data.profile.salon_name || ''; els.address.value = data.profile.address || '';
            if (data.profile.phone) { els.phone.value = data.profile.phone; if ((els.phone as any)._imask) (els.phone as any)._imask.updateValue(); }
            els.desc.value = data.profile.description || '';
            currentPhotos = data.profile.photos || [];
            if (currentPhotos.length === 0 && data.profile.avatar_url) currentPhotos.push(data.profile.avatar_url);
            renderCarousel();
            if (data.profile.timezone) masterTimezone = data.profile.timezone;
        }
    } catch (e) { console.error(e); }
}
if (els.btnFinishReg) {
    els.btnFinishReg.onclick = async () => {
        const name = els.regName.value.trim(); const address = els.regAddress.value.trim();
        if (!name) return showToast('Введите название', 'error');
        els.btnFinishReg.disabled = true; els.btnFinishReg.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';
        try {
            await apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify({ salon_name: name, address: address }) });
            els.name.value = name; els.address.value = address;
            els.onboardingScreen.style.opacity = '0'; setTimeout(() => els.onboardingScreen.classList.add('hidden'), 500);
            showToast('Салон создан! Теперь добавьте услуги.'); document.querySelector<HTMLButtonElement>('[onclick*="services"]')?.click();
        } catch (e) { showToast('Ошибка создания', 'error'); els.btnFinishReg.disabled = false; els.btnFinishReg.innerHTML = 'Создать салон <span class="material-symbols-outlined">arrow_forward</span>'; }
    };
}

// ... Services (Same logic) ...
const srvList = document.getElementById('services-list')!;
const addServiceForm = document.getElementById('add-service-form') as HTMLElement;
const btnToggleAdd = document.getElementById('btn-toggle-add-service') as HTMLButtonElement;
const btnCancelAdd = document.getElementById('btn-cancel-service') as HTMLButtonElement;
const btnSaveService = document.getElementById('btn-save-service') as HTMLButtonElement;
const inpName = document.getElementById('new-srv-name') as HTMLInputElement;
const inpDesc = document.getElementById('new-srv-desc') as HTMLTextAreaElement;
const inpPrice = document.getElementById('new-srv-price') as HTMLInputElement;
const inpDur = document.getElementById('new-srv-dur') as HTMLInputElement;

function toggleServiceForm(show: boolean) {
    if (show) { addServiceForm.classList.remove('hidden'); addServiceForm.classList.add('flex'); btnToggleAdd.classList.add('hidden'); inpName.focus(); } 
    else { addServiceForm.classList.add('hidden'); addServiceForm.classList.remove('flex'); btnToggleAdd.classList.remove('hidden'); inpName.value = ''; inpDesc.value = ''; inpPrice.value = ''; inpDur.value = '60'; }
}
if(btnToggleAdd) btnToggleAdd.onclick = () => toggleServiceForm(true);
if(btnCancelAdd) btnCancelAdd.onclick = () => toggleServiceForm(false);

async function loadServices() {
    try {
        const services = await apiFetch('/me/services');
        srvList.innerHTML = '';
        if (services.length === 0) { srvList.innerHTML = '<div class="text-center text-text-secondary p-4 opacity-50">Список услуг пуст</div>'; return; }
        services.forEach((s: any) => {
            const card = document.createElement('div');
            // FIX: Dynamic colors
            card.className = 'w-full bg-surface-dark border border-border-dark/50 rounded-xl overflow-hidden transition-all mb-3';
            const header = document.createElement('div');
            header.className = 'p-4 flex justify-between items-center transition-colors min-h-[72px]';
            const infoDiv = document.createElement('div');
            infoDiv.className = 'flex flex-col gap-1 flex-1 min-w-0';
            const nameSpan = document.createElement('span');
            // FIX: text-white becomes text-main
            nameSpan.className = 'text-white font-bold text-base leading-tight break-words';
            nameSpan.textContent = s.name;
            const detailsSpan = document.createElement('span');
            detailsSpan.className = 'text-primary text-sm font-bold';
            detailsSpan.textContent = `${s.price} ₸ • ${s.duration_min} мин`;
            infoDiv.appendChild(nameSpan); infoDiv.appendChild(detailsSpan);
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex items-center gap-1 shrink-0 ml-3';
            const delBtn = document.createElement('button');
            delBtn.className = 'text-text-secondary/40 hover:text-error p-2 rounded-full hover:bg-black/5 transition-colors z-20';
            delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
            delBtn.onclick = async (e) => { e.stopPropagation(); if (await showConfirm('Удалить эту услугу?')) { deleteService(s.id); } };
            actionsDiv.appendChild(delBtn);
            let chevron: HTMLElement | null = null;
            const hasDescription = s.description && s.description.trim() !== '';
            if (hasDescription) {
                const arrowBtn = document.createElement('div'); arrowBtn.className = 'p-1 text-text-secondary/50';
                chevron = document.createElement('span'); chevron.className = 'material-symbols-outlined transition-transform duration-200 block'; chevron.textContent = 'expand_more';
                arrowBtn.appendChild(chevron); actionsDiv.appendChild(arrowBtn); header.classList.add('cursor-pointer', 'hover:bg-black/5');
            }
            header.appendChild(infoDiv); header.appendChild(actionsDiv); card.appendChild(header);
            if (hasDescription) {
                const body = document.createElement('div');
                // FIX: colors
                body.className = 'hidden px-4 pb-4 pt-3 text-sm text-text-secondary/80 border-t border-border-dark/30 bg-black/5 break-words whitespace-normal w-full leading-relaxed';
                body.textContent = s.description; card.appendChild(body);
                header.onclick = () => {
                    const isHidden = body.classList.contains('hidden');
                    if (isHidden) { body.classList.remove('hidden'); body.animate([{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' }); if (chevron) chevron.style.transform = 'rotate(180deg)'; } 
                    else { body.classList.add('hidden'); if (chevron) chevron.style.transform = 'rotate(0deg)'; }
                };
            }
            srvList.appendChild(card);
        });
    } catch (e) { srvList.innerHTML = '<div class="text-center text-text-secondary p-4">Ошибка загрузки услуг</div>'; }
}
if(btnSaveService) btnSaveService.onclick = async () => {
    if (!inpName.value || !inpPrice.value) { showToast('Введите название и цену', 'error'); return; }
    btnSaveService.disabled = true; const originalText = btnSaveService.textContent; btnSaveService.textContent = '...';
    try { await apiFetch('/me/services', { method: 'POST', body: JSON.stringify({ name: inpName.value, description: inpDesc.value, price: parseFloat(inpPrice.value), duration_min: parseInt(inpDur.value) || 60 }) }); await loadServices(); toggleServiceForm(false); showToast('Услуга добавлена'); } catch(e) { showToast('Ошибка сохранения', 'error'); } finally { btnSaveService.disabled = false; btnSaveService.textContent = originalText; }
};
async function deleteService(id: number) { try { await apiFetch(`/me/services/${id}`, { method: 'DELETE' }); loadServices(); showToast('Услуга удалена'); } catch (e) { showToast('Ошибка удаления', 'error'); } }

// ... Schedule (FIXED COLORS) ...
const scheduleContainer = document.getElementById('schedule-container')!;
const btnSaveSchedule = document.getElementById('btn-save-schedule') as HTMLButtonElement;
const daysMap = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

async function loadSchedule() { scheduleContainer.innerHTML = ''; try { const existing = await apiFetch('/me/working-hours'); renderScheduleForm(existing); } catch (e) { console.error(e); } }

function renderScheduleForm(existingData: any[]) {
    scheduleContainer.innerHTML = '';
    for (let i = 1; i <= 7; i++) {
        const dayData = existingData.find((d: any) => d.day_of_week === i);
        const isActive = !!dayData;
        // FIX: Dynamic background
        const row = document.createElement('div');
        row.className = `group flex items-center gap-3 bg-background-dark px-4 py-4 min-h-[64px] hover:bg-surface-dark transition-colors border-b border-border-dark/30 last:border-0 ${!isActive ? 'opacity-50' : ''}`;
        
        const leftSide = document.createElement('div'); leftSide.className = 'flex items-center gap-3 flex-1 min-w-0';
        const checkWrap = document.createElement('div'); checkWrap.className = 'flex size-6 items-center justify-center shrink-0';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'h-5 w-5 rounded border-border-dark border-2 bg-transparent text-primary checked:bg-primary focus:ring-0 cursor-pointer transition-all';
        checkbox.dataset.day = i.toString(); checkbox.checked = isActive; checkWrap.appendChild(checkbox);
        const label = document.createElement('p'); label.className = `text-white text-base font-medium truncate transition-all ${!isActive ? 'line-through decoration-text-secondary text-text-secondary' : ''}`;
        label.textContent = daysMap[i - 1]; leftSide.appendChild(checkWrap); leftSide.appendChild(label);
        
        const settingsDiv = document.createElement('div'); settingsDiv.className = `flex items-center gap-2 shrink-0 transition-all ${!isActive ? 'pointer-events-none grayscale opacity-50' : ''}`;
        const createTimeInput = (val: string, cls: string) => {
            const inp = document.createElement('input'); inp.type = 'time';
            // FIX: Changed bg-[#182635] to bg-surface-dark
            inp.className = `${cls} bg-surface-dark border border-border-dark/50 text-white text-sm font-semibold px-2 py-1.5 rounded-lg w-[76px] text-center focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all`;
            inp.value = val; return inp;
        };
        const timeStart = createTimeInput(dayData?.start_time?.slice(0, 5) || '09:00', 'time-start');
        const sep = document.createElement('span'); sep.className = 'text-text-secondary font-medium'; sep.textContent = '-';
        const timeEnd = createTimeInput(dayData?.end_time?.slice(0, 5) || '18:00', 'time-end');
        settingsDiv.appendChild(timeStart); settingsDiv.appendChild(sep); settingsDiv.appendChild(timeEnd);

        checkbox.onchange = () => {
            if (checkbox.checked) { row.classList.remove('opacity-50'); settingsDiv.classList.remove('pointer-events-none', 'grayscale', 'opacity-50'); label.classList.remove('line-through', 'decoration-text-secondary', 'text-text-secondary'); } 
            else { row.classList.add('opacity-50'); settingsDiv.classList.add('pointer-events-none', 'grayscale', 'opacity-50'); label.classList.add('line-through', 'decoration-text-secondary', 'text-text-secondary'); }
        };
        row.appendChild(leftSide); row.appendChild(settingsDiv); scheduleContainer.appendChild(row);
    }
}
if(btnSaveSchedule) btnSaveSchedule.onclick = async () => {
    btnSaveSchedule.disabled = true; const originalContent = btnSaveSchedule.innerHTML; btnSaveSchedule.textContent = ''; const spinner = document.createElement('span'); spinner.className = 'material-symbols-outlined animate-spin text-[20px]'; spinner.textContent = 'progress_activity'; btnSaveSchedule.appendChild(spinner);
    const payload: any[] = []; const slotMin = 30; const checkboxes = document.querySelectorAll('#schedule-container input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((cb) => {
        if (cb.checked) {
            const row = cb.closest('.group');
            if (row) { const dayOfWeek = parseInt(cb.dataset.day || '0'); const startInp = row.querySelector('.time-start') as HTMLInputElement; const endInp = row.querySelector('.time-end') as HTMLInputElement; payload.push({ day_of_week: dayOfWeek, start_time: startInp.value, end_time: endInp.value, slot_minutes: slotMin }); }
        }
    });
    try { await apiFetch('/me/working-hours', { method: 'POST', body: JSON.stringify(payload) }); showToast('График сохранен!'); } catch (e) { showToast('Ошибка сохранения', 'error'); } finally { btnSaveSchedule.innerHTML = originalContent; btnSaveSchedule.disabled = false; }
};

// ... Appointments (FIXED COLORS) ...
const appList = document.getElementById('appointments-list')!;
const calendarContainer = document.getElementById('calendar-container')!;
let selectedDate = new Date(); let viewDate = new Date(); let busyDates: string[] = [];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function renderCalendar() {
    if (!calendarContainer) return;
    const year = viewDate.getFullYear(); const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDay = new Date(year, month, 1).getDay() - 1; if (firstDay === -1) firstDay = 6;
    const todayStr = new Date().toDateString(); const selectedStr = selectedDate.toDateString();
    let html = `
        <div class="px-4 pt-4 pb-2">
            <div class="flex justify-between items-center mb-3 px-2">
                <h2 class="text-lg font-bold text-white capitalize">${MONTH_NAMES[month]} ${year}</h2>
                <div class="flex gap-1">
                    <button id="cal-prev" class="p-1.5 hover:bg-surface-dark/50 rounded-lg text-text-secondary active:bg-surface-dark transition-colors"><span class="material-symbols-outlined text-[20px]">chevron_left</span></button>
                    <button id="cal-next" class="p-1.5 hover:bg-surface-dark/50 rounded-lg text-text-secondary active:bg-surface-dark transition-colors"><span class="material-symbols-outlined text-[20px]">chevron_right</span></button>
                </div>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center mb-2">
                ${WEEK_DAYS.map(d => `<span class="text-[10px] font-bold text-text-secondary/60 uppercase tracking-wider">${d}</span>`).join('')}
            </div>
            <div class="grid grid-cols-7 gap-1">
    `;
    for (let i = 0; i < firstDay; i++) { html += `<div class="h-9"></div>`; }
    for (let i = 1; i <= daysInMonth; i++) {
        const currentDate = new Date(year, month, i); const currentStr = currentDate.toDateString();
        const y = currentDate.getFullYear(); const m = String(currentDate.getMonth() + 1).padStart(2, '0'); const d = String(currentDate.getDate()).padStart(2, '0'); const isoDate = `${y}-${m}-${d}`;
        const isSelected = currentStr === selectedStr; const isToday = currentStr === todayStr; const hasRecords = busyDates.includes(isoDate);
        let classes = "h-9 flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all relative ";
        if (isSelected) classes += "bg-primary text-fixed-white shadow-md shadow-primary/20 scale-105";
        else if (isToday) classes += "text-primary border border-primary/30";
        else classes += "text-text-secondary hover:bg-surface-dark";
        const dotColor = isSelected ? 'bg-white' : 'bg-primary';
        const dot = hasRecords ? `<span class="w-1 h-1 rounded-full absolute bottom-1.5 ${dotColor}"></span>` : '';
        html += `<button class="day-btn ${classes}" data-day="${i}"><span>${i}</span>${dot}</button>`;
    }
    html += `</div></div>`;
    calendarContainer.innerHTML = html;
    const btnPrev = document.getElementById('cal-prev'); const btnNext = document.getElementById('cal-next');
    if (btnPrev) btnPrev.onclick = () => changeMonth(-1); if (btnNext) btnNext.onclick = () => changeMonth(1);
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const day = parseInt((e.currentTarget as HTMLElement).dataset.day!);
            selectedDate = new Date(year, month, day); renderCalendar(); renderAppointmentsList((window as any).cachedAppointments || []);
        });
    });
}
function changeMonth(offset: number) { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1); renderCalendar(); }
(window as any).cachedAppointments = [];
(window as any).loadAppointments = async () => {
    if (!appList) return; appList.innerHTML = '<div class="text-center text-text-secondary py-8">Загрузка...</div>';
    try {
        const apps = await apiFetch('/me/appointments'); (window as any).cachedAppointments = apps;
        const datesSet = new Set<string>();
        apps.forEach((a: any) => { if (a.status === 'cancelled') return; const d = new Date(a.starts_at); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); datesSet.add(`${y}-${m}-${day}`); });
        busyDates = Array.from(datesSet); renderCalendar(); renderAppointmentsList(apps);
    } catch (e) { appList.innerHTML = '<div class="text-center text-error">Ошибка сети</div>'; }
};
function renderAppointmentsList(apps: any[]) {
    if (!appList) return; appList.innerHTML = '';
    const filtered = apps.filter((a: any) => { const d = new Date(a.starts_at); const sameDay = d.toDateString() === selectedDate.toDateString(); const notCancelled = a.status !== 'cancelled'; return sameDay && notCancelled; });
    if (filtered.length === 0) { appList.innerHTML = `<div class="flex flex-col items-center justify-center py-12 opacity-50"><span class="material-symbols-outlined text-5xl text-text-secondary mb-2">event_note</span><p class="text-text-secondary text-sm">Нет записей</p></div>`; return; }
    filtered.forEach((a: any) => {
        const cardHTML = createRecordCardHTML(a);
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = cardHTML; const cardEl = tempDiv.firstElementChild as HTMLElement;
        const btnMsg = cardEl.querySelector('.btn-msg') as HTMLElement; if(btnMsg) btnMsg.onclick = () => { if (a.client_username) { Telegram.WebApp.openTelegramLink(`https://t.me/${a.client_username}`); } else { const phone = a.client_phone.replace(/\D/g, ''); Telegram.WebApp.openLink(`https://wa.me/${phone}`); } };
        const btnConfirm = cardEl.querySelector('.btn-confirm') as HTMLButtonElement; if(btnConfirm && !btnConfirm.disabled) { btnConfirm.onclick = async () => { btnConfirm.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>'; btnConfirm.disabled = true; try { await apiFetch(`/me/appointments/${a.id}/confirm`, { method: 'POST' }); (window as any).loadAppointments(); showToast('Запись подтверждена'); } catch (e) { showToast('Ошибка', 'error'); btnConfirm.textContent = 'Ошибка'; } }; }
        const btnCancel = cardEl.querySelector('.btn-cancel') as HTMLButtonElement; if(btnCancel) { btnCancel.onclick = async () => { if(await showConfirm('Отменить запись?')) { btnCancel.disabled = true; btnCancel.textContent = '...'; try { await apiFetch(`/me/appointments/${a.id}/cancel`, { method: 'POST' }); (window as any).loadAppointments(); showToast('Запись отменена'); } catch (e) { showToast('Ошибка', 'error'); btnCancel.disabled = false; btnCancel.textContent = 'Отменить'; } } }; }
        appList.appendChild(cardEl);
    });
}
function createRecordCardHTML(record: any) {
    const isPending = record.status === 'pending';
    const dateObj = new Date(record.starts_at);
    const timeStr = dateObj.toLocaleTimeString('ru-RU', { timeZone: masterTimezone, hour: '2-digit', minute: '2-digit' });

    // FIX: Using dynamic Tailwind colors
    const borderClass = isPending ? 'border-l-4 border-l-orange-500 shadow-lg shadow-orange-500/5' : 'border-l-4 border-l-success shadow-lg shadow-success/5';
    const dotClass = isPending ? 'bg-orange-500 animate-pulse' : 'bg-success';
    const statusBg = isPending ? 'bg-orange-500/10 text-orange-500' : 'bg-success/10 text-success';
    const statusText = isPending ? 'ОЖИДАЕТ' : 'ГОТОВО';
    const confirmBtnStyle = isPending ? 'bg-primary text-fixed-white hover:brightness-110 shadow-primary/20' : 'bg-success/20 text-success border border-success/30 hover:bg-success/30';
    const confirmBtnText = isPending ? 'Подтвердить' : 'Подтверждено';
    const confirmBtnDisabled = isPending ? '' : 'disabled';
    const hasUsername = !!record.client_username;
    const msgIcon = hasUsername ? ICONS.Telegram : ICONS.WhatsApp;
    const msgText = hasUsername ? 'Telegram' : 'WhatsApp';
    const msgColorClass = hasUsername ? 'text-fixed-white' : 'text-green-400';
    const petBreed = record.pet_breed || 'Не указана'; const serviceName = record.services?.name || 'Услуга удалена'; const clientName = record.client_name || 'Клиент'; const clientNote = record.comment;

    // FIX: Using bg-bg (variable) instead of hardcoded hex
    const noteHTML = clientNote ? `<div class="bg-background-dark rounded-xl p-3 border border-border-dark/50 mt-1 w-full overflow-hidden"><span class="text-[10px] text-primary font-bold uppercase tracking-wider block mb-1">Комментарий</span><p class="text-xs text-text-secondary leading-relaxed break-words whitespace-pre-wrap">${clientNote}</p></div>` : '';

    return `
    <div class="relative bg-surface-dark rounded-2xl p-4 border border-border-dark flex flex-col gap-4 transition-all duration-300 ${borderClass}">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
          <span class="text-white font-bold text-xs">${timeStr}</span>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${statusBg}">${statusText}</span>
      </div>
      <div class="flex gap-4 items-start">
        <div class="w-20 h-20 rounded-2xl bg-background-dark flex-shrink-0 border border-border-dark shadow-inner flex items-center justify-center text-text-secondary/60">
          ${ICONS.Pet}
        </div>
        <div class="flex-grow min-w-0 space-y-1">
          <div class="flex flex-col">
            <span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Кличка</span>
            <h3 class="text-lg font-bold truncate text-white leading-tight">${record.pet_name}</h3>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-1">
            <div class="flex flex-col">
              <span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Услуга</span>
              <p class="text-white text-[11px] font-medium truncate">${serviceName}</p>
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Порода</span>
              <p class="text-white text-[11px] font-medium truncate">${petBreed}</p>
            </div>
          </div>
          <div class="pt-2 flex items-center gap-2">
            <span class="text-[11px] text-text-secondary truncate font-medium">${clientName}</span>
            <a href="tel:${record.client_phone}" class="text-primary text-[11px] font-bold hover:text-primary/80 flex items-center gap-1 transition-colors">
              ${ICONS.Phone}
              ${record.client_phone}
            </a>
          </div>
        </div>
      </div>
      ${noteHTML}
      <div class="flex flex-col gap-2">
        <div class="flex gap-2">
          <button class="btn-cancel flex-1 py-2.5 rounded-xl bg-background-dark text-text-secondary font-bold text-xs hover:bg-error/10 hover:text-error border border-border-dark active:scale-[0.98] transition-all">Отменить</button>
          <button ${confirmBtnDisabled} class="btn-confirm flex-[2] py-2.5 rounded-xl font-bold text-xs active:scale-[0.98] transition-all shadow-lg ${confirmBtnStyle}">${confirmBtnText}</button>
        </div>
        <button class="btn-msg w-full py-2.5 rounded-xl bg-background-dark text-text-secondary font-bold text-xs border border-border-dark flex items-center justify-center gap-2 hover:bg-surface-dark hover:text-white transition-all active:scale-[0.98]">
          <span class="${msgColorClass}">${msgIcon}</span> ${msgText}
        </button>
      </div>
    </div>
    `;
}

loadProfile(); loadServices(); loadSchedule(); (window as any).loadAppointments();
