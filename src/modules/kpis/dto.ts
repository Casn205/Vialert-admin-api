import { z } from 'zod';
import { PRIORIDADES } from '../../domain/alerta.js';

const fecha = z.coerce.date({ error: 'La fecha no es válida (usa formato ISO-8601).' });
const booleano = z.enum(['true', 'false']).transform((v) => v === 'true');
const rangoValido = (d: { desde: Date; hasta: Date }) => d.desde <= d.hasta;
const MENSAJE_RANGO = 'La fecha "desde" no puede ser posterior a "hasta".';

const filtro = z.object({
  desde: fecha,
  hasta: fecha,
  tipo: z.string().trim().min(1).optional(),
  prioridad: z.enum(PRIORIDADES).optional(),
  ambulanciaId: z.string().trim().min(1).optional(),
  incluirSimuladas: booleano.optional(),
});

export const resumenQueryDto = filtro.refine(rangoValido, MENSAJE_RANGO);
export const seriesQueryDto = filtro
  .extend({ granularidad: z.enum(['dia', 'hora']) })
  .refine(rangoValido, MENSAJE_RANGO);
export const rankingQueryDto = filtro
  .extend({ por: z.enum(['ambulancia', 'conductor', 'paramedico', 'hospital']) })
  .refine(rangoValido, MENSAJE_RANGO);
