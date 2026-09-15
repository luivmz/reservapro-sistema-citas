# Contrato API REST

Contrato contrastado con las rutas, servicios y pruebas de integración actuales.

## Convenciones

- Base local: `http://localhost:3000/api`.
- JSON UTF-8; nombres camelCase.
- Autorización: `Authorization: Bearer <JWT>` salvo endpoints públicos.
- El tenant nunca se toma de query/body/header del cliente.
- Colecciones: `page` (1), `limit` (20, máximo 100).
- Error uniforme: `{ "error": { "code", "message", "details" } }`.

## Endpoints públicos

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/health` | salud del proceso/base |
| POST | `/api/auth/register` | crear tenant y ADMIN inicial |
| POST | `/api/auth/login` | autenticar por `tenantSlug`, email y contraseña |

## Endpoints autenticados

| Método | Ruta | Roles / alcance |
|---|---|---|
| GET | `/api/auth/me` | todos, identidad propia |
| GET/POST | `/api/users` | ADMIN |
| GET/PUT/DELETE | `/api/users/:id` | ADMIN, tenant |
| GET/POST | `/api/clients` | ADMIN, RECEPTIONIST |
| GET | `/api/clients/:id` | ADMIN, RECEPTIONIST; CLIENT solo perfil propio |
| PUT/DELETE | `/api/clients/:id` | ADMIN, RECEPTIONIST |
| GET | `/api/employees` | todos; alcance contextual para PROFESSIONAL |
| POST | `/api/employees` | ADMIN |
| GET | `/api/employees/:id` | todos; alcance contextual según rol |
| PUT/DELETE | `/api/employees/:id` | ADMIN |
| GET/PUT | `/api/employees/:id/services` | GET permitido por alcance; PUT ADMIN |
| GET/POST | `/api/employees/:id/schedules` | GET por alcance; POST ADMIN |
| PUT/DELETE | `/api/employees/:id/schedules/:scheduleId` | ADMIN |
| GET | `/api/services` | todos; activos/asignados según rol |
| POST | `/api/services` | ADMIN |
| GET | `/api/services/:id` | todos; alcance contextual según rol |
| PUT/DELETE | `/api/services/:id` | ADMIN |
| GET | `/api/availability` | todos autenticados con catálogo permitido |
| GET | `/api/appointments` | todos; tenant o perfil propio según rol |
| POST | `/api/appointments` | ADMIN, RECEPTIONIST, CLIENT propio |
| GET | `/api/appointments/:id` | todos; alcance contextual |
| PUT | `/api/appointments/:id` | ADMIN, RECEPTIONIST; edición de notas |
| PATCH | `/api/appointments/:id/reschedule` | ADMIN, RECEPTIONIST, CLIENT propio |
| PATCH | `/api/appointments/:id/cancel` | ADMIN, RECEPTIONIST, CLIENT propio |
| PATCH | `/api/appointments/:id/status` | ADMIN, RECEPTIONIST, PROFESSIONAL propio |
| GET | `/api/dashboard` | ADMIN, RECEPTIONIST, PROFESSIONAL propio |

## Payloads clave

### Registro

```json
{
  "organizationName": "Clínica Demo",
  "tenantSlug": "clinica-demo",
  "timezone": "America/Lima",
  "adminName": "Administrador",
  "email": "admin@example.com",
  "password": "una-clave-larga"
}
```

### Login

```json
{
  "tenantSlug": "clinica-demo",
  "email": "admin@example.com",
  "password": "una-clave-larga"
}
```

### Disponibilidad

`GET /api/availability?employeeId=<uuid>&serviceId=<uuid>&date=2026-09-14`

```json
{
  "data": {
    "date": "2026-09-14",
    "timezone": "America/Lima",
    "durationMinutes": 60,
    "slots": [
      { "startAt": "2026-09-14T14:00:00.000Z", "endAt": "2026-09-14T15:00:00.000Z" }
    ]
  }
}
```

### Crear cita

```json
{
  "clientId": "uuid",
  "employeeId": "uuid",
  "serviceId": "uuid",
  "startAt": "2026-09-14T10:00:00-05:00",
  "notes": "Primera consulta"
}
```

`endAt`, `tenantId`, `status` y `createdBy` no son controlables en este flujo.

### Reprogramar

```json
{ "startAt": "2026-09-15T11:00:00-05:00" }
```

### Cambiar estado

```json
{ "status": "CONFIRMED" }
```

Las transiciones válidas son `SCHEDULED → CONFIRMED|CANCELLED` y `CONFIRMED → COMPLETED|NO_SHOW|CANCELLED`. No existe eliminación física pública de citas.

## Campos de recursos operativos

| Operación | Campos aceptados |
|---|---|
| Crear usuario | `name`, `email`, `password`, `role`, `active?` |
| Crear cliente | `name`, `email?`, `phone?`, `notes?`, `userId?`, `active?` |
| Crear empleado | `name`, `email?`, `phone?`, `userId?`, `active?` |
| Crear servicio | `name`, `description?`, `durationMinutes`, `priceCents`, `active?` |
| Crear horario | `dayOfWeek` (1=lunes…7=domingo), `startTime`, `endTime` |

`PUT /api/employees/:id/services` reemplaza la asociación completa y recibe `serviceIds` como arreglo de UUID. Todos los IDs deben pertenecer al tenant autenticado. Los `PUT` de recursos aceptan cambios parciales de sus campos editables; las bajas responden `204` y cambian `active` a falso.

## Filtros de colecciones

- Usuarios: `search`, `role`, `active`, `page`, `limit`.
- Clientes, empleados y servicios: `search`, `active`, `page`, `limit`.
- Citas: `clientId`, `employeeId`, `serviceId`, `status`, `from`, `to`, `page`, `limit`.
- Disponibilidad: requiere `employeeId`, `serviceId` y `date=YYYY-MM-DD`.

Los filtros se combinan y nunca amplían el tenant derivado del JWT. `page` inicia en 1 y `limit` acepta de 1 a 100. Los elementos usan un objeto `data`; las colecciones agregan `meta` con `page`, `limit` y `total`.

## Códigos HTTP

| Código | Uso |
|---:|---|
| 200 | consulta/actualización correcta |
| 201 | recurso creado |
| 204 | baja lógica sin cuerpo cuando corresponda |
| 400 | sintaxis, query o JSON inválido |
| 401 | identidad ausente o inválida |
| 403 | rol/alcance denegado |
| 404 | recurso no encontrado dentro del tenant/contexto |
| 409 | unicidad, asociación o conflicto de horario |
| 422 | regla semántica no satisfecha |
| 500 | error interno seguro |

Los accesos cross-tenant usan normalmente `404` con códigos específicos del recurso para no revelar existencia. El backend ignora cualquier `tenantId`, `createdBy`, `status` o `endAt` que pretenda controlar la propiedad o duración durante la creación de citas.
