import { AppAST } from '../ast'
import { generateJavaFrontend } from './java-spring-frontend'
import { generateSpringBootBackend, generateRootReadme } from './java-spring-backend'
import { assertPolicySupported } from '../layers/access'
import { accessSql } from '../accessAdmin'

/**
 * java-spring-project.ts — Orquestrador do modo java-spring (Módulo 4)
 *
 * Gera um ZIP com estrutura dupla:
 *   frontend/  → Next.js chamando REST API (sem acesso direto ao banco)
 *   backend/   → Spring Boot 3.x + Java 21 com Entity/Repository/Service/Controller
 *   README.md  → Documentação master raiz do projeto full-stack
 */
export function generateJavaSpringProject(ast: AppAST): Map<string, string> {
  // acesso por linha configurado no projeto não é aplicado pelo backend Java: recusa em vez de exportar sem a proteção
  assertPolicySupported(ast)

  const files = new Map<string, string>()

  // BLOCO 1 — Frontend Next.js (modo REST client)
  generateJavaFrontend(ast, files)

  // BLOCO 2 — Backend Spring Boot
  generateSpringBootBackend(ast, files)

  // Script das tabelas de acesso: é do banco do backend, então fica na raiz (e não dentro do frontend)
  if (ast.accessAdmin) {
    files.delete('frontend/db/access-control.sql')
    files.set('db/access-control.sql', accessSql(ast))
  }

  // BLOCO 3 — Root README
  files.set('README.md', generateRootReadme(ast))

  return files
}

