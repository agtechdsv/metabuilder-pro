import { NextResponse, type NextRequest } from 'next/server'
import {
  DEVICE_COOKIE, SLOT_COOKIE, chooseUrl, decideGate, isProtectedApiPath, isProtectedPath, revokedUrl, signSlotCookie, slotSecret, verifySlotCookie,
} from './slotCore'
import { buildSlotInput, claimSlot } from './slotService'

interface GateAuth {
  user: { id: string } | null
  accessToken: string | null
  cookieDomain: string | undefined
}

const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Portão central das vagas de sessão (1 IDE + 1 navegador por usuário). Roda no proxy, depois de renovar o login.
 * Cobre todos os caminhos de entrada (senha, Google, passkey, entrega do login pela IDE) de uma vez, porque olha a sessão que existe
 * e não o botão que foi clicado. Desenho: docs/sessoes-dispositivos-desenho.md.
 */
export async function applySlotGate(request: NextRequest, response: NextResponse, auth: GateAuth): Promise<NextResponse> {
  const path = request.nextUrl.pathname
  if (!auth.user || !isProtectedPath(path)) return response

  const secret = slotSecret()
  if (!secret) return response // sem segredo não há como assinar: deixa passar (e o log do servidor avisa pelo serviço)

  const built = await buildSlotInput({
    userId: auth.user.id,
    accessToken: auth.accessToken,
    cookie: n => request.cookies.get(n)?.value,
    header: n => request.headers.get(n),
  })
  if (!built) return response
  const { input, isNewDevice } = built
  const claims = { sessionId: input.sessionId, kind: input.kind, deviceId: input.deviceId }

  const secure = process.env.NODE_ENV === 'production'
  const writeDevice = (res: NextResponse) => {
    if (isNewDevice) {
      res.cookies.set(DEVICE_COOKIE, input.deviceId, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: ONE_YEAR, domain: auth.cookieDomain })
    }
  }

  // Conferida há menos de ~60 s: não vai ao banco.
  if (await verifySlotCookie(request.cookies.get(SLOT_COOKIE)?.value, claims, secret)) {
    writeDevice(response)
    return response
  }

  const result = await claimSlot(input)
  const action = decideGate(result)

  if (action === 'pass') {
    writeDevice(response)
    if (result) {
      const ttl = Math.max(10, result.ttl || 60)
      response.cookies.set(SLOT_COOKIE, await signSlotCookie(claims, ttl, secret), {
        httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: ttl, domain: auth.cookieDomain,
      })
    }
    return response
  }

  // Rotas de API respondem 401 (quem chamou é um fetch, não uma página); o cliente trata o aviso pelo batimento
  if (isProtectedApiPath(path)) {
    return NextResponse.json({ error: 'session_inactive', status: result?.status }, { status: 401 })
  }

  const target = action === 'choose' ? chooseUrl(path + request.nextUrl.search) : revokedUrl(result?.by)
  const redirect = NextResponse.redirect(new URL(target, request.url))
  // mantém os cookies que o Supabase renovou nesta requisição
  response.cookies.getAll().forEach(c => redirect.cookies.set(c))
  writeDevice(redirect)
  redirect.cookies.set(SLOT_COOKIE, '', { path: '/', maxAge: 0, domain: auth.cookieDomain })

  if (action === 'revoked') {
    // esta sessão foi encerrada por outro login: tira os cookies de login para a tela de entrada não reabrir a sessão antiga
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith('sb-') || c.name === 'passkey_authenticated') {
        redirect.cookies.set(c.name, '', { path: '/', maxAge: 0, domain: auth.cookieDomain })
      }
    }
  }
  return redirect
}
