import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { crearFirebaseFalso, type FirebaseFalso } from '../../test/fake-firebase.js';
import { alertaVector } from '../../test/vector-kpi.js';

const ADMIN = { authorization: 'Bearer tok-admin' };
const QUERY = 'desde=2026-11-20T00:00:00Z&hasta=2026-11-20T23:59:59Z';

let falso: FirebaseFalso;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  falso = crearFirebaseFalso();
  falso.alertas.push(alertaVector());
  falso.etiquetas.ambulancia.set('amb-1', 'ABC123 · AMB-1');
  app = await buildApp({ firebase: falso.firebase });
});

describe('GET /kpis', () => {
  it('resumen y ranking responden con los valores del vector', async () => {
    const resumen = await app.inject({ method: 'GET', url: `/api/v1/kpis/resumen?${QUERY}`, headers: ADMIN });
    expect(resumen.statusCode).toBe(200);
    expect(resumen.json().tiempos.respuesta.media).toBe(540);

    const ranking = await app.inject({ method: 'GET', url: `/api/v1/kpis/ranking?${QUERY}&por=ambulancia`, headers: ADMIN });
    expect(ranking.json()[0]).toMatchObject({ id: 'amb-1', etiqueta: 'ABC123 · AMB-1', atendidas: 1, respuestaMediaSeg: 540 });
  });

  it('exige admin (403) y valida el rango (400)', async () => {
    const noAdmin = await app.inject({ method: 'GET', url: `/api/v1/kpis/resumen?${QUERY}`, headers: { authorization: 'Bearer tok-usuario' } });
    expect(noAdmin.statusCode).toBe(403);

    const malRango = await app.inject({
      method: 'GET',
      url: '/api/v1/kpis/resumen?desde=2026-11-21T00:00:00Z&hasta=2026-11-20T00:00:00Z',
      headers: ADMIN,
    });
    expect(malRango.statusCode).toBe(400);
    expect(malRango.json().error.code).toBe('VALIDATION_ERROR');
  });
});
