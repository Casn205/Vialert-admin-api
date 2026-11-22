# Preguntas abiertas

Formato: **[fecha] [punto de control]** Pregunta. Opción conservadora tomada mientras tanto.

- **[2026-11-21] [1-C]** ¿Cómo localiza `cerrar-turno` al personal a bordo? El plan solo dice que queda `disponible`. *Tomado:* por `currentConductorId` y `currentParamedicoId` de la ambulancia, y solo se libera a quien sigue con `ambulanciaId` igual a esa unidad (no se toca a quien ya fue reasignado).
- **[2026-11-21] [1-C]** ¿Una entrada de auditoría por lote o por fila? *Tomado:* una por cada ambulancia creada (`accion: 'crear'`); las filas fallidas no se auditan.
- **[2026-11-21] [1-C]** ¿Qué hace `habilitar` con una unidad en turno? El plan solo dice que pone `habilitada`, lo que pisaría el estado de una unidad en servicio. *Tomado:* 409 si `enTurno` o hay `currentAlertaId`.
- **[2026-11-21] [1-C]** Orden y fallos parciales en deshabilitar/habilitar. *Tomado:* Auth primero, Firestore después; ambas operaciones son idempotentes, así que repetir la acción corrige un estado a medias.
- **[2026-11-21] [1-C]** Si falla el batch de crear y además falla borrar el usuario de Auth, queda un usuario huérfano. *Tomado:* se registra una advertencia con el `uid` (sin reintentos automáticos).
- **[2026-11-21] [1-C]** Si falla escribir la auditoría después de una acción ya ejecutada. *Tomado:* se registra la advertencia y la acción no falla.
- **[2026-11-21] [1-C]** Correo de la cuenta: solo se aplica `trim` (como la app); Firebase Auth no distingue mayúsculas al comparar.
