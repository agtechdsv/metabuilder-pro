import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/utils/supabase/server';

const CONFIG_PATH = path.join(process.cwd(), 'metabuilder.config.json');

// Campos permitidos no config salvo pelo usuário (whitelist)
const ALLOWED_CONFIG_KEYS = [
  'connections', 'ldap', 'downloadPath', 'theme', 'language',
  'autoStart', 'logLevel', 'port'
];

export async function GET() {
  try {
    // Requer sessão autenticada
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!fs.existsSync(CONFIG_PATH)) {
      return NextResponse.json({
        connections: [],
        ldap: { enabled: false },
        downloadPath: ''
      });
    }

    const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(fileContent);

    // Remove chaves sensíveis — nunca expõe credenciais ao browser
    const { supabaseUrl, supabaseAnonKey, apiUrl, ...safeConfig } = config;

    return NextResponse.json(safeConfig);
  } catch (error: any) {
    console.error('Error reading config:', error);
    return NextResponse.json({ error: 'Erro ao ler arquivo de configuração' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Requer sessão autenticada
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();

    // Whitelist: aceita apenas campos conhecidos do body do usuário
    const sanitizedBody: Record<string, any> = {}
    for (const key of ALLOWED_CONFIG_KEYS) {
      if (body[key] !== undefined) {
        sanitizedBody[key] = body[key]
      }
    }

    // Preserva chaves de sistema existentes (nunca vindas do body)
    let existingSystemKeys = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chmstvtepzmjhpyxjjam.supabase.co',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      apiUrl: 'http://localhost:3000/api/metadata/sync'
    };

    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
      try {
        const oldConfig = JSON.parse(fileContent);
        existingSystemKeys.supabaseUrl = oldConfig.supabaseUrl || existingSystemKeys.supabaseUrl;
        existingSystemKeys.supabaseAnonKey = oldConfig.supabaseAnonKey || existingSystemKeys.supabaseAnonKey;
        existingSystemKeys.apiUrl = oldConfig.apiUrl || existingSystemKeys.apiUrl;
      } catch (e) {}
    }

    const newConfig = {
      ...sanitizedBody,
      ...existingSystemKeys // chaves de sistema sempre sobrescrevem
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'Configuração salva com sucesso!' });
  } catch (error: any) {
    console.error('Error writing config:', error);
    return NextResponse.json({ error: 'Erro ao salvar arquivo de configuração' }, { status: 500 });
  }
}

