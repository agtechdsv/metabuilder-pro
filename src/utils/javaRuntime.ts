/**
 * Java para rodar o backend Spring de um projeto ejetado (IDE Desktop, Windows).
 *
 * A IDE Local já usa um JDK 21 portátil em %USERPROFILE%\.metabuilder\jdk21 (e o Maven Wrapper, que baixa o Maven sozinho). Aqui o
 * "Executar o app" do Ejetar faz o mesmo: usa o JDK portátil se existir, senão o `java` do PATH, senão oferece baixar o portátil.
 * O download é o mesmo da IDE Local (Eclipse Temurin 21, Adoptium) e não mexe no PATH nem em nada fora da pasta .metabuilder.
 */

export type JavaSource = 'portable' | 'path' | 'none'

const PS = ['-NoProfile', '-NonInteractive', '-Command']

/** Onde há um Java: o JDK portátil da IDE, o do PATH, ou nenhum. */
export async function detectJava(): Promise<JavaSource> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const script = "$p = Join-Path $env:USERPROFILE '.metabuilder\\jdk21\\bin\\java.exe'; if (Test-Path $p) { 'PORTABLE' } elseif (Get-Command java -ErrorAction SilentlyContinue) { 'PATH' } else { 'NONE' }"
  const out = await Command.create('powershell', [...PS, script]).execute()
  const v = String(out.stdout || '').trim()
  return v.includes('PORTABLE') ? 'portable' : v.includes('PATH') ? 'path' : 'none'
}

/** Baixa e extrai o JDK 21 portátil (o mesmo da IDE Local) em %USERPROFILE%\.metabuilder\jdk21. true = instalado. */
export async function installPortableJdk(): Promise<boolean> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const script = [
    "$ProgressPreference = 'SilentlyContinue'",
    "$url = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.4%2B7/OpenJDK21U-jdk_x64_windows_hotspot_21.0.4_7.zip'",
    '$dir = Join-Path $env:USERPROFILE ".metabuilder"',
    'if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }',
    'if (Test-Path (Join-Path $dir "jdk21")) { Remove-Item -Recurse -Force (Join-Path $dir "jdk21") }',
    '$zip = Join-Path $dir "jdk21.zip"',
    'Invoke-WebRequest -Uri $url -OutFile $zip',
    'Expand-Archive -Path $zip -DestinationPath $dir -Force',
    'Remove-Item $zip',
    '$extracted = Get-ChildItem -Path $dir -Directory -Filter "jdk-21*" | Select-Object -First 1',
    'Rename-Item -Path $extracted.FullName -NewName "jdk21"',
    'if (Test-Path (Join-Path $dir "jdk21\\bin\\java.exe")) { exit 0 } else { exit 2 }',
  ].join('; ')
  const out = await Command.create('powershell', [...PS, script]).execute()
  return out.code === 0
}

/**
 * Comando PowerShell que sobe o backend numa janela de terminal MINIMIZADA (fica na barra de tarefas, com o log, e continua viva
 * mesmo se a IDE fechar). Escreve na saída o PID da janela (para parar o servidor depois). Usa o Maven Wrapper da pasta (não precisa de Maven instalado) e, se houver, o JDK portátil como JAVA_HOME.
 */
export function startBackendCommand(backendDir: string): string {
  const dir = backendDir.replace(/'/g, "''")
  return "$jh = Join-Path $env:USERPROFILE '.metabuilder\\jdk21'; if (Test-Path (Join-Path $jh 'bin\\java.exe')) { $env:JAVA_HOME = $jh }; " +
    "$p = Start-Process cmd -WindowStyle Minimized -ArgumentList '/k','.\\mvnw.cmd spring-boot:run' -WorkingDirectory '" + dir + "' -PassThru; $p.Id"
}
