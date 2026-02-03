import { $ } from '../../core/dom';
import { apiFetch } from '../../core/api';
import { showToast } from '../../ui/toast'; // FIX: Правильный путь
import { WorkingHour } from '../../types';

export async function loadSchedule() {
    const container = $('schedule-container');
    if (!container) return;
    container.innerHTML = '';
    try {
        const hours = await apiFetch<WorkingHour[]>('/me/working-hours');
        const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

        days.forEach((dayName, idx) => {
            const dayNum = idx + 1;
            const data = hours.find(h => h.day_of_week === dayNum);
            const isActive = !!data;

            const row = document.createElement('div');
            row.className = `group flex items-center gap-3 bg-background-dark px-4 py-4 min-h-[64px] hover:bg-surface-dark transition-colors border-b border-border-dark/30 last:border-0 ${!isActive ? 'opacity-50' : ''}`;
            row.innerHTML = `
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="flex size-6 items-center justify-center shrink-0">
                        <input type="checkbox" data-day="${dayNum}" ${isActive ? 'checked' : ''} class="h-5 w-5 rounded border-border-dark border-2 bg-transparent text-primary checked:bg-primary focus:ring-0 cursor-pointer transition-all">
                    </div>
                    <p class="label text-white text-base font-medium truncate transition-all ${!isActive ? 'line-through decoration-text-secondary text-text-secondary' : ''}">${dayName}</p>
                </div>
                <div class="settings flex items-center gap-2 shrink-0 transition-all ${!isActive ? 'pointer-events-none grayscale opacity-50' : ''}">
                    <input type="time" class="time-start bg-surface-dark border border-border-dark/50 text-white text-sm font-semibold px-2 py-1.5 rounded-lg w-[76px] text-center focus:ring-1 focus:ring-primary outline-none" value="${data?.start_time?.slice(0,5) || '09:00'}">
                    <span class="text-text-secondary font-medium">-</span>
                    <input type="time" class="time-end bg-surface-dark border border-border-dark/50 text-white text-sm font-semibold px-2 py-1.5 rounded-lg w-[76px] text-center focus:ring-1 focus:ring-primary outline-none" value="${data?.end_time?.slice(0,5) || '18:00'}">
                </div>
            `;

            const cb = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
            cb.onchange = () => {
                const settings = row.querySelector('.settings')!;
                const label = row.querySelector('.label')!;
                if (cb.checked) {
                    row.classList.remove('opacity-50');
                    settings.classList.remove('pointer-events-none', 'grayscale', 'opacity-50');
                    label.classList.remove('line-through', 'decoration-text-secondary', 'text-text-secondary');
                } else {
                    row.classList.add('opacity-50');
                    settings.classList.add('pointer-events-none', 'grayscale', 'opacity-50');
                    label.classList.add('line-through', 'decoration-text-secondary', 'text-text-secondary');
                }
            };
            container.appendChild(row);
        });
    } catch (e) { console.error(e); }
}

export function initScheduleHandlers() {
    const btn = $('btn-save-schedule');
    if (btn) {
        btn.onclick = async (e) => {
            const button = e.target as HTMLButtonElement;
            button.disabled = true;
            const payload: any[] = [];
            const rows = document.querySelectorAll('#schedule-container .group');

            rows.forEach(row => {
                const cb = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
                if (cb.checked) {
                    const start = (row.querySelector('.time-start') as HTMLInputElement).value;
                    const end = (row.querySelector('.time-end') as HTMLInputElement).value;
                    payload.push({
                        day_of_week: parseInt(cb.dataset.day!),
                        start_time: start,
                        end_time: end,
                        slot_minutes: 30
                    });
                }
            });

            try {
                await apiFetch('/me/working-hours', { method: 'POST', body: JSON.stringify(payload) });
                showToast('График сохранен');
            } catch { showToast('Ошибка сохранения', 'error'); }
            button.disabled = false;
        };
    }
}