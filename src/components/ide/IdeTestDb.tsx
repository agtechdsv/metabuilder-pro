'use client'

import React from 'react'
import { Database, Loader2, ShieldAlert } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { DbSettings } from '@/utils/testEngine'

export interface DbResult { kind: 'ok' | 'warn' | 'err'; text: string }
export type DbBusy = '' | 'test' | 'prepare' | 'remove'

interface Props {
  settings: DbSettings
  onChange: (patch: Partial<DbSettings>) => void
  /** conexão que o app exportado já usa (com a senha escondida), para mostrar no modo "banco original" */
  appDbHint: string
  busy: DbBusy
  result: DbResult | null
  /** o motor já está instalado (as ferramentas de banco são do motor) */
  engineReady: boolean
  disabled: boolean
  /** tipo de login do projeto (database, none, outro) */
  authType: string | null
  onTest: () => void
  onPrepare: () => void
  onRemove: () => void
}

const input = 'rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 w-full'

/** Banco de dados de teste: uma cópia que o cliente informa (padrão) ou o banco original do app, só com o consentimento dele. */
export function IdeTestDb({ settings: s, onChange, appDbHint, busy, result, engineReady, disabled, authType, onTest, onPrepare, onRemove }: Props) {
  const { t } = useI18n()
  const off = disabled || busy !== ''
  const btn = 'rounded-md border border-indigo-500/50 px-2 py-0.5 text-[11px] text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40'
  const fields: Array<['host' | 'port' | 'database' | 'user' | 'password', string, boolean]> = [
    ['host', t('ide_tests.db_host', 'Servidor'), false], ['port', t('ide_tests.db_port', 'Porta'), false], ['database', t('ide_tests.db_name', 'Banco'), false],
    ['user', t('ide_tests.db_user', 'Usuário'), false], ['password', t('ide_tests.db_pass', 'Senha'), true],
  ]
  const pronto = s.mode === 'copy' ? s.copyConfirmed : s.consentOriginal

  return (
    <div className="mb-3 rounded-xl border border-neutral-700 bg-neutral-800/40 px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Database className="w-3.5 h-3.5 text-neutral-400" />
        <span className="text-xs font-semibold text-white mr-2">{t('ide_tests.db_title', 'Banco de dados de teste')}</span>
        {([['copy', t('ide_tests.db_mode_copy', 'Uma cópia do banco (recomendado)')], ['original', t('ide_tests.db_mode_original', 'O banco original do app')]] as const).map(([id, label]) => (
          <button key={id} onClick={() => onChange({ mode: id })} disabled={off} className={`rounded-lg border px-2.5 py-1 text-[11px] ${s.mode === id ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-neutral-700 text-neutral-400'}`}>{label}</button>
        ))}
      </div>

      {s.mode === 'copy' ? (
        <>
          <p className="text-[11px] text-neutral-400">{t('ide_tests.db_copy_help', 'Informe a conexão de uma cópia do banco. O app exportado será executado apontando para ela; nada é gravado no banco original.')}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {fields.map(([k, label, secret]) => (
              <input key={k} type={secret ? 'password' : 'text'} value={s[k]} onChange={e => onChange({ [k]: e.target.value, copyConfirmed: false } as Partial<DbSettings>)} disabled={off} placeholder={label} title={label} className={input} />
            ))}
          </div>
          <label className="flex items-start gap-2 text-[11px] text-neutral-300 cursor-pointer">
            <input type="checkbox" className="accent-indigo-500 mt-0.5" checked={s.copyConfirmed} disabled={off} onChange={e => onChange({ copyConfirmed: e.target.checked })} />
            {t('ide_tests.db_copy_confirm', 'Confirmo que este banco é uma cópia de teste, e não o banco de produção.')}
          </label>
        </>
      ) : (
        <>
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 [html:not(.light)_&]:text-amber-400">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>{t('ide_tests.db_original_help', 'Os testes usarão o banco que o app exportado já usa ({url}). Eles só leem dados e conferem, no fim, que nada mudou, mas precisam criar um usuário de teste nesse banco.').replace('{url}', appDbHint || '—')}</p>
          </div>
          <label className="flex items-start gap-2 text-[11px] text-neutral-300 cursor-pointer">
            <input type="checkbox" className="accent-indigo-500 mt-0.5" checked={s.consentOriginal} disabled={off} onChange={e => onChange({ consentOriginal: e.target.checked, consentAt: e.target.checked ? new Date().toISOString() : undefined })} />
            {t('ide_tests.db_original_consent', 'Consinto em rodar os testes no banco original e em criar nele o usuário de teste do motor.')}
          </label>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <button onClick={onTest} disabled={off || !engineReady || !pronto} className={btn}>{busy === 'test' ? t('ide_tests.db_testing', 'Testando...') : t('ide_tests.db_test', 'Testar conexão')}</button>
        {authType !== 'none' && <button onClick={onPrepare} disabled={off || !engineReady || !pronto} className={btn}>{busy === 'prepare' ? '...' : t('ide_tests.db_prepare', 'Preparar usuário de teste')}</button>}
        {s.robot && authType !== 'none' && <button onClick={onRemove} disabled={off || !engineReady} className="rounded-md border border-red-500/40 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-40">{busy === 'remove' ? '...' : t('ide_tests.db_robot_remove', 'Remover usuário de teste')}</button>}
        {busy !== '' && <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />}
        {!engineReady && <span className="text-neutral-500">{t('ide_tests.db_err_need_engine', 'Instale o motor antes (acima).')}</span>}
        {engineReady && !pronto && <span className="text-neutral-500">{t('ide_tests.db_err_need_confirm', 'Confirme a opção acima para continuar.')}</span>}
      </div>
      {authType === 'none' && <p className="text-[11px] text-neutral-500">{t('ide_tests.db_robot_noauth', 'O app não tem login: nenhum usuário é necessário.')}</p>}
      {s.robot && authType !== 'none' && !result && <p className="text-[11px] text-emerald-400">{t('ide_tests.db_robot_ready', 'Usuário de teste pronto ({user}).').replace('{user}', s.robot.user)}{s.robot.group ? ` ${t('ide_tests.db_robot_group', 'No grupo "{g}".').replace('{g}', s.robot.group)}` : ''}</p>}
      {result && <p className={`text-[11px] whitespace-pre-wrap ${result.kind === 'ok' ? 'text-emerald-400' : result.kind === 'warn' ? 'text-amber-700 [html:not(.light)_&]:text-amber-400' : 'text-red-300'}`}>{result.text}</p>}
    </div>
  )
}
