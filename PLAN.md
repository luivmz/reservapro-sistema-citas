# Plan de implementación — ReservaPro

## Convenciones

Estados permitidos:

- `pendiente`: no iniciado.
- `en progreso`: trabajo activo sin validación completa.
- `completado`: implementación y pruebas previstas de la fase aprobadas.
- `pendiente de validación manual`: implementación lista, pero requiere verificación humana/visual.

Una fase solo pasa a `completado` con evidencia verificable. Este documento se actualizará durante el desarrollo.

## Fase 1. Setup — completado

**Objetivo:** verificar herramientas, Git y remoto sin alterar trabajo existente.
**Tareas:** ejecutar inspección inicial; inicializar `main` al comprobar que la carpeta no era repositorio; configurar `origin`; confirmar que el remoto no contiene ramas.
**Resultado esperado:** repositorio local limpio y remoto correcto.
**Criterios de finalización:** Node/npm registrados, `git status`, rama y `remote -v` verificados.

## Fase 2. SDD — completado

**Objetivo:** definir el contrato funcional antes del código.
**Tareas:** redactar `spec.md`; matriz RBAC; escenarios Given/When/Then; plan; documentación base.
**Resultado esperado:** alcance, reglas y aceptación no ambiguos.
**Criterios de finalización:** revisión cruzada de especificación, plan, arquitectura, API y QA; primer commit documental.

## Fase 3. Modelo SQLite — completado

**Objetivo:** crear un esquema relacional multi-tenant reproducible.
**Tareas:** tablas, constraints, claves foráneas, índices, triggers mínimos, WAL y script idempotente `db:init`.
**Resultado esperado:** base vacía válida e inicializable.
**Criterios de finalización:** tests de esquema, FK e idempotencia aprobados.

## Fase 4. Backend base — completado

**Objetivo:** establecer API Express por capas y manejo consistente de errores.
**Tareas:** configuración, app/server, health, CORS, Helmet, JSON, 404 y error handler.
**Resultado esperado:** servidor configurable con `GET /api/health`.
**Criterios de finalización:** tests de health, 404, JSON y errores aprobados.

## Fase 5. Multi-tenancy — completado

**Objetivo:** hacer obligatorio el contexto tenant en persistencia y dominio.
**Tareas:** repositorios tenant-scoped, helpers de pertenencia, respuestas opacas cross-tenant.
**Resultado esperado:** ninguna consulta operativa sin tenant autenticado.
**Criterios de finalización:** pruebas A/B de lectura, modificación, baja y asociación aprobadas.

## Fase 6. Autenticación — completado

**Objetivo:** registro seguro de organización y sesión JWT.
**Tareas:** alta atómica tenant+ADMIN, bcryptjs, login, `/me`, middleware JWT con algoritmo/expiración, logout frontend.
**Resultado esperado:** identidad verificable y contexto autenticado.
**Criterios de finalización:** tests de alta, login correcto/incorrecto, falta/token inválido y usuario inactivo.

## Fase 7. RBAC — completado

**Objetivo:** aplicar permisos de backend centralizados y alcance contextual.
**Tareas:** middleware de roles; guards de Service; endpoints básicos de usuarios ADMIN.
**Resultado esperado:** matriz de `spec.md` aplicada.
**Criterios de finalización:** suites ADMIN, RECEPTIONIST, PROFESSIONAL y CLIENT aprobadas.

## Fase 8. Clientes — completado

**Objetivo:** CRUD tenant-scoped de clientes.
**Tareas:** repository/service/controller/routes, validación, búsqueda, paginación y baja lógica.
**Resultado esperado:** `/api/clients` completo.
**Criterios de finalización:** CRUD, errores y aislamiento aprobados.

## Fase 9. Empleados — completado

**Objetivo:** administrar profesionales y vínculo opcional con usuarios.
**Tareas:** CRUD, activación, vínculo same-tenant, filtros básicos.
**Resultado esperado:** empleados administrables sin exigir cuenta.
**Criterios de finalización:** CRUD, vínculos, unicidad y aislamiento aprobados.

## Fase 10. Servicios — completado

**Objetivo:** administrar catálogo y asociaciones con empleados.
**Tareas:** CRUD, precio en centavos, duración; rutas de `employee_services`.
**Resultado esperado:** catálogo válido y profesionales habilitados por servicio.
**Criterios de finalización:** validaciones, asociaciones cross-tenant y aislamiento aprobados.

## Fase 11. Horarios de profesionales — completado

**Objetivo:** gestionar bloques semanales simples.
**Tareas:** CRUD anidado, ISO weekday, validación de rangos y solapamiento.
**Resultado esperado:** jornada explícita por empleado.
**Criterios de finalización:** tests de horario válido, inválido, superpuesto y tenant.

## Fase 12. Disponibilidad — completado

**Objetivo:** calcular slots reservables desde reglas persistidas.
**Tareas:** zona horaria, bloques, duración, asociación, citas bloqueantes e incremento de 15 minutos.
**Resultado esperado:** `GET /api/availability`.
**Criterios de finalización:** tests fuera de jornada, servicio no ofrecido, duración excedida, slots ocupados/libres.

## Fase 13. Citas — completado

**Objetivo:** implementar operaciones base de citas.
**Tareas:** crear, listar, ver, editar notas y autorización contextual.
**Resultado esperado:** citas con final derivado y relaciones same-tenant.
**Criterios de finalización:** integración válida, validaciones y roles aprobados.

## Fase 14. Prevención de solapamientos — completado

**Objetivo:** impedir dobles reservas de un profesional.
**Tareas:** predicado exacto, estados bloqueantes, exclusión por id y transacción inmediata.
**Resultado esperado:** conflicto `409` consistente.
**Criterios de finalización:** diez escenarios obligatorios de conflicto aprobados.

## Fase 15. Reprogramación, cancelación y estados — completado

**Objetivo:** completar el ciclo de vida trazable.
**Tareas:** endpoint de reprogramación; cancelación lógica; máquina de estados; permisos.
**Resultado esperado:** mutaciones atómicas y coherentes.
**Criterios de finalización:** transición, terminales, cancelación y reprogramación libre/ocupada aprobadas.

## Fase 16. Filtros — completado

**Objetivo:** consultar agenda por criterios combinables.
**Tareas:** cliente, empleado, servicio, fechas, estado y paginación.
**Resultado esperado:** listado eficiente y tenant-scoped.
**Criterios de finalización:** filtros individuales/combinados, rangos inválidos y scopes por rol aprobados.

## Fase 17. Frontend base — completado

**Objetivo:** construir SPA ligera sin framework usando Vite y ES2023.
**Tareas:** shell, router cliente, sesión, API client, login/registro, navegación RBAC, estados UI y CSS responsive.
**Resultado esperado:** aplicación navegable que consume REST.
**Criterios de finalización:** tests unitarios de lógica y build de producción aprobados; la interacción visual se conserva en QA manual.

## Fase 18. FullCalendar — pendiente de validación manual

**Objetivo:** mostrar y operar agenda en mes/semana/día.
**Tareas:** mapear eventos, detalle, creación, edición, reprogramación/cancelación y reversión ante rechazo.
**Resultado esperado:** calendario funcional por permisos.
**Criterios de finalización:** mapping automatizado y build aprobados; interacción y reversión visual quedan sujetas a QA manual.

## Fase 19. Dashboard — completado

**Objetivo:** exponer y visualizar métricas del tenant.
**Tareas:** conteos, hoy, servicios solicitados, clientes frecuentes y scope profesional.
**Resultado esperado:** tarjetas/listas con estados vacío/loading/error.
**Criterios de finalización:** métricas y aislamiento automatizados; vista integrada.

## Fase 20. QA funcional — completado

**Objetivo:** validar recorridos funcionales completos.
**Tareas:** suites de integración, smoke, checklist manual.
**Resultado esperado:** evidencia por requisito.
**Criterios de finalización:** 33/33 pruebas backend, 4/4 frontend y smoke HTTP reproducido dos veces; pendientes manuales identificados en `docs/QA.md`.

## Fase 21. QA RBAC — completado

**Objetivo:** demostrar la matriz de permisos.
**Tareas:** pruebas positivas y negativas por rol y contexto.
**Resultado esperado:** permisos backend verificables.
**Criterios de finalización:** pruebas positivas y negativas de los cuatro roles aprobadas; cero bypass conocido en endpoints documentados.

## Fase 22. QA aislamiento multi-tenant — completado

**Objetivo:** demostrar separación A/B integral.
**Tareas:** lectura, cambio, baja, relaciones, agenda, disponibilidad y dashboard cruzados.
**Resultado esperado:** respuestas seguras sin fuga.
**Criterios de finalización:** suite A/B aprobada para lectura, cambios, bajas, relaciones, agenda, disponibilidad, reservas y dashboard.

## Fase 23. QA visual — pendiente de validación manual

**Objetivo:** inspeccionar UI real y accesibilidad básica.
**Tareas:** navegador a 360 px/escritorio, mes/semana/día, teclado, foco, modales, toasts, errores y vacíos.
**Resultado esperado:** checklist visual con evidencia honesta.
**Criterios de finalización:** puntos inspeccionados marcados aprobados; el resto `pendiente de validación manual`.

## Fase 24. Documentación — completado

**Objetivo:** alinear documentación con la implementación final.
**Tareas:** completar README, arquitectura, API, QA, variables, comandos, limitaciones y trazabilidad.
**Resultado esperado:** una persona nueva puede instalar y evaluar el proyecto.
**Criterios de finalización:** README, arquitectura, API y QA contrastados con rutas, esquema, variables, scripts y resultados reales.

## Fase 25. Verificación final y publicación — completado

**Objetivo:** producir un estado estable reproducible y publicarlo.
**Tareas:** instalación limpia, db:init, tests, smoke, build, audits, Git status/log/remote, push y comparación de hashes.
**Resultado esperado:** `main` local y `origin/main` coincidentes.
**Criterios de finalización:** instalación limpia, db:init, tests, cobertura, smoke, build y audits aprobados; push de `main` confirmado sin force. QA visual continúa identificado como validación manual pendiente.

## Hitos de commits previstos

1. `docs: add SDD specification and implementation plan`
2. `chore: initialize frontend and backend workspace`
3. `feat: add multi-tenant SQLite schema and database initialization`
4. `feat: add Express API foundation`
5. `feat: implement authentication tenant context and RBAC`
6. `feat: implement tenant-scoped resource management`
7. `feat: implement schedules availability and appointments`
8. `feat: add appointment workflows filters and dashboard`
9. `feat: build responsive frontend and calendar`
10. `test: cover authentication tenancy RBAC and scheduling`
11. `docs: finalize API architecture QA and operations guide`

Los hitos pueden dividirse para mantener commits revisables; antes de cada uno se ejecutarán `git status`, `git diff` y las pruebas relevantes, agregando archivos mediante rutas explícitas.
