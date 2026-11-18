import { desktopCapturer, screen, type BrowserWindow, type NativeImage } from 'electron'

/** Largura máxima guardada na nota: legível, sem arquivos enormes de telas 4K. */
const NOTE_MAX = 2560
/** Lado maior que o modelo aproveita; acima disso ele reduz sozinho e só custa mais. */
const MODEL_MAX = 1568

export interface Capture {
  /** JPEG para a nota. */
  full: Buffer
  /** JPEG menor, para mandar ao resumo. */
  small: Buffer
}

function fit(img: NativeImage, max: number): NativeImage {
  const { width, height } = img.getSize()
  const scale = Math.min(1, max / Math.max(width, height))
  return scale < 1 ? img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'good' }) : img
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Fotografa a tela onde está o mouse (quem clicou no widget está nela, e a reunião costuma estar ali).
 * O widget some por um instante para não sair no print.
 */
export async function captureScreen(hide: BrowserWindow | null): Promise<Capture> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const size = { width: Math.round(display.size.width * display.scaleFactor), height: Math.round(display.size.height * display.scaleFactor) }
  hide?.setOpacity(0)
  try {
    await delay(120)
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
    const img = source?.thumbnail
    // Sem permissão de gravação de tela (macOS) a imagem vem vazia.
    if (!img || img.isEmpty()) throw new Error('screen-permission')
    return { full: fit(img, NOTE_MAX).toJPEG(85), small: fit(img, MODEL_MAX).toJPEG(80) }
  } finally {
    hide?.setOpacity(1)
  }
}
