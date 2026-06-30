import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'metabuilder.config.json');

export async function GET() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return NextResponse.json({
        connections: [],
        ldap: { enabled: false },
        downloadPath: ''
      });
    }

    const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(fileContent);

    // Filter out fixed environment keys so we don't expose them to the UI
    const { supabaseUrl, supabaseAnonKey, apiUrl, ...safeConfig } = config;

    return NextResponse.json(safeConfig);
  } catch (error: any) {
    console.error('Error reading config:', error);
    return NextResponse.json({ error: 'Erro ao ler arquivo de configuração' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // The CLI can read them directly from the environment variables, or we can inject them back just in case the CLI still expects them in the JSON.
    // Let's inject them back to ensure compatibility with existing cli-win.exe
    let existingSystemKeys = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chmstvtepzmjhpyxjjam.supabase.co',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      apiUrl: 'http://localhost:3000/api/metadata/sync' // Defina o caminho correto caso mude
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
      ...body,
      ...existingSystemKeys
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'Configuração salva com sucesso!' });
  } catch (error: any) {
    console.error('Error writing config:', error);
    return NextResponse.json({ error: 'Erro ao salvar arquivo de configuração' }, { status: 500 });
  }
}
