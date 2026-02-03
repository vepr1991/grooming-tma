import { $, getVal, setVal, show, hide, toggle } from '../../core/dom';
import { apiFetch } from '../../core/api';
import { showToast } from '../../ui/toast';
import { renderCarousel, uploadPhoto } from '../../ui/carousel';
import { MasterProfile } from '../../types';

let currentPhotos: string[] = [];
let originalData: Partial<MasterProfile> = {};

export async function loadProfile() {
    try {
        const data = await apiFetch<{ user: any, profile: MasterProfile }>('/me');
        const p = data.profile;
        if (!p.salon_name) show('onboarding-screen');

        setVal('salon-name', p.salon_name || '');
        setVal('address', p.address || '');
        setVal('phone', p.phone || '');
        setVal('description', p.description || '');

        currentPhotos = p.photos || [];
        if (currentPhotos.length === 0 && p.avatar_url) currentPhotos.push(p.avatar_url);

        updateCarousel(false);
    } catch (e) { console.error(e); }
}

function updateCarousel(editMode: boolean) {
    renderCarousel(
        'carousel-track', 'carousel-indicators', currentPhotos, editMode,
        () => $('photo-input')?.click(),
        (idx) => { currentPhotos.splice(idx, 1); updateCarousel(true); }
    );
}

export function initProfileHandlers() {
    const photoInput = $('photo-input') as HTMLInputElement;
    if (photoInput) {
        photoInput.onchange = async () => {
            if (!photoInput.files?.[0]) return;
            showToast('Загрузка...');
            try {
                const url = await uploadPhoto(photoInput.files[0]);
                currentPhotos.push(url);
                updateCarousel(true);
            } catch { showToast('Ошибка загрузки', 'error'); }
            photoInput.value = '';
        };
    }

    const toggleEdit = (enable: boolean) => {
        const inputs = ['salon-name', 'address', 'phone', 'description'];
        inputs.forEach(id => $(id)?.toggleAttribute('readonly', !enable));
        toggle($('edit-actions'), enable);
        toggle($('btn-edit-mode'), !enable);
        updateCarousel(enable);

        if (enable) {
            originalData = {
                salon_name: getVal('salon-name'),
                address: getVal('address'),
                phone: getVal('phone'),
                description: getVal('description'),
                photos: [...currentPhotos]
            };
        }
    };

    $('btn-edit-mode')!.onclick = () => toggleEdit(true);
    $('btn-cancel')!.onclick = () => {
        if(originalData.salon_name !== undefined) setVal('salon-name', originalData.salon_name);
        if(originalData.address !== undefined) setVal('address', originalData.address);
        if(originalData.phone !== undefined) setVal('phone', originalData.phone);
        if(originalData.description !== undefined) setVal('description', originalData.description);
        currentPhotos = originalData.photos || [];
        toggleEdit(false);
    };

    $('btn-save-profile')!.onclick = async (e) => {
        const btn = e.target as HTMLButtonElement;
        btn.disabled = true;
        try {
            await apiFetch('/me/profile', {
                method: 'PATCH',
                body: JSON.stringify({
                    salon_name: getVal('salon-name'),
                    address: getVal('address'),
                    phone: getVal('phone'),
                    description: getVal('description'),
                    photos: currentPhotos
                })
            });
            showToast('Профиль сохранен');
            toggleEdit(false);
        } catch { showToast('Ошибка сохранения', 'error'); }
        btn.disabled = false;
    };

    // Onboarding
    $('btn-finish-reg')!.onclick = async (e) => {
        const name = getVal('reg-name');
        const addr = getVal('reg-address');
        if(!name) return showToast('Введите название', 'error');
        const btn = e.target as HTMLButtonElement;
        btn.disabled = true;
        try {
            await apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify({ salon_name: name, address: addr }) });
            setVal('salon-name', name);
            setVal('address', addr);
            hide('onboarding-screen');
            showToast('Салон создан!');
        } catch { showToast('Ошибка', 'error'); }
        btn.disabled = false;
    }
}