function wrapEmailInTemplate(templateType, bodyHtml) {
  let formattedBody = bodyHtml;
  if (!formattedBody.includes('<br') && !formattedBody.includes('<p>')) {
    formattedBody = formattedBody.replace(/\n/g, '<br/>');
  }

  if (templateType === 'modern') {
    return `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">MetaBuilder PRO</h1>
    </div>
    <div style="padding: 40px 30px; color: #374151; font-size: 16px; line-height: 1.6;">
      ${formattedBody}
    </div>
    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
      &copy; ${new Date().getFullYear()} MetaBuilder PRO<br>Este é um e-mail automático, por favor não responda.
    </div>
  </div>
</div>`;
  }

  if (templateType === 'alert') {
    return `
<div style="background-color: #fef2f2; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #f87171; overflow: hidden; box-shadow: 0 4px 6px rgba(239,68,68,0.1);">
    <div style="background-color: #ef4444; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">⚠️ Ação Requerida</h1>
    </div>
    <div style="padding: 40px 30px; color: #374151; font-size: 16px; line-height: 1.6;">
      ${formattedBody}
    </div>
    <div style="background-color: #fef2f2; padding: 15px; text-align: center; font-size: 12px; color: #ef4444; font-weight: bold;">
      Sistema de Gestão MetaBuilder PRO
    </div>
  </div>
</div>`;
  }

  if (templateType === 'classic') {
    return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333; line-height: 1.5;">
  <div style="border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px;">
    <h2 style="color: #2563eb; margin: 0;">Notificação do Sistema</h2>
  </div>
  <div style="min-height: 150px;">
    ${formattedBody}
  </div>
  <div style="border-top: 1px solid #dddddd; padding-top: 15px; margin-top: 30px; font-size: 11px; color: #777777;">
    MetaBuilder PRO Enterprise Solutions<br>
    Este e-mail foi gerado automaticamente pelo motor BPM.
  </div>
</div>`;
  }

  return formattedBody;
}

module.exports = { wrapEmailInTemplate };
