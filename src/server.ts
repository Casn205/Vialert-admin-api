import { buildApp } from './app.js';
import { cargarEnv } from './config/env.js';
import { cuentasDe, iniciarFirebase, rolesDe, tokensDe } from './config/firebase.js';
import { crearAmbulanciasStore } from './modules/ambulances/ambulances.store.js';
import { crearKpisStore } from './modules/kpis/load-alertas.js';

const env = cargarEnv();
const { auth, db } = iniciarFirebase(env);

const app = await buildApp({
  firebase: {
    tokens: tokensDe(auth),
    roles: rolesDe(db),
    cuentas: cuentasDe(auth),
    ambulancias: crearAmbulanciasStore(db),
    kpis: crearKpisStore(db),
  },
  kpi: { umbralRespuestaSeg: env.KPI_UMBRAL_RESPUESTA_SEG, tz: env.TZ_OPERACION },
  corsOrigins: env.CORS_ORIGINS,
  logger: { level: env.LOG_LEVEL },
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
