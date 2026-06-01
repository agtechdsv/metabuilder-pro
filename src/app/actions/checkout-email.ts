'use server'

import nodemailer from 'nodemailer'

export async function sendPaymentEmail({
  email,
  paymentMethod,
  amount,
  invoiceUrl,
  barCode
}: {
  email: string
  paymentMethod: 'pix' | 'boleto'
  amount: number
  invoiceUrl: string | null
  barCode: string | null
}) {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return { success: false, error: 'Configurações de SMTP não encontradas no servidor.' }
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: Number(SMTP_PORT) === 465, 
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })

    const isPix = paymentMethod === 'pix'
    
    // Formatação em moeda
    const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)

    // Template HTML Bonitão com a marca MetaBuilder PRO
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sua Fatura MetaBuilder PRO</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">MetaBuilder <span style="color: #c7d2fe;">PRO</span></h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Sua fatura está pronta para pagamento</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #3f3f46; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Olá! Como solicitado, estamos enviando os dados para pagamento da sua assinatura.
              </p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <p style="color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 700;">Valor da Fatura</p>
                <p style="color: #0f172a; font-size: 36px; font-weight: 900; margin: 0;">${formattedAmount}</p>
              </div>

              ${barCode ? `
                <div style="margin-bottom: 30px;">
                  <p style="color: #4f46e5; font-size: 14px; font-weight: 700; margin: 0 0 8px 0;">
                    ${isPix ? 'PIX Copia e Cola:' : 'Linha Digitável do Boleto:'}
                  </p>
                  <div style="background-color: #f4f4f5; padding: 16px; border-radius: 12px; word-break: break-all; color: #18181b; font-family: monospace; font-size: 14px; border: 1px solid #e4e4e7;">
                    ${barCode}
                  </div>
                </div>
              ` : ''}

              ${invoiceUrl ? `
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${invoiceUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 16px 32px; border-radius: 12px; letter-spacing: 0.5px;">
                    Abrir Fatura Completa
                  </a>
                </div>
              ` : ''}

            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 13px; margin: 0;">
                Se você já realizou o pagamento, pode desconsiderar este e-mail. A ativação acontecerá automaticamente!
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    const subject = isPix ? `Seu PIX de ${formattedAmount} - MetaBuilder PRO` : `Seu Boleto de ${formattedAmount} - MetaBuilder PRO`

    await transporter.sendMail({
      from: `"MetaBuilder PRO" <${SMTP_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    })

    return { success: true }
  } catch (error: any) {
    console.error('Erro ao enviar e-mail de pagamento:', error)
    return { success: false, error: error.message || 'Falha no envio do e-mail' }
  }
}
