import { aFecha, aISO } from './fecha.js';
import { ESTADOS_OPERATIVOS, type Ambulancia, type AmbulanciaDto, type Doc, type EstadoOperativo } from './tipos.js';

const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const booleano = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const estado = (v: unknown): EstadoOperativo | null =>
  typeof v === 'string' && (ESTADOS_OPERATIVOS as readonly string[]).includes(v) ? (v as EstadoOperativo) : null;

/** `ambulancias/{uid}` → `Ambulancia`. Tolerante: todo es opcional salvo el id (igual que el mapper de la web). */
export function mapAmbulancia(id: string, d: Doc): Ambulancia {
  const currentConductorId = texto(d.currentConductorId);
  const currentParamedicoId = texto(d.currentParamedicoId);
  return {
    id,
    email: texto(d.email) ?? '',
    placa: texto(d.placa) ?? '',
    codigoInterno: texto(d.codigoInterno) ?? '',
    entidadId: texto(d.entidadId) ?? '',
    estadoOperativo: estado(d.estadoOperativo) ?? 'habilitada',
    currentConductorId,
    currentParamedicoId,
    currentAlertaId: texto(d.currentAlertaId),
    // Si el campo no existe (datos antiguos) se deduce del personal a bordo, como la app.
    enTurno: booleano(d.enTurno) ?? (currentConductorId !== null || currentParamedicoId !== null),
    turnoIniciadoAt: aFecha(d.turnoIniciadoAt),
    ultimoCambioEstadoAt: aFecha(d.ultimoCambioEstadoAt),
    createdAt: aFecha(d.createdAt),
  };
}

export function ambulanciaADto(a: Ambulancia): AmbulanciaDto {
  return {
    ...a,
    turnoIniciadoAt: aISO(a.turnoIniciadoAt),
    ultimoCambioEstadoAt: aISO(a.ultimoCambioEstadoAt),
    createdAt: aISO(a.createdAt),
  };
}
