'use server'

import { createAdminClient } from '@/utils/supabase/server'

export interface BetaLeadInput {
  fullName: string
  email: string
  phone: string
  companyName?: string
  companySize?: string
  challenge?: string
  operator?: string
  urgency?: string
  databaseType?: string
  objective?: string
}

export async function submitBetaLead(input: BetaLeadInput) {
  try {
    if (!input.fullName || !input.email || !input.phone) {
      return { success: false, error: 'Nome, E-mail e WhatsApp são obrigatórios.' }
    }

    const supabase = createAdminClient()

    const { error } = await supabase.from('beta_leads').insert({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      company_name: input.companyName || null,
      company_size: input.companySize || null,
      challenge: input.challenge || null,
      operator: input.operator || null,
      urgency: input.urgency || null,
      database_type: input.databaseType || null,
      objective: input.objective || null,
    })

    if (error) {
      console.error('Error inserting beta lead:', error)
      throw new Error(error.message)
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error in submitBetaLead:', err)
    return { success: false, error: err.message || 'Erro ao processar o seu cadastro.' }
  }
}
