import { describe, it, expect } from 'vitest'
import { envParaApp, lerUrl, tipoDoBanco, traduzirParaOracle } from '../../../../e2e/dynamic/lib/banco.mjs'
import { detectarApp, bancoDoApp } from '../../../../e2e/dynamic/lib/app.mjs'

/** O motor escreve SQL do jeito do Postgres; no Oracle o adaptador traduz. Estes casos são os que os testes usam. */
describe('adaptador de banco do motor (Postgres e Oracle)', () => {
  it('reconhece o banco pela URL', () => {
    expect(tipoDoBanco('postgres://u:p@h/db')).toBe('postgres')
    expect(tipoDoBanco('postgresql://u:p@h/db')).toBe('postgres')
    expect(tipoDoBanco('oracle://u:p@h:1521/FREEPDB1')).toBe('oracle')
    expect(tipoDoBanco('mysql://u:p@h/db')).toBeNull()
    expect(lerUrl('oracle://crm:a%40b@192.168.0.201/FREEPDB1')).toMatchObject({ tipo: 'oracle', host: '192.168.0.201', porta: '1521', banco: 'FREEPDB1', usuario: 'crm', senha: 'a@b' })
  })

  it('traduz $1, identificadores, ::text, outros casts, now() e limit para o Oracle', () => {
    const t = traduzirParaOracle('select "id"::text as "__id", count(*)::int n, now() from "clientes" where "nome"::text like $1 and "x" = $2 and "y" = $1 limit 5', ['E2E-%', 7])
    expect(t.texto).toBe('select to_char("ID") as "__ID", count(*) n, systimestamp from "CLIENTES" where to_char("NOME") like :b1 and "X" = :b2 and "Y" = :b1 fetch first 5 rows only')
    expect(t.binds).toEqual({ b1: 'E2E-%', b2: 7 })
  })

  it('não mexe em texto entre aspas simples (hora, $1 literal, nomes)', () => {
    const t = traduzirParaOracle(`select "c" from "t" where "c" = '12:00:00 $1 "ab" now()' and "d"::text = $1`, ['x'])
    expect(t.texto).toContain(`'12:00:00 $1 "ab" now()'`)
    expect(t.texto).toContain('to_char("D") = :b1')
  })

  it('injeta o banco de teste do jeito de cada pilha (Node Postgres, Node Oracle, Java)', () => {
    expect(envParaApp('postgres://u:p@h:5432/db', 'node')).toEqual({ DATABASE_URL: 'postgres://u:p@h:5432/db' })
    expect(envParaApp('oracle://u:p@h:1521/SRV', 'node')).toEqual({ DB_CONNECTION_STRING: 'h:1521/SRV', DB_USER: 'u', DB_PASSWORD: 'p' })
    expect(envParaApp('postgres://u:p@h:5432/db', 'java')).toEqual({ SPRING_DATASOURCE_URL: 'jdbc:postgresql://h:5432/db', SPRING_DATASOURCE_USERNAME: 'u', SPRING_DATASOURCE_PASSWORD: 'p' })
    expect(envParaApp('oracle://u:p@h:1521/SRV', 'java').SPRING_DATASOURCE_URL).toBe('jdbc:oracle:thin:@//h:1521/SRV')
  })

  it('detecta o app: Java só com backend/pom.xml e frontend/package.json', () => {
    expect(detectarApp('C:/pasta/que/nao/existe').pilha).toBe('node')
    expect(bancoDoApp({ pilha: 'node', frontendDir: 'C:/pasta/que/nao/existe', backendDir: null })).toBeNull()
  })
})
