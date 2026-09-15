import { useCallback, useRef, useState } from 'react'
import { toPng } from 'html-to-image'

/** Marge al voltant del contingut a la imatge descarregada, en px CSS. */
const IMAGE_PADDING = 24

/**
 * Captura un tros de pantalla i el descarrega com a PNG, per conservar rondes
 * èpiques i el podi final.
 *
 * Mentre dura la captura s'afegeix la classe `ficc-capturing` al node: atura
 * les animacions d'entrada (si no, els elements amb `animationDelay` es poden
 * capturar encara invisibles) i amaga el que no ha de sortir a la imatge
 * (marcat amb `data-capture-hide`).
 */
export function useDownloadImage(filename: () => string) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  const download = useCallback(async () => {
    const node = ref.current
    if (!node || busy) return
    setBusy(true)
    node.classList.add('ficc-capturing')
    try {
      // La classe atura les animacions i amaga/mostra elements. Esperem que el
      // navegador hi apliqui el layout abans de mesurar i capturar.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      // El marge s'afegeix ampliant el LLENÇ i desplaçant-hi el clon, no posant
      // padding al node: si el node s'eixampla o s'estreny, el text es reparteix
      // diferent i la imatge no coincideix amb el que es veu a la pantalla.
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        width: node.offsetWidth + IMAGE_PADDING * 2,
        height: node.offsetHeight + IMAGE_PADDING * 2,
        style: {
          // El clon conserva l'amplada original; només se'l mou cap endins.
          width: `${node.offsetWidth}px`,
          transform: `translate(${IMAGE_PADDING}px, ${IMAGE_PADDING}px)`,
          transformOrigin: 'top left',
        },
        // El fons el pinta el body; el node capturat és transparent.
        backgroundColor: '#0060f4',
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = filename()
      link.click()
    } catch (e) {
      console.error(e)
    } finally {
      node.classList.remove('ficc-capturing')
      setBusy(false)
    }
  }, [busy, filename])

  return { ref, download, busy }
}

/** Neteja un text per fer-lo servir en un nom de fitxer. */
export function safeFileName(part: string): string {
  return part
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
