import type { TestStatus } from './results'
import type { PlanLang } from './plan'

/**
 * Relatório de uma rodada do Ambiente de Testes: um único HTML autossuficiente (sem rede, sem bibliotecas), agrupado por caso de uso, com filtro por
 * situação, busca e layout próprio para impressão. A IDE mostra este HTML dentro do painel; "Baixar" grava o mesmo arquivo e "PDF" é a impressão dele
 * (o diálogo de impressão do sistema salva em PDF).
 */
export interface ReportRow { title: string; status: TestStatus | 'pending'; ms?: number; error?: string }
export interface ReportGroup { name: string; logicType: string; rows: ReportRow[] }
export interface ReportInput {
  project: string
  generatedAt: Date
  groups: ReportGroup[]
  /** modo da rodada: impressão abre direto com layout de papel */
  mode: 'html' | 'pdf'
  /** idioma do relatório (os títulos dos testes já vêm traduzidos em `groups`) */
  lang?: PlanLang
}

const TXT: Record<PlanLang, Record<string, string>> = {
  pt: { title: 'Relatório de testes', generated: 'Gerado em', engine: 'motor dinâmico do MetaBuilder PRO', ok: 'Aprovado', bad: 'Reprovado', none: 'Sem execução', tests: 'Testes', passed: 'Passaram', failed: 'Falharam', rate: 'Taxa de sucesso', time: 'Tempo total', all: 'Todos', notrun: 'Não executados', search: 'Buscar teste ou caso de uso...', okw: 'ok', fail: 'falha', fails: 'falhas', testsw: 'testes', foot: 'Os testes só leem dados e conferem, no fim, que nenhuma linha real foi alterada.', s_passed: 'Passou', s_failed: 'Falhou', s_skipped: 'Ignorado', s_running: 'Interrompido', s_pending: 'Não executado', locale: 'pt-BR' },
  en: { title: 'Test report', generated: 'Generated on', engine: 'MetaBuilder PRO dynamic engine', ok: 'Approved', bad: 'Failed', none: 'Not run', tests: 'Tests', passed: 'Passed', failed: 'Failed', rate: 'Success rate', time: 'Total time', all: 'All', notrun: 'Not run', search: 'Search test or use case...', okw: 'ok', fail: 'failure', fails: 'failures', testsw: 'tests', foot: 'The tests only read data and check, at the end, that no real row was changed.', s_passed: 'Passed', s_failed: 'Failed', s_skipped: 'Skipped', s_running: 'Interrupted', s_pending: 'Not run', locale: 'en-US' },
  es: { title: 'Informe de pruebas', generated: 'Generado el', engine: 'motor dinámico de MetaBuilder PRO', ok: 'Aprobado', bad: 'Reprobado', none: 'Sin ejecución', tests: 'Pruebas', passed: 'Pasaron', failed: 'Fallaron', rate: 'Tasa de éxito', time: 'Tiempo total', all: 'Todas', notrun: 'No ejecutadas', search: 'Buscar prueba o caso de uso...', okw: 'ok', fail: 'fallo', fails: 'fallos', testsw: 'pruebas', foot: 'Las pruebas solo leen datos y comprueban, al final, que ninguna fila real fue modificada.', s_passed: 'Pasó', s_failed: 'Falló', s_skipped: 'Omitida', s_running: 'Interrumpida', s_pending: 'No ejecutada', locale: 'es-ES' },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function reportTotals(groups: ReportGroup[]) {
  const all = groups.flatMap(g => g.rows)
  const n = (s: string) => all.filter(r => r.status === s).length
  const executados = all.filter(r => r.status === 'passed' || r.status === 'failed').length
  const passed = n('passed')
  return { total: all.length, passed, failed: n('failed'), other: all.length - passed - n('failed'), ms: all.reduce((a, r) => a + (r.ms || 0), 0), rate: executados ? Math.round((passed / executados) * 100) : 0 }
}

export function buildReportHtml(input: ReportInput): string {
  const t = reportTotals(input.groups)
  const L = TXT[input.lang || 'pt']
  const when = input.generatedAt.toLocaleString(L.locale)
  const veredito = t.failed === 0 && t.passed > 0 ? ['ok', L.ok] : t.failed > 0 ? ['bad', L.bad] : ['warn', L.none]
  const groups = input.groups.map(g => {
    const gp = g.rows.filter(r => r.status === 'passed').length
    const gf = g.rows.filter(r => r.status === 'failed').length
    const rows = g.rows.map(r => `
      <li class="row ${r.status}" data-status="${r.status}">
        <span class="dot"></span>
        <div class="main"><div class="ttl">${esc(r.title)}</div>${r.error ? `<pre class="err">${esc(r.error)}</pre>` : ''}</div>
        <span class="badge ${r.status}">${L['s_' + r.status] || r.status}</span>
        <span class="ms">${r.ms != null ? (r.ms / 1000).toFixed(1) + ' s' : ''}</span>
      </li>`).join('')
    return `
    <section class="grp" data-open="1">
      <header onclick="this.parentNode.classList.toggle('closed')">
        <h3>${esc(g.name)}</h3><span class="tag">${esc(g.logicType)}</span>
        <span class="cnt"><b class="g">${gp}</b> ${L.okw}${gf ? ` · <b class="r">${gf}</b> ${gf > 1 ? L.fails : L.fail}` : ''} · ${g.rows.length} ${L.testsw}</span>
      </header>
      <ul>${rows}</ul>
    </section>`
  }).join('')

  return `<!doctype html><html lang="${input.lang || 'pt'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${L.title} · ${esc(input.project)}</title>
<style>
:root{--bg:#f5f6fa;--card:#fff;--ink:#14161f;--mut:#667085;--line:#e4e7ee;--ok:#12a150;--okb:#e6f6ec;--bad:#d92d20;--badb:#fdecea;--warn:#b54708;--warnb:#fef3e2;--acc:#4f46e5}
@media (prefers-color-scheme:dark){:root{--bg:#0f1117;--card:#171a23;--ink:#eceef5;--mut:#98a2b3;--line:#262b38;--okb:#10281b;--badb:#2e1512;--warnb:#2b2112}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:28px 20px 60px}
.top{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
h1{margin:0;font-size:22px;letter-spacing:-.01em}.sub{color:var(--mut);margin-top:4px;font-size:13px}
.verdict{padding:6px 14px;border-radius:999px;font-weight:700;font-size:13px}
.verdict.ok{background:var(--okb);color:var(--ok)}.verdict.bad{background:var(--badb);color:var(--bad)}.verdict.warn{background:var(--warnb);color:var(--warn)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:22px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.card .n{font-size:28px;font-weight:800;letter-spacing:-.02em}.card .l{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.n.g{color:var(--ok)}.n.r{color:var(--bad)}
.bar{height:10px;border-radius:99px;background:var(--line);overflow:hidden;display:flex;margin:-6px 0 22px}
.bar i{display:block;height:100%}.bar .p{background:var(--ok)}.bar .f{background:var(--bad)}.bar .o{background:#98a2b3}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}
.chip{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;font-size:13px;cursor:pointer}
.chip.on{background:var(--acc);border-color:var(--acc);color:#fff}
input[type=search]{flex:1;min-width:180px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:7px 14px;font-size:13px}
.grp{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:12px;overflow:hidden}
.grp header{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;flex-wrap:wrap}
.grp h3{margin:0;font-size:15px}.tag{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);border:1px solid var(--line);border-radius:6px;padding:2px 6px}
.cnt{margin-left:auto;color:var(--mut);font-size:12px}.cnt .g{color:var(--ok)}.cnt .r{color:var(--bad)}
.grp.closed ul{display:none}ul{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.row{display:flex;gap:10px;align-items:flex-start;padding:9px 16px;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}
.dot{width:9px;height:9px;border-radius:50%;margin-top:6px;flex:none;background:#98a2b3}.row.passed .dot{background:var(--ok)}.row.failed .dot{background:var(--bad)}
.main{flex:1;min-width:0}.ttl{word-break:break-word}.row.failed .ttl{font-weight:600}
.err{white-space:pre-wrap;background:var(--badb);color:var(--bad);border-radius:8px;padding:8px 10px;font-size:12px;margin:6px 0 0}
.badge{font-size:11px;font-weight:700;border-radius:6px;padding:2px 8px;flex:none}.badge.passed{background:var(--okb);color:var(--ok)}.badge.failed{background:var(--badb);color:var(--bad)}.badge.skipped,.badge.pending,.badge.running{background:var(--line);color:var(--mut)}
.ms{width:52px;text-align:right;color:var(--mut);font-size:12px;flex:none;font-variant-numeric:tabular-nums}
.foot{color:var(--mut);font-size:12px;margin-top:22px;text-align:center}.hide{display:none!important}
@media print{:root{--bg:#fff;--card:#fff;--ink:#111;--mut:#555;--line:#ddd;--okb:#e6f6ec;--badb:#fdecea;--warnb:#fef3e2}
 .tools{display:none}.wrap{padding:0;max-width:none}.grp{break-inside:avoid;page-break-inside:avoid}.grp.closed ul{display:block}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="wrap">
<div class="top"><div><h1>${L.title} · ${esc(input.project)}</h1><div class="sub">${L.generated} ${esc(when)} · ${L.engine}</div></div><span class="verdict ${veredito[0]}">${veredito[1]}</span></div>
<div class="cards">
 <div class="card"><div class="n">${t.total}</div><div class="l">${L.tests}</div></div>
 <div class="card"><div class="n g">${t.passed}</div><div class="l">${L.passed}</div></div>
 <div class="card"><div class="n r">${t.failed}</div><div class="l">${L.failed}</div></div>
 <div class="card"><div class="n">${t.rate}%</div><div class="l">${L.rate}</div></div>
 <div class="card"><div class="n">${(t.ms / 1000).toFixed(0)} s</div><div class="l">${L.time}</div></div>
</div>
<div class="bar"><i class="p" style="width:${t.total ? (t.passed / t.total) * 100 : 0}%"></i><i class="f" style="width:${t.total ? (t.failed / t.total) * 100 : 0}%"></i><i class="o" style="width:${t.total ? (t.other / t.total) * 100 : 0}%"></i></div>
<div class="tools"><button class="chip on" data-f="all">${L.all}</button><button class="chip" data-f="passed">${L.passed}</button><button class="chip" data-f="failed">${L.failed}</button><button class="chip" data-f="other">${L.notrun}</button><input type="search" id="q" placeholder="${L.search}"></div>
${groups}
<div class="foot">${L.foot}</div>
</div>
<script>
(function(){var f='all',q='';function ap(){document.querySelectorAll('.grp').forEach(function(g){var any=false;g.querySelectorAll('.row').forEach(function(r){var s=r.dataset.status,okf=f==='all'||s===f||(f==='other'&&s!=='passed'&&s!=='failed');var okq=!q||(r.textContent+g.querySelector('h3').textContent).toLowerCase().indexOf(q)>=0;var show=okf&&okq;r.classList.toggle('hide',!show);if(show)any=true});g.classList.toggle('hide',!any)})}
document.querySelectorAll('.chip').forEach(function(b){b.onclick=function(){document.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on')});b.classList.add('on');f=b.dataset.f;ap()}});
document.getElementById('q').oninput=function(e){q=e.target.value.toLowerCase();ap()};
${input.mode === 'pdf' ? "document.querySelectorAll('.grp').forEach(function(g){g.classList.remove('closed')});" : ''}
})();
</script></body></html>`
}
