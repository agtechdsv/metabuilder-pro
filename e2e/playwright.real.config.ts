import { defineConfig } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { REAL } from './real/guard'

/**
 * Testes no app EXPORTADO DE VERDADE (ejetado pela IDE) apontando para o banco real do dia a dia (crm), com o usuário robô.
 * Regras de segurança em real/guard.ts. Rodar: npm run real:test (antes: npm run real:robot e npm run real:prepare).
 */
if (!fs.existsSync(path.join(REAL.appDir, 'package.json'))) {
  throw new Error(`Não achei o app exportado em ${REAL.appDir}. Ejete o projeto Vendas PG para essa pasta (IDE > Ejetar para uma pasta) e rode: npm run real:prepare (ou defina E2E_REAL_APP_DIR em e2e/.env.real).`)
}

export default defineConfig({
  testDir: './real/tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-real', open: 'never' }]],
  outputDir: 'test-results-real',
  globalSetup: './real/global-setup.ts',
  globalTeardown: './real/global-teardown.ts',
  use: { channel: 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'pt-BR', baseURL: `http://localhost:${REAL.port}` },
  projects: [{ name: 'real-pg-node' }],
  webServer: {
    command: `npx next start -p ${REAL.port}`,
    cwd: REAL.appDir,
    url: `http://localhost:${REAL.port}/login`,
    reuseExistingServer: false,
    timeout: 90_000,
    env: { EXPORT_DIR: path.resolve(import.meta.dirname, '.apps', 'exports-real') },
  },
})
