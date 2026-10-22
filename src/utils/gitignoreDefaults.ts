/**
 * .gitignore da pasta do projeto na IDE Local. O Sincronizar compara a pasta inteira com o repositório local: sem estas regras, o que o Node
 * e o Maven geram ao compilar (node_modules, .next, backend/target com centenas de .class) aparece como "alteração" na revisão do merge.
 */
export const GITIGNORE_PADRAO = [
  'node_modules', '.next', '.vscode', '.DS_Store', '*.log', '.env*',
  // Java / Maven: a compilação do backend (backend/target) e arquivos de IDE
  'target/', '*.class', '.idea/', '*.iml',
]

/** O conteúdo atual do .gitignore com as regras padrão que faltam acrescentadas ao fim; o que o dev já escreveu fica como está. */
export function gitignoreCompleto(atual: string): string {
  const texto = atual.replace(/\r\n/g, '\n')
  const tem = new Set(texto.split('\n').map(l => l.trim()).filter(Boolean))
  const faltam = GITIGNORE_PADRAO.filter(r => !tem.has(r))
  if (faltam.length === 0) return texto.endsWith('\n') || texto === '' ? texto : texto + '\n'
  const base = texto === '' ? '' : (texto.endsWith('\n') ? texto : texto + '\n')
  return base + faltam.join('\n') + '\n'
}
