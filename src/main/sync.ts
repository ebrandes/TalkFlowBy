import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Sincronização da pasta de notas por um repositório Git (por exemplo, um repositório privado no
 * GitHub). A pasta vira um repositório; cada sincronização grava um commit com o que mudou, traz o
 * que os outros computadores enviaram e envia de volta.
 *
 * Nunca apaga nota local: num conflito a versão deste computador fica no lugar e a do outro é salva
 * ao lado, como "<nota> (conflito <computador> <data>).md". Antes do primeiro envio a pasta inteira é
 * copiada para um backup.
 *
 * Usa o Git instalado no computador e as credenciais que ele já tem (chaveiro do macOS, Git
 * Credential Manager no Windows ou chave SSH).
 */

export const BRANCH = 'main'

/** O que fica fora do repositório: áudio temporário, backups (zips com todas as notas) e lixo de sistema. */
export const IGNORED = ['.audio/', '.backups/', '.DS_Store', 'Thumbs.db', 'desktop.ini', '*.tmp', '.~lock.*']

export interface SyncResult {
  /** Caminhos (relativos, com `/`) que chegaram de outro computador. */
  pulled: string[]
  /** Arquivos em conflito; para cada um ficou uma cópia "(conflito …)" ao lado. */
  conflicts: string[]
  /** Se este computador tinha mudanças para enviar. */
  committed: boolean
  /** Pasta do backup feito antes da primeira sincronização, quando houve. */
  backup?: string
}

export interface SyncOptions {
  root: string
  remote: string
  git: string
  /** Nome deste computador, para o commit e para a cópia em conflito. */
  device: string
  /** Onde guardar o backup antes da primeira sincronização. */
  backupDir: string
  now?: () => Date
}

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
    readonly code: number | null
  ) {
    super(message)
  }
}

export type GitRunner = (args: string[], opts?: { allowFail?: boolean; binary?: boolean }) => Promise<{ code: number; stdout: string; out: Buffer; stderr: string }>

export function gitRunner(git: string, cwd: string): GitRunner {
  return (args, opts = {}) =>
    new Promise((resolve, reject) => {
      execFile(
        git,
        ['-c', 'core.quotepath=false', ...args],
        {
          cwd,
          encoding: 'buffer',
          maxBuffer: 256 * 1024 * 1024,
          timeout: 120_000,
          windowsHide: true,
          env: {
            ...process.env,
            // Sem terminal para digitar senha: falhar é melhor que travar escondido.
            GIT_TERMINAL_PROMPT: '0',
            GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? 'ssh -o BatchMode=yes',
            LC_ALL: 'C',
            LANG: 'C'
          }
        },
        (err, stdout, stderr) => {
          const out = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? '')
          const errText = (Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? '')).toString('utf8')
          const code = err ? (typeof (err as NodeJS.ErrnoException).code === 'number' ? Number((err as NodeJS.ErrnoException).code) : 1) : 0
          if ((err as NodeJS.ErrnoException | null)?.code === 'ENOENT') return reject(new GitError('git-missing', errText, null))
          if (err && !opts.allowFail) return reject(new GitError(friendlyGitError(errText), errText, code))
          resolve({ code, stdout: opts.binary ? '' : out.toString('utf8'), out, stderr: errText })
        }
      )
    })
}

/** Erros que a pessoa consegue resolver, em vez do texto cru do Git. */
export function friendlyGitError(stderr: string): string {
  const s = stderr.toLowerCase()
  if (/authentication failed|could not read username|permission denied|access denied|invalid username or password|terminal prompts disabled/.test(s)) return 'auth'
  if (/repository not found|does not appear to be a git repository|not found/.test(s)) return 'not-found'
  if (/could not resolve host|unable to access|network is unreachable|connection timed out|failed to connect/.test(s)) return 'offline'
  return stderr.trim().split('\n').filter(Boolean).pop() ?? 'git-failed'
}

const splitZ = (s: string): string[] => s.split('\0').filter(Boolean)

/** Nome do arquivo para a versão do outro computador, ao lado da original. */
export function conflictName(path: string, device: string, when: Date): string {
  const stamp = when.toISOString().slice(0, 16).replace('T', ' ').replace(':', 'h')
  const safeDevice = device.replace(/[\\/:*?"<>|]/g, '-').trim() || 'outro computador'
  const dot = path.lastIndexOf('.')
  const slash = path.lastIndexOf('/')
  const hasExt = dot > slash + 1
  const base = hasExt ? path.slice(0, dot) : path
  const ext = hasExt ? path.slice(dot) : ''
  return `${base} (conflito ${safeDevice} ${stamp})${ext}`
}

/** Copia a pasta inteira (menos o áudio temporário e o .git) antes de sincronizar pela primeira vez. */
export async function backupFolder(root: string, backupDir: string, when: Date): Promise<string> {
  const target = join(backupDir, `TalkFlowBy-${when.toISOString().replace(/[:.]/g, '-')}`)
  await mkdir(target, { recursive: true })
  for (const entry of await readdir(root)) {
    if (entry === '.git' || entry === '.audio' || entry === '.backups') continue
    await cp(join(root, entry), join(target, entry), { recursive: true, preserveTimestamps: true })
  }
  return target
}

async function ensureGitignore(root: string): Promise<void> {
  const file = join(root, '.gitignore')
  const current = existsSync(file) ? await readFile(file, 'utf8') : ''
  const lines = new Set(current.split(/\r?\n/).map((l) => l.trim()))
  const missing = IGNORED.filter((l) => !lines.has(l))
  if (!missing.length) return
  const prefix = current && !current.endsWith('\n') ? '\n' : ''
  const header = current ? '' : '# TalkFlowBy: arquivos que não vão para a sincronização\n'
  await writeFile(file, `${current}${prefix}${header}${missing.join('\n')}\n`, 'utf8')
}

/** Transforma a pasta em repositório (uma vez) e aponta para o remoto. Devolve se acabou de criar. */
async function prepare(run: GitRunner, o: SyncOptions): Promise<boolean> {
  const fresh = !existsSync(join(o.root, '.git'))
  if (fresh) {
    await run(['init'])
    await run(['symbolic-ref', 'HEAD', `refs/heads/${BRANCH}`])
  }
  // Mac e Windows gravam o mesmo texto: sem conversão de fim de linha, sem diferença fantasma.
  await run(['config', 'core.autocrlf', 'false'])
  await run(['config', 'core.precomposeunicode', 'true'])
  const email = await run(['config', 'user.email'], { allowFail: true })
  if (!email.stdout.trim()) {
    await run(['config', 'user.email', 'talkflowby@localhost'])
    await run(['config', 'user.name', `TalkFlowBy (${o.device})`])
  }
  const current = await run(['remote', 'get-url', 'origin'], { allowFail: true })
  const ours = (await run(['config', 'talkflowby.remote'], { allowFail: true })).stdout.trim()
  // Pasta que já era um repositório de outra coisa (um vault do Obsidian com Git, por exemplo): não mexe.
  if (current.code === 0 && current.stdout.trim() !== o.remote && !ours) throw new GitError('other-repo', current.stdout, null)
  if (current.code !== 0) await run(['remote', 'add', 'origin', o.remote])
  else if (current.stdout.trim() !== o.remote) await run(['remote', 'set-url', 'origin', o.remote])
  await run(['config', 'talkflowby.remote', o.remote])
  await ensureGitignore(o.root)
  return fresh
}

async function hasCommits(run: GitRunner): Promise<boolean> {
  return (await run(['rev-parse', '--verify', '-q', 'HEAD'], { allowFail: true })).code === 0
}

async function commitAll(run: GitRunner, message: string): Promise<boolean> {
  await run(['add', '-A'])
  const status = await run(['status', '--porcelain', '-z'])
  if (!status.stdout.trim()) return false
  await run(['commit', '-q', '--no-verify', '-m', message])
  return true
}

/** De qual computador veio a última mudança no remoto, pela mensagem do commit ("Notas de X, …"). */
async function remoteDevice(run: GitRunner, path: string): Promise<string> {
  const log = await run(['log', '-1', '--format=%s', `origin/${BRANCH}`, '--', path], { allowFail: true })
  return /^Notas de (.+?), \d{4}-/.exec(log.stdout.trim())?.[1] ?? 'outro computador'
}

/**
 * Junta o que veio do remoto. Em conflito, fica a versão daqui e a de lá vai para um arquivo ao
 * lado; quem apagou de um lado e editou do outro perde a exclusão, nunca a edição.
 */
async function mergeRemote(run: GitRunner, o: SyncOptions, when: Date): Promise<string[]> {
  const merge = await run(['merge', '--no-edit', '--no-verify', '--allow-unrelated-histories', `origin/${BRANCH}`], { allowFail: true })
  if (merge.code === 0) return []
  const conflicted = splitZ((await run(['diff', '--name-only', '-z', '--diff-filter=U'])).stdout)
  if (!conflicted.length) throw new GitError(friendlyGitError(merge.stderr || merge.stdout), merge.stderr, merge.code)
  for (const path of conflicted) {
    const ours = await run(['show', `:2:${path}`], { allowFail: true, binary: true })
    const theirs = await run(['show', `:3:${path}`], { allowFail: true, binary: true })
    const full = join(o.root, path)
    await mkdir(dirname(full), { recursive: true })
    if (ours.code === 0) {
      await writeFile(full, ours.out)
      if (theirs.code === 0 && !ours.out.equals(theirs.out)) {
        const copy = conflictName(path, await remoteDevice(run, path), when)
        await writeFile(join(o.root, copy), theirs.out)
      }
    } else if (theirs.code === 0) {
      // Apagada aqui e editada lá: a edição volta.
      await writeFile(full, theirs.out)
    }
    await run(['add', '--', path])
  }
  await run(['add', '-A'])
  await run(['commit', '-q', '--no-verify', '--no-edit'])
  return conflicted
}

/** Uma rodada completa: backup na primeira vez, commit local, traz, junta e envia. */
export async function syncFolder(o: SyncOptions): Promise<SyncResult> {
  const now = o.now ?? (() => new Date())
  const run = gitRunner(o.git, o.root)
  await mkdir(o.root, { recursive: true })
  let backup: string | undefined
  if (!existsSync(join(o.root, '.git'))) backup = await backupFolder(o.root, o.backupDir, now())
  await prepare(run, o)

  const committed = await commitAll(run, `Notas de ${o.device}, ${now().toISOString().slice(0, 16).replace('T', ' ')}`)
  const result: SyncResult = { pulled: [], conflicts: [], committed, backup }

  for (let attempt = 0; attempt < 3; attempt++) {
    await run(['fetch', '--quiet', 'origin'])
    const remoteHas = (await run(['rev-parse', '--verify', '-q', `refs/remotes/origin/${BRANCH}`], { allowFail: true })).code === 0
    if (remoteHas) {
      const before = (await hasCommits(run)) ? (await run(['rev-parse', 'HEAD'])).stdout.trim() : null
      result.conflicts.push(...(await mergeRemote(run, o, now())))
      if (before) {
        const changed = splitZ((await run(['diff', '--name-only', '-z', before, 'HEAD'])).stdout)
        result.pulled.push(...changed.filter((p) => !result.pulled.includes(p)))
      }
    }
    if (!(await hasCommits(run))) return result
    const ahead = remoteHas ? Number((await run(['rev-list', '--count', `origin/${BRANCH}..HEAD`])).stdout.trim()) : 1
    if (!ahead) return result
    const push = await run(['push', '--quiet', '-u', 'origin', `HEAD:refs/heads/${BRANCH}`], { allowFail: true })
    if (push.code === 0) return result
    // Outro computador enviou no meio do caminho: traz de novo e tenta outra vez.
    if (!/rejected|fetch first|non-fast-forward/i.test(push.stderr)) throw new GitError(friendlyGitError(push.stderr), push.stderr, push.code)
  }
  throw new GitError('push-rejected', '', null)
}
