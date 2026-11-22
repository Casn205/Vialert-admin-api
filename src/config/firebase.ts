/**
 * Único lugar que importa `firebase-admin`. Inicializa el SDK y adapta Auth y los roles a los
 * puertos de `domain/puertos.ts`. Los stores (Firestore) reciben `db` y usan `FieldValue`.
 */
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CuentasPort, RolReader, TokenVerifier } from '../domain/puertos.js';
import { AppError } from '../plugins/errors.js';
import type { Env } from './env.js';

export { FieldValue };
export type { Firestore };

export function iniciarFirebase(env: Env): { auth: Auth; db: Firestore } {
  const app =
    getApps()[0] ??
    initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
      credential: env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount)
        : applicationDefault(),
    });
  return { auth: getAuth(app), db: getFirestore(app) };
}

export function tokensDe(auth: Auth): TokenVerifier {
  return {
    async verificarToken(token) {
      const d = await auth.verifyIdToken(token);
      return { uid: d.uid };
    },
  };
}

export function rolesDe(db: Firestore): RolReader {
  return {
    async obtenerRol(uid) {
      const snap = await db.collection('roles').doc(uid).get();
      const rol: unknown = snap.get('rol');
      return typeof rol === 'string' ? rol : null;
    },
  };
}

/** Traduce los códigos de error de Firebase Auth que la web necesita distinguir. */
function traducir(e: unknown): unknown {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/email-already-exists':
      return new AppError(409, 'CONFLICT', 'Ya existe una cuenta con ese correo.');
    case 'auth/invalid-email':
      return new AppError(400, 'VALIDATION_ERROR', 'El correo no tiene un formato válido.');
    case 'auth/invalid-password':
      return new AppError(400, 'VALIDATION_ERROR', 'La contraseña no es válida (mínimo 8 caracteres).');
    case 'auth/user-not-found':
      return new AppError(404, 'NOT_FOUND', 'La cuenta de la ambulancia no existe en Firebase Auth.');
    default:
      return e;
  }
}

export function cuentasDe(auth: Auth): CuentasPort {
  return {
    async crearUsuario({ email, password, deshabilitado }) {
      try {
        const u = await auth.createUser({ email, password, disabled: deshabilitado });
        return { uid: u.uid };
      } catch (e) {
        throw traducir(e);
      }
    },
    async borrarUsuario(uid) {
      await auth.deleteUser(uid);
    },
    async actualizarUsuario(uid, d) {
      try {
        await auth.updateUser(uid, {
          ...(d.password !== undefined && { password: d.password }),
          ...(d.deshabilitado !== undefined && { disabled: d.deshabilitado }),
        });
      } catch (e) {
        throw traducir(e);
      }
    },
    async revocarTokens(uid) {
      try {
        await auth.revokeRefreshTokens(uid);
      } catch (e) {
        throw traducir(e);
      }
    },
  };
}
