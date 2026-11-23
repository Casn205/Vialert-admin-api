import type { AlertaKpi } from '../domain/alerta.js';

const t = (hms: string) => new Date(`2026-11-20T${hms}Z`);

/** Vector de prueba obligatorio de la sección 8 del plan. */
export function alertaVector(sobrescribir: Partial<AlertaKpi> = {}): AlertaKpi {
  return {
    id: 'vector',
    type: 'Accidente',
    estado: 'atendida',
    prioridad: 'alta',
    ambulanciaAsignada: 'amb-1',
    conductorId: 'c-1',
    paramedicoId: 'p-1',
    hospitalDestinoId: 'h-1',
    createdAtServer: t('10:00:00'),
    tomadaAt: t('10:00:40'),
    rutaIniciadaAt: t('10:01:00'),
    llegadaAt: t('10:09:00'),
    atendidaAt: t('10:09:01'),
    trasladoIniciadoAt: t('10:10:30'),
    trasladoFinalizadoAt: t('10:25:00'),
    etaInicialSeg: 420,
    recalculos: 0,
    liberaciones: 0,
    fotos: 0,
    simulada: false,
    ...sobrescribir,
  };
}

export const RANGO_VECTOR = { desde: t('00:00:00'), hasta: t('23:59:59') };
