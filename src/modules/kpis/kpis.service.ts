import type { KpisStore, TipoRanking } from '../../domain/puertos.js';
import type { ConfigKpi } from '../tipos.js';
import { calcularRanking, calcularResumen, calcularSeries } from './calculators.js';
import type { FiltroKpi, Granularidad, KpiRankingItem, KpiResumen, KpiSerie } from './tipos.js';

/** Lo único que ven las rutas de KPI: carga las alertas del rango y delega en los calculadores puros. */
export interface ServicioKpis {
  resumen(f: FiltroKpi): Promise<KpiResumen>;
  series(f: FiltroKpi, granularidad: Granularidad): Promise<KpiSerie[]>;
  ranking(f: FiltroKpi, por: TipoRanking): Promise<KpiRankingItem[]>;
}

export function crearServicioKpis(store: KpisStore, config: ConfigKpi): ServicioKpis {
  return {
    async resumen(f) {
      return calcularResumen(await store.cargarAlertas(f.desde, f.hasta), f, config.umbralRespuestaSeg);
    },

    async series(f, granularidad) {
      return calcularSeries(await store.cargarAlertas(f.desde, f.hasta), f, granularidad, config.tz);
    },

    async ranking(f, por) {
      const [alertas, etiquetas] = await Promise.all([store.cargarAlertas(f.desde, f.hasta), store.cargarEtiquetas(por)]);
      return calcularRanking(alertas, f, por, etiquetas);
    },
  };
}
