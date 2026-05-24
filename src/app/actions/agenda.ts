'use server'

import { createAdminClient } from '@/utils/supabase/server'
import nodemailer from 'nodemailer'

// Busca os slots ocupados para uma data específica (público)
export async function getOccupiedSlots(dateStr: string) {
  try {
    const supabase = createAdminClient()
    
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`
    
    const { data, error } = await supabase
      .from('agenda_compromissos')
      .select('data_inicio, data_fim, status')
      .neq('status', 'Cancelado')
      .gte('data_inicio', startOfDay)
      .lte('data_inicio', endOfDay)
      
    if (error) {
      console.error('Error fetching occupied slots:', error)
      throw new Error(error.message)
    }
    
    const occupiedIsoStrings = data ? data.map(item => new Date(item.data_inicio).toISOString()) : []
    
    return { 
      success: true, 
      slots: occupiedIsoStrings
    }
  } catch (err: any) {
    console.error('Error in getOccupiedSlots:', err)
    return { success: false, error: err.message || 'Erro ao buscar horários ocupados.' }
  }
}

// Cria um novo agendamento de demonstração (público)
export async function createAppointment(input: {
  title: string
  description?: string
  startTime: string
  endTime: string
  clientName: string
  clientEmail: string
  clientPhone: string
}) {
  try {
    const supabase = createAdminClient()
    
    const { error } = await supabase
      .from('agenda_compromissos')
      .insert({
        titulo: input.title,
        descricao: input.description || 'Agendamento de demonstração de 30 minutos.',
        data_inicio: input.startTime,
        data_fim: input.endTime,
        status: 'Pendente',
        categoria: 'Demonstração',
        prioridade: 'Alta',
        cor_etiqueta: '#4F46E5', // Indigo
        cliente_nome: input.clientName,
        cliente_email: input.clientEmail,
        cliente_whatsapp: input.clientPhone
      })
      
    if (error) {
      console.error('Error creating appointment:', error)
      throw new Error(error.message)
    }
    
    return { success: true }
  } catch (err: any) {
    console.error('Error in createAppointment:', err)
    return { success: false, error: err.message || 'Erro ao agendar demonstração.' }
  }
}

// ==========================================
// AÇÕES DO SUPER ADMINISTRADOR (CRUD AGENDA)
// ==========================================

// Busca todos os agendamentos (admin)
export async function getAllAppointments() {
  try {
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('agenda_compromissos')
      .select('*')
      .order('data_inicio', { ascending: true })
      
    if (error) {
      console.error('Error fetching all appointments:', error)
      throw new Error(error.message)
    }
    
    return { success: true, appointments: data || [] }
  } catch (err: any) {
    console.error('Error in getAllAppointments:', err)
    return { success: false, error: err.message || 'Erro ao buscar compromissos.' }
  }
}

// Atualiza o status do agendamento (admin)
export async function updateAppointmentStatus(id: string, status: string) {
  try {
    const supabase = createAdminClient()
    
    const { error } = await supabase
      .from('agenda_compromissos')
      .update({ status })
      .eq('id', id)
      
    if (error) {
      console.error('Error updating appointment status:', error)
      throw new Error(error.message)
    }
    
    return { success: true }
  } catch (err: any) {
    console.error('Error in updateAppointmentStatus:', err)
    return { success: false, error: err.message || 'Erro ao atualizar status do compromisso.' }
  }
}

// Exclui um agendamento permanentemente (admin)
export async function deleteAppointment(id: string) {
  try {
    const supabase = createAdminClient()
    
    const { error } = await supabase
      .from('agenda_compromissos')
      .delete()
      .eq('id', id)
      
    if (error) {
      console.error('Error deleting appointment:', error)
      throw new Error(error.message)
    }
    
    return { success: true }
  } catch (err: any) {
    console.error('Error in deleteAppointment:', err)
    return { success: false, error: err.message || 'Erro ao excluir compromisso.' }
  }
}

// Atualiza a data/hora de um compromisso (admin / Drag-and-Drop)
export async function updateAppointmentDate(id: string, startTime: string, endTime: string) {
  try {
    const supabase = createAdminClient()
    
    const { error } = await supabase
      .from('agenda_compromissos')
      .update({
        data_inicio: startTime,
        data_fim: endTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      
    if (error) {
      console.error('Error updating appointment date:', error)
      throw new Error(error.message)
    }
    
    return { success: true }
  } catch (err: any) {
    console.error('Error in updateAppointmentDate:', err)
    return { success: false, error: err.message || 'Erro ao reagendar compromisso.' }
  }
}

// Atualiza o link da demonstração (admin)
export async function updateAppointmentLink(id: string, link: string) {
  try {
    const supabase = createAdminClient()
    
    const { error } = await supabase
      .from('agenda_compromissos')
      .update({
        link_demonstracao: link,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      
    if (error) {
      console.error('Error updating appointment link:', error)
      throw new Error(error.message)
    }
    
    return { success: true }
  } catch (err: any) {
    console.error('Error in updateAppointmentLink:', err)
    return { success: false, error: err.message || 'Erro ao atualizar link da demonstração.' }
  }
}

// Envia e-mail de confirmação usando Nodemailer
export async function sendConfirmationEmail(input: {
  id: string
  clientName: string
  clientEmail: string
  dateInicio: string
  linkDemonstracao: string
}) {
  try {
    const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com'
    const smtpPort = Number(process.env.SMTP_PORT || '465')
    const smtpUser = process.env.SMTP_USER || 'contato@metabuilderpro.com'
    const smtpPass = process.env.SMTP_PASS

    if (!smtpPass) {
      console.warn('SMTP_PASS is not configured in environment variables.')
      return { 
        success: false, 
        error: 'A senha do SMTP (SMTP_PASS) não está configurada nas variáveis de ambiente. Por favor, adicione as credenciais no arquivo .env.local.' 
      }
    }

    const startDate = new Date(input.dateInicio)
    const friendlyDate = startDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}h`

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false
      }
    })

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f6f9fc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f6f9fc;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    }
    .header {
      background: linear-gradient(135deg, #00B574 0%, #3B82F6 100%);
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .header span {
      font-weight: 300;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .content h2 {
      color: #1f2937;
      font-size: 22px;
      font-weight: 800;
      margin-top: 0;
      margin-bottom: 15px;
    }
    .content p {
      color: #4b5563;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .details-card {
      background-color: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 30px;
      text-align: left;
    }
    .details-card-title {
      font-size: 10px;
      font-weight: 800;
      color: #00B574;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 12px;
      text-align: center;
    }
    .details-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .details-row:last-child {
      margin-bottom: 0;
    }
    .details-label {
      color: #64748b;
      font-weight: 600;
    }
    .details-value {
      color: #0f172a;
      font-weight: 700;
    }
    .btn-container {
      margin-bottom: 30px;
    }
    .btn {
      display: inline-block;
      background-color: #00B574;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(0, 181, 116, 0.2);
    }
    .footer {
      text-align: center;
      padding: 0 30px 40px 30px;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.6;
      border-top: 1px solid #f1f5f9;
      padding-top: 20px;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer-highlight {
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>MetaBuilder <span>PRO</span></h1>
      </div>
      <div class="content">
        <h2>Demonstração Confirmada</h2>
        <p>Olá, <strong>${input.clientName}</strong>! Sua demonstração prática e exclusiva do MetaBuilderPRO com o fundador Alexandre Moura foi agendada e confirmada. Veja abaixo os detalhes da sua reunião:</p>
        
        <div class="details-card">
          <div class="details-card-title">Detalhes da Reunião</div>
          <div class="details-row">
            <span class="details-label">Data:</span>
            <span class="details-value">${friendlyDate}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Horário:</span>
            <span class="details-value">${timeStr} (Horário de Brasília)</span>
          </div>
          <div class="details-row">
            <span class="details-label">Duração:</span>
            <span class="details-value">30 minutos</span>
          </div>
        </div>

        <div class="btn-container">
          <a href="${input.linkDemonstracao}" target="_blank" class="btn">Acessar Demonstração</a>
        </div>
      </div>
      <div class="footer">
        <p class="footer-highlight">© 2026 METABUILDER PRO</p>
        <p>Este é um e-mail automático enviado para confirmar seu agendamento na plataforma.</p>
        <p>Por favor, <span class="footer-highlight">não responda a este e-mail</span>. Caso precise de suporte, entre em contato pelo nosso WhatsApp ou pelo e-mail de atendimento.</p>
        <p>Plataforma de Desenvolvimento Avançado.</p>
      </div>
    </div>
  </div>
</body>
</html>`

    const mailOptions = {
      from: `"MetaBuilderPRO" <${smtpUser}>`,
      to: input.clientEmail,
      subject: 'MetaBuilderPRO - Demonstração Confirmada! \u{1F680}',
      text: `Olá, ${input.clientName}! Sua demonstração prática está confirmada.\n\nData: ${friendlyDate}\nHorário: ${timeStr} (Horário de Brasília)\nLink da Reunião: ${input.linkDemonstracao}\n\nPor favor, não responda a este e-mail.`,
      html: htmlContent
    }

    await transporter.sendMail(mailOptions)

    // Update appointment status to "Confirmado" in database automatically when email is sent
    const supabase = createAdminClient()
    await supabase
      .from('agenda_compromissos')
      .update({ status: 'Confirmado', updated_at: new Date().toISOString() })
      .eq('id', input.id)

    return { success: true }
  } catch (err: any) {
    console.error('Error in sendConfirmationEmail:', err)
    return { success: false, error: err.message || 'Erro ao enviar e-mail de confirmação.' }
  }
}


