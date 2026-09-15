# Estrategia y checklist QA

## Estado verificado — 2026-09-14

La implementación funcional cuenta con pruebas automatizadas y smoke HTTP. La inspección visual e interacción real en navegador no pudo completarse en este entorno y permanece explícitamente pendiente.

## Evidencia automatizada

### Backend

- [x] Registro atómico de tenant y ADMIN.
- [x] Login válido e inválido; ruta sin token, token inválido/algoritmo no permitido y usuario inactivo.
- [x] CRUD lógico de clientes, empleados y servicios.
- [x] Asociaciones empleado-servicio y horarios semanales.
- [x] Disponibilidad, jornada, duración y servicio ofrecido.
- [x] Citas, notas, estados, cancelación y reprogramación.
- [x] Filtros combinados y dashboard.
- [x] RBAC positivo y negativo para ADMIN, RECEPTIONIST, PROFESSIONAL y CLIENT.
- [x] Tenant A no lee, modifica, desactiva ni relaciona clientes, empleados, servicios u horarios de B.
- [x] Tenant A no consulta disponibilidad, reserva ni muta citas de B.
- [x] Dashboard y agendas no mezclan tenants.
- [x] Diez escenarios obligatorios de solapamiento.

Resultado de `npm test`: **33/33 pruebas**, 6 suites, 0 fallos, 0 omitidas.

Resultado de `npm run test:coverage`: **96.91% líneas, 80.73% ramas, 97.26% funciones**.

Resultado de `npm run smoke`: **11 recorridos HTTP aprobados** sobre Express en puerto efímero y SQLite en memoria. Se ejecutó dos veces de forma independiente con el mismo resultado y sin archivos persistentes.

Resultado de `npm run db:init`: **aprobado**, con las 8 tablas de dominio disponibles.

### Frontend

- [x] Navegación y permisos visibles derivados por rol, sin tratarlos como frontera de seguridad.
- [x] Mapeo de citas a eventos FullCalendar.
- [x] Conversión de fechas local/UTC y validación de entrada inválida.
- [x] Formato de dinero almacenado en centavos.
- [x] Build de producción.
- [ ] Reversión drag/drop inspeccionada en navegador; el código invoca `info.revert()` al rechazo, pero no se presenta la revisión de código como QA visual.

Resultado de `npm test`: **4/4 pruebas**, 1 suite, 0 fallos.

Resultado de `npm run build`: **aprobado**, 39 módulos transformados.

Resultado de seguridad de dependencias: `npm audit` reportó **0 vulnerabilidades en backend** y **0 vulnerabilidades en frontend**.

## Matriz obligatoria de conflictos

| # | Existente | Nueva | Contexto | Esperado | Estado |
|---:|---|---|---|---|---|
| 1 | 10:00–11:00 | 10:00–11:00 | mismo tenant/profesional | rechazada | aprobado automático |
| 2 | 10:00–11:00 | 10:30–11:30 | mismo tenant/profesional | rechazada | aprobado automático |
| 3 | 10:00–11:00 | 09:30–10:30 | mismo tenant/profesional | rechazada | aprobado automático |
| 4 | 10:00–11:00 | 10:15–10:45 | mismo tenant/profesional | rechazada | aprobado automático |
| 5 | 10:00–11:00 | 09:00–12:00 | mismo tenant/profesional | rechazada | aprobado automático |
| 6 | 10:00–11:00 | 10:00–11:00 | profesional diferente | permitida | aprobado automático |
| 7 | 10:00–11:00 | 10:00–11:00 | tenant diferente | permitida | aprobado automático |
| 8 | CANCELLED 10:00–11:00 | 10:00–11:00 | mismo profesional | permitida | aprobado automático |
| 9 | cita a reprogramar | horario ocupado | excluye propia cita | rechazada | aprobado automático |
| 10 | cita a reprogramar | horario libre | excluye propia cita | permitida | aprobado automático |

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

Si no se dispone de navegador interactivo, todos los puntos anteriores permanecerán como `pendiente`; tests automatizados o un build correcto no se presentarán como sustituto de QA visual.

## Comandos de evidencia

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

Estos son los scripts reales de ambos `package.json`. El checklist manual permanece pendiente hasta una sesión con navegador interactivo; no se infieren aprobaciones visuales desde tests, build o lectura de código.
