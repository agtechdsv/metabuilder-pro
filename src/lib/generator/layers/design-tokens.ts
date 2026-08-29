/**
 * design-tokens.ts
 *
 * FONTE DA VERDADE para todas as classes Tailwind usadas no código gerado pelo Eject.
 *
 * Estas classes são extraídas diretamente dos componentes Runtime:
 *   - src/components/runtime/DynamicSidebar.tsx
 *   - src/components/runtime/RuntimeGlobalHeader.tsx
 *   - src/app/[workspace_slug]/[project_slug]/[view_slug]/page.tsx
 *
 * Se o Runtime mudar uma classe, basta atualizar aqui — todo o Eject se atualiza junto.
 */

export const T = {
  // ─────────────────────────────────────────────────────────────────────────
  // Sidebar
  // ─────────────────────────────────────────────────────────────────────────
  SIDEBAR_BG:
    'sticky top-0 h-screen bg-white/80 dark:bg-black/40 backdrop-blur-xl border-r border-neutral-200/50 dark:border-white/5 z-[100] flex flex-col shrink-0',

  SIDEBAR_HEADER:
    'h-16 flex items-center px-6 border-b border-neutral-200/50 dark:border-white/5 shrink-0',

  SIDEBAR_LOGO_ICON:
    'w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0',

  SIDEBAR_PROJECT_NAME:
    'text-[10px] font-black uppercase tracking-widest text-neutral-900 dark:text-white leading-none truncate',

  SIDEBAR_PROJECT_SUB:
    'text-[7px] font-black uppercase tracking-[0.2em] text-indigo-500 opacity-70 mt-0.5',

  SIDEBAR_NAV:
    'flex-1 px-4 py-6 space-y-2 overflow-y-auto',

  NAV_ITEM_ACTIVE:
    'flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 transition-all relative',

  NAV_ITEM_INACTIVE:
    'flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-indigo-500/10 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group relative',

  NAV_ITEM_LABEL:
    'text-sm font-bold truncate',

  NAV_ITEM_ACTIVE_DOT:
    'absolute right-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse',

  SIDEBAR_FOOTER:
    'p-4 border-t border-neutral-200/50 dark:border-white/5 bg-neutral-50/50 dark:bg-neutral-900/30',

  SIDEBAR_FOOTER_CARD:
    'flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 shadow-sm',

  SIDEBAR_AVATAR:
    'w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-black text-white shrink-0',

  SIDEBAR_USERNAME:
    'text-xs font-bold text-neutral-900 dark:text-white truncate',

  SIDEBAR_LOGOUT:
    'text-[9px] text-neutral-400 hover:text-red-500 text-left transition-colors truncate',

  // ─────────────────────────────────────────────────────────────────────────
  // Header
  // ─────────────────────────────────────────────────────────────────────────
  HEADER:
    'h-16 border-b border-neutral-200/50 dark:border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl sticky top-0 z-[90] flex items-center px-6 gap-4',

  HEADER_TOGGLE_BTN:
    'p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 transition-all hover:scale-105 active:scale-95',

  HEADER_BREADCRUMB_NAV:
    'flex-1 flex items-center gap-2 text-[10px] font-bold capitalize tracking-widest text-neutral-400 overflow-hidden',

  HEADER_BREADCRUMB_ACTIVE:
    'text-neutral-900 dark:text-white truncate capitalize',

  HEADER_BREADCRUMB_LINK:
    'flex items-center gap-1.5 hover:text-indigo-600 transition-colors truncate',

  // ─────────────────────────────────────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────────────────────────────────────
  LOGIN_PAGE:
    'min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#050505] p-4',

  LOGIN_CARD:
    'w-full max-w-md bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border border-slate-200 dark:border-[#27272a]/50 rounded-3xl p-8 sm:p-10 shadow-xl',

  LOGIN_LOGO:
    'w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mx-auto mb-6',

  LOGIN_TITLE:
    'text-2xl font-black tracking-tight text-slate-900 dark:text-white text-center mb-1',

  LOGIN_SUBTITLE:
    'text-sm text-slate-500 dark:text-neutral-400 text-center mb-8',

  LOGIN_LABEL:
    'block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400 mb-2',

  LOGIN_INPUT:
    'w-full bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all',

  LOGIN_BTN:
    'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-3.5 text-sm tracking-wide transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2',

  LOGIN_ERROR:
    'text-red-500 text-xs text-center mt-2',

  LOGIN_BACK_LINK:
    'block text-center text-xs text-neutral-400 hover:text-indigo-500 transition-colors mt-6',

  // ─────────────────────────────────────────────────────────────────────────
  // Dashboard de entrada (cards dos casos de uso)
  // ─────────────────────────────────────────────────────────────────────────
  DASHBOARD_PAGE:
    'p-6 sm:p-8 max-w-[1400px] mx-auto',

  DASHBOARD_HEADER:
    'flex flex-col sm:flex-row sm:items-center gap-4 mb-10',

  DASHBOARD_ICON_WRAPPER:
    'w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-indigo-600/10 dark:bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0',

  DASHBOARD_TITLE:
    'text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white',

  DASHBOARD_SUBTITLE:
    'text-xs font-bold tracking-[0.15em] uppercase text-indigo-500 mt-0.5',

  DASHBOARD_GRID:
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',

  DASHBOARD_CARD:
    'group flex flex-col justify-between bg-white dark:bg-[#141416] border border-slate-200 dark:border-[#27272a] rounded-3xl p-6 sm:p-8 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 min-h-[200px]',

  DASHBOARD_CARD_ICON:
    'w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4',

  DASHBOARD_CARD_TITLE:
    'font-black text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors',

  DASHBOARD_CARD_SUBTITLE:
    'text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-neutral-500 mt-0.5',

  DASHBOARD_CARD_ARROW:
    'w-5 h-5 text-slate-300 dark:text-neutral-600 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all',

  // ─────────────────────────────────────────────────────────────────────────
  // Listagem (Grid)
  // ─────────────────────────────────────────────────────────────────────────
  LIST_PAGE:
    'p-6 sm:p-8 max-w-[1600px] mx-auto space-y-6',

  LIST_HEADER:
    'flex justify-between items-start',

  LIST_TITLE_WRAPPER:
    'flex items-center gap-4',

  LIST_TITLE_ICON:
    'w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center ring-1 ring-indigo-500/20',

  LIST_TITLE:
    'text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground flex items-center gap-2',

  LIST_COUNT_BADGE:
    'px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-secondary text-[10px] font-semibold text-neutral-500 dark:text-muted-foreground border border-neutral-200 dark:border-input tracking-wider',

  LIST_SUBTITLE:
    'text-xs font-black tracking-widest text-neutral-400 dark:text-muted-foreground mt-1 uppercase',

  LIST_HEADER_ACTIONS:
    'flex items-center gap-3',

  LIST_BTN_OUTLINE:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-xs font-bold tracking-wide transition-all',

  LIST_BTN_PRIMARY:
    'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wide transition-colors shadow-lg shadow-indigo-500/20',

  // Filtros
  FILTER_BAR:
    'p-5 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-end',

  FILTER_LABEL:
    'text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1',

  FILTER_INPUT:
    'flex h-10 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all',

  FILTER_SELECT:
    'flex h-10 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all',

  FILTER_BTN_SEARCH:
    'px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold tracking-wide transition-colors',

  FILTER_BTN_CLEAR:
    'px-5 py-2.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-xs font-bold tracking-wide transition-colors',

  // Tabela
  TABLE_WRAPPER:
    'bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-xl dark:shadow-none backdrop-blur-sm flex flex-col w-full',

  TABLE_SCROLL:
    'overflow-x-auto overflow-y-auto max-h-[600px]',

  TABLE_ELEMENT:
    'w-full text-left border-collapse min-w-[1200px]',

  TABLE_THEAD:
    'sticky top-0 z-20',

  TABLE_THEAD_ROW:
    'bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800',

  TABLE_TH_STICKY_LEFT:
    'sticky left-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 w-[60px] border-r border-neutral-200/50 dark:border-neutral-700/50 shadow-[4px_0_10px_rgba(0,0,0,0.03)]',

  TABLE_TH:
    'px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] whitespace-nowrap cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 group/th transition-colors',

  TABLE_TH_STICKY_RIGHT:
    'sticky right-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)]',

  TABLE_ROW:
    'group border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors',

  TABLE_TD_STICKY_LEFT_EVEN:
    'sticky left-0 z-10 px-4 py-4 whitespace-nowrap w-[60px] text-center border-r border-neutral-200/50 dark:border-neutral-700/50 shadow-[4px_0_10px_rgba(0,0,0,0.03)] bg-white dark:bg-neutral-900 transition-colors',

  TABLE_TD_STICKY_LEFT_ODD:
    'sticky left-0 z-10 px-4 py-4 whitespace-nowrap w-[60px] text-center border-r border-neutral-200/50 dark:border-neutral-700/50 shadow-[4px_0_10px_rgba(0,0,0,0.03)] bg-neutral-50 dark:bg-neutral-800 transition-colors',

  TABLE_TD:
    'px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap',

  TABLE_TD_STICKY_RIGHT_EVEN:
    'sticky right-0 z-10 px-4 py-4 text-right border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)] bg-white dark:bg-neutral-900 transition-colors',

  TABLE_TD_STICKY_RIGHT_ODD:
    'sticky right-0 z-10 px-4 py-4 text-right border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)] bg-neutral-50 dark:bg-neutral-800 transition-colors',

  TABLE_ACTIONS_CELL:
    'flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity',

  TABLE_ACTION_BTN:
    'w-8 h-8 rounded-full flex items-center justify-center transition-all',

  TABLE_ACTION_VIEW:
    'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700',

  TABLE_ACTION_EDIT:
    'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30',

  TABLE_ACTION_DELETE:
    'text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30',

  TABLE_BADGE_STATUS:
    'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50',

  TABLE_EMPTY:
    'h-48 text-center',

  TABLE_FOOTER:
    'px-8 py-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between',

  TABLE_FOOTER_INFO:
    'flex items-center gap-4 text-[11px] font-bold text-neutral-500 uppercase tracking-widest',

  TABLE_FOOTER_PAGINATION:
    'flex items-center gap-2',

  TABLE_PAGINATION_BTN:
    'p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all border-none bg-transparent shadow-none',

  // ─────────────────────────────────────────────────────────────────────────
  // Formulário / Detalhe
  // ─────────────────────────────────────────────────────────────────────────
  FORM_PAGE:
    'p-6 sm:p-8 max-w-[1200px] mx-auto pb-24',

  FORM_BACK_LINK:
    'inline-flex items-center text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors mb-6 uppercase tracking-widest',

  FORM_HEADER:
    'flex items-end justify-between mb-8',

  FORM_HEADER_LEFT:
    'flex items-center gap-4',

  FORM_HEADER_ICON:
    'w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center',

  FORM_TITLE:
    'text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1',

  FORM_SUBTITLE:
    'text-sm text-neutral-400',

  FORM_WRAPPER:
    'bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-xl relative overflow-hidden',

  FORM_WRAPPER_GLOW:
    'absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full',

  FORM_GRID:
    'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6',

  FORM_FIELD_WRAPPER:
    'space-y-2',

  FORM_LABEL:
    'block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest',

  FORM_INPUT:
    'w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed',

  FORM_TEXTAREA:
    'w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60 resize-y min-h-[100px]',

  FORM_SELECT:
    'w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-60',

  FORM_CHECKBOX_WRAPPER:
    'flex items-center gap-3 py-1',

  FORM_CHECKBOX:
    'w-5 h-5 rounded-md border-2 border-neutral-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500',

  FORM_FOOTER:
    'flex justify-end pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-6',

  FORM_BTN_SAVE:
    'inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm tracking-wide transition-colors shadow-lg shadow-indigo-500/20',

  // Tabs (relacionamentos)
  TABS_LIST:
    'w-full justify-start h-auto p-1.5 bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-x-auto mb-6 inline-flex',

  TABS_TRIGGER_ACTIVE:
    'px-6 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-lg transition-all',

  TABS_TRIGGER_INACTIVE:
    'px-6 py-2.5 text-neutral-500 dark:text-neutral-400 font-semibold text-sm rounded-lg transition-all hover:text-neutral-700 dark:hover:text-neutral-200',

  TABS_CONTENT:
    'mt-6',

  // ─────────────────────────────────────────────────────────────────────────
  // "Em desenvolvimento" placeholder
  // ─────────────────────────────────────────────────────────────────────────
  WIP_WRAPPER:
    'flex flex-col items-center justify-center min-h-[400px] text-center p-8',

  WIP_ICON:
    'w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-4',

  WIP_TITLE:
    'text-xl font-black text-neutral-900 dark:text-white mb-2',

  WIP_SUBTITLE:
    'text-sm text-neutral-500 dark:text-neutral-400 max-w-md',
} as const

export type TokenKey = keyof typeof T
