import { Telegram } from './tg';

// Теперь мы используем относительный путь.
// Запрос пойдет на тот же домен, где открыт сайт, но с префиксом /api
const API_PREFIX = '/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Tg-Init-Data': Telegram.WebApp.initData,
    ...(options.headers || {}),
  };

  // endpoint должен начинаться с /, например /masters
  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Error ${response.status}`);
  }

  return response.json();
}