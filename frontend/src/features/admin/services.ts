import { $, getVal, setVal, show, hide, setText } from '../../core/dom';
import { showToast } from '../../ui/toast';
import { apiFetch } from '../../core/api';

let parsedServices: any[] = [];

export async function loadServices() {
    const list = $('services-list');
    if (!list) return;

    list.innerHTML = '';

    try {
        const [services, master] = await Promise.all([
            apiFetch<any[]>('/me/services'),
            apiFetch<any>('/me')
        ]);

        services.forEach(s => {
            const item = document.createElement('div');
            item.className = "bg-surface-dark border border-border-dark p-4 rounded-xl flex justify-between items-center";

            const infoDiv = document.createElement('div');
            infoDiv.className = "flex items-center gap-3";

            const iconDiv = document.createElement('div');
            iconDiv.className = "w-10 h-10 rounded-full bg-background-dark flex items-center justify-center text-xl";
            iconDiv.textContent = s.category === 'cat' ? '🐱' : '🐶';

            const textDiv = document.createElement('div');

            const nameEl = document.createElement('h4');
            nameEl.className = "font-bold text-white text-sm";
            nameEl.textContent = s.name;

            const priceEl = document.createElement('p');
            priceEl.className = "text-xs text-text-secondary";
            priceEl.textContent = `${s.price} ₸ • ${s.duration_min} мин`;

            textDiv.appendChild(nameEl);
            textDiv.appendChild(priceEl);
            infoDiv.appendChild(iconDiv);
            infoDiv.appendChild(textDiv);

            const btnDelete = document.createElement('button');
            btnDelete.className = "text-error p-2 active:scale-95 transition-transform";
            btnDelete.innerHTML = '<span class="material-symbols-outlined">delete</span>';
            btnDelete.onclick = () => deleteService(s.id);

            item.appendChild(infoDiv);
            item.appendChild(btnDelete);
            list.appendChild(item);
        });

        const btnAdd = $('btn-toggle-add-service');
        if (btnAdd) {
            if (!master.is_premium && services.length >= 10) {
                btnAdd.style.display = 'none';
                const limitMsg = document.createElement('div');
                limitMsg.className = "text-center text-xs text-text-secondary py-2";
                limitMsg.textContent = "Лимит услуг достигнут (10/10). Обновитесь до Pro.";
                list.appendChild(limitMsg);
            } else {
                btnAdd.style.display = 'flex';
            }
        }

    } catch (e) {
        console.error(e);
        showToast('Ошибка загрузки услуг', 'error');
    }
}

async function deleteService(id: number) {
    if (!confirm('Удалить услугу?')) return;
    try {
        await apiFetch(`/services/${id}`, { method: 'DELETE' });
        loadServices();
    } catch (e) {
        showToast('Ошибка удаления', 'error');
    }
}

export function initServiceHandlers() {
    $('btn-toggle-add-service')?.addEventListener('click', () => {
        const form = $('add-service-form');
        form?.classList.toggle('hidden');
    });

    $('btn-cancel-service')?.addEventListener('click', () => {
        $('add-service-form')?.classList.add('hidden');
    });

    $('btn-save-service')?.addEventListener('click', async () => {
        const name = getVal('new-srv-name');
        const price = parseInt(getVal('new-srv-price'));
        const duration = parseInt(getVal('new-srv-dur')) || 60;
        const desc = getVal('new-srv-desc');

        const catDog = document.querySelector('input[name="srv-cat"][value="dog"]') as HTMLInputElement;
        const category = catDog?.checked ? 'dog' : 'cat';

        if (!name || !price) return showToast('Заполните название и цену', 'error');

        try {
            await apiFetch('/services', {
                method: 'POST',
                body: JSON.stringify({ name, price, duration_min: duration, description: desc, category })
            });

            setVal('new-srv-name', '');
            setVal('new-srv-price', '');
            setVal('new-srv-desc', '');
            $('add-service-form')?.classList.add('hidden');
            loadServices();
            showToast('Услуга добавлена');
        } catch (e) {
            showToast('Ошибка сохранения', 'error');
        }
    });

    (window as any).openImport = () => {
        const modal = $('import-modal');
        if(modal) {
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.remove('opacity-0'), 10);
            (window as any).resetImport();
        }
    };

    (window as any).closeImport = () => {
        const modal = $('import-modal');
        if(modal) {
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    };

    (window as any).resetImport = () => {
        hide('import-step-2');
        show('import-step-1');
        setVal('import-text', '');
        setText('import-count', '0');
        parsedServices = [];
        const list = $('import-preview-list');
        if(list) list.innerHTML = '';
    };

    (window as any).removeImportItem = (idx: number) => {
        parsedServices.splice(idx, 1);
        if (parsedServices.length === 0) {
            (window as any).resetImport();
        } else {
            setText('import-count', parsedServices.length.toString());
            showToast('Элемент удален. Нажмите "Распознать" для обновления списка.', 'success');
        }
    };

    $('btn-parse')?.addEventListener('click', () => {
        const text = getVal('import-text');
        const catSelect = $('import-cat') as HTMLSelectElement;
        const cat = (catSelect?.value || 'dog') as 'dog' | 'cat';

        if(!text.trim()) return showToast('Введите текст', 'error');

        parsedServices = parseServicesText(text, cat);

        if(parsedServices.length === 0) return showToast('Не удалось распознать услуги', 'error');

        const list = $('import-preview-list');
        if(list) {
            list.innerHTML = '';
            parsedServices.forEach((s, idx) => {
                const item = document.createElement('div');
                item.className = "flex justify-between items-center bg-background-dark p-2 rounded-lg border border-border-dark/50 text-xs";

                const nameSpan = document.createElement('span');
                nameSpan.className = "text-white font-medium truncate flex-1";
                nameSpan.textContent = s.name;

                const priceSpan = document.createElement('span');
                priceSpan.className = "text-primary font-bold ml-2";
                priceSpan.textContent = `${s.price} ₸`;

                const delBtn = document.createElement('button');
                delBtn.className = "ml-2 text-error";
                delBtn.innerHTML = '<span class="material-symbols-outlined text-sm">close</span>';
                delBtn.onclick = () => {
                    item.remove();
                    parsedServices.splice(idx, 1);
                    setText('import-count', parsedServices.length.toString());
                };

                item.appendChild(nameSpan);
                item.appendChild(priceSpan);
                item.appendChild(delBtn);

                list.appendChild(item);
            });
        }

        setText('import-count', parsedServices.length.toString());
        hide('import-step-1');
        show('import-step-2');
    });

    $('btn-save-import')?.addEventListener('click', async (e) => {
        const btn = e.target as HTMLButtonElement;
        btn.disabled = true;
        btn.innerText = 'Сохраняем...';

        try {
            await apiFetch('/services/bulk', {
                method: 'POST',
                body: JSON.stringify(parsedServices)
            });
            showToast(`Успешно добавлено: ${parsedServices.length}`);
            (window as any).closeImport();
            loadServices();
        } catch (err) {
            showToast('Ошибка. Возможно, превышен лимит тарифа.', 'error');
        }
        btn.disabled = false;
        btn.innerText = 'Сохранить';
    });
}

function parseServicesText(text: string, defaultCategory: 'dog' | 'cat'): any[] {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const result = [];

    for (const line of lines) {
        const match = line.match(/^(.+?)\s*[-–—:]?\s*(\d+)\s*(?:тг|р|rub|kzt)?$/i);
        if (match) {
            const name = match[1].trim().replace(/[-–—]$/, '').trim();
            const price = parseFloat(match[2]);
            if (name && price) {
                result.push({
                    name: name,
                    price: price,
                    duration_min: 60,
                    category: defaultCategory,
                    description: ''
                });
            }
        }
    }
    return result;
}