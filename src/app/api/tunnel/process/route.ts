import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Usamos uma variável global no Node.js para manter o processo do túnel
// Isso garante que se houver reload na API (em dev), o processo original pode se perder da memória,
// mas em produção o estado se mantém. 
let tunnelProcess: any = null;

const CLI_PATH = path.join(process.cwd(), 'cli', 'cli-win.exe');

export async function POST(req: Request) {
  try {
    const { action, mode } = await req.json();

    if (action === 'start') {
      if (tunnelProcess && !tunnelProcess.killed) {
        return NextResponse.json({ success: false, message: 'O túnel já está rodando.' }, { status: 400 });
      }

      if (!fs.existsSync(CLI_PATH)) {
        return NextResponse.json({ success: false, message: 'Executável do CLI não encontrado na pasta cli/' }, { status: 404 });
      }

      // Executa o CLI em background (detached) ou atrelado a este processo.
      // Vamos atrelar para podermos dar kill.
      tunnelProcess = spawn(CLI_PATH, ['--mode', String(mode || 1)], {
        cwd: path.join(process.cwd(), 'cli')
      });

      tunnelProcess.on('close', (code: number) => {
        console.log(`Tunnel process exited with code ${code}`);
        tunnelProcess = null;
      });

      // Se der erro ao iniciar
      tunnelProcess.on('error', (err: any) => {
        console.error('Falha ao iniciar o CLI:', err);
        tunnelProcess = null;
      });

      // Opcional: printar stdout/stderr no console local para debug
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

      // Mata o processo
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
