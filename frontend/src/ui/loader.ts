export function showLoader() {
    // Простая реализация
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.style.position = 'fixed';
    loader.style.top = '0';
    loader.style.left = '0';
    loader.style.width = '100%';
    loader.style.height = '100%';
    loader.style.background = 'rgba(255,255,255,0.8)';
    loader.style.display = 'flex';
    loader.style.justifyContent = 'center';
    loader.style.alignItems = 'center';
    loader.innerHTML = '<span>Loading...</span>';
    document.body.appendChild(loader);
}

export function hideLoader() {
    const el = document.getElementById('global-loader');
    if (el) el.remove();
}