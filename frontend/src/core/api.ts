import { Telegram } from './tg';

// Считываем переменную окружения, которую мы зададим в Render
const ENV_API_URL = import.meta.env.VITE_API_URL;

// Логика выбора базового URL:
// 1. Если есть VITE_API_URL (на проде), используем его. Удаляем слэш в конце, если он есть.
// 2. Если нет (локально), используем '/api', чтобы срабатывал прокси из vite.config.ts.
const BASE_URL = ENV_API_URL ? ENV_API_URL.replace(/\/$/, '') : '/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    // Передаем initData для валидации на бэкенде
    'X-Tg-Init-Data': Telegram.WebApp.initData,
    ...(options.headers || {}),
  };

  // endpoint должен начинаться с /, например /masters
  // Склеиваем базовый URL и путь
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Error ${response.status}`);
  }

  return response.json();
}