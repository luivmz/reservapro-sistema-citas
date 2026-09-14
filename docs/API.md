# Contrato API REST

Documento inicial de diseño. Durante la implementación se completarán payloads y respuestas comprobados.

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
| GET/POST | `/api/clients` | ADMIN, RECEPTIONIST; CLIENT según operación contextual |
| GET/PUT/DELETE | `/api/clients/:id` | ADMIN, RECEPTIONIST; propio según matriz |
| GET/POST | `/api/employees` | lectura por roles; escritura ADMIN |
| GET/PUT/DELETE | `/api/employees/:id` | lectura por roles; escritura ADMIN |
| GET/PUT | `/api/employees/:id/services` | GET permitido por alcance; PUT ADMIN |
| GET/POST | `/api/employees/:id/schedules` | GET por alcance; POST ADMIN |
| PUT/DELETE | `/api/employees/:id/schedules/:scheduleId` | ADMIN |
| GET/POST | `/api/services` | lectura por roles; escritura ADMIN |
| GET/PUT/DELETE | `/api/services/:id` | lectura por roles; escritura ADMIN |
| GET | `/api/availability` | todos autenticados con catálogo permitido |
| GET/POST | `/api/appointments` | por rol y alcance contextual |
| GET/PUT | `/api/appointments/:id` | por rol y alcance contextual |
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

Los detalles finales se actualizarán desde las rutas y pruebas reales, evitando documentar endpoints ficticios.
