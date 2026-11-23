/** Configuración de los KPI que `buildApp` entrega a los módulos `kpis` y `reports`. */
export interface ConfigKpi {
  /** `KPI_UMBRAL_RESPUESTA_SEG`. */
  umbralRespuestaSeg: number;
  /** `TZ_OPERACION`: zona en la que se cortan los buckets por día y hora. */
  tz: string;
}

export const CONFIG_KPI_DEFAULT: ConfigKpi = { umbralRespuestaSeg: 600, tz: 'America/Bogota' };
