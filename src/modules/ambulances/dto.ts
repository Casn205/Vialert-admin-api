import { z } from 'zod';

// Mismas reglas que la app (`AmbulanciaBuilder`) y que `core/schemas/ambulancia.ts` de la web.
const textoObligatorio = (mensaje: string) => z.string().trim().min(1, mensaje);
const placa = textoObligatorio('La placa es obligatoria');
const codigoInterno = textoObligatorio('El código interno es obligatorio');
const email = z
  .string()
  .trim()
  .min(1, 'El correo es obligatorio')
  .refine((v) => v.includes('@'), 'El correo no tiene un formato válido');
/** Normaliza como la app: sin espacios en los extremos y en MAYÚSCULAS. */
const entidadId = z.string().trim().min(1, 'La entidad es obligatoria').toUpperCase();
const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres');

export const crearAmbulanciaDto = z.object({ email, password, placa, codigoInterno, entidadId });

/** Cada fila del lote se valida por separado (un error no debe tumbar todo el lote). */
export const filaLoteDto = z.object({ placa, codigoInterno, email });

export const loteDto = z.object({
  entidadId,
  estadoOperativo: z.enum(['habilitada', 'inactiva']),
  password,
  filas: z
    .array(z.object({ placa: z.string(), codigoInterno: z.string(), email: z.string() }))
    .min(1, 'Envía al menos una fila')
    .max(50, 'Máximo 50 filas por lote'),
});

export const editarAmbulanciaDto = z
  .object({ placa: placa.optional(), codigoInterno: codigoInterno.optional(), entidadId: entidadId.optional() })
  .refine((d) => Object.values(d).some((v) => v !== undefined), 'Envía al menos un campo para editar');

export const passwordDto = z.object({ password });
export const idParamDto = z.object({ id: z.string().min(1) });

export type CrearAmbulanciaDto = z.infer<typeof crearAmbulanciaDto>;
export type LoteDto = z.infer<typeof loteDto>;
export type EditarAmbulanciaDto = z.infer<typeof editarAmbulanciaDto>;
