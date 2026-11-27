/**
 * Atalhos globais (valem com o app em segundo plano). Ctrl+Alt no Windows e ⌘⌥ no Mac, para não
 * tomar atalhos comuns dos navegadores (Ctrl+Shift+R recarrega a página).
 */
export const SHORTCUTS = {
  record: 'CommandOrControl+Alt+R',
  capture: 'CommandOrControl+Alt+S'
} as const

/** Texto do atalho para mostrar na tela, no jeito de cada sistema. */
export function shortcutLabel(accelerator: string, platform: string): string {
  const mac = platform === 'darwin'
  return accelerator
    .split('+')
    .map((k) => {
      if (k === 'CommandOrControl') return mac ? '⌘' : 'Ctrl'
      if (k === 'Alt') return mac ? '⌥' : 'Alt'
      if (k === 'Shift') return mac ? '⇧' : 'Shift'
      return k
    })
    .join(mac ? '' : '+')
}
