import { aFecha } from './fecha.js';
import type { Doc } from './tipos.js';

export type EstadoAlerta = 'activa' | 'enProceso' | 'atendida';
export const ESTADOS_ALERTA: readonly EstadoAlerta[] = ['activa', 'enProceso', 'atendida'];

export type Prioridad = 'critica' | 'alta' | 'media' | 'baja';
export const PRIORIDADES = ['critica', 'alta', 'media', 'baja'] as const satisfies readonly Prioridad[];

/** Solo los campos de `alertas/{id}` que necesitan los KPI. `null` = "sin dato" (nunca cero). */
export interface AlertaKpi {
  id: string;
  type: string;
  estado: EstadoAlerta;
  prioridad: Prioridad | null;
  ambulanciaAsignada: string | null;
  conductorId: string | null;
  paramedicoId: string | null;
  hospitalDestinoId: string | null;
  /** Hora del servidor: base de todos los tiempos. */
  createdAtServer: Date | null;
  tomadaAt: Date | null;
  rutaIniciadaAt: Date | null;
  llegadaAt: Date | null;
  atendidaAt: Date | null;
  trasladoIniciadoAt: Date | null;
  trasladoFinalizadoAt: Date | null;
  etaInicialSeg: number | null;
  recalculos: number;
  liberaciones: number;
  /** Cantidad de fotos. */
  fotos: number;
  simulada: boolean;
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const enumDe = <T extends string>(v: unknown, validos: readonly T[]): T | null =>
  typeof v === 'string' && (validos as readonly string[]).includes(v) ? (v as T) : null;

/** `alertas/{id}` → `AlertaKpi`. Tolerante: los defaults son los de la app y nunca lanza por un campo ausente. */
export function mapAlertaKpi(id: string, d: Doc): AlertaKpi {
  return {
    id,
    type: texto(d.type) ?? '',
    estado: enumDe(d.estado, ESTADOS_ALERTA) ?? 'activa',
    prioridad: enumDe(d.prioridad, PRIORIDADES),
    ambulanciaAsignada: texto(d.ambulanciaAsignada),
    conductorId: texto(d.conductorId),
    paramedicoId: texto(d.paramedicoId),
    hospitalDestinoId: texto(d.hospitalDestinoId),
    createdAtServer: aFecha(d.createdAtServer),
    tomadaAt: aFecha(d.tomadaAt),
    rutaIniciadaAt: aFecha(d.rutaIniciadaAt),
    llegadaAt: aFecha(d.llegadaAt),
    atendidaAt: aFecha(d.atendidaAt),
    trasladoIniciadoAt: aFecha(d.trasladoIniciadoAt),
    trasladoFinalizadoAt: aFecha(d.trasladoFinalizadoAt),
    etaInicialSeg: numero(d.etaInicialSeg),
    recalculos: numero(d.recalculos) ?? 0,
    liberaciones: numero(d.liberaciones) ?? 0,
    fotos: Array.isArray(d.fotos) ? d.fotos.length : 0,
    simulada: d.simulada === true,
  };
}
