'use client'

import { motion } from 'framer-motion'
import { Database, ShieldCheck, CheckCircle2, ArrowLeft, GitMerge, GitBranch, History, GitCommit, ShieldAlert, Sparkles, Terminal, Code2 } from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'

export default function GitArchitectureFeaturePage() {
  const { t } = useI18n()

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
            <GitBranch className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('marketing_v2.features.git_architecture.hero_title_part1', 'Git Sem Dor:')} <br />
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">{t('marketing_v2.features.git_architecture.hero_title_part2', 'Triangulação de Branches')}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.git_architecture.hero_desc', 'Desenvolva localmente enquanto a IA programa na nuvem. Nossa arquitetura invisível isola o seu trabalho, funde as atualizações automaticamente e garante que você nunca perca uma linha de código.')}
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full"></div>
          <div className="relative p-2 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/20 to-purple-500/10 dark:from-indigo-900/40 dark:to-purple-900/20 border border-indigo-500/20 shadow-2xl space-y-6 overflow-hidden">
            <div className="bg-[#1e1e1e] p-6 rounded-[2rem] shadow-inner text-white h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-10 left-10 text-emerald-400 font-mono text-sm opacity-50 flex items-center gap-2"><GitCommit className="w-4 h-4" /> local</div>
              <div className="absolute top-10 right-10 text-cyan-400 font-mono text-sm opacity-50 flex items-center gap-2"><GitCommit className="w-4 h-4" /> upstream</div>

              <div className="w-24 h-24 rounded-full border border-indigo-500/30 flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 rounded-full border border-indigo-500 animate-ping opacity-20"></div>
                <GitMerge className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">{t('marketing_v2.features.git_architecture.sandbox_title', 'sync-sandbox')}</h3>
              <p className="text-sm text-neutral-400 text-center max-w-[200px]">{t('marketing_v2.features.git_architecture.sandbox_desc', 'A caixa de areia onde os dois mundos se encontram com segurança.')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* As 3 Branches */}
      <section className="space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold dark:text-white">{t('marketing_v2.features.git_architecture.section_3branches_title', 'A Arquitetura de 3 Branches')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg">
            {t('marketing_v2.features.git_architecture.section_3branches_desc', 'O MetaBuilder PRO constrói um fluxo Git corporativo dentro do seu computador, mas esconde todos os comandos difíceis de você. Entenda a Triangulação:')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Branch Local */}
          <div className="bg-white dark:bg-neutral-900/50 rounded-3xl p-8 border border-neutral-200 dark:border-neutral-800 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.features.git_architecture.branch_local_title', 'O Porto Seguro')}</h3>
              <div className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded inline-block mb-4">{t('marketing_v2.features.git_architecture.branch_local_badge', 'branch: local')}</div>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
                {t('marketing_v2.features.git_architecture.branch_local_desc', 'Esta é a base do seu projeto. Todo código que você digitou, configurou e considera "pronto e estável" fica aqui. É o seu HD em estado normal.')} <strong>{t('marketing_v2.features.git_architecture.branch_local_desc_bold', 'A IDE nunca altera essa branch sem a sua aprovação explícita.')}</strong>
              </p>
            </div>
          </div>

          {/* Branch Upstream */}
          <div className="bg-white dark:bg-neutral-900/50 rounded-3xl p-8 border border-neutral-200 dark:border-neutral-800 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-colors"></div>
            <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.features.git_architecture.branch_upstream_title', 'A Nuvem Pura')}</h3>
              <div className="text-xs font-mono text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded inline-block mb-4">{t('marketing_v2.features.git_architecture.branch_upstream_badge', 'branch: upstream')}</div>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
                {t('marketing_v2.features.git_architecture.branch_upstream_desc', 'O cofre intocável. O único papel desta branch é receber o código cru gerado pelo dev no Studio Web. Quando você clica em Sincronizar, ela faz o download e armazena as novidades aqui, sem tocar no seu trabalho atual.')}
              </p>
            </div>
          </div>

          {/* Branch Sync-Sandbox */}
          <div className="bg-white dark:bg-neutral-900/50 rounded-3xl p-8 border border-neutral-200 dark:border-neutral-800 space-y-6 relative overflow-hidden group border-indigo-500/20 shadow-lg shadow-indigo-500/5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
              <GitMerge className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.features.git_architecture.branch_sandbox_title', 'O Campo de Batalha')}</h3>
              <div className="text-xs font-mono text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded inline-block mb-4">{t('marketing_v2.features.git_architecture.branch_sandbox_badge', 'branch: sync-sandbox')}</div>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
                {t('marketing_v2.features.git_architecture.branch_sandbox_desc', 'A verdadeira mágica. A IDE copia o seu "Porto Seguro" e funde a "Nuvem Pura" em cima dele dentro desta caixa de areia. É aqui que você testa o Preview, experimenta e toma decisões sem medo de errar.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* High-Code / Pro-Code */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="order-2 lg:order-1 relative">
          <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full"></div>
          <div className="relative p-2 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/20 to-teal-500/10 dark:from-emerald-900/40 dark:to-teal-900/20 border border-emerald-500/20 shadow-2xl space-y-6 overflow-hidden">
             <img src="/ide-editor-demo.png" alt="Demonstração do Editor de Código da IDE" className="w-full h-auto rounded-[2rem] shadow-inner" />
          </div>
        </div>
        
        <div className="order-1 lg:order-2 space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <Code2 className="w-8 h-8" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white leading-[1.1]">
            {t('marketing_v2.features.git_architecture.pro_code_title_part1', 'Por que Triangulação?')} <br/>
            {t('marketing_v2.features.git_architecture.pro_code_title_part2', 'Porque somos Pro-Code (High-Code).')}
          </h2>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.git_architecture.pro_code_p1', 'Diferente de plataformas "No-Code" onde você fica preso em painéis e não vê o código fonte, o MetaBuilder PRO gera uma aplicação real em Next.js e React.')}
          </p>
          <p className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.git_architecture.pro_code_p2', 'Você tem acesso total através do nosso IDE embutido, podendo escrever lógicas complexas e criar componentes personalizados. A arquitetura de branches existe exatamente para proteger o SEU código manual das automações da Inteligência Artificial.')}
          </p>
        </div>
      </section>

      {/* Action Flow */}
      <section className="bg-neutral-50 dark:bg-neutral-900/30 rounded-3xl p-8 md:p-12 border border-neutral-200 dark:border-neutral-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h3 className="text-3xl font-bold dark:text-white">{t('marketing_v2.features.git_architecture.control_title', 'O Controle Final é Sempre Seu')}</h3>
            <p className="text-neutral-500 dark:text-neutral-400">
              {t('marketing_v2.features.git_architecture.control_desc', 'Após a fusão na Sandbox, você tem o poder absoluto sobre o destino do seu código. Teste no navegador local, modifique arquivos e valide as alterações. Quando terminar, você tem dois botões:')}
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="dark:text-white block">{t('marketing_v2.features.git_architecture.confirm_merge_title', 'Confirmar Merge')}</strong>
                  <span className="text-sm text-neutral-500">{t('marketing_v2.features.git_architecture.confirm_merge_desc', 'Tudo funciona! A IDE transporta o código da Sandbox permanentemente para o seu Porto Seguro (local).')}</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="dark:text-white block">{t('marketing_v2.features.git_architecture.discard_title', 'Descartar')}</strong>
                  <span className="text-sm text-neutral-500">{t('marketing_v2.features.git_architecture.discard_desc', 'A fusão quebrou? Você não gostou do resultado? Clique em descartar. A Sandbox é evaporada instantaneamente e seu código volta a ser o que era antes.')}</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <History className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="dark:text-white block">{t('marketing_v2.features.git_architecture.revert_title', 'Reverter Commit (Máquina do Tempo)')}</strong>
                  <span className="text-sm text-neutral-500">{t('marketing_v2.features.git_architecture.revert_desc', 'Fez alterações dentro da Sandbox e se arrependeu? Volte para qualquer estado anterior em milissegundos com um clique.')}</span>
                </div>
              </li>
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 blur-xl rounded-full opacity-50"></div>
            <div className="relative bg-black border border-neutral-800 rounded-2xl p-6 shadow-2xl font-mono text-sm text-neutral-400 space-y-3">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-neutral-800">
                <Terminal className="w-4 h-4 text-neutral-500" />
                <span className="text-neutral-300">{t('marketing_v2.features.git_architecture.terminal_title', 'Terminal Oculto da IDE')}</span>
              </div>
              <p>$ git checkout local -b sync-sandbox</p>
              <p>$ git merge upstream</p>
              <p className="text-yellow-400"># Você está isolado e seguro aqui...</p>
              <p className="text-neutral-600"># Se Confirmar:</p>
              <p>$ git checkout local</p>
              <p>$ git merge sync-sandbox</p>
              <p className="text-neutral-600"># Se Descartar:</p>
              <p>$ git checkout local --force</p>
              <p>$ git branch -D sync-sandbox</p>
            </div>
          </div>
        </div>
      </section>

      <BottomCta />
    </div>
  )
}
