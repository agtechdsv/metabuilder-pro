import { describe, it, expect } from 'vitest'
import { registroDns } from '../domainDns'

describe('registro DNS que o cliente cria para o domínio', () => {
  it('domínio sem nada na frente: registro A na raiz (CNAME na raiz não é aceito)', () => {
    expect(registroDns('empresa.com')).toEqual({ tipo: 'A', nome: '@', valor: '76.76.21.21' })
    expect(registroDns('empresa.com.br')).toEqual({ tipo: 'A', nome: '@', valor: '76.76.21.21' })
  })

  it('www e subdomínios: CNAME com o nome do subdomínio', () => {
    expect(registroDns('www.empresa.com')).toEqual({ tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' })
    expect(registroDns('teste.veritumpro.com')).toEqual({ tipo: 'CNAME', nome: 'teste', valor: 'cname.vercel-dns.com' })
    expect(registroDns('www.empresa.com.br')).toEqual({ tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' })
    expect(registroDns('app.vendas.empresa.com.br').nome).toBe('app.vendas')
  })

  it('ignora maiúsculas e ponto final', () => {
    expect(registroDns('WWW.Empresa.com.').nome).toBe('www')
  })
})
