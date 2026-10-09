import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { RateLimiter } from '@/lib/tunnel/relayPolicy';
import { parseEmailRequest } from '@/lib/automations/emailGuard';

export const dynamic = 'force-dynamic';

// Tentativas com token errado, por origem: impede adivinhar o token do projeto
const failedAuth = new RateLimiter(10, 60_000);
// Envios por projeto: 30 por minuto e 300 por hora (a automação normal não chega perto)
const sendsPerMinute = new RateLimiter(30, 60_000);
const sendsPerHour = new RateLimiter(300, 3_600_000);

const originOf = (req: NextRequest) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'ip';

export async function POST(req: NextRequest) {
  try {
    const origin = originOf(req);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }); }
    const { project_id, token } = body || {};

    if (!project_id || !token || typeof project_id !== 'string' || typeof token !== 'string') {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios.' }, { status: 400 });
    }

    // Validação de segurança: o CLI tem o token correto do projeto?
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('secret_token', token)
      .maybeSingle();

    if (projectError || !project) {
      if (!failedAuth.allow(origin)) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um instante.' }, { status: 429 });
      return NextResponse.json({ error: 'Credenciais inválidas (secret_token).' }, { status: 401 });
    }

    // Uso por projeto: um token vazado não vira disparador ilimitado de e-mails
    if (!sendsPerMinute.allow(project_id) || !sendsPerHour.allow(project_id)) {
      console.warn(`[automations/email] limite de envios atingido para o projeto ${project_id}`);
      return NextResponse.json({ error: 'Limite de envios atingido. Tente novamente mais tarde.' }, { status: 429 });
    }

    const parsed = parseEmailRequest(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { to, subject, html } = parsed.req;

    // Configurar o Nodemailer com as variáveis de ambiente
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"MetaBuilder PRO" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    // o motivo detalhado fica no log do servidor; quem chamou recebe só uma mensagem genérica
    console.error('Erro na API de envio de email:', error);
    return NextResponse.json({ error: 'Erro interno no servidor ao enviar email.' }, { status: 500 });
  }
}
