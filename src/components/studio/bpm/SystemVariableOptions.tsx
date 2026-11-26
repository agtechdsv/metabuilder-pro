import React from "react";

const GROUP_CLASS = "text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900";
const OPTION_CLASS = "text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal";

/**
 * Variáveis que não vêm de tabela, para qualquer combo "+ Variável" do BPM:
 *  - Sistema: data, hora e data/hora do momento em que o fluxo roda;
 *  - Usuário logado: id, nome e e-mail de quem fez a ação (vem da sessão do app; vazio em disparo sem usuário, como agendado e webhook).
 * O motor (cli/bpmCore.js, `specialVariable`) resolve exatamente estes nomes.
 */
export const SYSTEM_VARIABLES = {
  sistema: ['data', 'hora', 'data_hora'],
  usuario: ['nome', 'email', 'id'],
} as const;

export function SystemVariableOptions({ t }: { t: (key: string, fallback?: string) => string }) {
  return (
    <>
      <optgroup label={t('bpm.canvas.var_group_system', 'Sistema')} className={GROUP_CLASS}>
        <option value="sistema.data" className={OPTION_CLASS}>{t('bpm.canvas.var_system_date', 'Data atual')}</option>
        <option value="sistema.hora" className={OPTION_CLASS}>{t('bpm.canvas.var_system_time', 'Hora atual')}</option>
        <option value="sistema.data_hora" className={OPTION_CLASS}>{t('bpm.canvas.var_system_datetime', 'Data e hora atuais')}</option>
      </optgroup>
      <optgroup label={t('bpm.canvas.var_group_user', 'Usuário logado')} className={GROUP_CLASS}>
        <option value="usuario.nome" className={OPTION_CLASS}>{t('bpm.canvas.var_user_name', 'Nome')}</option>
        <option value="usuario.email" className={OPTION_CLASS}>{t('bpm.canvas.var_user_email', 'E-mail')}</option>
        <option value="usuario.id" className={OPTION_CLASS}>{t('bpm.canvas.var_user_id', 'ID')}</option>
      </optgroup>
      <optgroup label={t('bpm.canvas.var_group_query', 'Resultado da consulta')} className={GROUP_CLASS}>
        <option value="consulta.tabela" className={OPTION_CLASS}>{t('bpm.canvas.var_query_table', 'Tabela com o resultado')}</option>
        <option value="consulta.total" className={OPTION_CLASS}>{t('bpm.canvas.var_query_total', 'Quantidade de linhas')}</option>
      </optgroup>
    </>
  );
}
