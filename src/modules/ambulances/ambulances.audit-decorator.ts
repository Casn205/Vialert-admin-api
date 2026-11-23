import type { AccionAuditoria, AmbulanciasStore } from '../../domain/puertos.js';
import type { Log, ServicioAmbulancias } from './ambulances.service.js';

/**
 * Decorator: envuelve un `ServicioAmbulancias` y devuelve otro con la misma interfaz, que además
 * registra la auditoría después de cada acción exitosa. Un fallo al auditar solo se avisa en el log.
 */

export function decorarConAuditoria(
  servicio: ServicioAmbulancias,
  auditoria: Pick<AmbulanciasStore, 'auditar'>,
  log: Log,
): ServicioAmbulancias {
  async function registrar(uid: string, accion: AccionAuditoria, objetivoId: string): Promise<void> {
    try {
      await auditoria.auditar({ uid, accion, objetivoId });
    } catch (err) {
      log.warn({ err, accion, objetivoId }, 'No se pudo escribir la auditoría');
    }
  }

  return {
    async crear(adminUid, d) {
      const resultado = await servicio.crear(adminUid, d);
      await registrar(adminUid, 'crear', resultado.id);
      return resultado;
    },

    async crearLote(adminUid, d) {
      const resultado = await servicio.crearLote(adminUid, d);
      for (const fila of resultado.resultados) {
        if (fila.ok && fila.id) await registrar(adminUid, 'crear', fila.id);
      }
      return resultado;
    },

    async editar(adminUid, id, campos) {
      await servicio.editar(adminUid, id, campos);
      await registrar(adminUid, 'editar', id);
    },

    async deshabilitar(adminUid, id) {
      await servicio.deshabilitar(adminUid, id);
      await registrar(adminUid, 'deshabilitar', id);
    },

    async habilitar(adminUid, id) {
      await servicio.habilitar(adminUid, id);
      await registrar(adminUid, 'habilitar', id);
    },

    async resetearPassword(adminUid, id, password) {
      await servicio.resetearPassword(adminUid, id, password);
      await registrar(adminUid, 'resetear_password', id);
    },

    async cerrarTurno(adminUid, id) {
      await servicio.cerrarTurno(adminUid, id);
      await registrar(adminUid, 'cerrar_turno', id);
    },
  };
}
