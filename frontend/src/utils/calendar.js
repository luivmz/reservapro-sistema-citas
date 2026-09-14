export function appointmentToEvent(appointment) {
  return {
    id: appointment.id,
    title: `${appointment.clientName} · ${appointment.serviceName}`,
    start: appointment.startAt,
    end: appointment.endAt,
    classNames: [`status-${appointment.status.toLowerCase().replace('_', '-')}`],
    extendedProps: { appointment },
  };
}
