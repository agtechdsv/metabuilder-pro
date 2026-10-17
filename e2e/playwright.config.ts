import { defineConfig } from '@playwright/test'
import path from 'node:path'

/**
 * Testes de ponta a ponta dos apps exportados. Cada "projeto" abaixo é uma combinação (banco + backend) com o seu app e a sua porta.
 * Por enquanto: Postgres + Node. (Oracle e Java entram como novos projetos, com os mesmos testes.)
 * Usa o Chrome instalado na máquina (nada para baixar).
 */
const PG_NODE_PORT = 3101

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // os testes compartilham o mesmo banco: rodam um de cada vez
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: { channel: 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'pt-BR' },
  projects: [
    { name: 'pg-node', use: { baseURL: `http://localhost:${PG_NODE_PORT}` } },
  ],
  webServer: [
    { command: `npx next start -p ${PG_NODE_PORT}`, cwd: './.apps/pg-node', url: `http://localhost:${PG_NODE_PORT}/login`, reuseExistingServer: true, timeout: 60_000, env: { EXPORT_DIR: path.resolve(import.meta.dirname, '.apps', 'exports-pg-node') } },
  ],
})
