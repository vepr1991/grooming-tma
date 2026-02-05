import { $, show, hide, getVal, setVal } from '../../core/dom';
import { apiFetch } from '../../core/api';
import { showToast } from '../../ui/toast';
import { showConfirm } from '../../ui/modal';
import { getAdminServiceSkeleton } from '../../ui/skeletons';
import { ICONS } from '../../ui/icons';
import { Service } from '../../types';

let editingId: number | null = null;

export async function loadServices() {
    const list = $('services-list');
    if (!list) return;

    // NEW: Скелетон
    list.innerHTML = getAdminServiceSkeleton(3);

    try {
        const services = await apiFetch<Service[]>('/me/services');
        list.innerHTML = '';
        if (services.length === 0) {
            list.innerHTML = '<div class="text-center text-text-secondary p-4 opacity-50">Список услуг пуст</div>';
            return;
        }
        services.forEach(s => list.appendChild(createServiceCard(s)));
    } catch {
        list.innerHTML = '<div class="text-center text-error p-4">Ошибка загрузки</div>';
    }
}

function createServiceCard(s: Service): HTMLElement {
    const el = document.createElement('div');
    el.className = 'w-full bg-surface-dark border border-border-dark/50 rounded-xl overflow-hidden transition-all mb-3';

    const hasDesc = !!s.description;

    // [MODIFIED] Выбор иконки
    const icon = s.category === 'cat' ? '🐱' : '🐶';

    el.innerHTML = `
        <div class="p-4 flex justify-between items-center transition-colors min-h-[72px] ${hasDesc ? 'cursor-pointer hover:bg-black/5' : ''} header-row">
            <div class="flex flex-col gap-1 flex-1 min-w-0">
                <span class="text-white font-bold text-base leading-tight break-words">
                    <span class="mr-1">${icon}</span> ${s.name}
                </span>
                <span class="text-primary text-sm font-bold">${s.price} ₸ • ${s.duration_min} мин</span>
            </div>
            <div class="flex items-center gap-1 shrink-0 ml-3 actions">
                <button class="edit-btn text-text-secondary/40 hover:text-primary p-2 rounded-full hover:bg-black/5 transition-colors z-20">${ICONS.Edit}</button>
                <button class="del-btn text-text-secondary/40 hover:text-error p-2 rounded-full hover:bg-black/5 transition-colors z-20">${ICONS.Delete}</button>
                ${hasDesc ? '<div class="p-1 text-text-secondary/50 chevron"><span class="material-symbols-outlined transition-transform duration-200 block">expand_more</span></div>' : ''}
            </div>
        </div>
        ${hasDesc ? `<div class="body-content hidden px-4 pb-4 pt-3 text-sm text-text-secondary/80 border-t border-border-dark/30 bg-black/5 break-words whitespace-normal w-full leading-relaxed">${s.description}</div>` : ''}
    `;

    el.querySelector('.edit-btn')!.addEventListener('click', (e) => { e.stopPropagation(); openForm(s); });
    el.querySelector('.del-btn')!.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await showConfirm('Удалить услугу?')) deleteService(s.id);
    });

    if (hasDesc) {
        const header = el.querySelector('.header-row') as HTMLElement;
        const body = el.querySelector('.body-content') as HTMLElement;
        const chevron = el.querySelector('.chevron span') as HTMLElement;
        header.onclick = () => {
            const hidden = body.classList.toggle('hidden');
            chevron.style.transform = hidden ? 'rotate(0deg)' : 'rotate(180deg)';
        };
    }
    return el;
}

function openForm(s?: Service) {
    const form = $('add-service-form');
    const btnAdd = $('btn-toggle-add-service');
    if (!form || !btnAdd) return;

    show(form);
    form.classList.add('flex');
    hide(btnAdd);

    editingId = s?.id || null;
    $('btn-save-service')!.textContent = s ? 'Сохранить изменения' : 'Создать';

    setVal('new-srv-name', s?.name || '');
    setVal('new-srv-desc', s?.description || '');
    setVal('new-srv-price', s?.price?.toString() || '');
    setVal('new-srv-dur', s?.duration_min?.toString() || '60');

    // [MODIFIED] Установка радио-кнопки категории
    const catVal = s?.category || 'dog';
    const radio = document.querySelector(`input[name="srv-cat"][value="${catVal}"]`) as HTMLInputElement;
    if (radio) radio.checked = true;

    $('new-srv-name')?.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteService(id: number) {
    try {
        await apiFetch(`/me/services/${id}`, { method: 'DELETE' });
        loadServices();
        showToast('Услуга удалена');
    } catch { showToast('Ошибка удаления', 'error'); }
}

export function initServiceHandlers() {
    $('btn-toggle-add-service')!.onclick = () => openForm();
    $('btn-cancel-service')!.onclick = () => {
        hide($('add-service-form'));
        $('add-service-form')?.classList.remove('flex');
        show($('btn-toggle-add-service'));
        editingId = null;
    };

    $('btn-save-service')!.onclick = async (e) => {
        const name = getVal('new-srv-name');
        const price = getVal('new-srv-price');
        if (!name || !price) return showToast('Название и цена обязательны', 'error');

        const btn = e.target as HTMLButtonElement;
        btn.disabled = true;
        try {
            // [MODIFIED] Считывание выбранной категории
            const catInputs = document.querySelectorAll('input[name="srv-cat"]');
            let category = 'dog';
            catInputs.forEach((inp: any) => { if (inp.checked) category = inp.value; });

            const payload = {
                name,
                description: getVal('new-srv-desc'),
                price: parseFloat(price),
                duration_min: parseInt(getVal('new-srv-dur')) || 60,
                category // Добавляем в запрос
            };

            if (editingId) {
                await apiFetch(`/me/services/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
                showToast('Обновлено');
            } else {
                await apiFetch('/me/services', { method: 'POST', body: JSON.stringify(payload) });
                showToast('Создано');
            }
            loadServices();
            $('btn-cancel-service')?.click();
        } catch { showToast('Ошибка', 'error'); }
        btn.disabled = false;
    };
}