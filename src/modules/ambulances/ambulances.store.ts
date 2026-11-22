import { FieldValue, type Firestore } from '../../config/firebase.js';
import type { AmbulanciasStore, CamposEditablesDoc, EntradaAuditoria, NuevaAmbulanciaDoc } from '../../domain/puertos.js';
import type { Doc } from '../../domain/tipos.js';
import { AppError } from '../../plugins/errors.js';

/** Único acceso a Firestore del módulo de ambulancias. */
export function crearAmbulanciasStore(db: Firestore): AmbulanciasStore {
  const ambulancia = (id: string) => db.collection('ambulancias').doc(id);

  return {
    async obtener(id: string): Promise<Doc | null> {
      const snap = await ambulancia(id).get();
      return snap.exists ? (snap.data() ?? {}) : null;
    },

    async crear(id: string, d: NuevaAmbulanciaDoc): Promise<void> {
      const batch = db.batch();
      batch.set(ambulancia(id), {
        email: d.email,
        placa: d.placa,
        codigoInterno: d.codigoInterno,
        entidadId: d.entidadId,
        estadoOperativo: d.estadoOperativo,
        enTurno: false,
        currentConductorId: null,
        currentParamedicoId: null,
        currentAlertaId: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      batch.set(db.collection('roles').doc(id), { rol: 'ambulancia', createdAt: FieldValue.serverTimestamp() });
      await batch.commit();
    },

    async actualizar(id: string, campos: CamposEditablesDoc): Promise<void> {
      // Firestore rechaza `undefined`: solo se envían los campos presentes.
      await ambulancia(id).update(Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined)));
    },

    async cambiarEstado(id: string, estado: 'habilitada' | 'inactiva'): Promise<void> {
      await ambulancia(id).update({ estadoOperativo: estado, ultimoCambioEstadoAt: FieldValue.serverTimestamp() });
    },

    /** Replica `liberarPersonalYResetAmbulancia` de la app, en una transacción. */
    async cerrarTurno(id: string): Promise<void> {
      await db.runTransaction(async (tx) => {
        const ref = ambulancia(id);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new AppError(404, 'NOT_FOUND', 'La ambulancia no existe.');
        const d = snap.data() ?? {};
        if (typeof d.currentAlertaId === 'string' && d.currentAlertaId !== '') {
          throw new AppError(409, 'CONFLICT', 'No se puede cerrar el turno: la ambulancia tiene una alerta en curso.');
        }

        // Personal a bordo (lecturas antes que escrituras). Solo se libera a quien sigue asignado a ESTA unidad.
        const aBordo = [
          { coleccion: 'conductores', id: d.currentConductorId },
          { coleccion: 'paramedicos', id: d.currentParamedicoId },
        ].flatMap((p) =>
          typeof p.id === 'string' && p.id !== '' ? [db.collection('personal').doc(p.coleccion).collection('items').doc(p.id)] : [],
        );
        const personal = await Promise.all(aBordo.map((r) => tx.get(r)));

        tx.update(ref, {
          currentConductorId: null,
          currentParamedicoId: null,
          estadoOperativo: 'habilitada',
          enTurno: false,
          turnoIniciadoAt: FieldValue.delete(),
          ultimoCambioEstadoAt: FieldValue.serverTimestamp(),
        });
        tx.delete(db.collection('ubicaciones').doc(id));
        for (const p of personal) {
          if (p.exists && p.get('ambulanciaId') === id) tx.update(p.ref, { estado: 'disponible', ambulanciaId: null });
        }
      });
    },

    async auditar(e: EntradaAuditoria): Promise<void> {
      await db.collection('auditoria').add({ uid: e.uid, accion: e.accion, objetivoId: e.objetivoId, ts: FieldValue.serverTimestamp() });
    },
  };
}
