# Progreso

## Fase 1 · Base y gestión de datos

### 1-C. API base, ambulancias y feature web: entregado (lado API)

- [x] Scaffold (Fastify 5, TypeScript estricto, ESLint con reglas de frontera, Vitest), `config/{env,firebase}`, `plugins/{auth,errors}`, `health`.
- [x] Módulo `ambulances`: crear, lote (máx. 50), editar, deshabilitar, habilitar, password, cerrar-turno y auditoría (`auditoria/{id}`: `{ uid, accion, objetivoId, ts }`).
- [x] `Dockerfile` (multi-etapa, sin estado, `GET /health`).
- [x] 12 pruebas esenciales con `fastify.inject` y Firebase falso: 401/403, creación consistente (Auth + `ambulancias` + `roles`), validación 400, correo duplicado 409, rollback del batch (sin usuario huérfano), lote con errores parciales, lote `inactiva`, deshabilitar (409 y OK) y cerrar-turno (409 y OK).

**Verificación pendiente de tu lado** (se escribió sin poder ejecutar `npm install` ni las pruebas): `npm install` (genera `package-lock.json`; commitéalo), `npm run typecheck`, `npm run lint`, `npm test`, y probar con tu proyecto de Firebase (ver `ambulancias-web/docs/CAMBIOS-1C.md`).

**Lo que las pruebas NO cubren:** el Firebase falso reimplementa las reglas de `cerrar-turno`; la transacción real de Firestore (`ambulances.store.ts`) y los códigos de error reales de Auth (`config/firebase.ts`) solo se comprueban con tu Firebase real. Además, no hay pruebas de editar, habilitar ni cambiar contraseña (se redujeron a lo esencial).

## Desviaciones y supuestos (1-C)

- **Registro de módulos explícito** (`modules/index.ts`) en lugar de `@fastify/autoload`: autoload con archivos `.ts` bajo Vitest suele fallar y aquí no se podía comprobar. Cambia a autoload en ese único archivo si lo prefieres; cada fase solo agrega su módulo a la lista.
- **`AppError`** (plugins/errors.ts), `registrarErrores` y `registrarAuth` son funciones que configuran la instancia raíz (sin `fastify-plugin`).
- **Puertos** (`domain/puertos.ts`): la API habla con interfaces (`CuentasPort`, `AmbulanciasStore`, `TokenVerifier`, `RolReader`); `config/firebase.ts` y `ambulances.store.ts` son las únicas implementaciones reales. `buildApp({ firebase })` recibe esos puertos.
- **Rutas con prefijo completo** (`/api/v1/ambulancias/...`) declarado en cada archivo de rutas.
- **Respuestas:** `201` con la ambulancia (fechas ISO) en crear; `200 { resultados }` en lote; `204` sin cuerpo en el resto.
- **Archivos fuera del plan:** `domain/puertos.ts`, `modules/index.ts`, `modules/tipos.ts`, `src/test/fake-firebase.ts`, `tsconfig.build.json`, `README.md`.
- **Versiones:** rangos con `^` para las dependencias nuevas (`fastify`, `@fastify/cors`, `firebase-admin`); `npm install` fijará las vigentes.
