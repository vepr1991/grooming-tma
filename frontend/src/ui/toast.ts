import { $ } from '../core/dom';

let toastTimeout: any;

export function showToast(msg: string, type: 'success' | 'error' = 'success') {
    const el = $('toast');
    const txt = $('toast-msg');

    // Пытаемся найти иконку внутри тоста
    const icon = el?.querySelector('.material-symbols-rounded');

    if (!el || !txt) {
        console.warn('Toast element not found in DOM');
        return;
    }

    // Сбрасываем таймер скрытия, если тост уже показан
    if (toastTimeout) clearTimeout(toastTimeout);

    // Устанавливаем текст
    txt.textContent = msg;

    // Сбрасываем классы скрытия (показываем элемент)
    el.classList.remove('hidden', 'opacity-0', 'translate-y-[-20px]');

    // Сбрасываем цвета
    el.classList.remove('border-primary', 'border-error');
    if (icon) icon.classList.remove('text-primary', 'text-error');

    // Применяем стили в зависимости от типа
    if (type === 'error') {
        el.classList.add('border-error');
        if (icon) {
            icon.textContent = 'error'; // Иконка восклицательного знака
            icon.classList.add('text-error');
        }
    } else {
        el.classList.add('border-primary');
        if (icon) {
            icon.textContent = 'check_circle'; // Иконка галочки
            icon.classList.add('text-primary');
        }
    }

    // Запускаем таймер на скрытие через 3 секунды
    toastTimeout = setTimeout(() => {
        // Добавляем классы для анимации исчезновения
        el.classList.add('opacity-0', 'translate-y-[-20px]');

        // Полностью скрываем (display: none) после завершения CSS анимации (300мс)
        setTimeout(() => {
            el.classList.add('hidden');
        }, 300);
    }, 3000);
}