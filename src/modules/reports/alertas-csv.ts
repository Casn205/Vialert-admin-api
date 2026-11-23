import type { AlertaKpi } from '../../domain/alerta.js';
import { CLAVES_DURACION, medirAlerta, seleccionar } from '../kpis/calculators.js';
import type { FiltroKpi } from '../kpis/tipos.js';

const BOM = '\uFEFF';
const FIN_LINEA = '\r\n';

const COLUMNAS = [
  'id',
  'tipo',
  'estado',
  'prioridad',
  'creadaEn',
  'ambulanciaId',
  'conductorId',
  'paramedicoId',
  'hospitalDestinoId',
  'simulada',
  'liberaciones',
  'recalculos',
  'fotos',
  ...CLAVES_DURACION.map((k) => `${k}Seg`),
] as const;

/**
 * Celda CSV (RFC 4180). Los textos libres (p. ej. `type`) que empiezan con `= + - @` se prefijan con `'`
 * para que Excel no los ejecute como fórmula.
 */
function celda(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

function fila(a: AlertaKpi): string[] {
  const medidas = medirAlerta(a);
  return [
    a.id,
    a.type,
    a.estado,
    a.prioridad ?? '',
    a.createdAtServer?.toISOString() ?? '',
    a.ambulanciaAsignada ?? '',
    a.conductorId ?? '',
    a.paramedicoId ?? '',
    a.hospitalDestinoId ?? '',
    String(a.simulada),
    String(a.liberaciones),
    String(a.recalculos),
    String(a.fotos),
    // Sin dato, anomalía o "no aplica" → celda vacía (nunca cero).
    ...CLAVES_DURACION.map((k) => {
      const m = medidas[k];
      return m.tipo === 'valor' ? String(m.seg) : '';
    }),
  ];
}

/** Una fila por alerta en alcance (mismos filtros que los KPI) con sus duraciones en segundos. UTF-8 con BOM. */
export function generarCsvAlertas(todas: readonly AlertaKpi[], f: FiltroKpi): string {
  const filas = seleccionar(todas, f).enAlcance.map(fila);
  return BOM + [[...COLUMNAS], ...filas].map((c) => c.map(celda).join(',')).join(FIN_LINEA) + FIN_LINEA;
}
