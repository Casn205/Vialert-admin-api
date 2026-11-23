import type { KpisStore } from '../../domain/puertos.js';
import type { FiltroKpi } from '../kpis/tipos.js';
import { generarCsvAlertas } from './alertas-csv.js';

export interface ServicioReportes {
  alertasCsv(f: FiltroKpi): Promise<string>;
}

export function crearServicioReportes(store: Pick<KpisStore, 'cargarAlertas'>): ServicioReportes {
  return {
    async alertasCsv(f) {
      return generarCsvAlertas(await store.cargarAlertas(f.desde, f.hasta), f);
    },
  };
}
