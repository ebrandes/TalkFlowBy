import { spawn } from 'node:child_process'
import { ffmpegPath } from '../setup/binaries'

/** Converte a trilha gravada (webm/opus) em wav 16 kHz mono, o formato do Whisper. */
export function toWav16k(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', output]
    const child = spawn(ffmpegPath(), args, { windowsHide: true })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg falhou: ${err.trim() || code}`))))
  })
}

/** Mede o volume de pico; trilha quase muda não vale a pena transcrever. */
export function peakVolumeDb(input: string): Promise<number> {
  return new Promise((resolve) => {
    const args = ['-hide_banner', '-i', input, '-af', 'volumedetect', '-f', 'null', '-']
    const child = spawn(ffmpegPath(), args, { windowsHide: true })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('error', () => resolve(0))
    child.on('close', () => {
      const m = err.match(/max_volume:\s*(-?[\d.]+) dB/)
      resolve(m ? Number(m[1]) : 0)
    })
  })
}
