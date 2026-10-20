/**
 * Limpeza da pasta de destino antes de exportar o código (IDE Desktop).
 *
 * A exportação só extrai o ZIP por cima da pasta: o que o app já tinha e a exportação nova não gera mais (a tela de um caso de uso apagado no
 * Studio, por exemplo) continuaria lá, compilado e acessível pelo endereço. Esta limpeza apaga o conteúdo da pasta antes, com travas:
 *   - só pastas que já parecem um app exportado (package.json ou backend/pom.xml);
 *   - nunca a raiz de um disco, a pasta do usuário nem as pastas comuns dele (Desktop, Documentos, Downloads...);
 *   - sempre preserva node_modules, .git, .next e target (dependências, histórico e cache de compilação);
 *   - o usuário confirma vendo quantos arquivos e quais pastas serão apagados.
 */

/** O que nunca é apagado, em qualquer nível da pasta. */
export const PRESERVADOS = ['node_modules', '.git', '.next', 'target'] as const

const q = (s: string) => s.replace(/'/g, "''")
const UTF8 = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '

const normaliza = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()

/**
 * A pasta pode ser limpa? Recusa raiz de disco, pastas rasas demais, a pasta do usuário e as pastas comuns dentro dela (Downloads, Documentos...).
 * `home` é a pasta do usuário (C:\Users\Nome).
 */
export function isSafeToClean(dir: string, home: string): boolean {
  const d = normaliza(dir)
  if (!d) return false
  if (/^[a-z]:$/.test(d)) return false                       // raiz de disco
  if (d.split('\\').filter(Boolean).length < 3) return false  // C:\Users, C:\Projetos... (menos de duas pastas abaixo do disco)
  const h = normaliza(home)
  if (h && (d === h || h.startsWith(d + '\\'))) return false  // a pasta do usuário ou uma acima dela
  if (h) {
    const comuns = ['desktop', 'documents', 'documentos', 'downloads', 'pictures', 'imagens', 'videos', 'vídeos', 'music', 'músicas', 'onedrive', 'appdata']
    if (comuns.some(c => d === `${h}\\${c}`)) return false
  }
  return true
}

const FUNCAO_COLETAR = `$keep = @(${PRESERVADOS.map(p => `'${p}'`).join(',')}); function Coletar($p) { Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | ForEach-Object { if ($_.PSIsContainer) { if ($keep -notcontains $_.Name) { Coletar $_.FullName } } else { $_ } } }`

/** Script que descreve o que seria apagado (não apaga nada). Devolve JSON: { existe, exportado, arquivos, entradas }. */
export function planScript(dir: string): string {
  return `${UTF8}$d = '${q(dir)}'; ${FUNCAO_COLETAR}
if (-not (Test-Path -LiteralPath $d)) { '{"existe":false,"exportado":false,"arquivos":0,"entradas":[]}'; exit }
$d = (Get-Item -LiteralPath $d).FullName.TrimEnd('\') # forma longa do caminho: o nome curto do Windows (ALEXAN~1) tem outro tamanho e quebraria o corte do caminho relativo
$exp = (Test-Path -LiteralPath (Join-Path $d 'package.json')) -or (Test-Path -LiteralPath (Join-Path $d 'backend\\pom.xml'))
$arq = @(Coletar $d)
$top = @($arq | ForEach-Object { $_.FullName.Substring($d.TrimEnd('\\').Length).TrimStart('\\').Split('\\')[0] } | Sort-Object -Unique)
ConvertTo-Json -Compress @{ existe = $true; exportado = [bool]$exp; arquivos = $arq.Count; entradas = [string[]]$top }`
}

/** Script que apaga os arquivos (menos os preservados) e as pastas que ficaram vazias. */
export function cleanScript(dir: string): string {
  return `${UTF8}$d = '${q(dir)}'; ${FUNCAO_COLETAR}
function Vazias($p) { foreach ($s in @(Get-ChildItem -LiteralPath $p -Directory -Force -ErrorAction SilentlyContinue | Where-Object { $keep -notcontains $_.Name })) { Vazias $s.FullName; if (-not (Get-ChildItem -LiteralPath $s.FullName -Force -ErrorAction SilentlyContinue)) { Remove-Item -LiteralPath $s.FullName -Force -ErrorAction SilentlyContinue } } }
@(Coletar $d) | Remove-Item -Force -ErrorAction SilentlyContinue
Vazias $d
'ok'`
}

export interface PlanoDeLimpeza { existe: boolean; exportado: boolean; arquivos: number; entradas: string[] }

export function parsePlan(saida: string): PlanoDeLimpeza | null {
  const linha = saida.split(/\r?\n/).map(l => l.trim()).find(l => l.startsWith('{') && l.endsWith('}'))
  if (!linha) return null
  try {
    const j = JSON.parse(linha)
    return { existe: !!j.existe, exportado: !!j.exportado, arquivos: Number(j.arquivos) || 0, entradas: Array.isArray(j.entradas) ? j.entradas.map(String) : [] }
  } catch { return null }
}

/** Texto da confirmação: o que será apagado e o que fica. `modelo` usa {count}, {dir}, {entries} e {kept}. */
export function confirmMessage(dir: string, plano: PlanoDeLimpeza, modelo: string): string {
  const lista = plano.entradas.slice(0, 12).join(', ') + (plano.entradas.length > 12 ? `, … (+${plano.entradas.length - 12})` : '')
  return modelo.replace('{count}', String(plano.arquivos)).replace('{dir}', dir).replace('{entries}', lista).replace('{kept}', PRESERVADOS.join(', '))
}

async function powershell(script: string): Promise<{ code: number | null; out: string }> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const r = await Command.create('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]).execute()
  return { code: r.code, out: `${r.stdout}\n${r.stderr}`.trim() }
}

/** Descreve o que a limpeza apagaria na pasta. null = não foi possível ler. */
export async function planCleanup(dir: string): Promise<PlanoDeLimpeza | null> {
  const r = await powershell(planScript(dir))
  return parsePlan(r.out)
}

/** Apaga o conteúdo da pasta (menos os preservados). */
export async function cleanFolder(dir: string): Promise<boolean> {
  const r = await powershell(cleanScript(dir))
  return r.code === 0 && r.out.includes('ok')
}
