export function showToast(msg: string) {
    // В Telegram WebApp лучше использовать нативный showAlert
    // Но если нужно кастомное:
    alert(msg);
}