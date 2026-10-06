import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Só os testes unitários em src/ (os scripts/*.test.ts são scripts próprios, executados com tsx/node)
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'] },
})
