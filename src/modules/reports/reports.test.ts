import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { crearFirebaseFalso, type FirebaseFalso } from '../../test/fake-firebase.js';
import { alertaVector, RANGO_VECTOR } from '../../test/vector-kpi.js';
import { generarCsvAlertas } from './alertas-csv.js';

const ADMIN = { authorization: 'Bearer tok-admin' };
const QUERY = 'desde=2026-11-20T00:00:00Z&hasta=2026-11-20T23:59:59Z';

const lineas = (csv: string) => csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');

describe('CSV de alertas', () => {
  it('UTF-8 con BOM, encabezado y una fila por alerta con las duraciones del vector', () => {
    const csv = generarCsvAlertas([alertaVector()], RANGO_VECTOR);
    expect(csv.startsWith('\uFEFF')).toBe(true);

    const [encabezado, fila, ...resto] = lineas(csv);
    expect(resto).toHaveLength(0);
    const columnas = encabezado!.split(',');
    const valores = Object.fromEntries(columnas.map((c, i) => [c, fila!.split(',')[i]]));
    expect(valores).toMatchObject({
      id: 'vector',
      tipo: 'Accidente',
      estado: 'atendida',
      creadaEn: '2026-11-20T10:00:00.000Z',
      asignacionSeg: '40',
      respuestaSeg: '540',
      viajeSeg: '480',
      enEscenaSeg: '90',
      trasladoSeg: '870',
      cicloTotalSeg: '1500',
    });
  });

  it('aplica los filtros de los KPI: simuladas fuera por defecto', () => {
    const alertas = [alertaVector({ id: 'real' }), alertaVector({ id: 'sim', simulada: true })];
    expect(lineas(generarCsvAlertas(alertas, RANGO_VECTOR))).toHaveLength(2);
    expect(lineas(generarCsvAlertas(alertas, { ...RANGO_VECTOR, incluirSimuladas: true }))).toHaveLength(3);
  });

  it('deja vacío lo que no tiene dato (nunca cero) y escapa comas, comillas y fórmulas', () => {
    const csv = generarCsvAlertas(
      [
        alertaVector({ id: 'a', type: 'Choque, "grave"', llegadaAt: null }),
        alertaVector({ id: 'b', type: '=HYPERLINK("x")' }),
      ],
      RANGO_VECTOR,
    );
    const [, filaA, filaB] = lineas(csv);
    expect(filaA).toContain('"Choque, ""grave"""');
    expect(filaA).toMatch(/,atendida,alta,2026-11-20T10:00:00.000Z,/);
    expect(filaA!.split(',').at(-5)).toBe(''); // respuestaSeg sin llegada
    expect(filaB).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('GET /reportes/alertas.csv', () => {
  let falso: FirebaseFalso;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    falso = crearFirebaseFalso();
    falso.alertas.push(alertaVector());
    app = await buildApp({ firebase: falso.firebase });
  });

  it('descarga el CSV como adjunto para un admin', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/v1/reportes/alertas.csv?${QUERY}`, headers: ADMIN });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(r.headers['content-disposition']).toBe('attachment; filename="alertas.csv"');
    expect(lineas(r.body)).toHaveLength(2);
  });

  it('exige admin (403) y valida el rango (400)', async () => {
    const noAdmin = await app.inject({
      method: 'GET',
      url: `/api/v1/reportes/alertas.csv?${QUERY}`,
      headers: { authorization: 'Bearer tok-usuario' },
    });
    expect(noAdmin.statusCode).toBe(403);

    const malRango = await app.inject({
      method: 'GET',
      url: '/api/v1/reportes/alertas.csv?desde=2026-11-21T00:00:00Z&hasta=2026-11-20T00:00:00Z',
      headers: ADMIN,
    });
    expect(malRango.statusCode).toBe(400);
  });
});
