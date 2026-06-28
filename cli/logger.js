/**
 * MetaBuilderPRO CLI Logger
 * Gera arquivos de log diários na pasta ./logs/ ao lado do executável.
 *
 * - Arquivo de túnel:  logs/tunnel-YYYY-MM-DD.log
 * - Arquivo de sync:   logs/sync-YYYY-MM-DD.log
 *
 * Intercepta automaticamente console.log, console.error e console.warn
 * para espelhar tudo no arquivo sem alterar o comportamento do terminal.
 */

const fs = require('fs');
const path = require('path');

// Resolve a pasta raiz onde o CLI (ou o .exe compilado) está localizado.
// process.pkg.entrypoint indica que está rodando como binário compilado.
const BASE_DIR = process.pkg
  ? path.dirname(process.execPath)
  : __dirname;

const LOGS_DIR = path.join(BASE_DIR, 'logs');

// Garante que a pasta logs/ existe
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/** Retorna a data local no formato YYYY-MM-DD usando o fuso horário local da máquina */
function getDateStr() {
  const now = new Date();
  // Usa offset local para garantir que a data seja a da máquina cliente
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Retorna a hora local no formato HH:MM:SS usando o fuso horário local da máquina */
function getTimeStr() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  // Inclui o offset do fuso para rastreabilidade
  const off = now.getTimezoneOffset();
  const sign = off <= 0 ? '+' : '-';
  const absOff = Math.abs(off);
  const offH = String(Math.floor(absOff / 60)).padStart(2, '0');
  const offM = String(absOff % 60).padStart(2, '0');
  return `${h}:${mi}:${s}(UTC${sign}${offH}:${offM})`;
}

/**
 * Remove os códigos ANSI de cor/estilo (chalk) para que o log fique
 * legível em qualquer editor de texto.
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return String(str).replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
}

class Logger {
  constructor() {
    this._stream = null;
    this._mode = null;
    this._originalLog = console.log.bind(console);
    this._originalError = console.error.bind(console);
    this._originalWarn = console.warn.bind(console);
    this._fileLoggingEnabled = true;
  }

  /** Ativa ou desativa a gravação em arquivo físico dinamicamente */
  setFileLoggingEnabled(enabled) {
    this._fileLoggingEnabled = enabled !== false;
  }

  /**
   * Inicializa o logger para um modo específico.
   * @param {'tunnel'|'sync'} mode
   */
  init(mode) {
    this._mode = mode;
    const filename = `${mode}-${getDateStr()}.log`;
    const filepath = path.join(LOGS_DIR, filename);

    this._stream = fs.createWriteStream(filepath, { flags: 'a', encoding: 'utf8' });

    // Cabeçalho de sessão
    const header = [
      '',
      '='.repeat(70),
      `  MetaBuilderPRO CLI -- Modo: ${mode.toUpperCase()}`,
      `  Sessao iniciada em: ${new Date().toLocaleString()} [${Intl.DateTimeFormat().resolvedOptions().timeZone}]`,
      '='.repeat(70),
      '',
    ].join('\n');
    this._stream.write(header + '\n');

    // Intercepta console.log
    console.log = (...args) => {
      this._originalLog(...args);
      this._write('LOG', args);
    };

    // Intercepta console.error
    console.error = (...args) => {
      this._originalError(...args);
      this._write('ERR', args);
    };

    // Intercepta console.warn
    console.warn = (...args) => {
      this._originalWarn(...args);
      this._write('WRN', args);
    };

    this._originalLog(`\n📄 Log sendo salvo em: ${filepath}\n`);
  }

  /** Escreve uma linha formatada no arquivo */
  _write(level, args) {
    if (!this._stream || !this._fileLoggingEnabled) return;
    
    // Rotação diária: verifica se virou o dia enquanto o processo rodava
    const currentDay = getDateStr();
    if (this._dateStr !== currentDay) {
      this._dateStr = currentDay;
      this._stream.end();
      const filename = `${this._mode}-${currentDay}.log`;
      const filepath = path.join(LOGS_DIR, filename);
      this._stream = fs.createWriteStream(filepath, { flags: 'a', encoding: 'utf8' });
    }

    const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
    const clean = stripAnsi(text);
    const line = `[${getTimeStr()}] [${level}] ${clean}\n`;
    this._stream.write(line);
  }

  /**
   * Loga uma entrada de sincronização (mudanças detectadas por tabela).
   * @param {Object} params
   * @param {string} params.table  - Nome da tabela
   * @param {'added'|'removed'|'modified'} params.type
   * @param {string} params.item   - Descrição do item (coluna, índice, etc.)
   * @param {string} [params.detail] - Detalhe adicional (ex: tipo anterior → novo)
   */
  logSyncChange({ table, type, item, detail }) {
    const typeLabel = {
      added:    '+ ADICIONADO',
      removed:  '- REMOVIDO  ',
      modified: '~ ALTERADO  ',
    }[type] || '? MUDANÇA   ';

    const detailStr = detail ? ` (${detail})` : '';
    const line = `[${getTimeStr()}] [SYNC] ${typeLabel} | Tabela: ${table} | ${item}${detailStr}\n`;
    
    if (this._stream && this._fileLoggingEnabled) {
      this._stream.write(line);
    }

    // Também imprime no console com cor
    const chalkColor = type === 'added' ? '\x1b[32m' : type === 'removed' ? '\x1b[31m' : '\x1b[33m';
    this._originalLog(`${chalkColor}${line.trim()}\x1b[0m`);
  }

  /**
   * Loga um erro crítico com stack trace.
   */
  logCriticalError(message, error) {
    if (!this._stream) return;
    const stack = error?.stack || String(error);
    const block = [
      `[${getTimeStr()}] [CRIT] ${message}`,
      `         Stack: ${stack}`,
      '',
    ].join('\n');
    this._stream.write(block);
  }

  /** Fecha o stream de forma limpa ao encerrar o processo */
  close() {
    if (this._stream) {
      const footer = `\n[${getTimeStr()}] [LOG] Sessao encerrada.\n${'-'.repeat(70)}\n`;
      this._stream.write(footer);
      this._stream.end();
    }
    // Restaura os originais
    console.log = this._originalLog;
    console.error = this._originalError;
    console.warn = this._originalWarn;
  }
}

// Exporta instância singleton
const logger = new Logger();
module.exports = logger;
