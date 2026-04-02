type Listener = () => void;

const listeners = new Set<Listener>();

/** Appelé après une synchro qui modifie `spots_pack` (complète ou delta). */
export function emitSpotsLocalDbChanged(): void {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      /* éviter qu’un écran casse les autres abonnés */
    }
  }
}

export function onSpotsLocalDbChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
