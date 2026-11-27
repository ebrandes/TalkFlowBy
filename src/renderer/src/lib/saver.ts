/** Salvamento automático com atraso. Renomear ou apagar chama `flush` antes, para não recriar o arquivo antigo. */
const DELAY_MS = 600

let timer: ReturnType<typeof setTimeout> | null = null
let pending: { path: string; content: string } | null = null

export function scheduleSave(path: string, content: string): void {
  pending = { path, content }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void flush(), DELAY_MS)
}

export async function flush(): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = null
  const p = pending
  pending = null
  if (p) await window.talkflow.library.write(p.path, p.content)
}

/** A nota mudou fora do app e vai ser recarregada: descarta a gravação pendente dela. */
export function dropPending(path: string): void {
  if (pending?.path !== path) return
  pending = null
  if (timer) clearTimeout(timer)
  timer = null
}

window.addEventListener('beforeunload', () => void flush())
