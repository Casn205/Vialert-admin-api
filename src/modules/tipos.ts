import type { FirebasePorts } from '../domain/puertos.js';

/** Opciones que `buildApp` entrega a cada módulo de rutas. */
export interface OpcionesModulo {
  firebase: FirebasePorts;
}
