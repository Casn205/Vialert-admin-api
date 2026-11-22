/**
 * Puertos hacia Firebase. La API habla con estas interfaces; las implementaciones reales
 * viven en `config/firebase.ts` (Auth, roles) y `modules/ambulances/ambulances.store.ts`
 * (Firestore). Las pruebas inyectan implementaciones en memoria (`test/fake-firebase.ts`).
 */
import type { Doc } from './tipos.js';

export interface TokenVerifier {
  /** Lanza si el token no es válido. */
  verificarToken(token: string): Promise<{ uid: string }>;
}

export interface RolReader {
  /** Lee `roles/{uid}.rol`. `null` si no existe. */
  obtenerRol(uid: string): Promise<string | null>;
}

/** Cuentas de Firebase Auth. Los errores conocidos llegan ya como `AppError`. */
export interface CuentasPort {
  /** `AppError` 409 si el correo ya existe. */
  crearUsuario(d: { email: string; password: string; deshabilitado: boolean }): Promise<{ uid: string }>;
  borrarUsuario(uid: string): Promise<void>;
  actualizarUsuario(uid: string, d: { password?: string; deshabilitado?: boolean }): Promise<void>;
  revocarTokens(uid: string): Promise<void>;
}

export type AccionAuditoria = 'crear' | 'editar' | 'deshabilitar' | 'habilitar' | 'resetear_password' | 'cerrar_turno';

/** `auditoria/{id}`: `{ uid, accion, objetivoId, ts }` (el `ts` lo pone el store con hora del servidor). */
export interface EntradaAuditoria {
  uid: string;
  accion: AccionAuditoria;
  objetivoId: string;
}

export interface NuevaAmbulanciaDoc {
  email: string;
  placa: string;
  codigoInterno: string;
  entidadId: string;
  estadoOperativo: 'habilitada' | 'inactiva';
}

export interface CamposEditablesDoc {
  placa?: string;
  codigoInterno?: string;
  entidadId?: string;
}

export interface AmbulanciasStore {
  obtener(id: string): Promise<Doc | null>;
  /** Un solo batch atómico: `ambulancias/{id}` + `roles/{id}` `{rol:'ambulancia'}`. */
  crear(id: string, d: NuevaAmbulanciaDoc): Promise<void>;
  actualizar(id: string, campos: CamposEditablesDoc): Promise<void>;
  /** Pone `estadoOperativo` y `ultimoCambioEstadoAt` (hora del servidor). */
  cambiarEstado(id: string, estado: 'habilitada' | 'inactiva'): Promise<void>;
  /** Transacción: `AppError` 404 si no existe, 409 si tiene alerta en curso. */
  cerrarTurno(id: string): Promise<void>;
  auditar(e: EntradaAuditoria): Promise<void>;
}

export interface FirebasePorts {
  tokens: TokenVerifier;
  roles: RolReader;
  cuentas: CuentasPort;
  ambulancias: AmbulanciasStore;
}
