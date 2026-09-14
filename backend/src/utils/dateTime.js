import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { validationError } from './validation.js';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export { dayjs };

export function isoInstant(value, field = 'startAt') {
  if (typeof value !== 'string' || !/(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(value)) {
    validationError([{ field, message: 'Debe ser ISO 8601 e incluir Z u offset explícito.' }]);
  }
  const parsed = dayjs(value);
  if (!parsed.isValid()) validationError([{ field, message: 'Debe ser una fecha válida.' }]);
  return parsed.utc().toISOString();
}

export function dateOnly(value, field = 'date') {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    validationError([{ field, message: 'Debe tener formato YYYY-MM-DD.' }]);
  }
  const parsed = dayjs(value, 'YYYY-MM-DD', true);
  if (!parsed.isValid()) validationError([{ field, message: 'Debe ser una fecha válida.' }]);
  return value;
}

export function localDateTime(date, time, timezone) {
  return dayjs.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', timezone);
}

export function localDate(instant, timezone) {
  return dayjs.utc(instant).tz(timezone).format('YYYY-MM-DD');
}

export function isoWeekday(date, timezone) {
  const day = dayjs.tz(`${date} 12:00`, 'YYYY-MM-DD HH:mm', timezone).day();
  return day === 0 ? 7 : day;
}
