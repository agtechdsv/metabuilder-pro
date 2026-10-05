import { defineConfig } from 'vitest/config'

// Só os testes unitários em src/ (os scripts/*.test.ts são scripts próprios, executados com tsx/node)
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
