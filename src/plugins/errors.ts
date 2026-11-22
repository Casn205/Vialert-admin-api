import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export type CodigoError = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL';

/** Error esperado: llega al cliente tal cual como `{ error: { code, message, details? } }`. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: CodigoError,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const cuerpo = (code: CodigoError, message: string, details?: unknown) => ({
  error: { code, message, ...(details !== undefined && { details }) },
});

/** Formato único de error para toda la API (sección 6.1 del plan). */
export function registrarErrores(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => reply.code(404).send(cuerpo('NOT_FOUND', 'La ruta no existe.')));

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.status).send(cuerpo(error.code, error.message, error.details));
    }
    if (error instanceof ZodError) {
      const details = error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
      return reply.code(400).send(cuerpo('VALIDATION_ERROR', error.issues[0]?.message ?? 'Los datos enviados no son válidos.', details));
    }
    // Errores 4xx del propio Fastify (JSON mal formado, tipo de contenido no soportado, cuerpo muy grande...).
    const status = (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.code(status).send(cuerpo('VALIDATION_ERROR', 'La solicitud no es válida.'));
    }
    req.log.error({ err: error }, 'Error no controlado');
    return reply.code(500).send(cuerpo('INTERNAL', 'Error interno del servidor.'));
  });
}
