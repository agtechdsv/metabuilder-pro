/**
 * Gravação do código exportado na pasta escolhida (IDE Desktop): extrai o ZIP gerado pelo servidor e roda comandos nela.
 * O Windows só encontra o npm pelo cmd/PowerShell: os nomes de comando usados aqui são os liberados nas permissões do desktop.
 */

export const isWindowsDesktop = (): boolean => typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent)

/**
 * Abre o seletor de pasta do sistema. null = cancelado.
 * `recursive: true` libera a pasta escolhida e tudo dentro dela para gravação (o Tauri só deixa gravar em $HOME e na pasta escolhida;
 * sem isto, escolher uma pasta fora do perfil do usuário, como C:\AgTech\Apps, dava "forbidden path" ao extrair o projeto).
 */
export async function pickFolder(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const dir = await open({ directory: true, recursive: true })
  return dir && typeof dir === 'string' ? dir : null
}

/** Extrai o ZIP (bytes) dentro da pasta, criando as subpastas. Devolve quantos arquivos gravou. */
export async function writeZipToFolder(zipBytes: Uint8Array, dir: string): Promise<number> {
  const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
  const { join, dirname } = await import('@tauri-apps/api/path')
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(zipBytes)
  let count = 0
  for (const relativePath of Object.keys(zip.files)) {
    const entry = zip.files[relativePath]
    if (entry.dir) continue
    const fullPath = await join(dir, relativePath)
    try { await mkdir(await dirname(fullPath), { recursive: true }) } catch { /* já existe */ }
    await writeFile(fullPath, await entry.async('uint8array'))
    count++
  }
  return count
}

/** Roda um comando npm na pasta (PowerShell no Windows) e espera terminar. */
export async function runNpm(args: string, cwd: string): Promise<{ ok: boolean; output: string }> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const cmd = isWindowsDesktop()
    ? Command.create('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'npm ' + args], { cwd })
    : Command.create('npm', args.split(' '), { cwd })
  const out = await cmd.execute()
  return { ok: out.code === 0, output: String(out.stderr || out.stdout || '') }
}

/** Abre uma janela de terminal minimizada rodando o comando na pasta (fica viva mesmo se a IDE fechar). Só Windows. */
export async function startInTerminal(command: string, dir: string): Promise<void> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const safeDir = dir.replace(/'/g, "''")
  const safeCmd = command.replace(/'/g, "''")
  const out = await Command.create('powershell', ['-NoProfile', '-NonInteractive', '-Command', "Start-Process cmd -WindowStyle Minimized -ArgumentList '/k','" + safeCmd + "' -WorkingDirectory '" + safeDir + "'"]).execute()
  if (out.code !== 0) throw new Error(String(out.stderr || '').trim().slice(0, 200))
}

/** Abre a pasta no VS Code. */
export async function openInVsCode(dir: string): Promise<void> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  // no Windows o nome liberado nas permissões é 'cmd-code' (o 'cmd' só aceita npm install)
  const cmd = isWindowsDesktop()
    ? Command.create('cmd-code', ['/c', 'code', '.'], { cwd: dir })
    : Command.create('code', ['.'], { cwd: dir })
  await cmd.execute()
}
