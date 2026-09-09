/**
 * Accés a localStorage a prova de fallades. En alguns navegadors (sobretot
 * Firefox per Android amb protecció de seguiment/cookies bloquejades, o en mode
 * privat) el sol fet d'accedir a `window.localStorage` o de cridar-ne els mètodes
 * llança una excepció. Si això passa durant la càrrega inicial (i18n, device id),
 * l'app no arriba a muntar-se i es veu una PÀGINA EN BLANC.
 *
 * Aquest embolcall captura qualsevol error i, si no hi ha emmagatzematge
 * disponible, cau a un magatzem en memòria (viu només durant la sessió de la
 * pestanya). Així l'app sempre arrenca; simplement no recorda coses entre visites.
 */

let backingStore: Storage | null = null
const memoryStore = new Map<string, string>()

/** Comprova (una sola vegada) si localStorage és utilitzable de veritat. */
function getStore(): Storage | null {
  if (backingStore !== null) return backingStore
  try {
    const ls = window.localStorage
    const probe = '__ficc_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    backingStore = ls
  } catch {
    backingStore = null // bloquejat → fem servir memòria
  }
  return backingStore
}

export const safeStorage = {
  getItem(key: string): string | null {
    const store = getStore()
    if (store) {
      try {
        return store.getItem(key)
      } catch {
        /* cau a memòria */
      }
    }
    return memoryStore.has(key) ? memoryStore.get(key)! : null
  },

  setItem(key: string, value: string): void {
    const store = getStore()
    if (store) {
      try {
        store.setItem(key, value)
        return
      } catch {
        /* cau a memòria */
      }
    }
    memoryStore.set(key, value)
  },

  removeItem(key: string): void {
    const store = getStore()
    if (store) {
      try {
        store.removeItem(key)
      } catch {
        /* cau a memòria */
      }
    }
    memoryStore.delete(key)
  },
}
