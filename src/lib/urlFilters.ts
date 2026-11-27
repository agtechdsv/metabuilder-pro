/**
 * Filtros vindos da URL da tela (`?nome_empresa=ACME` vira o filtro `nome_empresa`).
 * Parâmetros que NÃO são filtros (controle da própria tela, pré-visualização, modo demonstração da Ajuda Interativa...) ficam de fora;
 * se entrassem, virariam filtro de uma coluna que não existe e a consulta falharia ("coluna x.mb_demo não existe").
 */

export const NON_FILTER_URL_PARAMS: readonly string[] = [
  'embedded', 'preview', 'return_to', 'edit_id', 'standalone', 'mode',
  // Ajuda Interativa: modo demonstração e linha sintética
  'mb_demo', 'mb_seed',
  // Automação de processos: endereço do editor (/automations?table=<id>&flow=<id>). Ao clicar numa tela do menu logo depois, o app ainda
  // lê a URL antiga e esses parâmetros viravam filtro ("coluna pedidos.table não existe")
  'table', 'flow', 'scope', 'use_case',
]

export function filtersFromSearch(search: string): Record<string, string> {
  const out: Record<string, string> = {}
  new URLSearchParams(search).forEach((value, key) => {
    if (!NON_FILTER_URL_PARAMS.includes(key)) out[key] = value
  })
  return out
}
