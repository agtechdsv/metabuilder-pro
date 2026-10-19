import { defineConfig } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { ORA } from './oracle/guard'

/**
 * Testes no app EXPORTADO (Node + Oracle) apontando para o banco Oracle real do dia a dia (schema crm), com usuários robô.
 * Regras de segurança em oracle/guard.ts. Rodar: npm run ora:run (antes: npm run ora:robot, ora:robot:func e ora:robot:leitura).
 */
if (!fs.existsSync(path.join(ORA.appDir, 'package.json'))) {
  throw new Error(`Não achei o app exportado em ${ORA.appDir}. Ejete o projeto Vendas ORA para essa pasta (IDE > Ejetar para uma pasta) e rode: npm run ora:prepare (ou defina E2E_ORA_APP_DIR em e2e/.env.oracle).`)
}

export default defineConfig({
  testDir: './oracle/tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-oracle', open: 'never' }]],
  outputDir: 'test-results-oracle',
  globalSetup: './oracle/global-setup.ts',
  globalTeardown: './oracle/global-teardown.ts',
  use: { channel: 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'pt-BR', baseURL: `http://localhost:${ORA.port}` },
  projects: [{ name: 'real-oracle-node' }],
  webServer: {
    command: `npx next start -p ${ORA.port}`,
    cwd: ORA.appDir,
    url: `http://localhost:${ORA.port}/login`,
    reuseExistingServer: false,
    timeout: 90_000,
    env: { EXPORT_DIR: path.resolve(import.meta.dirname, '.apps', 'exports-oracle') },
  },
})
