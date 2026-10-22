import { createHmac } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'

/**
 * Prova de que quem vincula um domínio é quem o controla: o painel pede um registro TXT no DNS do domínio com um valor que só este servidor sabe
 * calcular (HMAC do domínio e do projeto/portal com um segredo). Sem estado no banco: o mesmo cálculo serve para pedir e para conferir.
 */

/** Nomes que nunca podem ser vinculados por um cliente (o próprio sistema e hospedagens de terceiros). */
const RESERVADOS = ['metabuilderpro.com', 'vercel.app', 'vercel.com', 'localhost']

const semWww = (d: string) => d.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '')

export const dominioReservado = (dominio: string): boolean => {
  const d = semWww(dominio)
  return RESERVADOS.some(r => d === r || d.endsWith('.' + r))
}

/** Onde o cliente cria o registro TXT: _metabuilder-verify.<domínio sem www>. */
export const txtNome = (dominio: string): string => `_metabuilder-verify.${semWww(dominio)}`

/** O valor esperado no TXT: depende do domínio e do projeto/portal de destino, então uma prova serve só para esse vínculo. */
export const txtValor = (dominio: string, destinoId: string, segredo: string): string =>
  'mb-verify=' + createHmac('sha256', segredo).update(`${semWww(dominio)}|${destinoId}`).digest('hex').slice(0, 32)

/** O DNS do domínio tem o TXT com o valor esperado? (sem o registro, ou com outro valor, é não). */
export async function txtConfere(dominio: string, destinoId: string, segredo: string): Promise<boolean> {
  try {
    const registros = (await resolveTxt(txtNome(dominio))).map(partes => partes.join(''))
    return registros.includes(txtValor(dominio, destinoId, segredo))
  } catch { return false }
}
