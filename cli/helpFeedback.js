/**
 * MetaBuilderPRO - Feedback da ajuda contextual ("Isto ajudou?")
 *
 * Grava no banco LOCAL do cliente (tabela mb_help_feedback, criada na primeira gravação, como a mb_logs).
 * Só Postgres. Se o usuário do banco não puder criar a tabela, o script abaixo vai para o console do Agente
 * para o DBA executar; o app continua funcionando e o usuário final só recebe um aviso genérico.
 *
 * Cada voto guarda a ZONA onde a ajuda foi vista (filter, grid, form ou screen), porque o mesmo campo pode
 * ter uma ajuda boa no formulário e ruim no grid. Na leitura, vale o ÚLTIMO voto de cada usuário por alvo e zona.
 */

'use strict';

const ZONES = ['filter', 'grid', 'form', 'screen', 'central', 'tutorial'];

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mb_help_feedback (
  id          BIGSERIAL   PRIMARY KEY,
  screen_id   TEXT,
  field_id    TEXT,
  zone        TEXT,
  vote        SMALLINT    NOT NULL CHECK (vote IN (-1, 1)),
  comment     TEXT,
  user_ref    TEXT,
  language    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE mb_help_feedback ADD COLUMN IF NOT EXISTS zone TEXT;
CREATE INDEX IF NOT EXISTS idx_mb_help_feedback_target ON mb_help_feedback (screen_id, field_id, created_at DESC);
`.trim();

let tableReady = false;
let hasZone = true;

/** Cria a tabela e, em tabela antiga, tenta acrescentar a coluna zone. Sem permissão para a coluna, grava sem zona. */
async function ensureTable(pgClient) {
  if (tableReady) return;
  const [create, alter, index] = CREATE_TABLE_SQL.split(/;\s*\n/).map(s => s.replace(/;\s*$/, ''));
  await pgClient.query(create);
  try {
    await pgClient.query(alter);
    hasZone = true;
  } catch (err) {
    const col = await pgClient.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'mb_help_feedback' AND column_name = 'zone' AND table_schema = current_schema()`
    );
    hasZone = col.rows.length > 0;
  }
  try { await pgClient.query(index); } catch (_) { /* índice é só desempenho */ }
  tableReady = true;
}

/** Grava um voto. Devolve { ok:true } ou { ok:false, code:'NO_TABLE', script } quando não foi possível criar a tabela. */
async function saveHelpFeedback(pgClient, data) {
  const vote = data && data.vote === 'up' ? 1 : data && data.vote === 'down' ? -1 : 0;
  if (!vote) throw new Error('Voto inválido.');
  if (!data.screen && !data.field) throw new Error('Feedback sem tela ou campo.');
  const zone = ZONES.includes(data.zone) ? data.zone : null;
  try {
    await ensureTable(pgClient);
  } catch (err) {
    return { ok: false, code: 'NO_TABLE', script: CREATE_TABLE_SQL, detail: err.message };
  }
  const comment = data.comment ? String(data.comment).slice(0, 500) : null;
  const userRef = data.userRef ? String(data.userRef).slice(0, 120) : null;
  if (hasZone) {
    await pgClient.query(
      'INSERT INTO mb_help_feedback (screen_id, field_id, zone, vote, comment, user_ref, language) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [data.screen || null, data.field || null, zone, vote, comment, userRef, data.language || null]
    );
  } else {
    await pgClient.query(
      'INSERT INTO mb_help_feedback (screen_id, field_id, vote, comment, user_ref, language) VALUES ($1, $2, $3, $4, $5, $6)',
      [data.screen || null, data.field || null, vote, comment, userRef, data.language || null]
    );
  }
  return { ok: true };
}

function summarySql(zoneExpr) {
  return `
    WITH latest AS (
      SELECT DISTINCT ON (screen_id, field_id, ${zoneExpr}, COALESCE(user_ref, id::text))
             screen_id, field_id, ${zoneExpr} AS zone, vote, created_at
        FROM mb_help_feedback
       ORDER BY screen_id, field_id, ${zoneExpr}, COALESCE(user_ref, id::text), created_at DESC
    )
    SELECT screen_id, field_id, zone,
           SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END)::int AS up,
           SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END)::int AS down,
           MAX(created_at) AS last_at
      FROM latest GROUP BY screen_id, field_id, zone
     ORDER BY down DESC, last_at DESC LIMIT 400`;
}

/** Resumo por alvo e zona (mais 👎 primeiro) e últimos comentários. Sem a tabela ainda, devolve vazio. */
async function readHelpFeedback(pgClient) {
  try {
    let summary, comments;
    try {
      summary = await pgClient.query(summarySql('zone'));
      comments = await pgClient.query(
        `SELECT screen_id, field_id, zone, comment, language, created_at
           FROM mb_help_feedback WHERE comment IS NOT NULL ORDER BY created_at DESC LIMIT 100`
      );
    } catch (err) {
      if (!err || err.code !== '42703') throw err; // tabela antiga, sem a coluna zone
      summary = await pgClient.query(summarySql('NULL::text'));
      comments = await pgClient.query(
        `SELECT screen_id, field_id, NULL::text AS zone, comment, language, created_at
           FROM mb_help_feedback WHERE comment IS NOT NULL ORDER BY created_at DESC LIMIT 100`
      );
    }
    return { summary: summary.rows, comments: comments.rows };
  } catch (err) {
    if (err && err.code === '42P01') return { summary: [], comments: [] }; // tabela ainda não existe: ninguém votou
    throw err;
  }
}

module.exports = { saveHelpFeedback, readHelpFeedback, CREATE_TABLE_SQL };
