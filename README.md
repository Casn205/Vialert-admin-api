# ambulancias-api

Backend (Node + Fastify) del panel web de ambulancias y alertas. Es el único lugar con permisos de
Admin SDK: crea cuentas de ambulancias, las deshabilita, cambia contraseñas y cierra turnos colgados.
La web lo llama con el ID token de Firebase del administrador (`Authorization: Bearer ...`).

## Arranque

```bash
npm install            # genera package-lock.json: commitéalo (el Dockerfile lo usa con `npm ci`)
cp .env.example .env   # completa FIREBASE_PROJECT_ID y las credenciales de Admin SDK
npm run dev            # http://localhost:3000  ·  GET /health
```

La web apunta a esta API con `VITE_API_BASE_URL=http://localhost:3000`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga (`tsx watch`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (incluye las reglas de frontera de `firebase-admin`) |
| `npm test` | Vitest con Firebase falso (no necesita red ni credenciales) |
| `npm run build` / `npm start` | Compila a `dist/` y ejecuta |

## Rutas (`/api/v1`, todas exigen admin salvo `/health`)

`POST /ambulancias` · `POST /ambulancias/lote` · `PATCH /ambulancias/:id` ·
`POST /ambulancias/:id/{deshabilitar,habilitar,password,cerrar-turno}` ·
`GET /kpis/{resumen,series,ranking}` · `GET /reportes/alertas.csv`

Contratos completos en la sección 6.1 de `PLAN_MAESTRO.md`.

## Estructura

```
src/
  app.ts  server.ts          buildApp({ firebase, kpi }) / listen
  config/   env.ts  firebase.ts      (único que importa firebase-admin)
  plugins/  auth.ts  errors.ts
  domain/   tipos.ts  fecha.ts  mappers.ts  puertos.ts  alerta.ts
  modules/  health/  ambulances/{routes,facade,service,audit-decorator,store,dto}
            kpis/{routes,service,calculators,stats,dto,load-alertas}  reports/{routes,service,alertas-csv}
  test/     fake-firebase.ts  vector-kpi.ts
```

Las rutas consumen la fachada del módulo; no acceden a Auth, stores ni auditoría. La auditoría
envuelve al servicio con un decorador y no cambia el resultado de una acción ya completada si falla
su escritura. Los KPI y el CSV siguen el mismo esquema (rutas → servicio): las fórmulas son funciones
puras en `kpis/calculators.ts` y el ranking elige su criterio con una estrategia por tipo (`claveDe`).
