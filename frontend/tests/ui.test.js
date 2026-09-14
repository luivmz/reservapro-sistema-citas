import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { appointmentToEvent } from '../src/utils/calendar.js';
import { localInputToIso, money, toLocalInput } from '../src/utils/format.js';
import { canManage, defaultRoute, navigationForRole } from '../src/utils/permissions.js';

describe('lógica crítica frontend', () => {
  test('deriva navegación por rol sin conceder pantallas administrativas', () => {
    const admin = navigationForRole('ADMIN').map(({ route }) => route);
    const client = navigationForRole('CLIENT').map(({ route }) => route);
    const professional = navigationForRole('PROFESSIONAL').map(({ route }) => route);

    assert.ok(admin.includes('users'));
    assert.ok(!client.includes('users'));
    assert.ok(!client.includes('dashboard'));
    assert.ok(!professional.includes('clients'));
    assert.equal(defaultRoute('CLIENT'), 'appointments');
    assert.equal(canManage('RECEPTIONIST', 'clients'), true);
    assert.equal(canManage('RECEPTIONIST', 'employees'), false);
  });

  test('mapea una cita a evento FullCalendar con estado y datos originales', () => {
    const appointment = {
      id: 'appointment-id',
      clientName: 'Cliente Uno',
      serviceName: 'Consulta',
      startAt: '2030-01-07T15:00:00.000Z',
      endAt: '2030-01-07T16:00:00.000Z',
      status: 'NO_SHOW',
    };
    const event = appointmentToEvent(appointment);

    assert.equal(event.id, appointment.id);
    assert.equal(event.title, 'Cliente Uno · Consulta');
    assert.deepEqual(event.classNames, ['status-no-show']);
    assert.equal(event.extendedProps.appointment, appointment);
  });

  test('convierte datetime-local a instante y permite ida/vuelta local', () => {
    const local = '2030-01-07T10:30';
    const instant = localInputToIso(local);
    assert.match(instant, /^2030-01-07T[0-9]{2}:30:00[.]000Z$/);
    assert.equal(toLocalInput(instant), local);
    assert.equal(localInputToIso('fecha-inválida'), null);
  });

  test('formatea dinero almacenado en centavos', () => {
    const formatted = money(12550);
    assert.match(formatted, /125[.,]50/);
  });
});
