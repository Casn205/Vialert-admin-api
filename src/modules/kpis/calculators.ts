import type { AlertaKpi } from '../../domain/alerta.js';
import type { TipoRanking } from '../../domain/puertos.js';
import { estadistica, mediaEntera, sinNulos } from './stats.js';
import type { FiltroKpi, Granularidad, KpiRankingItem, KpiResumen, KpiSerie } from './tipos.js';

/** Una duración mayor a 24 h se considera anomalía. */
export const MAX_DURACION_SEG = 86_400;

export const CLAVES_DURACION = ['asignacion', 'respuesta', 'viaje', 'enEscena', 'traslado', 'cicloTotal'] as const;
export type ClaveDuracion = (typeof CLAVES_DURACION)[number];

type Medida = { tipo: 'valor'; seg: number } | { tipo: 'sinDato' } | { tipo: 'anomalia' } | { tipo: 'noAplica' };
const SIN_DATO: Medida = { tipo: 'sinDato' };
const ANOMALIA: Medida = { tipo: 'anomalia' };
const NO_APLICA: Medida = { tipo: 'noAplica' };

function medir(desde: Date | null, hasta: Date | null): Medida {
  if (!desde || !hasta) return SIN_DATO;
  const seg = Math.round((hasta.getTime() - desde.getTime()) / 1000);
  return seg >= 0 && seg <= MAX_DURACION_SEG ? { tipo: 'valor', seg } : ANOMALIA;
}

/** Duraciones de una alerta (sección 8). Escena y traslado solo aplican si hubo traslado. */
export function medirAlerta(a: AlertaKpi): Record<ClaveDuracion, Medida> {
  const t0 = a.createdAtServer;
  const hubo = a.trasladoIniciadoAt !== null;
  return {
    asignacion: medir(t0, a.tomadaAt),
    respuesta: medir(t0, a.llegadaAt),
    viaje: medir(a.rutaIniciadaAt, a.llegadaAt),
    enEscena: hubo ? medir(a.llegadaAt, a.trasladoIniciadoAt) : NO_APLICA,
    traslado: hubo ? medir(a.trasladoIniciadoAt, a.trasladoFinalizadoAt) : NO_APLICA,
    cicloTotal: medir(t0, a.trasladoFinalizadoAt ?? a.atendidaAt),
  };
}

const segundos = (m: Medida): number | null => (m.tipo === 'valor' ? m.seg : null);

/** Error relativo del ETA: `(viaje − etaInicialSeg) / etaInicialSeg`, solo con `etaInicialSeg > 0`. */
function errorEta(a: AlertaKpi, viaje: Medida): number | null {
  return viaje.tipo === 'valor' && a.etaInicialSeg !== null && a.etaInicialSeg > 0
    ? (viaje.seg - a.etaInicialSeg) / a.etaInicialSeg
    : null;
}

/** Alcance: `createdAtServer` dentro del rango y filtros; simuladas fuera salvo `incluirSimuladas`. */
export function seleccionar(todas: readonly AlertaKpi[], f: FiltroKpi): { enAlcance: AlertaKpi[]; simuladasExcluidas: number } {
  const enAlcance: AlertaKpi[] = [];
  let simuladasExcluidas = 0;
  for (const a of todas) {
    const t = a.createdAtServer;
    if (!t || t < f.desde || t > f.hasta) continue;
    if (f.tipo && a.type !== f.tipo) continue;
    if (f.prioridad && a.prioridad !== f.prioridad) continue;
    if (f.ambulanciaId && a.ambulanciaAsignada !== f.ambulanciaId) continue;
    if (a.simulada && !f.incluirSimuladas) {
      simuladasExcluidas += 1;
      continue;
    }
    enAlcance.push(a);
  }
  return { enAlcance, simuladasExcluidas };
}

export function calcularResumen(todas: readonly AlertaKpi[], f: FiltroKpi, umbralSeg: number): KpiResumen {
  const { enAlcance, simuladasExcluidas } = seleccionar(todas, f);
  const medidas = enAlcance.map(medirAlerta);

  const sinDato: Record<string, number> = Object.fromEntries(CLAVES_DURACION.map((k) => [k, 0]));
  let anomalias = 0;
  for (const m of medidas) {
    for (const k of CLAVES_DURACION) {
      if (m[k].tipo === 'sinDato') sinDato[k] = (sinDato[k] ?? 0) + 1;
      else if (m[k].tipo === 'anomalia') anomalias += 1;
    }
  }

  const col = (k: ClaveDuracion): number[] => sinNulos(medidas.map((m) => segundos(m[k])));
  const respuestas = col('respuesta');
  const errores = sinNulos(enAlcance.map((a, i) => errorEta(a, medidas[i]!.viaje)));
  const cuenta = (e: AlertaKpi['estado']) => enAlcance.filter((a) => a.estado === e).length;

  return {
    rango: { desde: f.desde.toISOString(), hasta: f.hasta.toISOString() },
    totalAlertas: enAlcance.length,
    porEstado: { activa: cuenta('activa'), enProceso: cuenta('enProceso'), atendida: cuenta('atendida') },
    tiempos: {
      asignacion: estadistica(col('asignacion')),
      respuesta: estadistica(respuestas),
      viaje: estadistica(col('viaje')),
      enEscena: estadistica(col('enEscena')),
      traslado: estadistica(col('traslado')),
      cicloTotal: estadistica(col('cicloTotal')),
    },
    precisionEta: {
      n: errores.length,
      errorRelativoMedio: errores.length ? errores.reduce((s, x) => s + x, 0) / errores.length : null,
    },
    cumplimientoRespuesta: {
      umbralSeg,
      n: respuestas.length,
      porcentaje: respuestas.length
        ? Math.round((respuestas.filter((s) => s <= umbralSeg).length / respuestas.length) * 1000) / 10
        : null,
    },
    operacion: {
      liberaciones: enAlcance.reduce((s, a) => s + a.liberaciones, 0),
      recalculosPromedio: enAlcance.length ? enAlcance.reduce((s, a) => s + a.recalculos, 0) / enAlcance.length : null,
      alertasConFotos: enAlcance.filter((a) => a.fotos > 0).length,
    },
    descartadas: { simuladas: simuladasExcluidas, sinDato, anomalias },
  };
}

/** Inicio del día/hora local de `d` en la zona `tz`, como instante UTC. */
export function inicioDeTramo(d: Date, gran: Granularidad, tz: string): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, Number(x.value)]));
  const [y, mes, dia, h] = [p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0];
  const localComoUtc = Date.UTC(y, mes, dia, h, p.minute ?? 0, p.second ?? 0);
  const desfaseMs = localComoUtc - Math.floor(d.getTime() / 1000) * 1000; // hora local − instante real
  return new Date(Date.UTC(y, mes, dia, gran === 'hora' ? h : 0) - desfaseMs);
}

export function calcularSeries(todas: readonly AlertaKpi[], f: FiltroKpi, gran: Granularidad, tz: string): KpiSerie[] {
  const grupos = new Map<number, AlertaKpi[]>();
  for (const a of seleccionar(todas, f).enAlcance) {
    if (!a.createdAtServer) continue;
    const k = inicioDeTramo(a.createdAtServer, gran, tz).getTime();
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ms, l]) => ({
      bucket: new Date(ms).toISOString(),
      total: l.length,
      atendidas: l.filter((a) => a.estado === 'atendida').length,
      respuestaMediaSeg: mediaEntera(sinNulos(l.map((a) => segundos(medirAlerta(a).respuesta)))),
    }));
}

const claveDe: Record<TipoRanking, (a: AlertaKpi) => string | null> = {
  ambulancia: (a) => (a.estado === 'atendida' ? a.ambulanciaAsignada : null),
  conductor: (a) => (a.estado === 'atendida' ? a.conductorId : null),
  paramedico: (a) => (a.estado === 'atendida' ? a.paramedicoId : null),
  hospital: (a) => (a.trasladoFinalizadoAt ? a.hospitalDestinoId : null), // solo traslados finalizados
};

/** Rankings por ambulancia/conductor/paramédico (alertas atendidas) y por hospital (traslados finalizados). */
export function calcularRanking(
  todas: readonly AlertaKpi[],
  f: FiltroKpi,
  por: TipoRanking,
  etiquetas: ReadonlyMap<string, string>,
): KpiRankingItem[] {
  const grupos = new Map<string, AlertaKpi[]>();
  for (const a of seleccionar(todas, f).enAlcance) {
    const k = claveDe[por](a);
    if (k) grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  return [...grupos.entries()]
    .map(([id, l]): KpiRankingItem => {
      const m = l.map(medirAlerta);
      const col = (k: ClaveDuracion) => sinNulos(m.map((x) => segundos(x[k])));
      const base = {
        id,
        etiqueta: etiquetas.get(id) ?? '(eliminado)',
        atendidas: por === 'hospital' ? l.length : l.filter((a) => a.estado === 'atendida').length,
        respuestaMediaSeg: mediaEntera(col('respuesta')),
        enEscenaMediaSeg: mediaEntera(col('enEscena')),
      };
      return por === 'hospital'
        ? { ...base, respuestaMediaSeg: null, enEscenaMediaSeg: null, traslados: l.length, trasladoMedioSeg: mediaEntera(col('traslado')) }
        : base;
    })
    .sort((a, b) => b.atendidas - a.atendidas || a.etiqueta.localeCompare(b.etiqueta));
}
