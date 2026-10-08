/**
 * Acesso a dados do usuário final, aplicado AQUI, dentro do Agente (que fala com o banco do cliente).
 *
 * O servidor do MetaBuilder confere quem é o usuário (sessão assinada), resolve as políticas por tabela (permissões de
 * criar/editar/excluir e acesso por linha) e envia o resultado DENTRO do comando assinado, em `payload.access`. O navegador
 * não consegue tirar nem alterar isso. Este arquivo faz valer a política em qualquer SQL que o usuário final mande, sem
 * depender do formato do SQL:
 *
 *   - leitura: cada referência à tabela (FROM/JOIN) vira uma subconsulta filtrada: `FROM (SELECT * FROM "t" WHERE <regra>) AS "t"`;
 *   - toda outra forma de citar uma tabela com política (vírgula, função, comentário...) é RECUSADA (falha fechada);
 *   - gravação estruturada (insert/update/delete): confere a permissão, os valores gravados e as linhas atingidas;
 *   - SQL de dados livre (execute_custom): UPDATE/DELETE recebem a regra no WHERE; INSERT em tabela com política é recusado.
 *
 * Não depende de nada do Agente (só texto), para ser testado sozinho. O formato de `access`:
 *   { policies: [{ table, deny?: true, conds: [{ column, op: 'eq'|'in'|'related', values: string[], related?: { table, key, column } }] }],
 *     flags:    { <tabela em minúsculas>: { create?: boolean, update?: boolean, delete?: boolean } } }
 */

class PolicyError extends Error {
  constructor(message) { super(message); this.name = 'PolicyError'; }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_VALUES = 100;

// ── Valores e identificadores ────────────────────────────────────────────────────

function quoteIdent(name) {
  if (typeof name !== 'string' || !IDENT.test(name)) throw new PolicyError('Nome inválido na política de acesso.');
  return `"${name}"`;
}

/** Texto SQL entre aspas simples. Postgres: com barra invertida usa E'...' (vale com qualquer configuração do servidor). */
function literal(value, dbType) {
  const s = String(value);
  if (s.includes('\0')) throw new PolicyError('Valor inválido na política de acesso.');
  const body = s.replace(/'/g, "''");
  if (dbType !== 'oracle' && s.includes('\\')) return `E'${body.replace(/\\/g, '\\\\')}'`;
  return `'${body}'`;
}

/** Condição de UMA regra sobre a coluna (qualificada, se informado o qualificador). */
function condSql(cond, qualifier, dbType) {
  const col = qualifier ? `${quoteIdent(qualifier)}.${quoteIdent(cond.column)}` : quoteIdent(cond.column);
  const values = (cond.values || []).slice(0, MAX_VALUES);
  if (values.length === 0) return '1 = 0';
  if (cond.op === 'related') {
    const r = cond.related || {};
    const inner = `SELECT ${quoteIdent(r.key)} FROM ${quoteIdent(r.table)} WHERE ${quoteIdent(r.column)} = ${literal(values[0], dbType)}`;
    return `${col} IN (${inner})`;
  }
  if (cond.op === 'in') return `${col} IN (${values.map(v => literal(v, dbType)).join(', ')})`;
  return `${col} = ${literal(values[0], dbType)}`;
}

/** Todas as regras da tabela juntas (E). Tabela negada = nenhuma linha. */
function policySql(policy, qualifier, dbType) {
  if (!policy || policy.deny) return '1 = 0';
  const parts = (policy.conds || []).map(c => condSql(c, qualifier, dbType));
  return parts.length ? parts.map(p => `(${p})`).join(' AND ') : '1 = 1';
}

function policyMap(access) {
  const map = new Map();
  for (const p of (access && access.policies) || []) {
    if (p && typeof p.table === 'string') map.set(p.table.toLowerCase(), p);
  }
  return map;
}

// ── Leitura do SQL em partes ─────────────────────────────────────────────────────

/** tipos: ws, word (minúsculo em `v`), ident ("..." sem aspas em `v`), str, num, param, punct, raw (texto já pronto) */
function tokenize(sql) {
  const toks = [];
  const n = sql.length;
  let i = 0;
  while (i < n) {
    const c = sql[i];
    if (/\s/.test(c)) {
      let j = i + 1;
      while (j < n && /\s/.test(sql[j])) j++;
      toks.push({ k: 'ws', v: ' ', raw: sql.slice(i, j) });
      i = j;
    } else if ((c === '-' && sql[i + 1] === '-') || (c === '/' && sql[i + 1] === '*')) {
      throw new PolicyError('Comentário em SQL não é permitido.');
    } else if (c === "'") {
      // E'...' aceita barra invertida como escape; o resto só dobra a aspa
      const prev = toks[toks.length - 1];
      const eMode = !!prev && prev.k === 'word' && prev.v === 'e' && prev.raw.length === 1;
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (eMode && sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue; }
          closed = true; j++; break;
        }
        j++;
      }
      if (!closed) throw new PolicyError('Texto SQL sem fechamento.');
      toks.push({ k: 'str', v: sql.slice(i, j), raw: sql.slice(i, j) });
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      let name = '';
      let closed = false;
      while (j < n) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') { name += '"'; j += 2; continue; }
          closed = true; j++; break;
        }
        name += sql[j++];
      }
      if (!closed) throw new PolicyError('Identificador SQL sem fechamento.');
      toks.push({ k: 'ident', v: name, raw: sql.slice(i, j) });
      i = j;
    } else if (c === '$') {
      let j = i + 1;
      if (/[0-9]/.test(sql[j] || '')) {
        while (j < n && /[0-9]/.test(sql[j])) j++;
        toks.push({ k: 'param', v: sql.slice(i, j), raw: sql.slice(i, j) });
        i = j;
      } else {
        // $$...$$ e $tag$...$tag$ escondem texto do leitor: não aceitos
        throw new PolicyError('Texto entre cifrões não é permitido.');
      }
    } else if (/[A-Za-z_À-￿]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$À-￿]/.test(sql[j])) j++;
      const raw = sql.slice(i, j);
      toks.push({ k: 'word', v: raw.toLowerCase(), raw });
      i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9.eE]/.test(sql[j])) j++;
      toks.push({ k: 'num', v: sql.slice(i, j), raw: sql.slice(i, j) });
      i = j;
    } else {
      toks.push({ k: 'punct', v: c, raw: c });
      i++;
    }
  }
  return toks;
}

const nameOf = t => (t.k === 'word' || t.k === 'ident' ? t.v.toLowerCase() : null);
const isWord = (t, w) => !!t && t.k === 'word' && t.v === w;
const isPunct = (t, p) => !!t && t.k === 'punct' && t.v === p;

/** Palavras que NÃO são apelido de tabela. */
const RESERVED = new Set([
  'where', 'group', 'order', 'limit', 'offset', 'fetch', 'having', 'union', 'intersect', 'except', 'minus', 'join', 'inner',
  'left', 'right', 'full', 'cross', 'natural', 'on', 'using', 'window', 'for', 'returning', 'set', 'values', 'select',
  'lateral', 'tablesample', 'and', 'or', 'not', 'with', 'connect', 'start', 'as', '__where_placeholder__',
]);

/** Funções cujo `FROM` interno não é uma tabela. */
const FROM_FUNCTIONS = new Set(['extract', 'substring', 'trim', 'overlay', 'position']);

/** Posição do próximo token que não é espaço (-1 se não houver). */
function sig(toks, from) {
  for (let i = from; i < toks.length; i++) if (toks[i].k !== 'ws') return i;
  return -1;
}
function sigBack(toks, from) {
  for (let i = from; i >= 0; i--) if (toks[i].k !== 'ws') return i;
  return -1;
}

/**
 * Lê o nome de uma tabela a partir de `start` (um token que não é espaço): `nome` ou `esquema.nome`.
 * Devolve { end (último token do nome), last (nome da tabela, minúsculo), text (como estava escrito) } ou null.
 */
function readRelation(toks, start) {
  const first = toks[start];
  if (!first || (first.k !== 'word' && first.k !== 'ident')) return null;
  let end = start;
  let last = nameOf(first);
  let text = first.raw;
  for (;;) {
    const d = sig(toks, end + 1);
    if (d < 0 || !isPunct(toks[d], '.')) break;
    const nx = sig(toks, d + 1);
    if (nx < 0 || (toks[nx].k !== 'word' && toks[nx].k !== 'ident')) break;
    text += '.' + toks[nx].raw;
    last = nameOf(toks[nx]);
    end = nx;
  }
  return { end, last, text };
}

/** Apelido logo depois da tabela: `AS x`, `"x"` ou `x` (se x não for palavra reservada). Devolve { end, text, name } ou null. */
function readAlias(toks, after) {
  const a = sig(toks, after + 1);
  if (a < 0) return null;
  const t = toks[a];
  if (isWord(t, 'as')) {
    const b = sig(toks, a + 1);
    if (b >= 0 && (toks[b].k === 'word' || toks[b].k === 'ident')) return { end: b, text: sliceRaw(toks, a, b), name: toks[b].v, explicitAs: true };
    return null;
  }
  if (t.k === 'ident') return { end: a, text: t.raw, name: t.v, explicitAs: false };
  if (t.k === 'word' && !RESERVED.has(t.v)) return { end: a, text: t.raw, name: t.v, explicitAs: false };
  return null;
}

const sliceRaw = (toks, a, b) => toks.slice(a, b + 1).map(t => t.raw).join('');

// ── Leitura (SELECT): cada tabela com política vira subconsulta filtrada ─────────

/**
 * Reescreve os tokens de UMA consulta. `skipTo` permite pular o início (usado pelo UPDATE/DELETE, cujo alvo é tratado à parte).
 */
function rewriteTokens(toks, policies, dbType, from = 0) {
  const out = [];
  const parenFn = []; // pilha: o parêntese aberto pertence a EXTRACT/SUBSTRING/...?
  for (let i = 0; i < from; i++) out.push(toks[i].raw);

  for (let i = from; i < toks.length; i++) {
    const t = toks[i];

    if (isPunct(t, '(')) {
      const p = sigBack(toks, i - 1);
      parenFn.push(p >= 0 && toks[p].k === 'word' && FROM_FUNCTIONS.has(toks[p].v));
      out.push(t.raw);
      continue;
    }
    if (isPunct(t, ')')) { parenFn.pop(); out.push(t.raw); continue; }

    const isFrom = isWord(t, 'from') || isWord(t, 'join') || isWord(t, 'using');
    if (isFrom) {
      const p = sigBack(toks, i - 1);
      const inFn = isWord(t, 'from') && parenFn.length > 0 && parenFn[parenFn.length - 1];
      const distinct = isWord(t, 'from') && p >= 0 && isWord(toks[p], 'distinct');
      if (!inFn && !distinct) {
        let r = sig(toks, i + 1);
        // palavras que antecedem o nome sem serem o nome
        while (r >= 0 && (isWord(toks[r], 'only') || isWord(toks[r], 'lateral'))) r = sig(toks, r + 1);
        if (r >= 0 && toks[r].k !== 'punct') {
          const rel = readRelation(toks, r);
          if (rel && policies.has(rel.last)) {
            const policy = policies.get(rel.last);
            const alias = readAlias(toks, rel.end);
            const sub = `(SELECT * FROM ${rel.text} WHERE ${policySql(policy, null, dbType)})`;
            out.push(sliceRaw(toks, i, i)); // a palavra FROM/JOIN
            out.push(toks.slice(i + 1, r).map(x => x.raw).join('')); // espaços (e ONLY/LATERAL) entre a palavra e o nome
            if (alias) {
              out.push(`${sub} ${alias.text}`);
              i = alias.end;
            } else {
              out.push(dbType === 'oracle' ? `${sub} ${quoteIdent(rel.last)}` : `${sub} AS ${quoteIdent(rel.last)}`);
              i = rel.end;
            }
            continue;
          }
        }
      }
      out.push(t.raw);
      continue;
    }

    // Qualquer outra citação de uma tabela com política precisa estar numa forma segura
    const nm = nameOf(t);
    if (nm && policies.has(nm) && t.k !== 'raw') {
      const nx = sig(toks, i + 1);
      const pv = sigBack(toks, i - 1);
      const qualifier = nx >= 0 && isPunct(toks[nx], '.');
      const aliasDef = pv >= 0 && isWord(toks[pv], 'as');
      const afterDot = pv >= 0 && isPunct(toks[pv], '.');
      if (!qualifier && !aliasDef && !afterDot) {
        throw new PolicyError(`A tabela "${nm}" tem acesso restrito e foi citada numa forma não permitida.`);
      }
    }
    out.push(t.raw);
  }
  return out.join('');
}

/** SELECT final montado pelo Agente (ou enviado pela tela): devolve o SQL com as políticas aplicadas. */
function applyToSelect(sql, access, opts = {}) {
  const policies = policyMap(access);
  if (policies.size === 0) return sql;
  const toks = tokenize(String(sql));
  const stmts = splitStatements(toks);
  if (stmts.length > 1) throw new PolicyError('Mais de um comando SQL não é permitido.');
  return rewriteTokens(stmts[0] || [], policies, opts.dbType === 'oracle' ? 'oracle' : 'postgres');
}

// ── SQL de dados livre (execute_custom) ──────────────────────────────────────────

const FLAG_OF = { insert: 'create', update: 'update', delete: 'delete' };

function flagAllowed(access, table, kind) {
  const f = access && access.flags && access.flags[String(table).toLowerCase()];
  return !(f && f[kind] === false);
}

const FLAG_MESSAGE = {
  create: 'Esta tabela não permite criar registros.',
  update: 'Esta tabela não permite editar registros.',
  delete: 'Esta tabela não permite excluir registros.',
};

/** Divide em comandos nos `;` fora de parênteses (os textos já são tokens próprios, então um `;` dentro deles não conta). */
function splitStatements(toks) {
  const stmts = [];
  let cur = [];
  let depth = 0;
  for (const t of toks) {
    if (isPunct(t, '(')) depth++;
    if (isPunct(t, ')')) depth--;
    if (isPunct(t, ';') && depth === 0) { stmts.push(cur); cur = []; continue; }
    cur.push(t);
  }
  stmts.push(cur);
  return stmts.filter(s => s.some(t => t.k !== 'ws'));
}

/** Índice (no vetor) do primeiro token de palavra `w` fora de parênteses, a partir de `from`; -1 se não houver. */
function topLevelWord(toks, w, from) {
  let depth = 0;
  for (let i = from; i < toks.length; i++) {
    if (isPunct(toks[i], '(')) depth++;
    else if (isPunct(toks[i], ')')) depth--;
    else if (depth === 0 && isWord(toks[i], w)) return i;
  }
  return -1;
}

function guardStatement(toks, access, policies, dbType) {
  const f = sig(toks, 0);
  const head = toks[f].v;
  if (head === 'select' || head === 'values' || head === 'table') return rewriteTokens(toks, policies, dbType);

  if (head === 'with') {
    // CTE: só leitura (qualquer comando de gravação dentro dela é recusado)
    if (toks.some(t => t.k === 'word' && (t.v === 'insert' || t.v === 'update' || t.v === 'delete'))) {
      throw new PolicyError('Comando de gravação dentro de WITH não é permitido.');
    }
    return rewriteTokens(toks, policies, dbType);
  }

  if (head === 'insert') {
    const into = sig(toks, f + 1);
    const r = into >= 0 && isWord(toks[into], 'into') ? sig(toks, into + 1) : -1;
    const rel = r >= 0 ? readRelation(toks, r) : null;
    if (!rel) throw new PolicyError('Comando INSERT não reconhecido.');
    if (!flagAllowed(access, rel.last, 'create')) throw new PolicyError(FLAG_MESSAGE.create);
    if (policies.has(rel.last)) throw new PolicyError(`A tabela "${rel.last}" tem acesso restrito: grave pelo cadastro, não por SQL livre.`);
    return rewriteTokens(toks, policies, dbType, rel.end + 1);
  }

  if (head === 'delete' || head === 'update') {
    let r;
    if (head === 'delete') {
      const fr = sig(toks, f + 1);
      if (fr < 0 || !isWord(toks[fr], 'from')) throw new PolicyError('Comando DELETE não reconhecido.');
      r = sig(toks, fr + 1);
    } else {
      r = sig(toks, f + 1);
    }
    const rel = r >= 0 ? readRelation(toks, r) : null;
    if (!rel) throw new PolicyError(`Comando ${head.toUpperCase()} não reconhecido.`);
    const kind = FLAG_OF[head];
    if (!flagAllowed(access, rel.last, kind)) throw new PolicyError(FLAG_MESSAGE[kind]);

    const alias = readAlias(toks, rel.end);
    const restFrom = (alias ? alias.end : rel.end) + 1;

    const policy = policies.get(rel.last);
    if (!policy) return rewriteTokens(toks, policies, dbType, restFrom);

    // a regra vai no WHERE do próprio comando: ela só alcança as linhas que o usuário pode ver
    const qualifier = alias ? alias.name : rel.last;
    const cond = policySql(policy, qualifier, dbType);
    const where = topLevelWord(toks, 'where', restFrom);
    const ret = topLevelWord(toks, 'returning', where >= 0 ? where : restFrom);
    const retAt = ret >= 0 ? ret : toks.length;
    const edited = [];
    if (where >= 0) {
      for (let i = 0; i <= where; i++) edited.push(toks[i]);
      edited.push({ k: 'raw', v: '(', raw: ' (' });
      for (let i = where + 1; i < retAt; i++) edited.push(toks[i]);
      edited.push({ k: 'raw', v: ')', raw: `) AND (${cond}) ` });
    } else {
      for (let i = 0; i < retAt; i++) edited.push(toks[i]);
      edited.push({ k: 'raw', v: 'where', raw: ` WHERE ${cond} ` });
    }
    for (let i = retAt; i < toks.length; i++) edited.push(toks[i]);
    return rewriteTokens(edited, policies, dbType, restFrom);
  }

  throw new PolicyError('Comando SQL não permitido.');
}

/** SQL livre de usuário final (um ou vários comandos de dados separados por `;`). */
function guardCustom(sql, access, opts = {}) {
  const dbType = opts.dbType === 'oracle' ? 'oracle' : 'postgres';
  const policies = policyMap(access);
  const toks = tokenize(String(sql));
  const stmts = splitStatements(toks);
  if (stmts.length === 0) throw new PolicyError('SQL vazio.');
  return stmts.map(s => guardStatement(s, access, policies, dbType).trim()).join('; ');
}

// ── Gravação estruturada (insert / update / delete) ──────────────────────────────

const keyIn = (data, column) => Object.keys(data).find(k => k.toLowerCase() === String(column).toLowerCase());

/**
 * Confere uma gravação estruturada e devolve os dados a gravar (no insert, completa com o valor da regra o que faltou).
 * `query(sql)` executa um SELECT e devolve as linhas (usado para a regra por tabela relacionada e para conferir as linhas atingidas).
 */
async function enforceWrite({ access, action, table, data, idColumn, idValue, dbType, query }) {
  const t = String(table || '').toLowerCase();
  const kind = FLAG_OF[action];
  if (!kind) return data;
  if (!flagAllowed(access, t, kind)) throw new PolicyError(FLAG_MESSAGE[kind]);

  const policy = policyMap(access).get(t);
  if (!policy) return data;
  if (policy.deny) throw new PolicyError('Você não tem acesso aos registros desta tabela.');
  const db = dbType === 'oracle' ? 'oracle' : 'postgres';
  const out = data ? { ...data } : (action === 'insert' ? {} : data);

  // os valores gravados precisam obedecer à regra (senão o usuário criaria/passaria para outro dono uma linha que não enxerga)
  if (action === 'insert' || action === 'update') {
    for (const c of policy.conds || []) {
      const key = keyIn(out || {}, c.column);
      if (key === undefined) {
        // coluna ausente no insert: a regra "igual" (ou lista de um valor só) preenche; as demais ficam como o banco definir
        if (action === 'insert' && c.op !== 'related' && (c.values || []).length === 1) {
          const colKey = dbType === 'oracle' ? c.column.toUpperCase() : c.column;
          out[colKey] = c.values[0];
        }
        continue;
      }
      const v = out[key];
      if (v === null || v === undefined || v === '') {
        throw new PolicyError(`O campo "${c.column}" é controlado pelo seu acesso e não pode ficar vazio.`);
      }
      if (c.op === 'related') {
        const r = c.related || {};
        const rows = await query(`SELECT 1 AS ok FROM ${quoteIdent(r.table)} WHERE ${quoteIdent(r.key)} = ${literal(v, db)} AND ${quoteIdent(r.column)} = ${literal((c.values || [])[0], db)}`);
        if (!rows || rows.length === 0) throw new PolicyError(`O valor de "${c.column}" está fora do seu acesso.`);
      } else if (!(c.values || []).map(String).includes(String(v))) {
        throw new PolicyError(`O valor de "${c.column}" está fora do seu acesso.`);
      }
    }
  }

  // update/delete: TODAS as linhas que o comando alcança precisam estar dentro da regra
  if (action === 'update' || action === 'delete') {
    const idc = quoteIdent(String(idColumn || 'id'));
    const all = await query(`SELECT COUNT(*) AS c FROM ${quoteIdent(t)} WHERE ${idc} = ${literal(idValue, db)}`);
    const mine = await query(`SELECT COUNT(*) AS c FROM ${quoteIdent(t)} WHERE ${idc} = ${literal(idValue, db)} AND ${policySql(policy, null, db)}`);
    const n = rows => Number((rows && rows[0] && (rows[0].c ?? rows[0].C)) || 0);
    if (n(all) !== n(mine) || n(mine) === 0) throw new PolicyError('Registro não encontrado ou fora do seu acesso.');
  }
  return out;
}

module.exports = { PolicyError, tokenize, applyToSelect, guardCustom, enforceWrite, policySql, condSql, literal, flagAllowed };
