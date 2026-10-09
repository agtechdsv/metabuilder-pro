// Gera docs/roteiro-de-testes.html (caixas clicáveis, progresso e marcação guardada no navegador) a partir de docs/ROTEIRO-DE-TESTES.md.
// Uso: node scripts/gen-roteiro-html.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const md = readFileSync(new URL('../docs/ROTEIRO-DE-TESTES.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

let html = '', open = false, n = 0, inList = false
const closeList = () => { if (inList) { html += '</ul>'; inList = false } }
for (const raw of md.split('\n')) {
  const line = raw.trimEnd()
  let m
  if ((m = /^# (.*)/.exec(line))) { closeList(); html += `<h1>${inline(m[1])}</h1>` }
  else if ((m = /^## (.*)/.exec(line))) { closeList(); html += `<h2>${inline(m[1])}</h2>` }
  else if ((m = /^- \[( |x)\] (.*)/.exec(line))) {
    if (!inList) { html += '<ul class="checks">'; inList = true }
    n++
    html += `<li><label><input type="checkbox" data-i="${n}" ${m[1] === 'x' ? 'checked' : ''}><span>${inline(m[2])}</span></label></li>`
  } else if (/^\s{2,}\S/.test(line) && inList) {
    // continuação do item anterior
    html = html.replace(/<\/span><\/label><\/li>$/, ` ${inline(line.trim())}</span></label></li>`)
  } else if (line.trim() === '') { closeList() }
  else { closeList(); html += `<p>${inline(line)}</p>` }
}
closeList()

const page = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Roteiro de testes</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#e5e5e5;--ac:#4f46e5;--ok:#059669;--code:#f3f4f6}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0f;--fg:#ececf1;--mut:#9a9aa6;--line:#26262e;--ac:#818cf8;--ok:#34d399;--code:#1c1c24}}
body{background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,Segoe UI,sans-serif;margin:0}
main{max-width:860px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:1.5rem;margin:0 0 8px}h2{font-size:1.05rem;margin:28px 0 8px;padding-top:12px;border-top:1px solid var(--line)}
code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:.9em}
ul.checks{list-style:none;padding:0;margin:0}ul.checks li{margin:2px 0}
label{display:flex;gap:10px;align-items:flex-start;padding:6px 8px;border-radius:8px;cursor:pointer}label:hover{background:var(--code)}
input{margin-top:4px;width:17px;height:17px;accent-color:var(--ac);flex:none}
input:checked+span{color:var(--mut);text-decoration:line-through}
.bar{position:sticky;top:0;background:var(--bg);padding:10px 0;border-bottom:1px solid var(--line);display:flex;gap:12px;align-items:center;z-index:2}
.track{flex:1;height:8px;background:var(--line);border-radius:99px;overflow:hidden}.fill{height:100%;width:0;background:var(--ok);transition:width .2s}
button{background:none;border:1px solid var(--line);color:var(--mut);border-radius:8px;padding:4px 10px;cursor:pointer}
</style></head><body><main>
<div class="bar"><span id="count">0/${n}</span><div class="track"><div class="fill" id="fill"></div></div><button id="reset">Limpar marcações</button></div>
${html}
</main>
<script>
const KEY='roteiro-testes-2026-10-09', boxes=[...document.querySelectorAll('input[type=checkbox]')];
let saved={}; try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
const render=()=>{const d=boxes.filter(b=>b.checked).length;document.getElementById('count').textContent=d+'/'+boxes.length;document.getElementById('fill').style.width=(boxes.length?d*100/boxes.length:0)+'%'};
boxes.forEach(b=>{if(saved[b.dataset.i]!==undefined)b.checked=saved[b.dataset.i];b.addEventListener('change',()=>{saved[b.dataset.i]=b.checked;try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{};render()})});
document.getElementById('reset').onclick=()=>{if(confirm('Limpar todas as marcações?')){boxes.forEach(b=>b.checked=false);saved={};try{localStorage.removeItem(KEY)}catch{};render()}};
render();
</script></body></html>`
writeFileSync(new URL('../docs/roteiro-de-testes.html', import.meta.url), page)
console.log(`docs/roteiro-de-testes.html gerado com ${n} itens`)
