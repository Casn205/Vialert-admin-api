import { z } from 'zod';

const vacioAUndefined = (v: unknown) => (v === '' ? undefined : v);

const esquema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
  FIREBASE_PROJECT_ID: z.string().min(1, 'es obligatoria'),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.preprocess(vacioAUndefined, z.string().optional()),
  GOOGLE_APPLICATION_CREDENTIALS: z.preprocess(vacioAUndefined, z.string().optional()),
  TZ_OPERACION: z.string().default('America/Bogota'),
  KPI_UMBRAL_RESPUESTA_SEG: z.coerce.number().int().positive().default(600),
});

export type Env = z.infer<typeof esquema>;

/** Lee y valida las variables de entorno. Falla al arrancar con un mensaje claro si algo falta. */
export function cargarEnv(fuente: NodeJS.ProcessEnv = process.env): Env {
  const r = esquema.safeParse(fuente);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${detalle}`);
  }
  return r.data;
}
