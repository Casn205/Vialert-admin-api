/** Documento de Firestore sin tipar. Todo valor se valida antes de usarse. */
export type Doc = Record<string, unknown>;

export type EstadoOperativo = 'habilitada' | 'enRuta' | 'enRutaHospital' | 'inactiva';
export const ESTADOS_OPERATIVOS: readonly EstadoOperativo[] = ['habilitada', 'enRuta', 'enRutaHospital', 'inactiva'];

/** Equivalente a `Ambulancia` de la web (mismos campos y nombres). */
export interface Ambulancia {
  id: string;
  email: string;
  placa: string;
  codigoInterno: string;
  entidadId: string;
  estadoOperativo: EstadoOperativo;
  currentConductorId: string | null;
  currentParamedicoId: string | null;
  currentAlertaId: string | null;
  enTurno: boolean;
  turnoIniciadoAt: Date | null;
  ultimoCambioEstadoAt: Date | null;
  createdAt: Date | null;
}

/** Lo que la API devuelve: igual que `Ambulancia` pero con fechas ISO-8601 UTC. */
export type AmbulanciaDto = Omit<Ambulancia, 'turnoIniciadoAt' | 'ultimoCambioEstadoAt' | 'createdAt'> & {
  turnoIniciadoAt: string | null;
  ultimoCambioEstadoAt: string | null;
  createdAt: string | null;
};

/** Resultado de una fila del lote (`fila` es el índice en la lista enviada). */
export interface ResultadoFila {
  fila: number;
  ok: boolean;
  id?: string;
  error?: string;
}
