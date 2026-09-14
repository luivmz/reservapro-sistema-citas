# Arquitectura de ReservaPro

## 1. Vista general

ReservaPro sigue una arquitectura cliente-servidor modular. El navegador nunca accede a SQLite: consume JSON mediante la API REST.

```text
HTML/CSS/JavaScript + Vite + FullCalendar
                    |
                 HTTPS/JSON
                    |
Route -> Auth/RBAC -> Controller -> Service -> Repository -> SQLite
                    |             |
              Tenant context   Reglas de dominio
```

El backend es la autoridad para autenticación, roles, tenant, validación, duración, disponibilidad, conflictos y estados. El frontend mejora la experiencia, pero no forma parte de la frontera de seguridad.

## 2. Decisiones arquitectónicas

### ADR-001 — Monolito modular

Se usa un proceso Express y un frontend Vite separado. Es suficiente para el alcance académico, simplifica despliegue y evita microservicios sin necesidad.

### ADR-002 — Capas explícitas

- **Routes:** declaran verbo, path y middleware.
- **Controllers:** traducen HTTP a llamadas de aplicación y construyen respuestas.
- **Services:** aplican reglas, permisos contextuales y transacciones.
- **Repositories:** encapsulan SQL preparado y exigen `tenantId` en recursos operativos.
- **Middleware:** autenticación, RBAC, errores y controles HTTP comunes.

No se admite SQL en controllers ni autorización de negocio exclusiva en frontend.

### ADR-003 — UUID externos

Todas las claves primarias usan UUID v4 en `TEXT`. Esto evita enumeración trivial, es consistente entre API y base, y facilita generar IDs antes de transacciones. No sustituye controles de acceso.

### ADR-004 — Dinero en centavos

`services.price_cents` usa entero no negativo. La API acepta/devuelve `priceCents`; la UI formatea moneda. Se evita `REAL` por precisión.

### ADR-005 — Tiempo

- `tenants.timezone` contiene una zona IANA, por defecto `America/Lima`.
- `start_at` y `end_at` son instantes UTC ISO 8601 canónicos.
- `employee_schedules.start_time/end_time` son horas locales `HH:mm`.
- Day.js con plugins UTC/timezone realiza conversiones explícitas.
- SQLite compara instantes UTC lexicográficamente porque se persisten en formato uniforme.

### ADR-006 — Bajas lógicas

Clientes, empleados, servicios y usuarios usan `active`. Las citas no se eliminan físicamente desde la API: se cancelan para preservar trazabilidad y relaciones.

### ADR-007 — Control de concurrencia SQLite

Creación y reprogramación ejecutan validación de conflicto y escritura dentro de `BEGIN IMMEDIATE`. SQLite serializa escritores; `busy_timeout` permite esperas breves y WAL mejora concurrencia de lectura. Esta estrategia es adecuada para una instancia académica, no para escalado horizontal.

## 3. Modelo de datos

### Relaciones

```text
tenants 1 --- N users
tenants 1 --- N clients
tenants 1 --- N employees
tenants 1 --- N services
employees 0..1 --- 0..1 users       (vínculo de cuenta profesional)
clients   0..1 --- 0..1 users       (vínculo de cuenta cliente)
employees N --- N services          (employee_services)
employees 1 --- N employee_schedules
clients   1 --- N appointments
employees 1 --- N appointments
services  1 --- N appointments
users     1 --- N appointments      (created_by)
```

Todas las relaciones operativas incluyen `tenant_id`. Se usan claves foráneas compuestas `(tenant_id, id)` para que SQLite impida asociaciones cross-tenant incluso si una validación de aplicación falla.

### Tablas planificadas

#### tenants

| Campo | Tipo / regla |
|---|---|
| id | TEXT PK UUID |
| name | TEXT NOT NULL |
| slug | TEXT NOT NULL UNIQUE, minúsculas/guiones |
| timezone | TEXT NOT NULL DEFAULT `America/Lima` |
| active | INTEGER NOT NULL CHECK 0/1 |
| created_at, updated_at | TEXT UTC NOT NULL |

#### users

| Campo | Tipo / regla |
|---|---|
| id | TEXT PK UUID |
| tenant_id | TEXT NOT NULL FK tenants |
| name, email, password_hash | TEXT NOT NULL |
| role | TEXT CHECK ADMIN/RECEPTIONIST/PROFESSIONAL/CLIENT |
| active | INTEGER CHECK 0/1 |
| created_at, updated_at | TEXT UTC |

Restricciones: `UNIQUE(tenant_id, email)` y `UNIQUE(tenant_id, id)` para referencias compuestas.

#### clients

`id`, `tenant_id`, `user_id` nullable, `name`, `email` nullable, `phone` nullable, `notes`, `active`, timestamps. `user_id`, si existe, apunta a un usuario del mismo tenant y es único por tenant.

#### employees

`id`, `tenant_id`, `user_id` nullable, `name`, `email` nullable, `phone` nullable, `active`, timestamps. `user_id`, si existe, apunta a un usuario PROFESSIONAL del mismo tenant; el rol se verifica en Service.

#### services

`id`, `tenant_id`, `name`, `description`, `duration_minutes` con `CHECK` 5..480, `price_cents` con `CHECK` 0..100000000, `active`, timestamps.

#### employee_services

`tenant_id`, `employee_id`, `service_id`, `created_at`; PK compuesta. Ambos FK compuestos garantizan tenant coincidente.

#### employee_schedules

`id`, `tenant_id`, `employee_id`, `day_of_week` 1..7, `start_time`, `end_time`, timestamps. `CHECK(start_time < end_time)`. El no solapamiento entre filas se valida transaccionalmente en Service.

#### appointments

`id`, `tenant_id`, `client_id`, `employee_id`, `service_id`, `start_at`, `end_at`, `status`, `notes`, `created_by`, timestamps. FKs compuestos atan cada relación al tenant. Estado limitado a `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`; `CHECK(start_at < end_at)`.

### Índices

- `users(tenant_id, email)` único.
- `clients(tenant_id, active, name)`.
- `employees(tenant_id, active, name)`.
- `services(tenant_id, active, name)`.
- `employee_services(tenant_id, service_id, employee_id)`.
- `employee_schedules(tenant_id, employee_id, day_of_week)`.
- `appointments(tenant_id, employee_id, start_at, end_at)` para conflicto/agenda.
- `appointments(tenant_id, client_id, start_at)`.
- `appointments(tenant_id, service_id, start_at)`.
- `appointments(tenant_id, status, start_at)`.

## 4. Aislamiento por capas

| Capa | Control |
|---|---|
| JWT | claims firmados; algoritmo y expiración validados |
| Auth middleware | recarga usuario y tenant activos; crea `req.auth` inmutable |
| Route/RBAC | restringe roles habilitados |
| Service | aplica ownership de CLIENT/PROFESSIONAL y reglas contextuales |
| Repository | exige tenant y usa `WHERE tenant_id = ?` |
| SQLite | FK compuestas evitan asociaciones entre tenants |

El API no expone un selector de tenant para una sesión. Los endpoints de registro resuelven la creación inicial sin identidad previa dentro de una transacción aislada.

## 5. Seguridad

- `bcryptjs` con coste configurable razonable.
- JWT HS256 con secreto externo de al menos 32 caracteres y expiración explícita.
- Helmet y CSP ajustada; CORS limitado a `FRONTEND_ORIGIN`.
- Límite de tamaño JSON y rate limit básico para autenticación si no perjudica tests.
- Validator.js y validadores propios con listas permitidas.
- Statements preparados de `better-sqlite3`; ninguna concatenación de valores SQL.
- Mensajes opacos en login y lookups cross-tenant.
- Stack solo en entorno de test/desarrollo controlado, nunca en producción.

Limitación conocida: el frontend necesita conservar el bearer token durante la sesión. Se priorizará memoria con respaldo en `sessionStorage`; un despliegue productivo debería evaluar cookies HttpOnly con protección CSRF y TLS obligatorio.

## 6. Estructura prevista

```text
backend/src/
  config/ controllers/ database/ errors/ middleware/
  repositories/ routes/ services/ utils/ validators/
  app.js server.js
backend/tests/
frontend/src/
  components/ css/ js/ pages/ services/ utils/
frontend/tests/
```

## 7. Contratos compartidos

- Respuesta exitosa de elemento: `{ "data": {...} }`.
- Respuesta exitosa de colección: `{ "data": [...], "meta": {...} }`.
- Error: `{ "error": { "code", "message", "details" } }`.
- Timestamps de API: ISO 8601.
- Booleanos de API: `true/false`, convertidos desde `0/1` por mapper de repository.
- Campos JSON en camelCase; columnas SQLite en snake_case.

## 8. Verificación

El esquema se validará con pruebas sobre `:memory:` o base temporal, `PRAGMA foreign_keys`, constraints e idempotencia. La API se probará con Supertest, y el frontend con Vitest/jsdom para lógica crítica. El checklist visual se conserva en `docs/QA.md` y solo se aprobará después de usar un navegador real.
