import { $, setText, show, hide } from '../../core/dom';
import { apiFetch } from '../../core/api';

export async function loadAnalytics() {
    const content = $('analytics-content');
    const lock = $('analytics-lock');
    if (!content || !lock) return;

    try {
        const data = await apiFetch<any>('/me/analytics/dashboard');

        if (!data.is_premium) {
            show(lock);
            hide(content);
            return;
        }

        hide(lock);
        show(content);
        content.classList.add('flex'); // Восстанавливаем flex

        // 1. KPI
        setText('an-revenue', `${data.kpi.revenue.toLocaleString()} ₸`);
        setText('an-avg', `${data.kpi.avg_check.toLocaleString()} ₸`);

        // 2. Топ услуг
        const topContainer = $('an-top-services');
        if (topContainer) {
            topContainer.innerHTML = '';
            const max = Math.max(...data.top_services.map((s:any) => s.count)) || 1;

            if (data.top_services.length === 0) {
                 topContainer.innerHTML = '<p class="text-xs text-text-secondary text-center">Нет данных</p>';
            }

            data.top_services.forEach((s: any) => {
                const percent = (s.count / max) * 100;
                topContainer.innerHTML += `
                    <div class="flex flex-col gap-1.5">
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-white font-medium truncate pr-4">${s.name}</span>
                            <span class="text-text-secondary font-bold">${s.count} зап.</span>
                        </div>
                        <div class="w-full bg-background-dark h-2 rounded-full overflow-hidden">
                            <div class="h-full bg-primary transition-all duration-1000 ease-out" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            });
        }

        // 3. Bar Chart (Динамика)
        const barsContainer = $('an-chart-bars');
        const labelsContainer = $('an-chart-labels');
        if (barsContainer && labelsContainer) {
            barsContainer.innerHTML = '';
            labelsContainer.innerHTML = '';

            const maxVal = Math.max(...data.daily_dynamics.map((d:any) => d.value)) || 5; // Минимум 5 для масштаба

            data.daily_dynamics.forEach((day: any) => {
                const height = (day.value / maxVal) * 100;
                const color = day.is_today ? 'bg-primary' : 'bg-primary/40';

                // Столбик
                barsContainer.innerHTML += `
                    <div class="w-full bg-background-dark/30 rounded-t-lg relative group flex items-end justify-center h-full">
                         <div class="${color} w-full mx-1 rounded-t-md transition-all duration-700 ease-out relative group-hover:brightness-110" style="height: ${height || 5}%">
                            <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-dark border border-border-dark px-2 py-1 rounded text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-xl">
                                ${day.value} зап.
                            </div>
                         </div>
                    </div>
                `;
                // Подпись
                labelsContainer.innerHTML += `
                    <span class="text-[9px] text-text-secondary font-bold uppercase w-full text-center truncate">${day.day.split(' ')[0]}</span>
                `;
            });
        }

        // 4. Pie Chart (Круговая)
        const s = data.status_distribution;
        const total = s.completed + s.cancelled + s.pending;
        setText('an-total-count', total.toString());

        if (total > 0) {
            // Считаем градусы для conic-gradient
            const degCompleted = (s.completed / total) * 360;
            const degPending = (s.pending / total) * 360;
            const degCancelled = (s.cancelled / total) * 360;

            // Формируем градиент:
            // Зеленый (0 -> A), Синий (A -> A+B), Красный (A+B -> 360)
            const p1 = degCompleted;
            const p2 = degCompleted + degPending;

            const pie = document.getElementById('an-pie');
            if (pie) {
                pie.style.background = `conic-gradient(
                    var(--c-success) 0deg ${p1}deg,
                    var(--c-primary) ${p1}deg ${p2}deg,
                    var(--c-error) ${p2}deg 360deg
                )`;
            }

            // Легенда
            const legend = $('an-pie-legend');
            if (legend) {
                legend.innerHTML = `
                    ${createLegendItem('Завершено', s.completed, total, 'bg-success')}
                    ${createLegendItem('В ожидании', s.pending, total, 'bg-primary')}
                    ${createLegendItem('Отменено', s.cancelled, total, 'bg-error')}
                `;
            }
        }

        // 5. Совет
        const advice = data.top_services.length > 0
            ? `Услуга "${data.top_services[0].name}" в топе! Попробуйте создать пакетное предложение с ней.`
            : 'Заполните график и добавьте услуги, чтобы начать работу.';
        setText('an-advice', advice);

    } catch (e) { console.error(e); }
}

function createLegendItem(label: string, val: number, total: number, bgClass: string) {
    if (val === 0) return '';
    const percent = Math.round((val / total) * 100);
    return `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full ${bgClass}"></div>
                <span class="text-xs text-text-secondary font-medium">${label}</span>
            </div>
            <span class="text-xs font-bold text-white">${val} (${percent}%)</span>
        </div>
    `;
}