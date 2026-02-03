import { $, setText, show, hide, toggle } from '../../core/dom';
import { apiFetch } from '../../core/api';
import { renderCarousel } from '../../ui/carousel';
import { Service, MasterProfile } from '../../types';

export async function loadMasterInfo(masterId: string) {
    try {
        const data = await apiFetch<MasterProfile>(`/masters/${masterId}`);

        setText('hero-title', data.salon_name || 'Мастер');

        if (data.phone) {
            const phoneLink = $('hero-phone') as HTMLAnchorElement;
            if (phoneLink) {
                show(phoneLink);
                phoneLink.href = `tel:${data.phone}`;
                phoneLink.classList.add('flex'); // Восстанавливаем flex, так как show просто убирает hidden
                setText('hero-phone-text', data.phone);
            }
        }

        const descEl = $('hero-desc');
        if (descEl) {
            setText('hero-desc', data.description || 'Нет описания');
            // Простая логика "Читать полностью"
            if (descEl.scrollHeight > descEl.clientHeight) {
                show('btn-expand-desc');
                $('btn-expand-desc')!.onclick = function() {
                    descEl.classList.remove('desc-clamp');
                    descEl.classList.add('desc-expanded');
                    hide(this as HTMLElement);
                };
            }
        }

        // Используем наш общий UI компонент
        let photos = data.photos || [];
        if (photos.length === 0 && data.avatar_url) photos = [data.avatar_url];

        renderCarousel('client-carousel-track', 'client-carousel-indicators', photos);

        if (data.timezone) checkOpenStatus(data.timezone);

        return data; // Возвращаем для использования timezone в других модулях
    } catch (e) {
        setText('hero-title', 'Мастер не найден');
        setText('hero-status', 'Ошибка');
        console.error(e);
        return null;
    }
}

function checkOpenStatus(timezone: string) {
    try {
        const now = new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour12: false });
        const [h, m] = now.split(':').map(Number);
        const currentMinutes = h * 60 + m;
        const start = 9 * 60;
        const end = 21 * 60;

        const statusEl = $('hero-status');
        const dotEl = $('status-dot');
        const textDotEl = $('status-text-dot');

        if (currentMinutes >= start && currentMinutes < end) {
            if(statusEl) { statusEl.textContent = "Открыто сейчас"; statusEl.className = "text-[#31b545] text-xs font-bold uppercase tracking-wider"; }
            if(dotEl) dotEl.className = "absolute bottom-1 right-1 w-5 h-5 bg-[#31b545] border-4 border-bg rounded-full z-20";
            if(textDotEl) textDotEl.className = "text-[#31b545] text-[10px]";
        } else {
            if(statusEl) { statusEl.textContent = "Закрыто"; statusEl.className = "text-gray-400 text-xs font-bold uppercase tracking-wider"; }
            if(dotEl) dotEl.className = "absolute bottom-1 right-1 w-5 h-5 bg-gray-500 border-4 border-bg rounded-full z-20";
            if(textDotEl) textDotEl.className = "text-gray-500 text-[10px]";
        }
    } catch (e) { console.error(e); }
}

export async function loadServices(masterId: string, onSelect: (s: Service) => void) {
    const list = $('services-list');
    if (!list) return;

    try {
        const services = await apiFetch<Service[]>(`/masters/${masterId}/services`);
        list.innerHTML = '';

        if (services.length === 0) {
            list.innerHTML = '<div class="text-center text-secondary py-4">Нет услуг</div>';
            return;
        }

        services.forEach(srv => {
            // Создаем карточку через DOM API (безопаснее innerHTML)
            const card = document.createElement('div');
            card.className = 'w-full bg-surface border border-border rounded-xl overflow-hidden shadow-sm transition-all mb-3';

            const header = document.createElement('div');
            header.className = 'p-4 flex justify-between items-center cursor-pointer active:bg-bg/50 transition-colors min-h-[72px]';

            header.innerHTML = `
                <div class="flex flex-col gap-1 flex-1 min-w-0 pr-4">
                    <span class="text-white font-bold text-base leading-tight">${srv.name}</span>
                    <span class="text-secondary text-xs">${srv.duration_min} мин</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-primary font-bold text-base whitespace-nowrap">${srv.price} ₸</span>
                    <span class="material-symbols-rounded text-secondary/50 text-xl transition-transform duration-300 chevron">expand_more</span>
                </div>
            `;

            const body = document.createElement('div');
            body.className = 'hidden px-4 pb-4 pt-0 border-t border-border/30 bg-bg/20';

            const descP = document.createElement('p');
            descP.className = 'text-sm text-secondary py-3 leading-relaxed';
            descP.textContent = srv.description || '';
            if (!srv.description) descP.className = 'h-2'; // spacer

            const btn = document.createElement('button');
            btn.className = 'w-full bg-primary text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-all shadow-lg shadow-primary/20 mt-2';
            btn.textContent = 'Записаться';
            btn.onclick = (e) => {
                e.stopPropagation();
                onSelect(srv);
            };

            body.appendChild(descP);
            body.appendChild(btn);

            // Accordion logic
            const chevron = header.querySelector('.chevron') as HTMLElement;
            header.onclick = () => {
                const isHidden = body.classList.toggle('hidden');
                if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
            };

            card.appendChild(header);
            card.appendChild(body);
            list.appendChild(card);
        });
    } catch (e) {
        list.innerHTML = '<div class="text-center text-error">Ошибка загрузки</div>';
    }
}