import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { conflictName, friendlyGitError, syncFolder } from '../src/main/sync'

const git = 'git'

function setup(): { remote: string; a: string; b: string; backups: string } {
  const base = mkdtempSync(join(tmpdir(), 'tfb-sync-'))
  const remote = join(base, 'remote.git')
  execFileSync(git, ['init', '-q', '--bare', '-b', 'main', remote])
  const a = join(base, 'mac')
  const b = join(base, 'pc')
  mkdirSync(join(a, 'Reuniões'), { recursive: true })
  mkdirSync(join(b, 'Reuniões'), { recursive: true })
  return { remote, a, b, backups: join(base, 'backups') }
}

const opts = (root: string, remote: string, device: string, backupDir: string) => ({ root, remote, git, device, backupDir })
const write = (root: string, rel: string, text: string): void => {
  mkdirSync(join(root, rel, '..'), { recursive: true })
  writeFileSync(join(root, rel), text)
}
const read = (root: string, rel: string): string => readFileSync(join(root, rel), 'utf8')

// Cada rodada chama o Git umas vinte vezes; no Windows cada chamada custa bem mais.
describe('sincronização por Git', { timeout: 60_000 }, () => {
  it('faz backup antes da primeira vez e leva as notas de um computador para o outro', async () => {
    const { remote, a, b, backups } = setup()
    write(a, 'Reuniões/2026-11-27 Daily.md', '# Daily\n\nconversa importante\n')
    write(a, '.audio/x/mic.webm', 'audio')

    const first = await syncFolder(opts(a, remote, 'Mac', backups))
    expect(first.committed).toBe(true)
    expect(first.backup).toBeTruthy()
    expect(read(first.backup!, 'Reuniões/2026-11-27 Daily.md')).toContain('conversa importante')
    expect(existsSync(join(first.backup!, '.audio'))).toBe(false)

    write(b, 'Notas/Ideias.md', '# Ideias\n')
    const second = await syncFolder(opts(b, remote, 'PC', backups))
    expect(read(b, 'Reuniões/2026-11-27 Daily.md')).toContain('conversa importante')
    expect(read(b, 'Notas/Ideias.md')).toBe('# Ideias\n')
    expect(second.pulled).toContain('Reuniões/2026-11-27 Daily.md')
    expect(existsSync(join(b, '.audio'))).toBe(false)

    const back = await syncFolder(opts(a, remote, 'Mac', backups))
    expect(read(a, 'Notas/Ideias.md')).toBe('# Ideias\n')
    expect(back.pulled).toEqual(['Notas/Ideias.md'])
    // O áudio temporário nunca sai do computador.
    const tracked = execFileSync(git, ['-c', 'core.quotepath=false', 'ls-files'], { cwd: a, encoding: 'utf8' })
    expect(tracked).not.toContain('.audio')
  })

  it('num conflito mantém a versão daqui e salva a de lá ao lado, sem perder nada', async () => {
    const { remote, a, b, backups } = setup()
    write(a, 'Notas/Plano.md', 'v1\n')
    await syncFolder(opts(a, remote, 'Mac', backups))
    await syncFolder(opts(b, remote, 'PC', backups))

    write(a, 'Notas/Plano.md', 'editado no Mac\n')
    write(b, 'Notas/Plano.md', 'editado no PC\n')
    await syncFolder(opts(a, remote, 'Mac', backups))
    const res = await syncFolder(opts(b, remote, 'PC', backups))

    expect(res.conflicts).toEqual(['Notas/Plano.md'])
    expect(read(b, 'Notas/Plano.md')).toBe('editado no PC\n')
    const copy = readdirSync(join(b, 'Notas')).find((f) => f.includes('conflito'))
    expect(copy).toMatch(/^Plano \(conflito Mac .+\)\.md$/)
    expect(read(b, `Notas/${copy}`)).toBe('editado no Mac\n')

    // O Mac recebe as duas versões na próxima rodada.
    await syncFolder(opts(a, remote, 'Mac', backups))
    expect(read(a, 'Notas/Plano.md')).toBe('editado no PC\n')
    expect(read(a, `Notas/${copy}`)).toBe('editado no Mac\n')
  })

  it('apagada num computador e editada no outro: a edição volta', async () => {
    const { remote, a, b, backups } = setup()
    write(a, 'Notas/Rascunho.md', 'v1\n')
    await syncFolder(opts(a, remote, 'Mac', backups))
    await syncFolder(opts(b, remote, 'PC', backups))

    rmSync(join(a, 'Notas/Rascunho.md'))
    write(b, 'Notas/Rascunho.md', 'ainda uso\n')
    await syncFolder(opts(b, remote, 'PC', backups))
    await syncFolder(opts(a, remote, 'Mac', backups))
    expect(read(a, 'Notas/Rascunho.md')).toBe('ainda uso\n')
  })

  it('junta com notas que já existiam no segundo computador antes de ligar', async () => {
    const { remote, a, b, backups } = setup()
    write(a, 'Notas/Do Mac.md', 'mac\n')
    write(b, 'Notas/Do PC.md', 'pc\n')
    await syncFolder(opts(a, remote, 'Mac', backups))
    const res = await syncFolder(opts(b, remote, 'PC', backups))
    expect(res.backup).toBeTruthy()
    expect(read(res.backup!, 'Notas/Do PC.md')).toBe('pc\n')
    expect(read(b, 'Notas/Do Mac.md')).toBe('mac\n')
    expect(read(b, 'Notas/Do PC.md')).toBe('pc\n')
  })

  it('traduz os erros comuns', () => {
    expect(friendlyGitError('fatal: Authentication failed for https://github.com/x')).toBe('auth')
    expect(friendlyGitError('remote: Repository not found.')).toBe('not-found')
    expect(friendlyGitError('fatal: unable to access: Could not resolve host: github.com')).toBe('offline')
  })

  it('dá nome à cópia em conflito ao lado da original', () => {
    expect(conflictName('Notas/Plano.md', 'PC', new Date('2026-11-27T13:05:00Z'))).toBe('Notas/Plano (conflito PC 2026-11-27 13h05).md')
  })
})
