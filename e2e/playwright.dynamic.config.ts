import { defineConfig } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { CONFIG } from './dynamic/lib/config'
import { detectarApp } from './dynamic/lib/app.mjs'
import { envParaApp, tipoDoBanco } from './dynamic/lib/banco.mjs'

/**
 * Testes dinâmicos: gerados a partir do manifesto do projeto (o que o dev configurou no Studio), contra o app exportado: Node ou Java (Spring Boot + Next),
 * com PostgreSQL ou Oracle. A configuração vem de E2E_CONFIG (JSON gravado pela IDE) ou, no repositório, do e2e/.env.real.
 * Rodar: npm run dyn:test  (E2E_MANIFEST=caminho.json para outro manifesto).
 */
const app = detectarApp(CONFIG.appDir)
if (!CONFIG.appDir || !fs.existsSync(path.join(app.frontendDir, 'package.json'))) {
  throw new Error(`Não achei o app exportado em "${CONFIG.appDir}". Ejete o projeto (IDE > Ejetar para uma pasta) e escolha essa pasta no Ambiente de Testes.`)
}

// com a configuração da IDE (E2E_CONFIG) o app sobe apontando para o banco de TESTE: a variável de ambiente vale mais que o .env.local (Node) e que o application.properties (Spring)
const bancoDeTeste = process.env.E2E_CONFIG && CONFIG.dbUrl ? envParaApp(CONFIG.dbUrl, app.pilha) : {}
const frontend = {
  command: `npx next start -p ${CONFIG.port}`,
  cwd: app.frontendDir,
  url: `http://localhost:${CONFIG.port}/login`,
  reuseExistingServer: false,
  timeout: 90_000,
  env: { EXPORT_DIR: CONFIG.exportDir, ...(app.pilha === 'node' ? bancoDeTeste : { NEXT_PUBLIC_API_URL: `http://localhost:${CONFIG.backendPort}` }) },
}

function backendJava() {
  const target = path.join(app.backendDir!, 'target')
  const jar = fs.existsSync(target) ? fs.readdirSync(target).find(n => n.endsWith('.jar') && !n.endsWith('.original')) : undefined
  if (!jar) throw new Error(`O backend Java ainda não foi compilado (sem .jar em ${target}). A IDE o compila ao preparar o app.`)
  const jdk = path.join(process.env.USERPROFILE || process.env.HOME || '', '.metabuilder', 'jdk21')
  const javaExe = fs.existsSync(path.join(jdk, 'bin', 'java.exe')) ? path.join(jdk, 'bin', 'java.exe') : 'java'
  // o log do backend (o erro de cada gravação que falha) fica num arquivo: sem ele os erros do Spring não aparecem
  const log = path.resolve(import.meta.dirname, '.apps', 'backend-java.log')
  fs.mkdirSync(path.dirname(log), { recursive: true })
  return {
    command: `"${javaExe}" -jar "${path.join(target, jar)}" > "${log}" 2>&1`,
    cwd: app.backendDir!,
    url: `http://localhost:${CONFIG.backendPort}/api-docs`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { SERVER_PORT: String(CONFIG.backendPort), APP_CORS_ALLOWED_ORIGINS: `http://localhost:${CONFIG.port}`, ...bancoDeTeste },
  }
}

export default defineConfig({
  testDir: './dynamic/tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // o relator da IDE escreve uma linha por teste (começou/terminou) para o painel "Ambiente de Testes" mostrar o andamento ao vivo
  reporter: [['list'], ['./dynamic/ide-reporter.ts'], ['html', { outputFolder: 'playwright-report-dynamic', open: 'never' }]],
  outputDir: 'test-results-dynamic',
  globalSetup: './dynamic/global-setup.ts',
  globalTeardown: './dynamic/global-teardown.ts',
  // E2E_HEADED=1 abre o navegador na tela ("ver ao vivo"); E2E_SLOWMO=<ms> espera entre as ações para dar tempo de acompanhar
  use: { channel: (process.env.E2E_BROWSER || 'chrome') as 'chrome' | 'msedge', headless: process.env.E2E_HEADED !== '1', launchOptions: { slowMo: Number(process.env.E2E_SLOWMO || 0), args: process.env.E2E_HEADED === '1' ? ['--start-maximized'] : [] }, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'pt-BR', baseURL: `http://localhost:${CONFIG.port}` },
  projects: [{ name: `dynamic-${tipoDoBanco(CONFIG.dbUrl) ?? 'banco'}-${app.pilha}` }],
  webServer: app.pilha === 'java' ? [backendJava(), frontend] : frontend,
})
