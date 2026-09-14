import { clearSession, token } from './session.js';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message ?? 'No se pudo completar la solicitud.');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.error?.code ?? 'REQUEST_ERROR';
    this.details = payload?.error?.details ?? [];
  }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token()) headers.Authorization = `Bearer ${token()}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { error: { code: 'NETWORK_ERROR', message: 'No se pudo conectar con la API.' } });
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) clearSession();
    throw new ApiError(response.status, payload);
  }
  return payload;
}
