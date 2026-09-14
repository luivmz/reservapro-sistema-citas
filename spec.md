# Especificación SDD — ReservaPro

## 1. Identificación y contexto

**Sistema:** ReservaPro — Sistema Web de Reservas de Citas
**Tipo:** aplicación web académica bajo modelo SaaS multiinquilino.
**Enfoque:** Software-Driven Development (SDD), con esta especificación como contrato funcional previo al código.

Las organizaciones que atienden mediante citas suelen coordinar clientes, profesionales, servicios y horarios usando canales dispersos. Esto provoca duplicidad, reservas fuera de jornada, cruces de agenda y exposición accidental de datos. ReservaPro centraliza la operación sin mezclar información entre organizaciones.

## 2. Problema y objetivos

### Problema

Se necesita una solución web que permita reservar y administrar citas con reglas verificables de horario, disponibilidad y autorización, manteniendo aislamiento estricto entre tenants y una experiencia adecuada para administración, recepción, profesionales y clientes.

### Objetivo general

Construir una aplicación cliente-servidor segura, mantenible y reproducible para gestionar citas de múltiples organizaciones sobre una API REST, con SQLite como persistencia y autorización RBAC aplicada en backend.

### Objetivos específicos

- Crear organizaciones con su cuenta ADMIN inicial.
- Autenticar usuarios mediante contraseñas hasheadas y JWT de duración limitada.
- Administrar clientes, empleados, servicios, asociaciones y horarios semanales.
- Calcular disponibilidad desde horarios, duración del servicio y citas bloqueantes.
- Crear, consultar, reprogramar, cancelar y cambiar el estado de citas.
- Prevenir solapamientos en backend y dentro de una transacción SQLite.
- Mostrar agenda, filtros y métricas limitadas al tenant y al rol.
- Entregar una interfaz responsive en HTML, CSS y JavaScript ES2023 con Vite.
- Probar automáticamente las reglas críticas de autenticación, RBAC, tenant y agenda.

## 3. Alcance

### Incluido

- Registro autoservicio de un tenant y su primer ADMIN.
- Login, consulta del usuario actual y logout lógico del cliente.
- Gestión básica de usuarios del tenant por ADMIN.
- CRUD lógico de clientes, empleados y servicios.
- Asociación empleado-servicio y horarios semanales.
- Disponibilidad por profesional, servicio y fecha.
- Ciclo de vida de citas, filtros combinables y calendario.
- Dashboard operativo por tenant.
- UI condicionada por rol y API protegida independientemente de la UI.

### Fuera de alcance inicial

- Pagos, facturación, suscripciones y planes SaaS.
- Envío real de correo, SMS o WhatsApp.
- Sincronización con calendarios externos.
- Vacaciones, feriados y excepciones avanzadas de horarios.
- Múltiples sucursales complejas.
- Auditoría empresarial o historial completo de cambios.
- Recuperación de contraseña.
- Reservas recurrentes y listas de espera.

Estas capacidades se consideran mejoras futuras y no se simularán superficialmente.

## 4. Actores y roles

- **Visitante:** registra una organización o inicia sesión.
- **ADMIN:** configura y opera todos los recursos de su tenant.
- **RECEPTIONIST:** administra clientes y citas; consulta profesionales, servicios, calendario y dashboard operativo.
- **PROFESSIONAL:** consulta únicamente su agenda/citas vinculadas y actualiza estados operativos permitidos.
- **CLIENT:** consulta, crea, reprograma y cancela únicamente sus propias citas.

Una cuenta PROFESSIONAL debe estar vinculada a un `employee` y una cuenta CLIENT a un `client`. Si el vínculo requerido no existe, la operación contextual se rechaza sin ampliar permisos.

## 5. Casos de uso e historias de usuario

### Casos de uso principales

1. Registrar organización y ADMIN inicial.
2. Autenticarse y recuperar el contexto de sesión.
3. Administrar usuarios del tenant.
4. Administrar clientes.
5. Administrar empleados y sus servicios.
6. Administrar servicios.
7. Configurar horarios semanales de profesionales.
8. Consultar disponibilidad.
9. Crear y consultar citas.
10. Reprogramar, cancelar y actualizar estados.
11. Filtrar agenda y visualizar calendario.
12. Consultar métricas operativas.

### Historias de usuario

- Como ADMIN, quiero registrar mi organización para comenzar con un espacio de datos aislado.
- Como ADMIN, quiero gestionar usuarios, empleados, servicios y horarios de mi organización.
- Como RECEPTIONIST, quiero crear citas sin poder cambiar configuración exclusiva del ADMIN.
- Como PROFESSIONAL, quiero ver solamente mi agenda para atender a mis clientes.
- Como CLIENT, quiero reservar un slot libre y consultar solamente mis citas.
- Como operador, quiero recibir una explicación coherente cuando una cita entra en conflicto.
- Como organización, quiero que ningún usuario de otro tenant pueda inferir o modificar mis recursos.

## 6. Requisitos funcionales

### RF-01 Autenticación

- Registrar tenant y ADMIN en una transacción.
- Iniciar sesión con tenant slug, email y contraseña.
- Emitir JWT firmado con algoritmo permitido, expiración y claims mínimos (`sub`, `tenantId`, `role`).
- Consultar `GET /api/auth/me` en ruta protegida.
- Realizar logout lógico eliminando el token en frontend.

### RF-02 Usuarios y RBAC

- ADMIN puede listar, crear, editar y activar/desactivar usuarios de su tenant.
- Los roles enviados por cliente se validan contra el catálogo permitido.
- Ningún usuario puede asignarse un rol a sí mismo desde endpoints generales.
- La autorización se aplica mediante middleware central y validaciones contextuales de servicio.

### RF-03 Clientes

- CRUD mediante `/api/clients`.
- La eliminación es lógica (`active = 0`) para preservar referencias históricas.
- Búsqueda por nombre, email o teléfono.

### RF-04 Empleados

- CRUD con activación/desactivación.
- Vínculo opcional y único con una cuenta del mismo tenant.
- Asociación con uno o más servicios del mismo tenant.

### RF-05 Servicios

- CRUD con nombre, descripción, duración positiva, precio no negativo y estado activo.
- El precio se almacena en centavos enteros para evitar errores de coma flotante.

### RF-06 Horarios

- Un empleado puede tener uno o varios bloques por día de semana.
- Cada bloque cumple `start_time < end_time`.
- Los bloques del mismo empleado/día no pueden superponerse.

### RF-07 Disponibilidad

- Consultar slots con `employeeId`, `serviceId` y `date`.
- Validar tenant, recursos activos, asociación empleado-servicio y horario semanal.
- Derivar el fin desde `services.duration_minutes`.
- Excluir intervalos ocupados por citas bloqueantes.

### RF-08 Citas

- Crear, listar, ver, actualizar notas, reprogramar, cancelar y cambiar estado.
- Filtrar por cliente, empleado, servicio, rango de fechas y estado; filtros combinables.
- Derivar siempre `end_at` desde inicio y duración persistida del servicio.
- Evitar eliminación física desde la API pública para conservar trazabilidad.

### RF-09 Dashboard

- Informar conteos por estado, citas de hoy, servicios más solicitados y clientes frecuentes.
- Respetar tenant y restricciones contextuales del rol.

### RF-10 Frontend

- Consumir exclusivamente la API REST.
- Ofrecer vistas de login/registro, dashboard, calendario, citas, clientes, empleados, servicios, horarios, mi agenda y mis citas según rol.
- Integrar FullCalendar en vistas diaria, semanal y mensual.
- Usar SweetAlert2 para confirmaciones y Toastify para feedback breve.

## 7. Requisitos no funcionales

- **Seguridad:** hash bcrypt, JWT sin secretos hardcodeados, Helmet, CORS restringido, validación y errores seguros.
- **Aislamiento:** todas las consultas de recursos de negocio incluyen el tenant autenticado.
- **Mantenibilidad:** capas Route → Controller → Service → Repository → SQLite.
- **Calidad:** código ES2023, funciones cohesivas, sin SQL en controllers ni reglas complejas en routes.
- **Rendimiento:** índices por tenant y campos de consulta; paginación limitada en listados.
- **Integridad:** claves foráneas activas, constraints y transacciones para operaciones compuestas.
- **Accesibilidad:** labels, foco visible, estructura semántica, teclado y contraste razonable.
- **Responsive:** operación usable desde 360 px y escritorio.
- **Portabilidad:** inicialización reproducible con `npm ci` y `npm run db:init`.
- **Observabilidad básica:** errores del servidor sin contraseñas, tokens ni stack en producción.

## 8. Modelo multi-tenant y reglas de aislamiento

`tenants` es la raíz de propiedad. Toda entidad operativa contiene `tenant_id`. El tenant efectivo se deriva exclusivamente del JWT validado y de la cuenta activa recargada desde la base; cualquier `tenantId` enviado por frontend se ignora o rechaza.

Reglas obligatorias:

1. Repositories reciben `tenantId` desde el contexto autenticado y lo incorporan a cada consulta.
2. Lectura, actualización y desactivación usan simultáneamente `id` y `tenant_id`.
3. Las asociaciones verifican que ambos extremos pertenezcan al tenant actual.
4. Las métricas y conflictos filtran por tenant.
5. Un identificador existente en otro tenant responde como recurso no encontrado (`404`) cuando sea apropiado.
6. El registro público es la única operación que crea un tenant; no existe un rol global implícito.
7. Claims desactualizados no bastan: el middleware verifica usuario y tenant activos en SQLite.

## 9. Matriz RBAC

Leyenda: `T` todos los recursos del tenant; `C` alcance contextual propio; `R` solo lectura; `—` denegado.

| Capacidad | ADMIN | RECEPTIONIST | PROFESSIONAL | CLIENT |
|---|---:|---:|---:|---:|
| Usuarios del tenant | T | — | — | — |
| Clientes | T CRUD | T CRUD | C R mínimo | C R propio |
| Empleados | T CRUD | T R | C R propio | R catálogo disponible |
| Servicios | T CRUD | T R | C R asignados | R activos |
| Asociar empleado-servicio | T | — | — | — |
| Horarios | T CRUD | T R | C R propio | — |
| Agenda completa del tenant | T | T | — | — |
| Citas | T | T | C propias | C propias |
| Crear cita | T | T | — | C propia |
| Reprogramar/cancelar | T | T | — | C propia y estado permitido |
| Estado → CONFIRMED | T | T | C propia | — |
| Estado → COMPLETED/NO_SHOW | T | T | C propia | — |
| Dashboard | T | T operativo | C propio | — |
| Configuración tenant | T básica | — | — | — |

Las reglas contextuales se vuelven a comprobar en Service incluso después del middleware de rol.

## 10. Reglas de negocio

### RN-01 Identidad y unicidad

- Email de usuario es único dentro de un tenant, no globalmente.
- `slug` de tenant es único globalmente y se normaliza a minúsculas con guiones.
- IDs externos son UUID v4 en texto y se usan consistentemente.

### RN-02 Estado activo

- Tenant o usuario inactivo no puede autenticarse ni usar tokens previos.
- Cliente, empleado o servicio inactivo no puede usarse para nuevas citas.
- Datos inactivos pueden conservarse en citas históricas.

### RN-03 Fechas y zona horaria

- La zona horaria del tenant se almacena como identificador IANA; inicialmente `America/Lima` por defecto.
- Instantes de cita se reciben como ISO 8601 con offset y se guardan normalizados en UTC (`YYYY-MM-DDTHH:mm:ss.SSSZ`).
- La fecha de disponibilidad se interpreta en la zona IANA del tenant.
- Horarios semanales se guardan como hora local `HH:mm`, nunca como instantes ambiguos.

### RN-04 Duración y precio

- `duration_minutes` es entero entre 5 y 480.
- `price_cents` es entero entre 0 y 100000000.
- `end_at = start_at + duration_minutes`; el cliente no decide el final.

### RN-05 Jornada y disponibilidad

- `day_of_week` usa ISO: 1=lunes … 7=domingo.
- Una cita debe quedar completamente contenida en un bloque de horario del empleado.
- Los slots avanzan en incrementos configurados de 15 minutos.
- Solo `SCHEDULED` y `CONFIRMED` bloquean agenda; `COMPLETED`, `CANCELLED` y `NO_SHOW` no bloquean nuevas reservas futuras. La aplicación impide normalmente reprogramar hacia el pasado.
- Un empleado debe ofrecer el servicio solicitado mediante `employee_services`.

### RN-06 Solapamiento

Para citas bloqueantes del mismo `tenant_id` y `employee_id`, existe conflicto cuando:

```text
newStart < existingEnd AND newEnd > existingStart
```

La comparación usa intervalos semiabiertos `[start, end)`: una cita puede comenzar exactamente cuando termina otra. En reprogramación se excluye la cita actual. La comprobación y escritura se ejecutan en una transacción inmediata de SQLite para serializar escritores dentro de las capacidades locales del motor.

### RN-07 Estados y transiciones

Estados: `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.

| Desde | Hacia permitido |
|---|---|
| SCHEDULED | CONFIRMED, CANCELLED |
| CONFIRMED | COMPLETED, NO_SHOW, CANCELLED |
| COMPLETED | ninguno |
| CANCELLED | ninguno |
| NO_SHOW | ninguno |

ADMIN no omite esta máquina de estados. La cancelación es un cambio a `CANCELLED`, no borrado físico. Solo `SCHEDULED` o `CONFIRMED` pueden reprogramarse. CLIENT puede reprogramar/cancelar sus citas en esos estados; no cambia estados operativos.

### RN-08 Paginación y filtros

- Listados admiten `page` y `limit`; límite máximo 100.
- Fechas `from` y `to` forman un rango válido y combinable con otros filtros.
- IDs de filtros se validan y no permiten ampliar el tenant.

## 11. Validaciones y errores

- Strings requeridos se recortan y tienen límites explícitos.
- Emails se normalizan a minúsculas y validan con Validator.js.
- UUID, roles, estados, fechas ISO con offset, `HH:mm`, enteros y rangos se validan en backend.
- JSON malformado responde `400`; autenticación ausente/inválida `401`; permiso insuficiente `403`; recurso propio inexistente o ajeno `404`; conflicto de horario o unicidad `409`; validación semántica `422` cuando corresponda.
- Formato de error consistente:

```json
{
  "error": {
    "code": "APPOINTMENT_CONFLICT",
    "message": "El horario solicitado ya no está disponible.",
    "details": []
  }
}
```

- No se exponen SQL, stack traces, hashes, secretos ni existencia cross-tenant.

## 12. Escenarios Given / When / Then

### Conflicto parcial obligatorio

**GIVEN:** existe una cita para el profesional P de 10:00 a 11:00
**WHEN:** se intenta crear otra cita para P de 10:30 a 11:30
**THEN:** el backend rechaza la operación por conflicto de horario con `409`.

### Aislamiento obligatorio

**GIVEN:** Usuario A pertenece al Tenant A
**AND:** Cliente B pertenece al Tenant B
**WHEN:** Usuario A intenta consultar Cliente B
**THEN:** el sistema no devuelve los datos de B y responde `404`.

### Cobertura de intervalos

**GIVEN:** existe una cita bloqueante de 10:00 a 11:00
**WHEN:** se solicita exactamente 10:00–11:00, 10:15–10:45, 09:30–10:30 o 09:00–12:00 para el mismo profesional y tenant
**THEN:** cada solicitud se rechaza como conflicto.

### Límite adyacente

**GIVEN:** existe una cita bloqueante de 10:00 a 11:00
**WHEN:** se solicita una cita que termina a las 10:00 o empieza a las 11:00, dentro de jornada
**THEN:** no existe conflicto por solapamiento.

### Profesionales y tenants distintos

**GIVEN:** existe una cita de 10:00 a 11:00
**WHEN:** otro profesional del mismo tenant, o un profesional de otro tenant, recibe una cita a la misma hora
**THEN:** la cita puede crearse si cumple el resto de reglas.

### Cita cancelada

**GIVEN:** existe una cita `CANCELLED` de 10:00 a 11:00
**WHEN:** se solicita ese intervalo para el mismo profesional
**THEN:** la cita cancelada no bloquea el slot.

### Reprogramación

**GIVEN:** una cita propia está `SCHEDULED` y existe otro intervalo ocupado
**WHEN:** se reprograma al intervalo ocupado
**THEN:** se rechaza sin modificar la cita original.
**WHEN:** se reprograma a un slot libre dentro de jornada
**THEN:** se actualizan inicio y fin calculado de forma atómica.

### Fin falsificado

**GIVEN:** un servicio dura 60 minutos
**WHEN:** el cliente envía un inicio a las 10:00 y un final a las 10:15
**THEN:** el backend ignora/rechaza el final y calcula 11:00 desde el servicio.

### Empleado sin servicio

**GIVEN:** un empleado no está asociado al servicio S
**WHEN:** se consulta disponibilidad o se intenta reservar S con ese empleado
**THEN:** la operación se rechaza sin crear cita.

### Fuera de jornada

**GIVEN:** el horario del profesional termina a las 17:00 y el servicio dura 60 minutos
**WHEN:** se solicita inicio 16:30
**THEN:** se rechaza porque la cita terminaría fuera de jornada.

### RBAC

**GIVEN:** una cuenta CLIENT autenticada
**WHEN:** intenta crear o modificar un empleado
**THEN:** recibe `403` y no ocurre ninguna escritura.

**GIVEN:** una cuenta PROFESSIONAL vinculada al empleado P
**WHEN:** consulta citas del empleado Q
**THEN:** no obtiene citas de Q.

### Token revocado por estado

**GIVEN:** un JWT aún no expiró pero el usuario fue desactivado
**WHEN:** intenta acceder a una ruta protegida
**THEN:** recibe `401`.

## 13. Criterios de aceptación

- Todas las rutas privadas derivan tenant y rol de identidad verificada.
- CRUD y asociaciones nunca leen ni escriben recursos cross-tenant.
- Los diez casos de conflicto solicitados están automatizados.
- Disponibilidad y creación comparten las mismas reglas de servicio, jornada y estados bloqueantes.
- La UI no accede a SQLite y consume solamente `/api`.
- FullCalendar ofrece mes, semana y día y revierte cambios visuales rechazados.
- La inicialización SQLite es reproducible e idempotente.
- Tests backend y frontend, build y auditorías se ejecutan y documentan con resultados reales.
- Los puntos visuales no inspeccionados se declaran pendientes, no aprobados.

## 14. Escenarios negativos adicionales

- Registro con slug duplicado o contraseña débil.
- Login con tenant, email o contraseña incorrectos sin revelar cuál falló.
- JWT firmado con algoritmo no permitido, expirado o para usuario inexistente.
- Asociación con empleado, servicio, cliente o usuario ajeno.
- Duración cero/negativa, precio negativo, hora final anterior o fecha sin offset.
- Dos bloques de horario superpuestos.
- Estado desconocido o transición terminal.
- Rango de filtros inválido o paginación excesiva.
- JSON malformado y campos inesperados sensibles (`tenantId`, `role` no autorizado).
- Condición de carrera entre dos intentos de reservar el mismo slot.

## 15. Criterios de éxito

- Cumplimiento verificable de requisitos funcionales y no funcionales críticos.
- Ningún test de tenant, RBAC o solapamiento fallido.
- Instalación limpia documentada en otra PC.
- Sin secretos ni artefactos locales versionados.
- Documentación coherente con rutas, esquema y comandos reales.
- Historial Git semántico y estado final limpio tras push confirmado.

## 16. Supuestos

- Despliegue académico local con una instancia Node y un archivo SQLite.
- La zona inicial por defecto es `America/Lima`, configurable por tenant en el registro.
- El incremento de slots es 15 minutos y no se configura por UI en esta versión.
- La creación de cuentas CLIENT/PROFESSIONAL y sus vínculos la realiza ADMIN.
- No se requiere revocación central de JWT más allá de expiración y verificación de usuario/tenant activos.

## 17. Riesgos conocidos y mitigación

| Riesgo | Mitigación |
|---|---|
| Fuga cross-tenant por consulta sin filtro | API de repository exige `tenantId`; tests A/B por lectura, escritura, borrado y asociación |
| Carrera al reservar | transacción `BEGIN IMMEDIATE`, consulta de conflicto y escritura en la misma unidad |
| Fechas ambiguas | ISO con offset en API, UTC en SQLite, zona IANA para horarios locales |
| JWT robado en navegador | expiración limitada, CSP/Helmet, no persistir secretos; limitación de almacenamiento documentada |
| SQLite bajo alta concurrencia | WAL y timeout; solución destinada a carga académica/local |
| Cambios de estado incoherentes | máquina de estados central en Service |
| Divergencia disponibilidad/creación | funciones de dominio compartidas y tests de integración |
| QA visual incompleto | checklist explícito y estado pendiente hasta inspección real en navegador |

## 18. Trazabilidad

La implementación se controla mediante [PLAN.md](PLAN.md). El esquema y decisiones se detallan en `docs/ARCHITECTURE.md`, el contrato HTTP en `docs/API.md` y las evidencias/checklists en `docs/QA.md`. Si código y especificación divergen, se actualiza primero esta especificación o se corrige el código antes de declarar una fase completada.
