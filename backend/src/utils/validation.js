import validator from 'validator';
import { AppError } from '../errors/AppError.js';

export const ROLES = Object.freeze(['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT']);
export const APPOINTMENT_STATUSES = Object.freeze([
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

export function validationError(details) {
  throw new AppError(422, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', details);
}

export function requiredString(value, field, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string') validationError([{ field, message: 'Debe ser texto.' }]);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    validationError([{ field, message: `Debe tener entre ${min} y ${max} caracteres.` }]);
  }
  return normalized;
}

export function optionalString(value, field, { max = 255, emptyAsNull = false } = {}) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') validationError([{ field, message: 'Debe ser texto.' }]);
  const normalized = value.trim();
  if (normalized.length > max) validationError([{ field, message: `No puede exceder ${max} caracteres.` }]);
  return emptyAsNull && normalized === '' ? null : normalized;
}

export function email(value, field = 'email', { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const normalized = requiredString(value, field, { min: 3, max: 254 }).toLowerCase();
  if (!validator.isEmail(normalized)) validationError([{ field, message: 'Debe ser un email válido.' }]);
  return normalized;
}

export function password(value, field = 'password') {
  const normalized = requiredString(value, field, { min: 10, max: 128 });
  if (!/[a-z]/i.test(normalized) || !/\d/.test(normalized)) {
    validationError([{ field, message: 'Debe incluir al menos una letra y un número.' }]);
  }
  return normalized;
}

export function slug(value) {
  const normalized = requiredString(value, 'tenantSlug', { min: 3, max: 60 }).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    validationError([{ field: 'tenantSlug', message: 'Use minúsculas, números y guiones internos.' }]);
  }
  return normalized;
}

export function timezone(value = 'America/Lima') {
  const normalized = requiredString(value, 'timezone', { min: 3, max: 64 });
  try {
    new Intl.DateTimeFormat('es', { timeZone: normalized });
  } catch {
    validationError([{ field: 'timezone', message: 'Debe ser una zona horaria IANA válida.' }]);
  }
  return normalized;
}

export function role(value) {
  if (!ROLES.includes(value)) validationError([{ field: 'role', message: 'Rol no permitido.' }]);
  return value;
}

export function booleanValue(value, field, defaultValue = true) {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'boolean') validationError([{ field, message: 'Debe ser booleano.' }]);
  return value;
}

export function uuid(value, field = 'id') {
  const normalized = requiredString(value, field, { min: 36, max: 36 });
  if (!validator.isUUID(normalized, 4)) validationError([{ field, message: 'Debe ser un UUID v4 válido.' }]);
  return normalized;
}

export function integer(value, field, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    validationError([{ field, message: `Debe ser un entero entre ${min} y ${max}.` }]);
  }
  return value;
}

export function queryBoolean(value, field = 'active') {
  if (value === undefined) return null;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  validationError([{ field, message: 'Debe ser true o false.' }]);
}

export function uuidArray(value, field) {
  if (!Array.isArray(value)) validationError([{ field, message: 'Debe ser un arreglo.' }]);
  return [...new Set(value.map((item) => uuid(item, field)))];
}

export function weekday(value) {
  return integer(value, 'dayOfWeek', { min: 1, max: 7 });
}

export function localTime(value, field) {
  const normalized = requiredString(value, field, { min: 5, max: 5 });
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(normalized)) {
    validationError([{ field, message: 'Debe tener formato HH:mm de 00:00 a 23:59.' }]);
  }
  return normalized;
}

export function pagination(query) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  if (!Number.isInteger(page) || page < 1) validationError([{ field: 'page', message: 'Debe ser un entero positivo.' }]);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    validationError([{ field: 'limit', message: 'Debe estar entre 1 y 100.' }]);
  }
  return { page, limit, offset: (page - 1) * limit };
}
