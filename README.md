# ReservaPro — Sistema Web de Reservas de Citas

ReservaPro es una aplicación web académica para administrar clientes, profesionales, servicios, horarios y citas bajo un modelo SaaS multi-tenant con aislamiento estricto y autorización RBAC.

> Estado: fase SDD. La implementación se construirá por fases y este README se actualizará únicamente con comandos y capacidades verificadas.

## Objetivo y características planificadas

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
- Pruebas: Vitest, Supertest y jsdom.

## Arquitectura, SDD y seguridad

El flujo backend es `Route → Controller → Service → Repository → SQLite`. El tenant se deriva de la identidad autenticada; los repositories filtran por tenant y las claves foráneas compuestas protegen asociaciones. RBAC se aplica en backend y se refuerza con autorización contextual.

El desarrollo sigue el enfoque SDD exigido por la asignatura. La especificación se encuentra en [spec.md](spec.md), el plan verificable en [PLAN.md](PLAN.md) y las decisiones técnicas en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Se utilizó Codex como asistente de desarrollo basado en IA; no se atribuye el trabajo a OpenCode.

## Estructura prevista

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

## Instalación y ejecución

Los comandos definitivos se añadirán después de crear y probar ambos workspaces. El flujo objetivo es:

```bash
git clone https://github.com/luivmz/reservapro-sistema-citas.git
cd reservapro-sistema-citas

# Copiar .env.example a backend/.env y reemplazar JWT_SECRET.
cd backend
npm ci
npm run db:init
npm test
npm run dev

# En otra terminal:
cd frontend
npm ci
npm test
npm run build
npm run dev
```

No se incluye un secreto real ni una base SQLite en el repositorio.

## Variables de entorno previstas

Consulte [.env.example](.env.example). `JWT_SECRET` debe tener al menos 32 caracteres impredecibles. El archivo real debe ubicarse en `backend/.env` y no se versiona.

## API y roles

El contrato inicial se documenta en [docs/API.md](docs/API.md). Los permisos completos están en la matriz RBAC de [spec.md](spec.md).

## Pruebas y QA

La estrategia y el checklist se encuentran en [docs/QA.md](docs/QA.md). Ningún control visual se declarará aprobado sin inspección en navegador.

## Multi-tenancy

Cada recurso operativo pertenece a un `tenant_id`. El backend obtiene ese valor de un JWT validado y vuelve a verificar que usuario y tenant estén activos. IDs de tenant enviados por el navegador no deciden propiedad. Los accesos a recursos ajenos responden de forma opaca, normalmente `404`.

## Limitaciones iniciales

No incluye pagos, correo/SMS real, calendarios externos, vacaciones, feriados, sucursales complejas, facturación, auditoría empresarial ni suscripciones. SQLite y una sola instancia Node están orientados al entorno académico/local.

## Autores/equipo

- Estudiante(s): _pendiente de proporcionar_.
- Curso: Ingeniería Web.

No se inventan nombres ni afiliaciones no proporcionadas.
