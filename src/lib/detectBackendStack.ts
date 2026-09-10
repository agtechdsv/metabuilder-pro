import { FileNode } from '@/contexts/ide/useIDEFileSystem'
import type { BackendStack } from '@/lib/generator/ast'

/**
 * detectBackendStack — Módulo 10.4
 *
 * Detecta a stack de backend olhando o fileTree do IDE.
 * Critérios (em ordem de prioridade):
 *   1. Existe pasta 'backend/' → java-spring (projeto dual)
 *   2. Existe 'pom.xml' na raiz → java-spring
 *   3. Existe 'pom.xml' em qualquer profundidade → java-spring
 *   4. Caso contrário → nodejs
 *
 * Retorna 'nodejs' se fileTree estiver vazio ou não carregado ainda.
 */
export function detectBackendStack(fileTree: FileNode[]): BackendStack {
  if (!fileTree || fileTree.length === 0) return 'nodejs'

  // Verificar nós de nível 0
  for (const node of fileTree) {
    const name = node.name?.toLowerCase() ?? ''

    // Critério 1: pasta 'backend/' (projeto dual java-spring)
    if (node.isDirectory && name === 'backend') {
      return 'java-spring'
    }

    // Critério 2: pom.xml na raiz
    if (!node.isDirectory && name === 'pom.xml') {
      return 'java-spring'
    }
  }

  // Critério 3: pom.xml em qualquer profundidade (busca recursiva)
  if (hasPomXmlDeep(fileTree)) {
    return 'java-spring'
  }

  return 'nodejs'
}

function hasPomXmlDeep(nodes: FileNode[]): boolean {
  for (const node of nodes) {
    if (!node.isDirectory && node.name?.toLowerCase() === 'pom.xml') {
      return true
    }
    if (node.isDirectory && node.children && hasPomXmlDeep(node.children)) {
      return true
    }
  }
  return false
}

/**
 * isJavaSpringFromFileTree
 * Sugar helper — retorna boolean direto para uso em JSX.
 */
export function isJavaSpringFromFileTree(fileTree: FileNode[]): boolean {
  return detectBackendStack(fileTree) === 'java-spring'
}

