# Progreso

## Fase 1 · Base y gestión de datos

### 1-C. API base, ambulancias y feature web: entregado (lado API)

- [x] Scaffold (Fastify 5, TypeScript estricto, ESLint con reglas de frontera, Vitest), `config/{env,firebase}`, `plugins/{auth,errors}`, `health`.
- [x] Módulo `ambulances`: crear, lote (máx. 50), editar, deshabilitar, habilitar, password, cerrar-turno y auditoría (`auditoria/{id}`: `{ uid, accion, objetivoId, ts }`).
- [x] `Dockerfile` (multi-etapa, sin estado, `GET /health`).
- [x] Pruebas esenciales con `fastify.inject` y Firebase falso: 401/403, creación consistente (Auth + `ambulancias` + `roles`), validación 400, correo duplicado 409, rollback del batch (sin usuario huérfano), lote con errores parciales, lote `inactiva`, deshabilitar (409 y OK), cerrar-turno (409 y OK) y fallo de auditoría no bloqueante.
- [x] Patrones de diseño en la API: decorador transversal para auditoría y fachada por módulo para aislar las rutas de Auth, stores y auditoría.
- [x] Prueba de que un fallo al persistir auditoría no convierte una acción ya exitosa en error.

**Verificación en este entorno:** `npm run typecheck`, `npm run lint` y `npm run build` pasan. `npm test` requiere Node >=22 (declarado en `package.json`), pero el entorno tiene Node 20.11.1 y Vitest no inicia. La prueba con Firebase real sigue pendiente (ver `ambulancias-web/docs/CAMBIOS-1C.md`).

**Lo que las pruebas NO cubren:** el Firebase falso reimplementa las reglas de `cerrar-turno`; la transacción real de Firestore (`ambulances.store.ts`) y los códigos de error reales de Auth (`config/firebase.ts`) solo se comprueban con tu Firebase real. Además, no hay pruebas de editar, habilitar ni cambiar contraseña (se redujeron a lo esencial).

## Fase 3 · Analítica: entregado (lado API)

- [x] Módulo `kpis`: `GET /kpis/resumen`, `/kpis/series` (día u hora en `TZ_OPERACION`) y `/kpis/ranking` (ambulancia, conductor, paramédico, hospital). Fórmulas puras en `calculators.ts` y `stats.ts`; carga paginada de alertas en `load-alertas.ts` (único acceso a Firestore del módulo).
- [x] Módulo `reports`: `GET /reportes/alertas.csv` con los mismos filtros. CSV UTF-8 con BOM, una fila por alerta con sus duraciones; vacío donde no hay dato; textos que empiezan con `= + - @` se prefijan con `'` (evita fórmulas en Excel).
- [x] Pruebas: vector de la sección 8 (40 / 540 / 480 / 90 / 870 / 1500 s, ETA 0,1429), sin datos, simuladas, anomalías, series en zona de operación, ranking con "(eliminado)", CSV y 401/403/400 en las rutas.

**Verificación:** `typecheck`, `lint` y `test` (25) en verde. Las consultas reales a Firestore (`load-alertas.ts`) quedan por comprobar con tu Firebase.

**Supuestos y desviaciones (Fase 3):**
- Se integró el paquete `fase3-api.zip`, que estaba hecho sobre la versión anterior a los patrones. Se adaptó a la composición actual: `crearModulos(firebase, log, kpi)` y rutas que reciben un servicio (`kpis.service.ts`, `reports.service.ts`). La fachada y el decorador de ambulancias no cambian.
- `buildApp` recibe `kpi?: ConfigKpi` (por defecto 600 s y `America/Bogota`); `server.ts` lo lee de `KPI_UMBRAL_RESPUESTA_SEG` y `TZ_OPERACION`.
- Strategy: el ranking elige el criterio de agrupación con un mapa de estrategias por tipo (`claveDe`). Con un solo formato de reporte (CSV) no se añadió una estrategia de formato; se hará si aparece un segundo formato.
- **Archivos fuera del plan:** `domain/alerta.ts`, `modules/tipos.ts` (`ConfigKpi`), `kpis/kpis.service.ts`, `reports/alertas-csv.ts`, `reports/reports.service.ts`, `src/test/vector-kpi.ts`.

## Desviaciones y supuestos (1-C)

- **Registro de módulos explícito** (`modules/index.ts`) en lugar de `@fastify/autoload`: autoload con archivos `.ts` bajo Vitest suele fallar y aquí no se podía comprobar. Cambia a autoload en ese único archivo si lo prefieres; cada fase solo agrega su módulo a la lista.
- **`AppError`** (plugins/errors.ts), `registrarErrores` y `registrarAuth` son funciones que configuran la instancia raíz (sin `fastify-plugin`).
- **Puertos** (`domain/puertos.ts`): la API habla con interfaces (`CuentasPort`, `AmbulanciasStore`, `TokenVerifier`, `RolReader`); `config/firebase.ts` y `ambulances.store.ts` son las únicas implementaciones reales. `buildApp({ firebase })` recibe esos puertos.
- **Composición de módulos** (`modules/index.ts`): arma la fachada del módulo y entrega su servicio a las rutas. `ambulances.audit-decorator.ts` envuelve las operaciones y registra auditoría después de cada éxito; los fallos de auditoría se notifican en el log sin ocultar el resultado de negocio.
- **KPI y reportes**: incorporados en la Fase 3 (ver abajo).
- **Rutas con prefijo completo** (`/api/v1/ambulancias/...`) declarado en cada archivo de rutas.
- **Respuestas:** `201` con la ambulancia (fechas ISO) en crear; `200 { resultados }` en lote; `204` sin cuerpo en el resto.
- **Archivos fuera del plan:** `domain/puertos.ts`, `modules/index.ts`, `modules/tipos.ts`, `src/test/fake-firebase.ts`, `tsconfig.build.json`, `README.md`.
- **Versiones:** rangos con `^` para las dependencias nuevas (`fastify`, `@fastify/cors`, `firebase-admin`); `npm install` fijará las vigentes.
