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

describe('nome do TXT como o painel de DNS pede', () => {
  it('sem o domínio registrado (muitos painéis acrescentam sozinhos)', async () => {
    const { txtNomeRelativo } = await import('../domainDns')
    expect(txtNomeRelativo('vendasora.veritumpro.com')).toBe('_metabuilder-verify.vendasora')
    expect(txtNomeRelativo('empresa.com')).toBe('_metabuilder-verify')
    expect(txtNomeRelativo('www.empresa.com')).toBe('_metabuilder-verify')
    expect(txtNomeRelativo('empresa.com.br')).toBe('_metabuilder-verify')
    expect(txtNomeRelativo('app.vendas.empresa.com.br')).toBe('_metabuilder-verify.app.vendas')
  })
})

describe('CNAME recomendado pela Vercel', () => {
  it('entra no lugar do genérico, sem o ponto final; sem ele fica o genérico; a raiz continua com o registro A', () => {
    expect(registroDns('vendasora.veritumpro.com', { cname: '25004989a1b45523.vercel-dns-017.com.' }).valor).toBe('25004989a1b45523.vercel-dns-017.com')
    expect(registroDns('vendasora.veritumpro.com', {}).valor).toBe('cname.vercel-dns.com')
    expect(registroDns('vendasora.veritumpro.com').valor).toBe('cname.vercel-dns.com')
    expect(registroDns('empresa.com', { cname: 'x.vercel-dns-017.com' })).toEqual({ tipo: 'A', nome: '@', valor: '76.76.21.21' })
  })
})
