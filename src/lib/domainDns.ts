/**
 * O registro DNS que o cliente cria para o domínio apontar para a plataforma (a caixa "Configuração de DNS" do White-Label):
 * - domínio sem nada na frente (empresa.com): registro A em "@" (um CNAME na raiz não é aceito pela maioria dos provedores);
 * - www ou outro subdomínio (www.empresa.com, teste.empresa.com): CNAME com o nome do subdomínio.
 */
export const IP_VERCEL = '76.76.21.21'
export const CNAME_VERCEL = 'cname.vercel-dns.com'

// sufixos de dois níveis comuns (empresa.com.br tem a raiz em "empresa", não em "com")
const SUFIXOS_2 = new Set(['com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'co.uk', 'org.uk', 'com.au', 'com.ar', 'com.mx', 'com.pt', 'co.za', 'co.jp'])

export interface RegistroDns { tipo: 'A' | 'CNAME'; nome: string; valor: string }

export function registroDns(dominio: string): RegistroDns {
  const partes = dominio.trim().toLowerCase().replace(/\.$/, '').split('.').filter(Boolean)
  const nSufixo = partes.length >= 2 && SUFIXOS_2.has(partes.slice(-2).join('.')) ? 2 : 1
  const nRaiz = nSufixo + 1 // o nome registrado + o sufixo (empresa.com, empresa.com.br)
  if (partes.length <= nRaiz) return { tipo: 'A', nome: '@', valor: IP_VERCEL }
  return { tipo: 'CNAME', nome: partes.slice(0, partes.length - nRaiz).join('.'), valor: CNAME_VERCEL }
}

/** O nome do TXT sem o domínio registrado: vendasora.veritumpro.com → _metabuilder-verify.vendasora; empresa.com → _metabuilder-verify. */
export function txtNomeRelativo(dominio: string): string {
  // sem o "www.": o TXT vale para o apex e para o www; o prefixo do subdomínio (se houver) é o que sobra antes do domínio registrado
  const partes = dominio.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '').split('.').filter(Boolean)
  const nSufixo = partes.length >= 2 && SUFIXOS_2.has(partes.slice(-2).join('.')) ? 2 : 1
  const prefixo = partes.slice(0, Math.max(0, partes.length - (nSufixo + 1))).join('.')
  return prefixo ? `_metabuilder-verify.${prefixo}` : '_metabuilder-verify'
}
