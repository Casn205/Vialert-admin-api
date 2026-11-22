import type { FastifyBaseLogger } from 'fastify';
import { ambulanciaADto, mapAmbulancia } from '../../domain/mappers.js';
import type { AccionAuditoria, AmbulanciasStore, CuentasPort } from '../../domain/puertos.js';
import type { Ambulancia, AmbulanciaDto, ResultadoFila } from '../../domain/tipos.js';
import { AppError } from '../../plugins/errors.js';
import { filaLoteDto, type CrearAmbulanciaDto, type EditarAmbulanciaDto, type LoteDto } from './dto.js';

/** Subconjunto del logger de Fastify (`req.log`) que usa el servicio. */
export type Log = Pick<FastifyBaseLogger, 'warn'>;

interface Deps {
  cuentas: CuentasPort;
  store: AmbulanciasStore;
  ahora?: () => Date;
}

export function crearServicioAmbulancias({ cuentas, store, ahora = () => new Date() }: Deps) {
  /** La auditoría no debe tumbar una acción que ya se ejecutó: se registra el fallo y se sigue. */
  async function auditar(uid: string, accion: AccionAuditoria, objetivoId: string, log: Log): Promise<void> {
    try {
      await store.auditar({ uid, accion, objetivoId });
    } catch (err) {
      log.warn({ err, accion, objetivoId }, 'No se pudo escribir la auditoría');
    }
  }

  async function requerir(id: string): Promise<Ambulancia> {
    const doc = await store.obtener(id);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'La ambulancia no existe.');
    return mapAmbulancia(id, doc);
  }

  /** Auth → batch (`ambulancias` + `roles`). Si el batch falla, se borra el usuario de Auth (sin huérfanos). */
  async function crearUna(
    adminUid: string,
    d: Omit<CrearAmbulanciaDto, 'password'> & { password: string },
    estadoOperativo: 'habilitada' | 'inactiva',
    log: Log,
  ): Promise<AmbulanciaDto> {
    const { uid } = await cuentas.crearUsuario({
      email: d.email,
      password: d.password,
      deshabilitado: estadoOperativo === 'inactiva',
    });
    const doc = { email: d.email, placa: d.placa, codigoInterno: d.codigoInterno, entidadId: d.entidadId, estadoOperativo };
    try {
      await store.crear(uid, doc);
    } catch (e) {
      await cuentas
        .borrarUsuario(uid)
        .catch((err: unknown) => log.warn({ err, uid }, 'No se pudo borrar el usuario de Auth tras el fallo del batch'));
      throw e;
    }
    await auditar(adminUid, 'crear', uid, log);
    return ambulanciaADto({
      id: uid,
      ...doc,
      currentConductorId: null,
      currentParamedicoId: null,
      currentAlertaId: null,
      enTurno: false,
      turnoIniciadoAt: null,
      ultimoCambioEstadoAt: null,
      createdAt: ahora(),
    });
  }

  return {
    crear: (adminUid: string, d: CrearAmbulanciaDto, log: Log) => crearUna(adminUid, d, 'habilitada', log),

    /** Equivale a "Crear Flota" de la app: en secuencia; un error en una fila no detiene las demás. */
    async crearLote(adminUid: string, d: LoteDto, log: Log): Promise<{ resultados: ResultadoFila[] }> {
      const resultados: ResultadoFila[] = [];
      for (const [fila, f] of d.filas.entries()) {
        const v = filaLoteDto.safeParse(f);
        if (!v.success) {
          resultados.push({ fila, ok: false, error: v.error.issues[0]?.message ?? 'La fila no es válida.' });
          continue;
        }
        try {
          const a = await crearUna(adminUid, { ...v.data, entidadId: d.entidadId, password: d.password }, d.estadoOperativo, log);
          resultados.push({ fila, ok: true, id: a.id });
        } catch (e) {
          if (e instanceof AppError) {
            resultados.push({ fila, ok: false, error: e.message });
          } else {
            log.warn({ err: e, fila }, 'Fallo inesperado al crear una fila del lote');
            resultados.push({ fila, ok: false, error: 'No se pudo crear la ambulancia. Inténtalo de nuevo.' });
          }
        }
      }
      return { resultados };
    },

    async editar(adminUid: string, id: string, campos: EditarAmbulanciaDto, log: Log): Promise<void> {
      await requerir(id);
      await store.actualizar(id, campos);
      await auditar(adminUid, 'editar', id, log);
    },

    /** Auth primero (seguridad), Firestore después. Ambas operaciones son idempotentes: reintentar corrige. */
    async deshabilitar(adminUid: string, id: string, log: Log): Promise<void> {
      const a = await requerir(id);
      if (a.enTurno || a.currentAlertaId !== null) {
        throw new AppError(409, 'CONFLICT', 'No se puede deshabilitar: la ambulancia está en turno o atendiendo una alerta.');
      }
      await cuentas.actualizarUsuario(id, { deshabilitado: true });
      await store.cambiarEstado(id, 'inactiva');
      await auditar(adminUid, 'deshabilitar', id, log);
    },

    async habilitar(adminUid: string, id: string, log: Log): Promise<void> {
      const a = await requerir(id);
      // Evita pisar el estado de una unidad que ya trabaja (la pondría en 'habilitada' en pleno servicio).
      if (a.enTurno || a.currentAlertaId !== null) {
        throw new AppError(409, 'CONFLICT', 'No se puede habilitar: la ambulancia está en turno o atendiendo una alerta.');
      }
      await cuentas.actualizarUsuario(id, { deshabilitado: false });
      await store.cambiarEstado(id, 'habilitada');
      await auditar(adminUid, 'habilitar', id, log);
    },

    async resetearPassword(adminUid: string, id: string, password: string, log: Log): Promise<void> {
      await requerir(id);
      await cuentas.actualizarUsuario(id, { password });
      await cuentas.revocarTokens(id);
      await auditar(adminUid, 'resetear_password', id, log);
    },

    async cerrarTurno(adminUid: string, id: string, log: Log): Promise<void> {
      await store.cerrarTurno(id); // 404 / 409 dentro de la transacción
      await auditar(adminUid, 'cerrar_turno', id, log);
    },
  };
}

export type ServicioAmbulancias = ReturnType<typeof crearServicioAmbulancias>;
