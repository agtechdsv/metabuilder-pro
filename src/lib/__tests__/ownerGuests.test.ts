import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildOwnerGuestIds, consumedLicenses } from '../admin/ownerGuests'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

describe('licenças consumidas no painel do SuperAdmin', () => {
  const workspaces = [{ id: 'w1', owner_id: 'dono' }, { id: 'w2', owner_id: 'dono' }, { id: 'w3', owner_id: 'outro' }]

  it('um convidado do dono que vale para os 2 workspaces conta UMA vez (era o erro: 2 contratadas / 3 consumidas)', () => {
    const map = buildOwnerGuestIds(workspaces, [], [{ owner_id: 'dono', user_id: 'quilla' }])
    expect(map.get('dono')?.size).toBe(1)
    expect(consumedLicenses(map.get('dono'))).toBe(2)
  })

  it('a mesma pessoa como convidada do dono e membro dos dois workspaces continua sendo uma só', () => {
    const members = [{ workspace_id: 'w1', user_id: 'quilla' }, { workspace_id: 'w2', user_id: 'quilla' }]
    const map = buildOwnerGuestIds(workspaces, members, [{ owner_id: 'dono', user_id: 'quilla' }])
    expect(map.get('dono')?.size).toBe(1)
  })

  it('duas pessoas diferentes são duas, o dono como membro não conta e cada dono tem os seus', () => {
    const members = [{ workspace_id: 'w1', user_id: 'dono' }, { workspace_id: 'w1', user_id: 'ana' }, { workspace_id: 'w3', user_id: 'beto' }]
    const map = buildOwnerGuestIds(workspaces, members, [{ owner_id: 'dono', user_id: 'quilla' }])
    expect([...(map.get('dono') || [])].sort()).toEqual(['ana', 'quilla'])
    expect(consumedLicenses(map.get('dono'))).toBe(3)
    expect([...(map.get('outro') || [])]).toEqual(['beto'])
  })

  it('sem convidados, consome só a do dono; membro de workspace desconhecido é ignorado', () => {
    expect(consumedLicenses(undefined)).toBe(1)
    expect(buildOwnerGuestIds(workspaces, [{ workspace_id: 'fantasma', user_id: 'x' }], []).size).toBe(0)
  })

  it('a lista de clientes usa a contagem por dono (e não soma por workspace)', () => {
    const hook = read('src/components/admin/hooks/useClientsAdmin.ts')
    expect(hook).toContain('buildOwnerGuestIds(mappedWorkspaces, workspaceMembers, ownerGuests)')
    expect(hook).toContain('client.guestCount = guestIds ? guestIds.size : 0')
    expect(hook).not.toMatch(/client\.guestCount \+= /)
  })
})
