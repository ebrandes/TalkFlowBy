// Processo à parte (utilityProcess) que separa as vozes e devolve o resultado para o app.
import { diarizeFile, type DiarizeJob } from './diarize'

process.parentPort.once('message', (e: { data: DiarizeJob }) => {
  try {
    process.parentPort.postMessage({ ok: true, turns: diarizeFile(e.data) })
  } catch (err) {
    process.parentPort.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})
