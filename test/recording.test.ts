import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordingStore } from '../src/main/recording'
import { elapsedSec, IDLE } from '../src/shared/recording'

describe('tempo gravado', () => {
  const start = '2026-11-18T10:00:00.000Z'
  const at = (s: number): number => new Date(start).getTime() + s * 1000

  it('desconta as pausas encerradas e a pausa atual', () => {
    const base = { ...IDLE, recording: true, startedAt: start }
    expect(elapsedSec(base, at(90))).toBe(90)
    expect(elapsedSec({ ...base, pausedMs: 30_000 }, at(90))).toBe(60)
    expect(elapsedSec({ ...base, pausedMs: 30_000, paused: true, pausedAt: new Date(at(80)).toISOString() }, at(90))).toBe(50)
    expect(elapsedSec(IDLE, at(90))).toBe(0)
  })
})

describe('RecordingStore com pausa', () => {
  let dir = ''
  afterEach(async () => {
    vi.useRealTimers()
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('salva a duração sem o tempo em pausa', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tfb-rec-'))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z'))
    const store = new RecordingStore(() => dir)
    const s = await store.begin('Teams')
    vi.setSystemTime(new Date('2026-11-18T10:01:00Z'))
    store.setPaused(true)
    store.setPaused(true)
    vi.setSystemTime(new Date('2026-11-18T10:03:00Z'))
    store.setPaused(false)
    vi.setSystemTime(new Date('2026-11-18T10:04:00Z'))
    store.setPaused(true)
    vi.setSystemTime(new Date('2026-11-18T10:05:00Z'))
    const done = await store.finish()
    expect(done?.durationSec).toBe(120)
    const meta = JSON.parse(await readFile(join(s.dir, 'meta.json'), 'utf8'))
    expect(meta.durationSec).toBe(120)
  })
})
