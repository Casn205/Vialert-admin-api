import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { crearFirebaseFalso, sembrarAmbulancia, type FirebaseFalso } from '../../test/fake-firebase.js';

const ADMIN = { authorization: 'Bearer tok-admin' };
const BASE = '/api/v1/ambulancias';

let falso: FirebaseFalso;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  falso = crearFirebaseFalso();
  app = await buildApp({ firebase: falso.firebase });
});

const post = (url: string, payload?: unknown) => app.inject({ method: 'POST', url, headers: ADMIN, payload: payload as object });

const nueva = {
  email: '  amb-10@vialert.com ',
  password: 'clave-segura',
  placa: ' ABC123 ',
  codigoInterno: 'AMB-10',
  entidadId: ' hospital del sur ',
};

describe('POST /ambulancias', () => {
  it('deja Auth, ambulancias/{uid} y roles/{uid} consistentes, normaliza y audita', async () => {
    const res = await post(BASE, nueva);
    expect(res.statusCode).toBe(201);
    const cuerpo = res.json();
    expect(cuerpo).toMatchObject({ placa: 'ABC123', entidadId: 'HOSPITAL DEL SUR', estadoOperativo: 'habilitada', enTurno: false });

    const uid: string = cuerpo.id;
    expect(falso.usuarios.get(uid)).toMatchObject({ email: 'amb-10@vialert.com', deshabilitado: false });
    expect(falso.ambulancias.get(uid)).toMatchObject({ placa: 'ABC123', entidadId: 'HOSPITAL DEL SUR', enTurno: false });
    expect(falso.roles.get(uid)).toBe('ambulancia');
    expect(falso.auditoria).toEqual([{ uid: 'admin-1', accion: 'crear', objetivoId: uid }]);
    // La contraseña no sale en la respuesta ni queda en la auditoría.
    expect(JSON.stringify([cuerpo, falso.auditoria])).not.toContain('clave-segura');
  });

  it('rechaza datos inválidos con 400 VALIDATION_ERROR y no crea nada', async () => {
    const res = await post(BASE, { ...nueva, password: '123' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(falso.usuarios.size).toBe(0);
  });

  it('un correo repetido responde 409 CONFLICT y no deja documentos', async () => {
    sembrarAmbulancia(falso, 'amb-1', { email: 'amb-10@vialert.com' });
    falso.usuarios.get('amb-1')!.email = 'amb-10@vialert.com';
    const antes = falso.ambulancias.size;

    const res = await post(BASE, nueva);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
    expect(falso.ambulancias.size).toBe(antes);
  });

  it('si falla el batch borra el usuario de Auth (sin huérfanos)', async () => {
    falso.fallos.crearDocumentos = true;
    const res = await post(BASE, nueva);
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('INTERNAL');
    expect(falso.usuarios.size).toBe(0);
    expect(falso.ambulancias.size).toBe(0);
  });

  it('si falla la auditoría conserva el resultado exitoso de la acción', async () => {
    falso.fallos.auditoria = true;
    const res = await post(BASE, nueva);

    expect(res.statusCode).toBe(201);
    expect(falso.ambulancias.size).toBe(1);
    expect(falso.auditoria).toEqual([]);
  });
});

describe('POST /ambulancias/lote', () => {
  it('reporta el resultado de cada fila y un error no detiene las demás', async () => {
    falso.usuarios.set('uid-existente', { email: 'dup@vialert.com', password: 'x', deshabilitado: false, tokensRevocados: 0 });
    const res = await post(`${BASE}/lote`, {
      entidadId: 'cruz roja',
      estadoOperativo: 'habilitada',
      password: 'clave-segura',
      filas: [
        { placa: 'AAA111', codigoInterno: 'F-01', email: 'f01@vialert.com' },
        { placa: 'BBB222', codigoInterno: 'F-02', email: 'dup@vialert.com' }, // correo ya existe
        { placa: '', codigoInterno: 'F-03', email: 'f03@vialert.com' }, // fila inválida
        { placa: 'DDD444', codigoInterno: 'F-04', email: 'f04@vialert.com' },
      ],
    });

    expect(res.statusCode).toBe(200);
    const { resultados } = res.json();
    expect(resultados).toEqual([
      { fila: 0, ok: true, id: expect.any(String) },
      { fila: 1, ok: false, error: 'Ya existe una cuenta con ese correo.' },
      { fila: 2, ok: false, error: 'La placa es obligatoria' },
      { fila: 3, ok: true, id: expect.any(String) },
    ]);
    expect(falso.ambulancias.size).toBe(2);
    expect([...falso.ambulancias.values()].every((d) => d.entidadId === 'CRUZ ROJA')).toBe(true);
  });

  it('con estado "inactiva" crea las cuentas de Auth deshabilitadas', async () => {
    const res = await post(`${BASE}/lote`, {
      entidadId: 'CRUZ ROJA',
      estadoOperativo: 'inactiva',
      password: 'clave-segura',
      filas: [{ placa: 'AAA111', codigoInterno: 'F-01', email: 'f01@vialert.com' }],
    });
    const id: string = res.json().resultados[0].id;
    expect(falso.usuarios.get(id)?.deshabilitado).toBe(true);
    expect(falso.ambulancias.get(id)?.estadoOperativo).toBe('inactiva');
  });
});

describe('deshabilitar', () => {
  it('responde 409 si la ambulancia está en turno y no toca la cuenta', async () => {
    sembrarAmbulancia(falso, 'amb-1', { enTurno: true, estadoOperativo: 'enRuta' });
    const res = await post(`${BASE}/amb-1/deshabilitar`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
    expect(falso.usuarios.get('amb-1')?.deshabilitado).toBe(false);
  });

  it('deshabilita la cuenta y marca la ambulancia como inactiva', async () => {
    sembrarAmbulancia(falso, 'amb-2');
    const res = await post(`${BASE}/amb-2/deshabilitar`);
    expect(res.statusCode).toBe(204);
    expect(falso.usuarios.get('amb-2')?.deshabilitado).toBe(true);
    expect(falso.ambulancias.get('amb-2')?.estadoOperativo).toBe('inactiva');
    expect(falso.auditoria).toEqual([{ uid: 'admin-1', accion: 'deshabilitar', objetivoId: 'amb-2' }]);
  });
});

describe('cerrar-turno', () => {
  it('responde 409 si hay una alerta en curso y no cambia nada', async () => {
    sembrarAmbulancia(falso, 'amb-3', { enTurno: true, estadoOperativo: 'enRuta', currentAlertaId: 'al-1', currentConductorId: 'c-1' });
    falso.conductores.set('c-1', { estado: 'ocupado', ambulanciaId: 'amb-3' });
    falso.ubicaciones.add('amb-3');

    const res = await post(`${BASE}/amb-3/cerrar-turno`);
    expect(res.statusCode).toBe(409);
    expect(falso.ambulancias.get('amb-3')).toMatchObject({ enTurno: true, currentAlertaId: 'al-1' });
    expect(falso.conductores.get('c-1')).toMatchObject({ estado: 'ocupado' });
    expect(falso.ubicaciones.has('amb-3')).toBe(true);
  });

  it('cierra el turno colgado: limpia la unidad, borra la ubicación y libera al personal', async () => {
    sembrarAmbulancia(falso, 'amb-4', {
      enTurno: true,
      estadoOperativo: 'enRuta',
      currentConductorId: 'c-1',
      currentParamedicoId: 'p-1',
      turnoIniciadoAt: '2026-11-21T10:00:00.000Z',
    });
    falso.conductores.set('c-1', { estado: 'ocupado', ambulanciaId: 'amb-4' });
    falso.paramedicos.set('p-1', { estado: 'ocupado', ambulanciaId: 'amb-4' });
    falso.ubicaciones.add('amb-4');

    const res = await post(`${BASE}/amb-4/cerrar-turno`);
    expect(res.statusCode).toBe(204);

    const a = falso.ambulancias.get('amb-4')!;
    expect(a).toMatchObject({ enTurno: false, estadoOperativo: 'habilitada', currentConductorId: null, currentParamedicoId: null });
    expect(a).not.toHaveProperty('turnoIniciadoAt');
    expect(falso.ubicaciones.has('amb-4')).toBe(false);
    expect(falso.conductores.get('c-1')).toEqual({ estado: 'disponible', ambulanciaId: null });
    expect(falso.paramedicos.get('p-1')).toEqual({ estado: 'disponible', ambulanciaId: null });
    expect(falso.auditoria).toEqual([{ uid: 'admin-1', accion: 'cerrar_turno', objetivoId: 'amb-4' }]);
  });
});
