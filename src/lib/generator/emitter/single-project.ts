import { AppAST } from '../ast'
import { generateNodeProject } from './node-project'
import { generateJavaSpringProject } from './java-spring-project'

/**
 * single-project.ts — Dispatcher (Módulo 2 do plano Multi-Backend Eject & Sync)
 *
 * Mantém a MESMA assinatura pública de sempre: generateNativeProject(ast).
 * Delega para o gerador correto baseado em ast.backendStack.
 *
 * O emitter/index.ts continua re-exportando generateNativeProject sem alteração
 * — zero breaking change para os consumers existentes.
 */
export function generateNativeProject(ast: AppAST): Map<string, string> {
  if (ast.backendStack === 'java-spring') {
    return generateJavaSpringProject(ast)
  }

  // backendStack = 'nodejs' (default) — comportamento 100% idêntico ao original
  return generateNodeProject(ast)
}


