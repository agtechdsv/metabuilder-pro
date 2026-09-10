import { AppAST } from '../ast'
import { generateJavaFrontend } from './java-spring-frontend'
import { generateSpringBootBackend } from './java-spring-backend'

/**
 * java-spring-project.ts — Orquestrador do modo java-spring (Módulo 4)
 *
 * Gera um ZIP com estrutura dupla:
 *   frontend/  → Next.js chamando REST API (sem acesso direto ao banco)
 *   backend/   → Spring Boot 3.x + Java 21 com Entity/Repository/Service/Controller
 */
export function generateJavaSpringProject(ast: AppAST): Map<string, string> {
  const files = new Map<string, string>()

  // BLOCO 1 — Frontend Next.js (modo REST client)
  generateJavaFrontend(ast, files)

  // BLOCO 2 — Backend Spring Boot
  generateSpringBootBackend(ast, files)

  return files
}

