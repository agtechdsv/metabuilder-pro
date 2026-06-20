import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function run() {
  const email = 'agtechtrade@gmail.com'
  console.log(`Buscando usuário: ${email}...`)
  
  const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
  if (usersError) throw usersError
  
  const user = users.users.find(u => u.email === email)
  if (!user) throw new Error('Usuário não encontrado')
    
  console.log(`Usuário encontrado: ${user.id}`)
  
  const { data: factors, error: factorsError } = await supabaseAdmin.auth.admin.mfa.listFactors({
    userId: user.id
  })
  if (factorsError) throw factorsError
  
  const totpFactors = factors.factors.filter(f => f.factor_type === 'totp')
  
  if (totpFactors.length === 0) {
    console.log('Nenhum fator TOTP encontrado para este usuário.')
    return
  }
  
  for (const factor of totpFactors) {
    console.log(`Removendo fator TOTP: ${factor.id}`)
    const { error: unenrollError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: user.id
    })
    if (unenrollError) {
      console.error('Erro ao remover fator:', unenrollError)
    } else {
      console.log(`Fator ${factor.id} removido com sucesso!`)
    }
  }
  
  console.log('Processo finalizado.')
}

run().catch(console.error)
