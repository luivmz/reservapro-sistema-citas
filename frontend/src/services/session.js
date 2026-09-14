const KEY = 'reservapro.session';

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('reservapro:session'));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent('reservapro:session'));
}

export function token() {
  return getSession()?.token ?? null;
}
