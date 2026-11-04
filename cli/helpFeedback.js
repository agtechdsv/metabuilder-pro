/**
 * MetaBuilderPRO - Feedback da ajuda contextual ("Isto ajudou?")
 *
 * Grava no banco LOCAL do cliente (tabela mb_help_feedback, criada na primeira gravação, como a mb_logs).
 * Só Postgres. Se o usuário do banco não puder criar a tabela, o script abaixo vai para o console do Agente
 * para o DBA executar; o app continua funcionando e o usuário final só recebe um aviso genérico.
 */

'use strict';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mb_help_feedback (
  id          BIGSERIAL   PRIMARY KEY,
  screen_id   TEXT,
  field_id    TEXT,
  vote        SMALLINT    NOT NULL CHECK (vote IN (-1, 1)),
  comment     TEXT,
  user_ref    TEXT,
  language    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mb_help_feedback_target ON mb_help_feedback (screen_id, field_id, created_at DESC);
`.trim();

let tableReady = false;

async function ensureTable(pgClient) {
  if (tableReady) return;
  await pgClient.query(CREATE_TABLE_SQL);
  tableReady = true;
}

/** Grava um voto. Devolve { ok:true } ou { ok:false, code:'NO_TABLE', script } quando não foi possível criar a tabela. */
async function saveHelpFeedback(pgClient, data) {
  const vote = data && data.vote === 'up' ? 1 : data && data.vote === 'down' ? -1 : 0;
  if (!vote) throw new Error('Voto inválido.');
  if (!data.screen && !data.field) throw new Error('Feedback sem tela ou campo.');
  try {
    await ensureTable(pgClient);
  } catch (err) {
    return { ok: false, code: 'NO_TABLE', script: CREATE_TABLE_SQL, detail: err.message };
  }
  await pgClient.query(
    'INSERT INTO mb_help_feedback (screen_id, field_id, vote, comment, user_ref, language) VALUES ($1, $2, $3, $4, $5, $6)',
    [data.screen || null, data.field || null, vote, data.comment ? String(data.comment).slice(0, 500) : null,
      data.userRef ? String(data.userRef).slice(0, 120) : null, data.language || null]
  );
  return { ok: true };
}

module.exports = { saveHelpFeedback, CREATE_TABLE_SQL };
