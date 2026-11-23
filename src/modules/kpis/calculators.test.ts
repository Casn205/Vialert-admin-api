import { describe, expect, it } from 'vitest';
import { alertaVector, RANGO_VECTOR } from '../../test/vector-kpi.js';
import { calcularRanking, calcularResumen, calcularSeries } from './calculators.js';

const UMBRAL = 600;

describe('KPI: vector de la sección 8', () => {
  it('da exactamente los valores esperados', () => {
    const r = calcularResumen([alertaVector()], RANGO_VECTOR, UMBRAL);
    expect(r.totalAlertas).toBe(1);
    expect(r.tiempos.asignacion.media).toBe(40);
    expect(r.tiempos.respuesta.media).toBe(540);
    expect(r.tiempos.viaje.media).toBe(480);
    expect(r.tiempos.enEscena.media).toBe(90);
    expect(r.tiempos.traslado.media).toBe(870);
    expect(r.tiempos.cicloTotal.media).toBe(1500);
    expect(r.precisionEta.errorRelativoMedio).toBeCloseTo(0.1429, 4);
    expect(r.cumplimientoRespuesta).toEqual({ umbralSeg: UMBRAL, n: 1, porcentaje: 100 });
  });
});

describe('KPI: casos de borde', () => {
  it('sin datos: n = 0 y todo en null (nunca cero)', () => {
    const r = calcularResumen([], RANGO_VECTOR, UMBRAL);
    expect(r.totalAlertas).toBe(0);
    expect(r.tiempos.respuesta).toEqual({ n: 0, media: null, mediana: null, p90: null });
    expect(r.precisionEta).toEqual({ n: 0, errorRelativoMedio: null });
    expect(r.cumplimientoRespuesta.porcentaje).toBeNull();
    expect(r.operacion.recalculosPromedio).toBeNull();
  });

  it('excluye simuladas, cuenta anomalías y sin dato, y descarta alertas sin createdAtServer', () => {
    const alertas = [
      alertaVector({ id: 'ok' }),
      alertaVector({ id: 'sim', simulada: true }),
      alertaVector({ id: 'sin-servidor', createdAtServer: null }),
      // llegada antes de la creación → duración negativa (anomalía en respuesta, viaje y asignación no)
      alertaVector({ id: 'anomala', llegadaAt: new Date('2026-11-20T09:00:00Z') }),
      // sin hitos: nunca fue tomada
      alertaVector({ id: 'activa', estado: 'activa', tomadaAt: null, rutaIniciadaAt: null, llegadaAt: null, atendidaAt: null, trasladoIniciadoAt: null, trasladoFinalizadoAt: null }),
    ];
    const r = calcularResumen(alertas, RANGO_VECTOR, UMBRAL);
    expect(r.totalAlertas).toBe(3); // ok, anomala, activa
    expect(r.descartadas.simuladas).toBe(1);
    expect(r.descartadas.anomalias).toBeGreaterThanOrEqual(1);
    expect(r.descartadas.sinDato.asignacion).toBe(1); // la activa
    expect(r.descartadas.sinDato.enEscena).toBe(0); // sin traslado: no aplica, no es "sin dato"
    expect(r.tiempos.respuesta.n).toBe(1); // solo la alerta ok cuenta
    expect(calcularResumen(alertas, { ...RANGO_VECTOR, incluirSimuladas: true }, UMBRAL).totalAlertas).toBe(4);
  });

  it('series por día en zona de operación y ranking con "(eliminado)"', () => {
    // 02:00 UTC del 21 = 21:00 del día 20 en Bogotá (UTC-5): cae en el día 20 local.
    const tarde = alertaVector({ id: 'tarde', createdAtServer: new Date('2026-11-21T02:00:00Z') });
    const f = { desde: new Date('2026-11-20T00:00:00Z'), hasta: new Date('2026-11-22T00:00:00Z') };
    const series = calcularSeries([alertaVector(), tarde], f, 'dia', 'America/Bogota');
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ bucket: '2026-11-20T05:00:00.000Z', total: 2 });

    const ranking = calcularRanking([alertaVector()], f, 'hospital', new Map());
    expect(ranking[0]).toMatchObject({ id: 'h-1', etiqueta: '(eliminado)', traslados: 1, trasladoMedioSeg: 870 });
  });
});
