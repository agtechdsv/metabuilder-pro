import { seedPostgres } from './scripts/seed-postgres.mjs'

// Antes de cada rodada: banco de testes recriado com os dados fixos.
export default async function globalSetup() {
  await seedPostgres()
}
