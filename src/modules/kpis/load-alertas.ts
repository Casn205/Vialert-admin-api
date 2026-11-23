import type { Firestore, QueryDocumentSnapshot } from '../../config/firebase.js';
import { mapAlertaKpi, type AlertaKpi } from '../../domain/alerta.js';
import type { KpisStore, TipoRanking } from '../../domain/puertos.js';
import type { Doc } from '../../domain/tipos.js';

const TAM_PAGINA = 500;

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Etiqueta legible según lo que se rankea (placa · código, nombre completo, nombre del hospital). */
function etiquetaDe(por: TipoRanking, d: Doc, id: string): string {
  const etiqueta =
    por === 'ambulancia'
      ? [texto(d.placa), texto(d.codigoInterno)].filter(Boolean).join(' · ')
      : por === 'hospital'
        ? texto(d.nombre)
        : `${texto(d.nombre)} ${texto(d.apellido)}`.trim();
  return etiqueta || id;
}

/** Único acceso a Firestore del módulo de KPIs (solo lectura). */
export function crearKpisStore(db: Firestore): KpisStore {
  return {
    /** Carga paginada por `createdAtServer`: no exige índices compuestos y no depende de un límite fijo. */
    async cargarAlertas(desde: Date, hasta: Date): Promise<AlertaKpi[]> {
      const alertas: AlertaKpi[] = [];
      let cursor: QueryDocumentSnapshot | undefined;
      for (;;) {
        let q = db
          .collection('alertas')
          .where('createdAtServer', '>=', desde)
          .where('createdAtServer', '<=', hasta)
          .orderBy('createdAtServer')
          .limit(TAM_PAGINA);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        for (const d of snap.docs) alertas.push(mapAlertaKpi(d.id, d.data()));
        if (snap.size < TAM_PAGINA) return alertas;
        cursor = snap.docs[snap.docs.length - 1];
      }
    },

    async cargarEtiquetas(por: TipoRanking): Promise<Map<string, string>> {
      const coleccion =
        por === 'ambulancia'
          ? db.collection('ambulancias')
          : por === 'hospital'
            ? db.collection('hospitales')
            : db.collection('personal').doc(por === 'conductor' ? 'conductores' : 'paramedicos').collection('items');
      const snap = await coleccion.get();
      return new Map(snap.docs.map((d) => [d.id, etiquetaDe(por, d.data(), d.id)]));
    },
  };
}
