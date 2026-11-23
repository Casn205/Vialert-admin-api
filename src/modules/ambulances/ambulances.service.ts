import type { FastifyBaseLogger } from 'fastify';
import { ambulanciaADto, mapAmbulancia } from '../../domain/mappers.js';
import type { AmbulanciasStore, CuentasPort } from '../../domain/puertos.js';
import type { Ambulancia, AmbulanciaDto, ResultadoFila } from '../../domain/tipos.js';
import { AppError } from '../../plugins/errors.js';
import { filaLoteDto, type CrearAmbulanciaDto, type EditarAmbulanciaDto, type LoteDto } from './dto.js';

/** Subconjunto del logger de Fastify que usan el servicio y su decorador. */
export type Log = Pick<FastifyBaseLogger, 'warn'>;

interface Deps {
  cuentas: CuentasPort;
  store: Pick<AmbulanciasStore, 'obtener' | 'crear' | 'actualizar' | 'cambiarEstado' | 'cerrarTurno'>;
  log: Log;
  ahora?: () => Date;
}

export interface OperacionesAmbulancias {
  crear(d: CrearAmbulanciaDto): Promise<AmbulanciaDto>;
  crearLote(d: LoteDto): Promise<{ resultados: ResultadoFila[] }>;
  editar(id: string, campos: EditarAmbulanciaDto): Promise<void>;
  deshabilitar(id: string): Promise<void>;
  habilitar(id: string): Promise<void>;
  resetearPassword(id: string, password: string): Promise<void>;
  cerrarTurno(id: string): Promise<void>;
}

export interface ServicioAmbulancias {
  crear(adminUid: string, d: CrearAmbulanciaDto): Promise<AmbulanciaDto>;
  crearLote(adminUid: string, d: LoteDto): Promise<{ resultados: ResultadoFila[] }>;
  editar(adminUid: string, id: string, campos: EditarAmbulanciaDto): Promise<void>;
  deshabilitar(adminUid: string, id: string): Promise<void>;
  habilitar(adminUid: string, id: string): Promise<void>;
  resetearPassword(adminUid: string, id: string, password: string): Promise<void>;
  cerrarTurno(adminUid: string, id: string): Promise<void>;
}

export function crearServicioAmbulancias({ cuentas, store, log, ahora = () => new Date() }: Deps): OperacionesAmbulancias {
  async function requerir(id: string): Promise<Ambulancia> {
    const doc = await store.obtener(id);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'La ambulancia no existe.');
    return mapAmbulancia(id, doc);
  }

  /** Auth → batch (`ambulancias` + `roles`). Si el batch falla, se borra el usuario de Auth (sin huérfanos). */
  async function crearUna(
    d: Omit<CrearAmbulanciaDto, 'password'> & { password: string },
    estadoOperativo: 'habilitada' | 'inactiva',
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
    crear: (d: CrearAmbulanciaDto) => crearUna(d, 'habilitada'),

    /** Equivale a "Crear Flota" de la app: en secuencia; un error en una fila no detiene las demás. */
    async crearLote(d: LoteDto): Promise<{ resultados: ResultadoFila[] }> {
      const resultados: ResultadoFila[] = [];
      for (const [fila, f] of d.filas.entries()) {
        const v = filaLoteDto.safeParse(f);
        if (!v.success) {
          resultados.push({ fila, ok: false, error: v.error.issues[0]?.message ?? 'La fila no es válida.' });
          continue;
        }
        try {
          const a = await crearUna({ ...v.data, entidadId: d.entidadId, password: d.password }, d.estadoOperativo);
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

    async editar(id: string, campos: EditarAmbulanciaDto): Promise<void> {
      await requerir(id);
      await store.actualizar(id, campos);
    },

    /** Auth primero (seguridad), Firestore después. Ambas operaciones son idempotentes: reintentar corrige. */
    async deshabilitar(id: string): Promise<void> {
      const a = await requerir(id);
      if (a.enTurno || a.currentAlertaId !== null) {
        throw new AppError(409, 'CONFLICT', 'No se puede deshabilitar: la ambulancia está en turno o atendiendo una alerta.');
      }
      await cuentas.actualizarUsuario(id, { deshabilitado: true });
      await store.cambiarEstado(id, 'inactiva');
    },

    async habilitar(id: string): Promise<void> {
      const a = await requerir(id);
      // Evita pisar el estado de una unidad que ya trabaja (la pondría en 'habilitada' en pleno servicio).
      if (a.enTurno || a.currentAlertaId !== null) {
        throw new AppError(409, 'CONFLICT', 'No se puede habilitar: la ambulancia está en turno o atendiendo una alerta.');
      }
      await cuentas.actualizarUsuario(id, { deshabilitado: false });
      await store.cambiarEstado(id, 'habilitada');
    },

    async resetearPassword(id: string, password: string): Promise<void> {
      await requerir(id);
      await cuentas.actualizarUsuario(id, { password });
      await cuentas.revocarTokens(id);
    },

    async cerrarTurno(id: string): Promise<void> {
      await store.cerrarTurno(id); // 404 / 409 dentro de la transacción
    },
  };
}
