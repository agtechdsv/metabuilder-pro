import { defineConfig } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { REAL } from './real/guard'

/**
 * Testes dinâmicos: gerados a partir do manifesto do projeto (o que o dev configurou no Studio), contra o app exportado (Node + Postgres).
 * Mesmas travas de segurança do banco real (real/guard.ts). Rodar: npm run dyn:test  (E2E_MANIFEST=caminho.json para outro manifesto).
 */
if (!fs.existsSync(path.join(REAL.appDir, 'package.json'))) {
  throw new Error(`Não achei o app exportado em ${REAL.appDir}. Ejete o projeto e rode: npm run real:prepare (ou defina E2E_REAL_APP_DIR em e2e/.env.real).`)
}

export default defineConfig({
  testDir: './dynamic/tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-dynamic', open: 'never' }]],
  outputDir: 'test-results-dynamic',
  globalSetup: './real/global-setup.ts',
  globalTeardown: './real/global-teardown.ts',
  use: { channel: 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'pt-BR', baseURL: `http://localhost:${REAL.port}` },
  projects: [{ name: 'dynamic-pg-node' }],
  webServer: {
    command: `npx next start -p ${REAL.port}`,
    cwd: REAL.appDir,
    url: `http://localhost:${REAL.port}/login`,
    reuseExistingServer: false,
    timeout: 90_000,
    env: { EXPORT_DIR: path.resolve(import.meta.dirname, '.apps', 'exports-dynamic') },
  },
})
