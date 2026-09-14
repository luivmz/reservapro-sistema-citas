# Estrategia y checklist QA

## Estado inicial

La implementación todavía no ha comenzado. Ningún ítem funcional o visual se considera aprobado en este documento hasta contar con evidencia.

## Automatización prevista

### Backend

- [ ] Registro válido de tenant y ADMIN.
- [ ] Login válido e inválido.
- [ ] Ruta sin token, token inválido/expirado y usuario inactivo.
- [ ] CRUD de clientes, empleados y servicios.
- [ ] Asociaciones y horarios.
- [ ] Reglas de disponibilidad.
- [ ] Citas, estados, cancelación y reprogramación.
- [ ] Filtros combinados y dashboard.
- [ ] RBAC positivo y negativo por rol.
- [ ] Tenant A no lee, modifica, desactiva ni relaciona recursos de Tenant B.
- [ ] Dashboard y agenda no mezclan tenants.
- [ ] Diez escenarios obligatorios de solapamiento.

### Frontend

- [ ] Sesión y cliente API.
- [ ] Guards/navegación por rol (sin considerarlos frontera de seguridad).
- [ ] Mapeo de citas a eventos FullCalendar.
- [ ] Formateo/validación de datos críticos.
- [ ] Reversión del evento cuando backend rechaza reprogramación.
- [ ] Build de producción.

## Matriz obligatoria de conflictos

| # | Existente | Nueva | Contexto | Esperado | Estado |
|---:|---|---|---|---|---|
| 1 | 10:00–11:00 | 10:00–11:00 | mismo tenant/profesional | rechazada | pendiente |
| 2 | 10:00–11:00 | 10:30–11:30 | mismo tenant/profesional | rechazada | pendiente |
| 3 | 10:00–11:00 | 09:30–10:30 | mismo tenant/profesional | rechazada | pendiente |
| 4 | 10:00–11:00 | 10:15–10:45 | mismo tenant/profesional | rechazada | pendiente |
| 5 | 10:00–11:00 | 09:00–12:00 | mismo tenant/profesional | rechazada | pendiente |
| 6 | 10:00–11:00 | 10:00–11:00 | profesional diferente | permitida | pendiente |
| 7 | 10:00–11:00 | 10:00–11:00 | tenant diferente | permitida | pendiente |
| 8 | CANCELLED 10:00–11:00 | 10:00–11:00 | mismo profesional | permitida | pendiente |
| 9 | cita a reprogramar | horario ocupado | excluye propia cita | rechazada | pendiente |
| 10 | cita a reprogramar | horario libre | excluye propia cita | permitida | pendiente |

## Checklist manual funcional y visual

Estado permitido: `pendiente`, `aprobado`, `fallido`, `no aplica`.

| Área | Verificación | Estado | Evidencia/notas |
|---|---|---|---|
| Auth | registro de organización | pendiente | |
| Auth | login y mensajes de error | pendiente | |
| Auth | logout y retorno a login | pendiente | |
| Roles | navegación ADMIN | pendiente | |
| Roles | navegación RECEPTIONIST | pendiente | |
| Roles | mi agenda PROFESSIONAL | pendiente | |
| Roles | mis citas CLIENT | pendiente | |
| Clientes | crear, editar, buscar y desactivar | pendiente | |
| Empleados | crear, editar, asociar servicios y desactivar | pendiente | |
| Servicios | crear, editar, validar precio/duración y desactivar | pendiente | |
| Horarios | crear, editar, eliminar y validar cruces | pendiente | |
| Citas | crear en slot libre | pendiente | |
| Citas | rechazo fuera de jornada/conflicto | pendiente | |
| Citas | reprogramar libre y rechazar ocupado | pendiente | |
| Citas | cancelar con confirmación SweetAlert2 | pendiente | |
| Citas | transiciones de estado | pendiente | |
| Filtros | cliente, empleado, servicio, fechas y estado combinados | pendiente | |
| Calendario | vista diaria | pendiente | |
| Calendario | vista semanal | pendiente | |
| Calendario | vista mensual | pendiente | |
| Calendario | detalle/edición y reversión de drag/drop rechazado | pendiente | |
| Dashboard | tarjetas y rankings correctos | pendiente | |
| Estados UI | loading | pendiente | |
| Estados UI | vacío | pendiente | |
| Estados UI | error y recuperación | pendiente | |
| Responsive | 360 px sin overflow bloqueante | pendiente | |
| Responsive | escritorio | pendiente | |
| Accesibilidad | labels y nombres accesibles | pendiente | |
| Accesibilidad | recorrido por teclado | pendiente | |
| Accesibilidad | foco visible | pendiente | |
| Feedback | confirmaciones importantes | pendiente | |
| Feedback | toasts de éxito/error | pendiente | |

Si no se dispone de navegador interactivo, todos los puntos anteriores permanecerán como `pendiente`; tests jsdom o un build correcto no se presentarán como sustituto de QA visual.

## Comandos de evidencia previstos

```bash
cd backend
npm run db:init
npm test
npm run test:coverage
npm run smoke
npm audit

cd ../frontend
npm test
npm run build
npm audit
```

Los scripts exactos se confirmarán después del setup y este bloque se corregirá si cambia alguno.
