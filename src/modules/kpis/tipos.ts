import type { AlertaKpi, Prioridad } from '../../domain/alerta.js';
import type { EstadoAlerta } from '../../domain/alerta.js';

/** Contratos de respuesta de la sección 6.1 del plan (iguales a `core/domain/kpi.ts` de la web). */
export interface Estadistica {
  n: number;
  /** Segundos enteros. */
  media: number | null;
  mediana: number | null;
  p90: number | null;
}

export interface KpiResumen {
  rango: { desde: string; hasta: string };
  totalAlertas: number;
  porEstado: Record<EstadoAlerta, number>;
  tiempos: {
    asignacion: Estadistica;
    respuesta: Estadistica;
    viaje: Estadistica;
    enEscena: Estadistica;
    traslado: Estadistica;
    cicloTotal: Estadistica;
  };
  precisionEta: { n: number; errorRelativoMedio: number | null };
  cumplimientoRespuesta: { umbralSeg: number; n: number; porcentaje: number | null };
  operacion: { liberaciones: number; recalculosPromedio: number | null; alertasConFotos: number };
  descartadas: { simuladas: number; sinDato: Record<string, number>; anomalias: number };
}

export interface KpiSerie {
  /** Inicio del tramo, instante ISO UTC (el corte de día/hora se hace en `TZ_OPERACION`). */
  bucket: string;
  total: number;
  atendidas: number;
  respuestaMediaSeg: number | null;
}

export interface KpiRankingItem {
  id: string;
  etiqueta: string;
  atendidas: number;
  respuestaMediaSeg: number | null;
  enEscenaMediaSeg: number | null;
  /** Solo en el ranking de hospitales. */
  traslados?: number;
  trasladoMedioSeg?: number | null;
}

export interface FiltroKpi {
  desde: Date;
  hasta: Date;
  tipo?: string | undefined;
  prioridad?: Prioridad | undefined;
  ambulanciaId?: string | undefined;
  incluirSimuladas?: boolean | undefined;
}

export type Granularidad = 'dia' | 'hora';
export type { AlertaKpi };
