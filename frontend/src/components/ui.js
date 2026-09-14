import Swal from 'sweetalert2';
import Toastify from 'toastify-js';
import { escapeHtml } from '../utils/format.js';

export function notify(message, type = 'success') {
  Toastify({
    text: message,
    duration: 3200,
    gravity: 'top',
    position: 'right',
    className: `toast-${type}`,
    stopOnFocus: true,
  }).showToast();
}

export async function confirmAction({ title, text, confirmText = 'Confirmar' }) {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Volver',
    focusCancel: true,
    confirmButtonColor: '#c2415d',
  });
  return result.isConfirmed;
}

export function loading(message = 'Cargando…') {
  return `<div class="state" role="status"><span class="spinner" aria-hidden="true"></span>${escapeHtml(message)}</div>`;
}

export function empty(message) {
  return `<div class="empty-state"><span aria-hidden="true">◇</span><p>${escapeHtml(message)}</p></div>`;
}

export function errorState(error) {
  return `<div class="error-state" role="alert"><strong>No se pudo cargar</strong><p>${escapeHtml(error.message)}</p></div>`;
}

export function fieldError(error) {
  return error.details?.map(({ field, message }) => `${field}: ${message}`).join(' · ') || error.message;
}
