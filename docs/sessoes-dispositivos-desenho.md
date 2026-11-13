# Vagas de sessão por usuário (IDE e navegador): desenho e como ficou

Decisões fechadas com o dono em 2026-11-13. **Código escrito e verificado (tsc, testes, build e o SQL num PostgreSQL de verdade); nada publicado e nada testado em navegador ou IDE reais.** O roteiro de teste está em `docs/sessoes-dispositivos-roteiro-teste.md`.

## Objetivo e promessa comercial
Impedir que **um mesmo login seja usado ao mesmo tempo** em mais de uma máquina, para que uma licença não vire dez pessoas trabalhando. A promessa que fazemos (cláusula 5 dos Termos de Serviço) é:

> Cada usuário tem **uma sessão de IDE e uma sessão de navegador** ativas ao mesmo tempo. Entrar em outra máquina do mesmo tipo exige escolher qual sessão manter.

O que **não** garante: que seja uma pessoa só. Um grupo pode se **revezar** (um de cada vez). O limite de trocas por dia e o painel do SuperAdmin existem para tornar isso visível.

## Regras
1. **Duas vagas por usuário**, independentes: `web` (navegador) e `ide` (IDE desktop). IDE e navegador na **mesma máquina** funcionam juntos.
2. Entrar com **credencial correta** (senha, Google ou passkey, mais MFA quando obrigatório) numa segunda máquina do **mesmo tipo** abre uma tela com a escolha:
   - **Permanecer lá e sair daqui** (esta sessão é encerrada, a outra continua), ou
   - **Encerrar a outra sessão e entrar aqui** (a outra cai, esta fica).
3. Cidade aproximada, horário e navegador/sistema da outra sessão só aparecem **depois** de autenticar.
4. **Mesmo dispositivo** (mesmo cookie de dispositivo) entrando de novo: substitui a sessão anterior sem perguntar.
5. **Ociosidade libera a vaga**: sem atividade por N minutos (padrão 15), a vaga fica livre e o novo login entra direto.
6. **Quem foi derrubado é avisado**: modal na própria tela em até ~60 s, aviso na tela de entrada e **e-mail de segurança** ao dono do login (pt, en, es).
7. **Limite de trocas por dia** (padrão 3): a quarta troca do dia exige um **código de 6 dígitos por e-mail** (vale 10 min, 5 tentativas, reenvio a cada 60 s). Tentativa de passar do limite e código errado ficam no painel do SuperAdmin.
8. **Isentos**: SuperAdmin não ocupa vaga. Convidados da equipe são usuários próprios, com vagas próprias. Os apps publicados dos clientes (usuários finais) **não entram**.
9. **Logout só sai deste dispositivo** e libera a vaga na hora. (O padrão do Supabase, `signOut()` sem argumento, é **global** e derrubaria também a sessão da outra máquina; por isso o app usa `scope: 'local'`.)
10. **Modo** (`device_slot_mode`, ajustado pelo SuperAdmin): `off` (nada muda), `observe` (registra sem bloquear) e `enforce` (vale). É também o **botão de emergência**.

## Como funciona

### Identificação
- **Dispositivo** (`mb_device`): cookie `httpOnly`, 1 ano, gravado pelo servidor (UUID aleatório) no domínio `.metabuilderpro.com`. Chrome e Edge na mesma máquina são dispositivos diferentes.
- **Tipo** (`mb_kind` = `ide` ou `web`): a IDE (Tauri) carrega o site, então o `SessionGuard` detecta `isTauri()` e grava `mb_kind=ide`. **Não exige nova release da IDE.** Uma IDE já logada que chegue antes do cookie é vista como `web` e **migra sozinha** para a vaga da IDE no primeiro batimento, se ela estiver livre.
- **Sessão**: a claim `session_id` do JWT do Supabase (estável nas renovações, nova a cada login).
- **Lugar**: cabeçalhos `x-vercel-ip-city`, `x-vercel-ip-country-region` e `x-vercel-ip-country` (só existem em produção na Vercel). O IP vira **hash** com segredo (`DEVICE_SLOT_SECRET`, ou a chave de serviço se não houver).

### Portão central (`src/proxy.ts` + `src/lib/sessions/gate.ts`)
Roda depois de renovar o login e olha a **sessão que existe**, não o botão clicado, então cobre senha, Google, passkey e a entrega do login pela IDE de uma vez.
1. Sem usuário, rota pública ou domínio próprio de cliente: segue.
2. Cookie `mb_slot` válido (assinado, ~60 s): segue sem ir ao banco.
3. Senão chama `mb_claim_device_slot`: `ok`/`claimed`/`off`/`exempt` seguem e renovam o cookie; `occupied` vai para `/auth/sessao-ativa`; `revoked` limpa os cookies de login e vai para `/login?motivo=encerrada`.
4. **Falha do banco nunca trava ninguém** (deixa passar e registra no log).
5. Rotas de API sensíveis (lista em `PROTECTED_API_PREFIXES`) respondem **401** em vez de redirecionar. Fora da lista ficam `/api/session`, `/api/auth`, `/api/tunnel`, `/api/cron` e o runtime.

### Batimento (`SessionGuard`, em `Providers`)
Nas áreas da plataforma chama `/api/session/heartbeat` a cada 60 s e ao voltar o foco da aba: mantém a vaga viva e, se a sessão foi encerrada por outro login, mostra o modal "Sua sessão foi encerrada" e só então sai.

## Dados (`scripts/sessoes-dispositivos.sql`, o usuário roda no SQL Editor; idempotente)
- `mb_device_sessions` (as vagas; **índice único parcial** `(user_id, kind) where revoked_at is null`: dois logins simultâneos, o segundo perde no banco), `mb_device_events` (histórico: claimed, takeover, conflict, idle_release, logout, cap_reached, code_sent, code_failed, revoked), `mb_slot_challenges` (códigos por e-mail, só o hash).
- RLS ligada **sem policy**; `revoke ... from anon, authenticated`. Funções `security definer`, `set search_path = public`, executáveis **só pelo service_role**: `mb_claim_device_slot`, `mb_take_over_slot`, `mb_release_device_slot`, `mb_revoke_device_session`, `mb_purge_revoked_auth_sessions`, `mb_purge_device_data`.
- Ajustes em `platform_settings`: `device_slot_mode` (começa `off`), `device_idle_minutes` (15), `device_takeover_daily_cap` (3), `device_check_ttl_seconds` (60).
- **Sessão encerrada de verdade:** a vaga encerrada por troca, ociosidade ou admin tem a linha de `auth.sessions` apagada depois de 15 min (na próxima troca e no cron diário `/api/cron/empty-trash`), o que impede renovar o token. Retenção de 90 dias para histórico e vagas encerradas.
- `scripts/test-sessoes-dispositivos-sql.mjs` roda o SQL num banco descartável do PostgreSQL local e confere 54 comportamentos (inclui duas conexões disputando a vaga).

## Onde está no código
| Peça | Arquivo |
|---|---|
| Regras puras (cookie assinado, rotas, textos do cliente, código por e-mail) | `src/lib/sessions/slotCore.ts` |
| Banco (RPC) e montagem do pedido | `src/lib/sessions/slotService.ts`, `currentSlot.ts` |
| Portão | `src/lib/sessions/gate.ts`, `src/proxy.ts`, `src/utils/supabase/middleware.ts` |
| Tela de escolha | `src/app/auth/sessao-ativa/page.tsx`, `src/components/auth/ActiveSessionChooser.tsx` |
| Batimento e aviso de sessão encerrada | `src/app/api/session/heartbeat/route.ts`, `SessionGuard.tsx`, `KickedNotice.tsx` (login) |
| Ações (troca, código, meus dispositivos, SuperAdmin) | `src/app/actions/deviceSessions.ts` |
| Logout local e libera a vaga | `signOut` em `src/app/auth/actions.ts` |
| "Meus dispositivos" | `src/components/workspace/DeviceSessionsPanel.tsx` (aba Segurança do `/client/dashboard` e perfil) |
| SuperAdmin | `src/components/admin/DeviceSessionsAdmin.tsx` (aba **Sistema**, junto com a Lixeira) |
| E-mails | `src/lib/security/securityMailText.ts` e `securityMail.ts` (mesmo SMTP do checkout) |
| Termos e Privacidade | `terms.item5_*` e `privacy.item4_desc`, `privacy.item5_*` (pt, en, es) |
| Testes | `src/lib/sessions/__tests__/*` |

## Limites honestos
1. **Chamadas diretas ao Supabase.** A IDE e o navegador falam com o PostgREST usando o token do usuário, sem passar pelo `proxy.ts`. Uma sessão derrubada pode continuar lendo e gravando por esse caminho até o batimento (~60 s) e, no pior caso, até o token vencer (padrão 1 h; a Supabase recomenda não baixar de 5 min). A linha de `auth.sessions` apagada aos 15 min impede a renovação.
2. **O tipo é declarado pelo cliente.** Um navegador pode se passar por IDE e ganhar a segunda vaga: no máximo **2 pessoas ao mesmo tempo, nunca 10**. Assinar o batimento na IDE com uma chave embutida **não** resolve (a chave seria extraível do binário), por isso não foi feito.
3. **Revezamento** (um de cada vez) não é detectável como tal; só o volume de trocas denuncia.
4. **Cookies de login copiados** para outra máquina compartilham a mesma sessão do Supabase e passam pelo portão, mas o Supabase **não deixa duas máquinas renovarem o mesmo token** (reuso do refresh token derruba a sessão) e o evento "Mesma sessão em outro dispositivo" aparece para o SuperAdmin.
5. **Dispositivo novo = cookie novo.** Limpar cookies ou reinstalar a IDE gera outro dispositivo e cai no fluxo normal de escolha.

## Privacidade (LGPD)
Guardamos cidade, região e país (dos cabeçalhos da Vercel), tipo, navegador/sistema e horários; o IP só como **hash**. Retenção de **90 dias**. A Política de Privacidade (item 5 e o item 4, de cookies) e os Termos (item 5) já citam isso nos três idiomas.

## Publicação (ordem)
1. Rodar `scripts/sessoes-dispositivos.sql` no SQL Editor (o modo começa `off`, nada muda).
2. Deploy do site. (Opcional: `DEVICE_SLOT_SECRET` na Vercel; sem ela usa a chave de serviço.)
3. Em Sistema > Sessões e dispositivos: mudar para **Observar** e olhar por alguns dias quantos usuários bateriam na regra.
4. Revisar os Termos (item 5) e a Política de Privacidade com o advogado.
5. Mudar para **Valer**. Se algo der errado, voltar para **Desligado**: em até 60 s ninguém mais é bloqueado, sem novo deploy.
