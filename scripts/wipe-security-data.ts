import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    let value = match[2].trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    env[key] = value
  }
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseKey) {
  console.error('ERRO: Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function wipeData() {
  console.log('Iniciando limpeza total de dados de segurança (Passkeys e MFA)...')

  try {
    console.log('1. Limpando dados de Owners e Desenvolvedores...')
    
    const { error: errorPkDevs } = await supabase
      .from('passkey_credentials')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (errorPkDevs) throw new Error('Erro ao limpar passkey_credentials: ' + errorPkDevs.message)
    console.log('  -> Passkeys de Devs apagadas com sucesso!')

    console.log('2. Limpando dados de End-Users (CRM)...')
    const { error: errorEndUsers } = await supabase
      .from('project_users_security')
      .update({ passkeys: [], mfa_enabled: false, totp_secret: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (errorEndUsers) throw new Error('Erro ao resetar project_users_security: ' + errorEndUsers.message)
    console.log('  -> Passkeys e MFA de End-Users resetados com sucesso!')

    console.log('\n✅ Limpeza concluída com sucesso! Todos os usuários estão "zerados" para Passkey e MFA.')
  } catch (error) {
    console.error('\n❌ Erro durante a limpeza:', error)
  }
}

wipeData()
