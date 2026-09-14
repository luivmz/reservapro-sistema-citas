const items = Object.freeze([
  { route: 'dashboard', label: 'Resumen', icon: '⌂', roles: ['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL'] },
  { route: 'calendar', label: 'Calendario', icon: '◫', roles: ['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'] },
  { route: 'appointments', label: 'Citas', icon: '◷', roles: ['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'] },
  { route: 'clients', label: 'Clientes', icon: '◎', roles: ['ADMIN', 'RECEPTIONIST'] },
  { route: 'employees', label: 'Profesionales', icon: '♙', roles: ['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'] },
  { route: 'services', label: 'Servicios', icon: '◇', roles: ['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'] },
  { route: 'schedules', label: 'Horarios', icon: '◴', roles: ['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL'] },
  { route: 'users', label: 'Usuarios', icon: '⊙', roles: ['ADMIN'] },
]);

export function navigationForRole(role) {
  return items.filter((item) => item.roles.includes(role));
}

export function canManage(role, resource) {
  if (role === 'ADMIN') return true;
  return role === 'RECEPTIONIST' && ['clients', 'appointments'].includes(resource);
}

export function defaultRoute(role) {
  return role === 'CLIENT' ? 'appointments' : 'dashboard';
}
