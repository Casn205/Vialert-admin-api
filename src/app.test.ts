import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { crearFirebaseFalso } from './test/fake-firebase.js';

async function montar() {
  const falso = crearFirebaseFalso();
  const app = await buildApp({ firebase: falso.firebase });
  return { app, falso };
}

describe('API base', () => {
  it('GET /health es público', async () => {
    const { app } = await montar();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('sin token responde 401 UNAUTHENTICATED con el formato de error del plan', async () => {
    const { app } = await montar();
    const res = await app.inject({ method: 'POST', url: '/api/v1/ambulancias/lote', payload: {} });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'UNAUTHENTICATED', message: expect.any(String) } });
  });

  it('un usuario que no es admin recibe 403 FORBIDDEN', async () => {
    const { app } = await montar();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ambulancias/amb-1/cerrar-turno',
      headers: { authorization: 'Bearer tok-usuario' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });
});
