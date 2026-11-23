import type { AccionAuditoria, AmbulanciasStore } from '../../domain/puertos.js';
import type { Log, OperacionesAmbulancias, ServicioAmbulancias } from './ambulances.service.js';

export function decorarConAuditoria(
  servicio: OperacionesAmbulancias,
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
      const resultado = await servicio.crear(d);
      await registrar(adminUid, 'crear', resultado.id);
      return resultado;
    },

    async crearLote(adminUid, d) {
      const resultado = await servicio.crearLote(d);
      for (const fila of resultado.resultados) {
        if (fila.ok && fila.id) await registrar(adminUid, 'crear', fila.id);
      }
      return resultado;
    },

    async editar(adminUid, id, campos) {
      await servicio.editar(id, campos);
      await registrar(adminUid, 'editar', id);
    },

    async deshabilitar(adminUid, id) {
      await servicio.deshabilitar(id);
      await registrar(adminUid, 'deshabilitar', id);
    },

    async habilitar(adminUid, id) {
      await servicio.habilitar(id);
      await registrar(adminUid, 'habilitar', id);
    },

    async resetearPassword(adminUid, id, password) {
      await servicio.resetearPassword(id, password);
      await registrar(adminUid, 'resetear_password', id);
    },

    async cerrarTurno(adminUid, id) {
      await servicio.cerrarTurno(id);
      await registrar(adminUid, 'cerrar_turno', id);
    },
  };
}
