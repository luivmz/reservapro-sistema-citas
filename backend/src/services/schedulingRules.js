import { AppError } from '../errors/AppError.js';
import { dayjs, isoWeekday, localDate, localDateTime } from '../utils/dateTime.js';

export const BLOCKING_STATUSES = Object.freeze(['SCHEDULED', 'CONFIRMED']);

export function appointmentEnd(startAt, durationMinutes) {
  return dayjs.utc(startAt).add(durationMinutes, 'minute').toISOString();
}

export function scheduleWindows({ schedules, date, timezone }) {
  const weekday = isoWeekday(date, timezone);
  return schedules
    .filter((schedule) => schedule.dayOfWeek === weekday)
    .map((schedule) => ({
      start: localDateTime(date, schedule.startTime, timezone),
      end: localDateTime(date, schedule.endTime, timezone),
    }));
}

export function isWithinSchedule({ schedules, startAt, endAt, timezone }) {
  const date = localDate(startAt, timezone);
  if (localDate(endAt, timezone) !== date) return false;
  const start = dayjs.utc(startAt);
  const end = dayjs.utc(endAt);
  return scheduleWindows({ schedules, date, timezone })
    .some((window) => !start.isBefore(window.start) && !end.isAfter(window.end));
}

export function assertWithinSchedule(options) {
  if (!isWithinSchedule(options)) {
    throw new AppError(422, 'OUTSIDE_WORKING_HOURS', 'La cita debe quedar completamente dentro del horario laboral.');
  }
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}
