/**
 * Endereço do site usado nos links de e-mails e avisos. Um lugar só.
 * O endereço oficial é COM www (o sem www só redireciona para ele); a variável de ambiente, se existir, tem prioridade.
 */
export const DEFAULT_SITE_URL = 'https://www.metabuilderpro.com'

export const siteBaseUrl = (): string =>
  (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')
