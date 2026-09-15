# ReservaPro — Sistema Web de Reservas de Citas

ReservaPro es una aplicación web académica para administrar clientes, profesionales, servicios, horarios y citas bajo un modelo SaaS multi-tenant con aislamiento estricto y autorización RBAC.

> Estado: implementación funcional, QA automatizado y publicación de `main` completados. La validación visual en navegador permanece pendiente.

## Objetivo y características

- Registro de organización con ADMIN inicial.
- Autenticación JWT y contraseñas hasheadas.
- Roles ADMIN, RECEPTIONIST, PROFESSIONAL y CLIENT.
- CRUD de clientes, empleados y servicios.
- Asociaciones empleado-servicio y horarios semanales.
- Disponibilidad y prevención de citas solapadas.
- Reprogramación, cancelación, estados y filtros.
- Dashboard tenant-scoped.
- Calendario diario, semanal y mensual con FullCalendar.
- UI responsive sin framework SPA.

## Stack

- Frontend: HTML5, CSS3, JavaScript ES2023, Vite, FullCalendar, Day.js, SweetAlert2 y Toastify.
- Backend: Node.js 20+, Express, JWT, bcryptjs y Validator.js.
- Persistencia: SQLite con `better-sqlite3`.
- Pruebas: runner nativo `node:test`, Supertest y smoke HTTP autocontenido.

## Arquitectura, SDD y seguridad

El flujo backend es `Route → Controller → Service → Repository → SQLite`. El tenant se deriva de la identidad autenticada; los repositories filtran por tenant y las claves foráneas compuestas protegen asociaciones. RBAC se aplica en backend y se refuerza con autorización contextual.

El desarrollo sigue el enfoque SDD exigido por la asignatura. La especificación se encuentra en [spec.md](spec.md), el plan verificable en [PLAN.md](PLAN.md) y las decisiones técnicas en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Se utilizó Codex como asistente de desarrollo basado en IA; no se atribuye el trabajo a OpenCode.

## Estructura

```text
frontend/     interfaz Vite sin framework SPA
backend/      API Express y persistencia SQLite
docs/         arquitectura, API y QA
spec.md       contrato funcional SDD
PLAN.md       fases y estado verificable
```

## Requisitos previos

- Git.
- Node.js 20 o superior.
- npm 10 o superior.

## Instalación en otra PC

```bash
git clone https://github.com/luivmz/reservapro-sistema-citas.git
cd reservapro-sistema-citas

# Copiar .env.example a backend/.env y reemplazar JWT_SECRET.
# Linux/macOS: cp .env.example backend/.env
# PowerShell: Copy-Item .env.example backend\.env
cd backend
npm ci
npm run db:init
npm test
npm run smoke
npm audit

# Volver a la raíz para instalar y verificar frontend.
cd ../frontend
npm ci
npm test
npm run build
npm audit
```

La interfaz queda en `http://localhost:5173`; la API en `http://localhost:3000/api` y su health check en `http://localhost:3000/api/health`. No se incluye un secreto real ni una base SQLite en el repositorio.

Para ejecutar, abra dos terminales desde la raíz:

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

## Variables de entorno

Copie [.env.example](.env.example) como `backend/.env`. Las variables efectivas son:

| Variable | Propósito | Valor local sugerido |
|---|---|---|
| `NODE_ENV` | modo de ejecución | `development` |
| `PORT` | puerto de la API | `3000` |
| `JWT_SECRET` | firma HS256; mínimo 32 caracteres impredecibles | sin valor real versionado |
| `JWT_EXPIRES_IN` | vigencia del token | `2h` |
| `DATABASE_PATH` | ruta relativa a `backend/` o `:memory:` | `./data/reservapro.sqlite3` |
| `FRONTEND_ORIGIN` | orígenes CORS separados por coma | `http://localhost:5173` |
| `BCRYPT_ROUNDS` | coste bcrypt entre 10 y 14 | `12` |

El backend rechaza al iniciar un `JWT_SECRET` menor de 32 caracteres. `backend/.env`, las bases y sus journals están ignorados por Git.

## Creación del tenant y ADMIN inicial

No existe un seed con credenciales fijas. En una base nueva, abra `http://localhost:5173/#register` y complete el registro de organización, o envíe `POST /api/auth/register` con `organizationName`, `tenantSlug`, `timezone`, `adminName`, `email` y `password`. La operación crea tenant y ADMIN de forma atómica.

## Comandos por workspace

Backend:

```bash
cd backend
npm run db:init
npm test
npm run test:coverage
npm run smoke
npm run dev
```

Frontend:

```bash
cd frontend
npm test
npm run build
npm run dev
```

## API y roles

El contrato inicial se documenta en [docs/API.md](docs/API.md). Los permisos completos están en la matriz RBAC de [spec.md](spec.md).

## Pruebas y QA

La última verificación automatizada registró 33/33 pruebas backend en 6 suites, 96.91% de líneas cubiertas, 4/4 pruebas frontend, build Vite correcto, un smoke de 11 recorridos HTTP reproducido dos veces y 0 vulnerabilidades en ambos `npm audit`. La evidencia y el checklist están en [docs/QA.md](docs/QA.md). Ningún control visual se declara aprobado sin inspección en navegador.

## Multi-tenancy

Cada recurso operativo pertenece a un `tenant_id`. El backend obtiene ese valor de un JWT validado y vuelve a verificar que usuario y tenant estén activos. IDs de tenant enviados por el navegador no deciden propiedad. Los accesos a recursos ajenos responden de forma opaca, normalmente `404`.

## Limitaciones iniciales

No incluye pagos, correo/SMS real, calendarios externos, vacaciones, feriados, sucursales complejas, facturación, auditoría empresarial ni suscripciones. SQLite y una sola instancia Node están orientados al entorno académico/local. No se implementó rate limiting ni revocación central de JWT; un despliegue público requeriría TLS, cookies HttpOnly/CSRF o una estrategia equivalente, rate limiting y una revisión de hardening.

## Autores/equipo

- Estudiante(s): _pendiente de proporcionar_.
- Curso: Ingeniería Web.

No se inventan nombres ni afiliaciones no proporcionadas.
