import type { TestStatus } from './results'
import type { PlanLang } from './plan'

/**
 * Relatório de uma rodada do Ambiente de Testes: um único HTML autossuficiente (sem rede, sem bibliotecas; gráficos em SVG), com resumo, taxa de
 * sucesso, resultado por caso de uso, testes mais lentos, falhas com a captura da tela e a lista completa com filtro e busca. A IDE mostra este HTML
 * dentro do painel; imprimir e baixar (PDF, HTML, JSON) partem dele.
 */
export interface ReportRow {
  title: string
  status: TestStatus | 'pending'
  ms?: number
  error?: string
  /** captura da tela da falha, já como data URI (o relatório continua sendo um arquivo só) */
  shot?: string
}
export interface ReportGroup { name: string; logicType: string; rows: ReportRow[] }
export interface ReportInput {
  project: string
  generatedAt: Date
  groups: ReportGroup[]
  /** modo da rodada: impressão abre direto com layout de papel */
  mode: 'html' | 'pdf'
  /** idioma do relatório (os títulos dos testes já vêm traduzidos em `groups`) */
  lang?: PlanLang
  /** como a rodada foi acompanhada (texto já traduzido) */
  watch?: string
}

const TXT: Record<PlanLang, Record<string, string>> = {
  pt: { title: 'Relatório de testes', generated: 'Gerado em', engine: 'motor dinâmico do MetaBuilder PRO', ok: 'Aprovado', bad: 'Reprovado', none: 'Sem execução', tests: 'Testes', passed: 'Passaram', failed: 'Falharam', notrun: 'Não executados', rate: 'Taxa de sucesso', time: 'Tempo total', all: 'Todos', search: 'Buscar teste ou caso de uso...', okw: 'ok', fail: 'falha', fails: 'falhas', testsw: 'testes', foot: 'Os testes só leem dados e conferem, no fim, que nenhuma linha real foi alterada.', s_passed: 'Passou', s_failed: 'Falhou', s_skipped: 'Ignorado', s_running: 'Interrompido', s_pending: 'Não executado', locale: 'pt-BR', by_view: 'Resultado por caso de uso', slowest: 'Testes mais lentos', failures: 'Falhas', no_failures: 'Nenhuma falha nesta execução.', shot: 'Captura da tela no momento da falha', mode: 'Acompanhamento', detail: 'Todos os testes', success: 'sucesso' },
  en: { title: 'Test report', generated: 'Generated on', engine: 'MetaBuilder PRO dynamic engine', ok: 'Approved', bad: 'Failed', none: 'Not run', tests: 'Tests', passed: 'Passed', failed: 'Failed', notrun: 'Not run', rate: 'Success rate', time: 'Total time', all: 'All', search: 'Search test or use case...', okw: 'ok', fail: 'failure', fails: 'failures', testsw: 'tests', foot: 'The tests only read data and check, at the end, that no real row was changed.', s_passed: 'Passed', s_failed: 'Failed', s_skipped: 'Skipped', s_running: 'Interrupted', s_pending: 'Not run', locale: 'en-US', by_view: 'Result by use case', slowest: 'Slowest tests', failures: 'Failures', no_failures: 'No failures in this run.', shot: 'Screenshot at the moment of the failure', mode: 'Followed by', detail: 'All tests', success: 'success' },
  es: { title: 'Informe de pruebas', generated: 'Generado el', engine: 'motor dinámico de MetaBuilder PRO', ok: 'Aprobado', bad: 'Reprobado', none: 'Sin ejecución', tests: 'Pruebas', passed: 'Pasaron', failed: 'Fallaron', notrun: 'No ejecutadas', rate: 'Tasa de éxito', time: 'Tiempo total', all: 'Todas', search: 'Buscar prueba o caso de uso...', okw: 'ok', fail: 'fallo', fails: 'fallos', testsw: 'pruebas', foot: 'Las pruebas solo leen datos y comprueban, al final, que ninguna fila real fue modificada.', s_passed: 'Pasó', s_failed: 'Falló', s_skipped: 'Omitida', s_running: 'Interrumpida', s_pending: 'No ejecutada', locale: 'es-ES', by_view: 'Resultado por caso de uso', slowest: 'Pruebas más lentas', failures: 'Fallos', no_failures: 'Ningún fallo en esta ejecución.', shot: 'Captura de pantalla en el momento del fallo', mode: 'Seguimiento', detail: 'Todas las pruebas', success: 'éxito' },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function reportTotals(groups: ReportGroup[]) {
  const all = groups.flatMap(g => g.rows)
  const n = (s: string) => all.filter(r => r.status === s).length
  const executados = all.filter(r => r.status === 'passed' || r.status === 'failed').length
  const passed = n('passed')
  return { total: all.length, passed, failed: n('failed'), other: all.length - passed - n('failed'), ms: all.reduce((a, r) => a + (r.ms || 0), 0), rate: executados ? Math.round((passed / executados) * 100) : 0 }
}

/** Medidor circular da taxa de sucesso (SVG puro). */
function gauge(rate: number, executed: boolean, label: string): string {
  const r = 52
  const c = 2 * Math.PI * r
  const color = !executed ? '#98a2b3' : rate === 100 ? 'var(--ok)' : rate >= 80 ? '#f79009' : 'var(--bad)'
  return `<svg viewBox="0 0 130 130" width="130" height="130" role="img" aria-label="${rate}%">
    <circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/>
    <circle cx="65" cy="65" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * rate) / 100} ${c}" transform="rotate(-90 65 65)"/>
    <text x="65" y="64" text-anchor="middle" font-size="26" font-weight="800" fill="var(--ink)">${rate}%</text>
    <text x="65" y="84" text-anchor="middle" font-size="10" fill="var(--mut)" letter-spacing=".08em">${esc(label.toUpperCase())}</text></svg>`
}

export function buildReportHtml(input: ReportInput): string {
  const t = reportTotals(input.groups)
  const L = TXT[input.lang || 'pt']
  const when = input.generatedAt.toLocaleString(L.locale)
  const veredito = t.failed === 0 && t.passed > 0 ? ['ok', L.ok] : t.failed > 0 ? ['bad', L.bad] : ['warn', L.none]
  const allRows = input.groups.flatMap(g => g.rows.map(r => ({ ...r, group: g.name })))

  const perView = input.groups.map(g => {
    const p = g.rows.filter(r => r.status === 'passed').length
    const f = g.rows.filter(r => r.status === 'failed').length
    const o = g.rows.length - p - f
    const w = (n: number) => (g.rows.length ? (n / g.rows.length) * 100 : 0).toFixed(1)
    return `<div class="pv"><div class="pvn" title="${esc(g.name)}">${esc(g.name.split(' (')[0])}</div>
      <div class="pvb"><i class="p" style="width:${w(p)}%"></i><i class="f" style="width:${w(f)}%"></i><i class="o" style="width:${w(o)}%"></i></div>
      <div class="pvc"><b class="g">${p}</b>${f ? ` · <b class="r">${f}</b>` : ''}<span class="m"> / ${g.rows.length}</span></div></div>`
  }).join('')

  const slow = [...allRows].filter(r => r.ms != null).sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, 5)
  const maxMs = Math.max(1, ...slow.map(r => r.ms || 0))
  const slowest = slow.map(r => `<div class="sl"><div class="slt" title="${esc(r.title)}">${esc(r.title)}</div><div class="slb"><i style="width:${(((r.ms || 0) / maxMs) * 100).toFixed(1)}%"></i></div><div class="slm">${((r.ms || 0) / 1000).toFixed(1)} s</div></div>`).join('')

  const falhas = allRows.filter(r => r.status === 'failed')
  const failuresHtml = `<section class="box"><h2>${L.failures}${falhas.length ? ` <span class="pill bad">${falhas.length}</span>` : ''}</h2>${falhas.length === 0 ? `<p class="m">${L.no_failures}</p>` : falhas.map(r => `
      <div class="fail"><div class="ftt">${esc(r.title)}</div><div class="fg">${esc(r.group)}</div>
        ${r.error ? `<pre class="err">${esc(r.error)}</pre>` : ''}
        ${r.shot ? `<details open><summary>${L.shot}</summary><img class="shot" alt="" src="${r.shot}"></details>` : ''}</div>`).join('')}</section>`

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
    <section class="grp">
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
h1{margin:0;font-size:22px;letter-spacing:-.01em}h2{margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut)}.sub{color:var(--mut);margin-top:4px;font-size:13px}.m{color:var(--mut)}
.verdict{padding:6px 14px;border-radius:999px;font-weight:700;font-size:13px}
.verdict.ok{background:var(--okb);color:var(--ok)}.verdict.bad{background:var(--badb);color:var(--bad)}.verdict.warn{background:var(--warnb);color:var(--warn)}
.hero{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:center;margin:22px 0 14px}
@media(max-width:640px){.hero{grid-template-columns:1fr;justify-items:center}}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;width:100%}
.card,.box{background:var(--card);border:1px solid var(--line);border-radius:14px}.card{padding:14px 16px}.box{padding:16px 18px;margin-bottom:14px}
.card .n{font-size:26px;font-weight:800;letter-spacing:-.02em}.card .l{color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.n.g,.g{color:var(--ok)}.n.r,.r{color:var(--bad)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:760px){.cols{grid-template-columns:1fr}}
.pv{display:grid;grid-template-columns:minmax(80px,150px) 1fr 70px;gap:10px;align-items:center;margin:7px 0;font-size:12px}
.pvn,.slt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pvb,.slb{height:10px;border-radius:99px;background:var(--line);overflow:hidden;display:flex}
.pvb i{display:block;height:100%}.pvb .p{background:var(--ok)}.pvb .f{background:var(--bad)}.pvb .o{background:#98a2b3}.pvc{text-align:right;font-variant-numeric:tabular-nums}
.sl{display:grid;grid-template-columns:minmax(80px,1fr) 90px 48px;gap:10px;align-items:center;margin:7px 0;font-size:12px}.slb i{display:block;height:100%;background:var(--acc);border-radius:99px}.slm{text-align:right;color:var(--mut);font-variant-numeric:tabular-nums}
.pill{font-size:11px;border-radius:99px;padding:1px 8px;vertical-align:middle}.pill.bad{background:var(--badb);color:var(--bad)}
.fail{border-top:1px solid var(--line);padding:10px 0}.fail:first-of-type{border-top:0}.ftt{font-weight:600}.fg{font-size:12px;color:var(--mut)}
.shot{max-width:100%;border:1px solid var(--line);border-radius:10px;margin-top:8px}summary{cursor:pointer;color:var(--mut);font-size:12px;margin-top:8px}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:20px 0 14px;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}
.chip{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;font-size:13px;cursor:pointer}
.chip.on{background:var(--acc);border-color:var(--acc);color:#fff}
input[type=search]{flex:1;min-width:180px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:7px 14px;font-size:13px}
.grp{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:12px;overflow:hidden}
.grp header{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;flex-wrap:wrap}
.grp h3{margin:0;font-size:15px}.tag{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);border:1px solid var(--line);border-radius:6px;padding:2px 6px}
.cnt{margin-left:auto;color:var(--mut);font-size:12px}
.grp.closed ul{display:none}ul{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.row{display:flex;gap:10px;align-items:flex-start;padding:9px 16px;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}
.dot{width:9px;height:9px;border-radius:50%;margin-top:6px;flex:none;background:#98a2b3}.row.passed .dot{background:var(--ok)}.row.failed .dot{background:var(--bad)}
.main{flex:1;min-width:0}.ttl{word-break:break-word}.row.failed .ttl{font-weight:600}
.err{white-space:pre-wrap;background:var(--badb);color:var(--bad);border-radius:8px;padding:8px 10px;font-size:12px;margin:6px 0 0}
.badge{font-size:11px;font-weight:700;border-radius:6px;padding:2px 8px;flex:none}.badge.passed{background:var(--okb);color:var(--ok)}.badge.failed{background:var(--badb);color:var(--bad)}.badge.skipped,.badge.pending,.badge.running{background:var(--line);color:var(--mut)}
.ms{width:52px;text-align:right;color:var(--mut);font-size:12px;flex:none;font-variant-numeric:tabular-nums}
.foot{color:var(--mut);font-size:12px;margin-top:22px;text-align:center}.hide{display:none!important}
@media print{:root{--bg:#fff;--card:#fff;--ink:#111;--mut:#555;--line:#ddd;--okb:#e6f6ec;--badb:#fdecea;--warnb:#fef3e2}
 .tools{display:none}.wrap{padding:0;max-width:none}.grp,.box,.fail{break-inside:avoid;page-break-inside:avoid}.grp.closed ul{display:block}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="wrap">
<div class="top"><div><h1>${L.title} · ${esc(input.project)}</h1><div class="sub">${L.generated} ${esc(when)} · ${L.engine}${input.watch ? ` · ${L.mode}: ${esc(input.watch)}` : ''}</div></div><span class="verdict ${veredito[0]}">${veredito[1]}</span></div>
<div class="hero">${gauge(t.rate, t.passed + t.failed > 0, L.success)}
 <div class="cards">
  <div class="card"><div class="n">${t.total}</div><div class="l">${L.tests}</div></div>
  <div class="card"><div class="n g">${t.passed}</div><div class="l">${L.passed}</div></div>
  <div class="card"><div class="n r">${t.failed}</div><div class="l">${L.failed}</div></div>
  <div class="card"><div class="n">${t.other}</div><div class="l">${L.notrun}</div></div>
  <div class="card"><div class="n">${(t.ms / 1000).toFixed(0)} s</div><div class="l">${L.time}</div></div>
 </div></div>
<div class="cols">
 <section class="box"><h2>${L.by_view}</h2>${perView}</section>
 <section class="box"><h2>${L.slowest}</h2>${slowest || `<p class="m">—</p>`}</section>
</div>
${failuresHtml}
<h2 style="margin-top:22px">${L.detail}</h2>
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
