import { $ } from '../core/dom';
import { BASE_URL } from '../core/api';
import { Telegram } from '../core/tg';

// ... остальной код без изменений ...

export function renderCarousel(
    trackId: string,
    indicatorsId: string,
    photos: string[],
    isEditMode = false,
    onAddClick?: () => void,
    onRemoveClick?: (index: number) => void
) {
    const track = $(trackId);
    const indicators = $(indicatorsId);
    if (!track) return;

    track.innerHTML = '';

    // Render photos
    photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = 'flex-shrink-0 w-full h-full snap-center relative group';
        slide.innerHTML = `
            <img src="${photo}" alt="Photo ${index + 1}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
        `;

        if (isEditMode && onRemoveClick) {
            const delBtn = document.createElement('button');
            delBtn.className = 'absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white backdrop-blur-sm hover:bg-red-500/80 transition-all';
            delBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
            delBtn.onclick = (e) => { e.stopPropagation(); onRemoveClick(index); };
            slide.appendChild(delBtn);
        }
        track.appendChild(slide);
    });

    // Render "Add" slide if editing
    if (isEditMode && photos.length < 5 && onAddClick) {
        const addSlide = document.createElement('div');
        addSlide.className = 'flex-shrink-0 w-full h-full snap-center bg-surface-dark flex items-center justify-center cursor-pointer hover:brightness-110 transition-colors border-2 border-dashed border-primary/30';
        addSlide.onclick = onAddClick;
        addSlide.innerHTML = `
            <div class="flex flex-col items-center gap-2 text-primary">
                <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                <span class="text-sm font-medium">Добавить</span>
            </div>
        `;
        track.appendChild(addSlide);
    } else if (photos.length === 0) {
        track.innerHTML = `
            <div class="flex-shrink-0 w-full h-full snap-center bg-surface-dark flex flex-col items-center justify-center text-text-secondary/50">
                <span class="material-symbols-outlined text-4xl mb-2 opacity-50">image_not_supported</span>
                <span class="text-xs">Нет фотографий</span>
            </div>`;
    }

    renderIndicators(indicators, photos.length + (isEditMode && photos.length < 5 ? 1 : 0), 0);

    // Add scroll listener
    track.onscroll = () => {
        const index = Math.round(track.scrollLeft / track.clientWidth);
        renderIndicators(indicators, indicators?.children.length || 0, index);
    }
}

function renderIndicators(container: HTMLElement | null, count: number, activeIndex: number) {
    if (!container) return;
    container.innerHTML = '';
    if (count <= 1) return;

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        const isActive = i === activeIndex;
        dot.className = `h-1.5 rounded-full transition-all duration-300 ${isActive ? 'bg-primary w-3' : 'bg-text-secondary/30 w-1.5'}`;
        container.appendChild(dot);
    }
}

export async function uploadPhoto(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    // Используем fetch напрямую для FormData
    const response = await fetch(`${BASE_URL}/me/upload-photo`, {
        method: 'POST',
        headers: { 'X-Tg-Init-Data': Telegram.WebApp.initData || '' },
        body: formData
    });
    if (!response.ok) throw new Error('Upload failed');
    const res = await response.json();
    return res.url;
}