import { desktopCapturer, session, systemPreferences } from 'electron'

/**
 * Quando a janela pede `getDisplayMedia`, entrega a tela principal com o áudio do sistema
 * (loopback). No Mac 14.2+ isso usa o CoreAudio Tap; no Windows, o WASAPI loopback.
 * O vídeo é descartado na janela; só a trilha de áudio é gravada.
 */
export function installSystemAudioCapture(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => callback(sources[0] ? { video: sources[0], audio: 'loopback' } : {}))
        .catch(() => callback({}))
    },
    { useSystemPicker: false }
  )
}

export type PermissionState = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface Permissions {
  microphone: PermissionState
  screen: PermissionState
}

export function readPermissions(): Permissions {
  if (process.platform !== 'darwin') return { microphone: 'granted', screen: 'granted' }
  return {
    microphone: systemPreferences.getMediaAccessStatus('microphone') as PermissionState,
    screen: systemPreferences.getMediaAccessStatus('screen') as PermissionState
  }
}

export async function askMicrophone(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  return systemPreferences.askForMediaAccess('microphone')
}
