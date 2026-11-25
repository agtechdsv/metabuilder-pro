# Release notes da IDE — modelo e como o painel usa o texto

Quando o dono pedir "release notes" para uma nova versão, **escreva neste formato** e entregue num bloco de código para ele colar no painel (SuperAdmin → Releases → Lançamento → "Release Notes Personalizado"). Guarde cada versão publicada em `docs/release-notes/<versao>.md` (exemplo: `1.0.5.md`).

## Como o painel trata o texto (`src/app/api/admin/release/route.ts`, `src/lib/releaseNotes.ts`)
- O campo aceita **Markdown e emojis**. O Histórico de Atualizações da IDE (`ReleaseNotes.tsx`) renderiza Markdown (títulos, negrito, listas, código, links).
- **Três idiomas num campo só**, separados por linhas próprias: `=== pt ===`, `=== en ===`, `=== es ===`. Sem marcadores, o mesmo texto vale para os três. Idioma que faltar usa o português.
- O texto vai **como está** para `public/changelog.json` (uma entrada por idioma) e, **só o português**, para o corpo da release no GitHub. **Não passa pelo Gemini.**
- "Release Notes Automático" (Gemini, a partir dos commits) vem **desmarcado** e só deve ser ligado de propósito: ele corta os commits em 3000 caracteres e, se falha, grava "Atualização de versão e melhorias gerais.".
- Campo vazio com o automático desligado: o botão **bloqueia** com mensagem.
- **Ordem:** commit + push → esperar o deploy da Vercel (o painel é o site; sem o deploy vale a rota antiga) → gerar a release.
- A release sai do que está no GitHub (`master`): tudo que deve ir na versão precisa estar commitado e enviado.

## Modelo (copie e adapte)
Título com a versão; seções com emoji; linhas curtas, em linguagem de usuário final (valor, não detalhe técnico); negrito no nome do recurso; **o mesmo conteúdo nos três idiomas**.

```
=== pt ===
## 🚀 MetaBuilder PRO vX.Y.Z

### ⚙️ <Área 1>
- **<Recurso>:** <o que o usuário ganha>.

### 💳 <Área 2>
- ...

### 🧭 Novidades na plataforma
- ...

=== en ===
## 🚀 MetaBuilder PRO vX.Y.Z
...

=== es ===
## 🚀 MetaBuilder PRO vX.Y.Z
...
```

## Regras de redação
- Escreva a partir dos commits desde a última release (`git log <tag anterior>..master`) e do que de fato mudou na tela; **não prometa o que não foi testado** (diga ao dono o que ficou de fora ou incerto).
- Sem termos internos (nome de arquivo, função, "low-code"); descreva o benefício.
- Itens de correção entram em "Correções" ou na área afetada, em uma linha.
- Conferir depois de gerar: Histórico de Atualizações da IDE mostra a versão formatada nos três idiomas e o **Sobre** (rodapé) mostra a versão instalada.
