import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RolReader, TokenVerifier } from '../domain/puertos.js';
import { AppError } from './errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** `preHandler`: exige `Authorization: Bearer <ID token>` de un usuario con `roles/{uid}.rol == 'admin'`. */
    requireAdmin: (req: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    /** uid del administrador autenticado (solo después de `requireAdmin`). */
    adminUid: string;
  }
}

const TTL_ROL_MS = 60_000; // el rol de un admin se cachea ≤ 60 s (sección 6.1)

export function registrarAuth(
  app: FastifyInstance,
  deps: { tokens: TokenVerifier; roles: RolReader },
  ahora: () => number = Date.now,
): void {
  const adminsVigentes = new Map<string, number>(); // uid → expira (ms)

  app.decorateRequest('adminUid', '');
  app.decorate('requireAdmin', async (req: FastifyRequest) => {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
    if (!m) throw new AppError(401, 'UNAUTHENTICATED', 'Falta el token de autenticación.');

    let uid: string;
    try {
      uid = (await deps.tokens.verificarToken(m[1]!.trim())).uid;
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'La sesión no es válida o expiró. Vuelve a iniciar sesión.');
    }

    const expira = adminsVigentes.get(uid);
    if (expira === undefined || expira <= ahora()) {
      const rol = await deps.roles.obtenerRol(uid);
      if (rol !== 'admin') {
        adminsVigentes.delete(uid);
        throw new AppError(403, 'FORBIDDEN', 'Solo los administradores pueden usar esta API.');
      }
      adminsVigentes.set(uid, ahora() + TTL_ROL_MS);
    }
    req.adminUid = uid;
  });
}
