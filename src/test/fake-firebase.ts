/** Firebase falso en memoria para las pruebas: ningún test necesita Firebase real. */
import type { EntradaAuditoria, FirebasePorts } from '../domain/puertos.js';
import type { Doc } from '../domain/tipos.js';
import { AppError } from '../plugins/errors.js';

export interface UsuarioFalso {
  email: string;
  password: string;
  deshabilitado: boolean;
  tokensRevocados: number;
}

export function crearFirebaseFalso() {
  const usuarios = new Map<string, UsuarioFalso>();
  const ambulancias = new Map<string, Doc>();
  const roles = new Map<string, string>([
    ['admin-1', 'admin'],
    ['user-1', 'usuario'],
  ]);
  const conductores = new Map<string, Doc>();
  const paramedicos = new Map<string, Doc>();
  const ubicaciones = new Set<string>();
  const auditoria: EntradaAuditoria[] = [];
  /** Permite simular que el batch (`ambulancias` + `roles`) falla. */
  const fallos = { crearDocumentos: false };
  const tokens: Record<string, string> = { 'tok-admin': 'admin-1', 'tok-usuario': 'user-1' };
  let siguiente = 0;

  const liberar = (mapa: Map<string, Doc>, personalId: unknown, ambulanciaId: string) => {
    if (typeof personalId !== 'string') return;
    const p = mapa.get(personalId);
    if (p && p.ambulanciaId === ambulanciaId) Object.assign(p, { estado: 'disponible', ambulanciaId: null });
  };

  const firebase: FirebasePorts = {
    tokens: {
      async verificarToken(token) {
        const uid = tokens[token];
        if (!uid) throw new Error('token inválido');
        return { uid };
      },
    },
    roles: {
      async obtenerRol(uid) {
        return roles.get(uid) ?? null;
      },
    },
    cuentas: {
      async crearUsuario({ email, password, deshabilitado }) {
        const e = email.toLowerCase();
        if ([...usuarios.values()].some((u) => u.email.toLowerCase() === e)) {
          throw new AppError(409, 'CONFLICT', 'Ya existe una cuenta con ese correo.');
        }
        const uid = `uid-${++siguiente}`;
        usuarios.set(uid, { email, password, deshabilitado, tokensRevocados: 0 });
        return { uid };
      },
      async borrarUsuario(uid) {
        usuarios.delete(uid);
      },
      async actualizarUsuario(uid, d) {
        const u = usuarios.get(uid);
        if (!u) throw new AppError(404, 'NOT_FOUND', 'La cuenta de la ambulancia no existe en Firebase Auth.');
        if (d.password !== undefined) u.password = d.password;
        if (d.deshabilitado !== undefined) u.deshabilitado = d.deshabilitado;
      },
      async revocarTokens(uid) {
        const u = usuarios.get(uid);
        if (u) u.tokensRevocados += 1;
      },
    },
    ambulancias: {
      async obtener(id) {
        return ambulancias.get(id) ?? null;
      },
      async crear(id, d) {
        if (fallos.crearDocumentos) throw new Error('fallo simulado del batch');
        ambulancias.set(id, { ...d, enTurno: false, currentConductorId: null, currentParamedicoId: null, currentAlertaId: null });
        roles.set(id, 'ambulancia');
      },
      async actualizar(id, campos) {
        Object.assign(ambulancias.get(id) ?? {}, campos);
      },
      async cambiarEstado(id, estado) {
        const d = ambulancias.get(id);
        if (d) d.estadoOperativo = estado;
      },
      async cerrarTurno(id) {
        const d = ambulancias.get(id);
        if (!d) throw new AppError(404, 'NOT_FOUND', 'La ambulancia no existe.');
        if (typeof d.currentAlertaId === 'string' && d.currentAlertaId !== '') {
          throw new AppError(409, 'CONFLICT', 'No se puede cerrar el turno: la ambulancia tiene una alerta en curso.');
        }
        liberar(conductores, d.currentConductorId, id);
        liberar(paramedicos, d.currentParamedicoId, id);
        Object.assign(d, { currentConductorId: null, currentParamedicoId: null, estadoOperativo: 'habilitada', enTurno: false });
        delete d.turnoIniciadoAt;
        ubicaciones.delete(id);
      },
      async auditar(e) {
        auditoria.push(e);
      },
    },
  };

  return { firebase, usuarios, ambulancias, roles, conductores, paramedicos, ubicaciones, auditoria, fallos };
}

export type FirebaseFalso = ReturnType<typeof crearFirebaseFalso>;

/** Deja una ambulancia ya creada (cuenta de Auth + documento). */
export function sembrarAmbulancia(f: FirebaseFalso, id: string, campos: Doc = {}): void {
  f.usuarios.set(id, { email: `${id}@vialert.com`, password: 'x', deshabilitado: false, tokensRevocados: 0 });
  f.ambulancias.set(id, {
    email: `${id}@vialert.com`,
    placa: 'AAA111',
    codigoInterno: id.toUpperCase(),
    entidadId: 'HOSPITAL DEL SUR',
    estadoOperativo: 'habilitada',
    enTurno: false,
    currentConductorId: null,
    currentParamedicoId: null,
    currentAlertaId: null,
    ...campos,
  });
}
