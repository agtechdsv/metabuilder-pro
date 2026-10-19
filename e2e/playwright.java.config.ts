import './real/java-env' // PRIMEIRO: ajusta o ambiente (pasta do frontend, porta) antes do guard ler
import { defineConfig } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { JAVA } from './real/java-env'
import { REAL } from './real/guard'

/**
 * Os mesmos testes do banco real (real/tests) contra o app ejetado com BACKEND JAVA (Spring Boot): sobe o backend (jar) e o frontend (Next).
 * Regras de segurança em real/guard.ts (banco localhost na lista permitida, prefixo E2E-, contagens conferidas no fim).
 * Rodar: npm run java:run (antes: npm run real:robot, real:robot:func e real:robot:leitura, que usam o mesmo banco crm).
 */
if (!fs.existsSync(path.join(JAVA.frontendDir, 'package.json'))) {
  throw new Error(`Não achei o app Java em ${JAVA.root} (frontend/ e backend/). Ejete o projeto Vendas PG com backend Java para essa pasta e rode: npm run java:prepare (ou defina E2E_JAVA_DIR em e2e/.env.real).`)
}
const target = path.join(JAVA.backendDir, 'target')
const jar = fs.existsSync(target) ? fs.readdirSync(target).find(n => n.endsWith('.jar') && !n.endsWith('.original')) : undefined
if (!jar) throw new Error(`Backend ainda não compilado (sem .jar em ${target}). Rode: npm run java:prepare`)
const javaExe = fs.existsSync(path.join(JAVA.jdkHome, 'bin', 'java.exe')) ? path.join(JAVA.jdkHome, 'bin', 'java.exe') : 'java'
const apiUrl = `http://localhost:${JAVA.backendPort}`
// o log do backend (erros de cada gravação que falha) fica num arquivo: sem ele os erros do Spring não aparecem no relatório
const backendLog = path.resolve(import.meta.dirname, '.apps', 'backend-java.log')
fs.mkdirSync(path.dirname(backendLog), { recursive: true })

export default defineConfig({
  testDir: './real/tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-java', open: 'never' }]],
  outputDir: 'test-results-java',
  globalSetup: './real/global-setup.ts',
  globalTeardown: './real/global-teardown.ts',
  use: { channel: 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'pt-BR', baseURL: `http://localhost:${REAL.port}` },
  projects: [{ name: 'real-pg-java' }],
  webServer: [
    {
      // backend Spring Boot (jar já compilado por java:prepare), numa porta própria e com CORS para o frontend dos testes
      command: `"${javaExe}" -jar "${path.join(target, jar)}" > "${backendLog}" 2>&1`,
      cwd: JAVA.backendDir,
      url: `${apiUrl}/api-docs`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { SERVER_PORT: String(JAVA.backendPort), APP_CORS_ALLOWED_ORIGINS: `http://localhost:${REAL.port}` },
    },
    {
      command: `npx next start -p ${REAL.port}`,
      cwd: JAVA.frontendDir,
      url: `http://localhost:${REAL.port}/login`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: { EXPORT_DIR: path.resolve(import.meta.dirname, '.apps', 'exports-java'), NEXT_PUBLIC_API_URL: apiUrl },
    },
  ],
})
