import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createClient } from '@/utils/supabase/server';

// Usamos uma variável global no Node.js para manter o processo do túnel
let tunnelProcess: any = null;

const CLI_PATH = path.join(process.cwd(), 'cli', 'cli-win.exe');

// Valores permitidos para argumentos do CLI (whitelist)
const ALLOWED_MODES = ['1', '2', '3'];
const ALLOWED_LANGS = ['pt', 'en', 'es'];

export async function POST(req: Request) {
  try {
    // Requer sessão autenticada
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const { action, mode, lang } = await req.json();

    if (action === 'start') {
      if (tunnelProcess && !tunnelProcess.killed) {
        return NextResponse.json({ success: false, message: 'O túnel já está rodando.' }, { status: 400 });
      }

      if (!fs.existsSync(CLI_PATH)) {
        return NextResponse.json({ success: false, message: 'Executável do CLI não encontrado na pasta cli/' }, { status: 404 });
      }

      // Sanitiza argumentos via whitelist (previne command injection)
      const safeMode = ALLOWED_MODES.includes(String(mode)) ? String(mode) : '1';
      const args = ['--mode', safeMode];
      if (lang) {
        const safeLang = ALLOWED_LANGS.includes(String(lang)) ? String(lang) : 'pt';
        args.push(`--lang=${safeLang}`);
      }

      tunnelProcess = spawn(CLI_PATH, args, {
        cwd: path.join(process.cwd(), 'cli')
      });

      tunnelProcess.on('close', (code: number) => {
        console.log(`Tunnel process exited with code ${code}`);
        tunnelProcess = null;
      });

      tunnelProcess.on('error', (err: any) => {
        console.error('Falha ao iniciar o CLI:', err);
        tunnelProcess = null;
      });

      tunnelProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`[CLI]: ${data.toString().trim()}`);
      });
      tunnelProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[CLI ERROR]: ${data.toString().trim()}`);
      });

      return NextResponse.json({ success: true, message: 'Túnel iniciado com sucesso.', pid: tunnelProcess.pid });
    }

    if (action === 'stop') {
      if (!tunnelProcess || tunnelProcess.killed) {
        return NextResponse.json({ success: false, message: 'Nenhum túnel rodando no momento.' }, { status: 400 });
      }

      tunnelProcess.kill('SIGINT');
      tunnelProcess = null;

      return NextResponse.json({ success: true, message: 'Túnel encerrado com sucesso.' });
    }

    if (action === 'status') {
      const isRunning = tunnelProcess !== null && !tunnelProcess.killed;
      return NextResponse.json({ isRunning, pid: isRunning ? tunnelProcess.pid : null });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });

  } catch (error: any) {
    console.error('Error controlling tunnel process:', error);
    return NextResponse.json({ error: 'Erro ao controlar o processo do túnel' }, { status: 500 });
  }
}

