import { $, setText } from '../core/dom';

export function showToast(message: string, type: 'success' | 'error' = 'success') {
    const toast = $('global-toast');
    if (!toast) return;

    const icon = $('toast-icon', toast);
    const msg = $('toast-message', toast);

    if (msg) setText('toast-message', message);
    if (icon) {
        // Убираем старые классы цвета, добавляем новые
        icon.classList.remove('text-success', 'text-error');
        icon.classList.add(type === 'success' ? 'text-success' : 'text-error');
        icon.textContent = type === 'success' ? 'check_circle' : 'error';
    }

    toast.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');

    // Сброс таймера если тост вызван повторно быстро (упрощенно)
    const newTimer = setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
    }, 3000);
    (toast as any)._timer = newTimer;
}