/**
 * Para onde o DONO (assinante ativo) vai logo depois de entrar: o painel; mas com fatura VENCIDA em aberto, direto na tela Assinatura,
 * onde estão o QR Code do Pix e o cartão. É só o destino do login: ele continua livre para navegar pelo painel depois.
 */
export const OWNER_DASHBOARD_PATH = '/client/dashboard'
export const OWNER_SUBSCRIPTION_PATH = '/client/dashboard?tab=subscription'

export const ownerLandingPath = (hasOverdueCharge: boolean): string => (hasOverdueCharge ? OWNER_SUBSCRIPTION_PATH : OWNER_DASHBOARD_PATH)
