import { AppAST } from '../ast'
import { generateRoutes } from '../layers/routes'
import { generateActions } from '../layers/actions'
import { generateComponents } from '../layers/components'
import { generateBaseFiles } from './base-files'
import { generateLoginPage, generateDownloadsPage } from './auth-flow'

export function generateNativeProject(ast: AppAST): Map<string, string> {
  const files = new Map<string, string>()

  // 1. Arquivos Base do Projeto
  generateBaseFiles(ast, files)

  // 2. Geração das Camadas
  generateRoutes(ast, files)
  generateActions(ast, files)
  generateComponents(ast, files)

  // 3. Página de Login
  generateLoginPage(ast, files)

  // 4. Página de Downloads
  generateDownloadsPage(ast, files)

  return files
}
