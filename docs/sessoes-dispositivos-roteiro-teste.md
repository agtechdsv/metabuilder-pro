# Roteiro de teste: vagas de sessão (1 IDE + 1 navegador por usuário)

Desenho e regras: `docs/sessoes-dispositivos-desenho.md`. **Nada disto foi testado em navegador ou IDE reais**: o que foi verificado até aqui é `tsc`, a suíte de testes, o build e o SQL num PostgreSQL de verdade (54 comportamentos). Marque cada item com `[x]` ao passar e anote o que fugir do esperado.

## 0. Preparação

### Máquinas, navegadores e contas
| Sigla | O que é |
|---|---|
| **M1** | sua máquina principal (Windows) |
| **M2** | a máquina virtual Windows |
| **C1 / E1** | Chrome e Edge na M1 (dois navegadores na mesma máquina = dois dispositivos) |
| **C2** | Chrome na M2 |
| **I1 / I2** | a IDE instalada na M1 e na M2 (a IDE instalada serve: a regra é do site, não precisa de release nova) |
| **SA** | sua conta SuperAdmin (não ocupa vaga) |
| **U1** | uma conta de cliente comum, com assinatura ativa (dono) |
| **U2** | um convidado de U1 (para o teste de licenças) |
| **U3** | uma conta grátis, sem convidados |

Use janelas anônimas (ou perfis separados) quando precisar de "outro navegador" na mesma máquina.

### Antes de ligar
- [ ] Rodei `scripts/sessoes-dispositivos.sql` no SQL Editor (a última linha do resultado não pode ter erro; pode rodar de novo, é idempotente).
- [ ] Fiz o deploy do site com esta versão.
- [ ] Em **/admin/platform > Sistema > Sessões e dispositivos** a tela abre, mostra o modo **Desligado** e os valores 15, 3 e 60.
- [ ] (Opcional) criei `DEVICE_SLOT_SECRET` na Vercel (qualquer texto longo e aleatório). Sem ela, o site usa a chave de serviço do Supabase para assinar o cookie.

### Ajustes provisórios para testar mais rápido
Na tela do SuperAdmin: **ociosidade = 2 minutos**, **trocas por dia = 3**, **conferência = 10 segundos**. Anote para **voltar a 15, 3 e 60 no fim**.

### Consultas de apoio (SQL Editor; ou me peça que eu leio pelo MCP, que é só leitura)
```sql
-- vagas
select u.email, s.kind, s.device_id, s.label, s.city, s.created_at, s.last_seen_at, s.revoked_at, s.revoked_reason
from public.mb_device_sessions s join auth.users u on u.id = s.user_id
order by s.created_at desc limit 30;

-- histórico de eventos de um usuário
select created_at, event, kind, label, city, meta
from public.mb_device_events
where user_id = (select id from auth.users where email = 'u1@exemplo.com')
order by id desc limit 30;

-- sessões do Supabase Auth de um usuário (devem sumir ~15 min depois de uma vaga encerrada por troca)
select id, created_at, updated_at from auth.sessions
where user_id = (select id from auth.users where email = 'u1@exemplo.com');
```
Para **recomeçar** com um usuário (grava, rode no SQL Editor):
```sql
delete from public.mb_device_events    where user_id = (select id from auth.users where email = 'u1@exemplo.com');
delete from public.mb_device_sessions  where user_id = (select id from auth.users where email = 'u1@exemplo.com');
delete from public.mb_slot_challenges  where user_id = (select id from auth.users where email = 'u1@exemplo.com');
```

---

## A. Modo Desligado (nada pode mudar)
- [ ] **A1.** Com o modo **Desligado**, entre com U1 em C1 e em C2 ao mesmo tempo. *Esperado:* os dois entram direto, como antes.
- [ ] **A2.** Consulta das vagas. *Esperado:* **nenhuma linha** nova (no modo Desligado nada é registrado).
- [ ] **A3.** Em C1 abra /client/dashboard > Segurança. *Esperado:* aparece **Meus dispositivos** com o aviso "A regra de uma sessão por tipo ainda não está ativa" e lista vazia.
- [ ] **A4.** Home, /features/tour, /parceiros, /login, /terms, /privacy. *Esperado:* normais. Termos e Privacidade mostram o **item 5** (pt, en e es: troque o idioma).

## B. Modo Observar (registra, não bloqueia)
Mude para **Observar** e salve. Faça logout de tudo e entre de novo (para criar sessões novas).
- [ ] **B1.** U1 entra em C1. *Esperado:* entra; a consulta mostra 1 vaga `web` ativa com cidade (em produção) e "Chrome · Windows".
- [ ] **B2.** U1 entra em C2 (outra máquina). *Esperado:* **entra sem tela de escolha**; nada é derrubado.
- [ ] **B3.** Eventos de U1. *Esperado:* um evento `conflict` (e só um, mesmo que você atualize a página várias vezes).
- [ ] **B4.** Na tela do SuperAdmin, "Tentativas em 2ª máquina (7 dias)" mostra 1 e U1 aparece em "Quem trocou mais".
- [ ] **B5.** Em C2 clique em **Encerrar a outra e entrar aqui** não existe (não há tela). *Esperado:* ninguém é encerrado no modo Observar.

## C. Modo Valer: ocupação básica
Mude para **Valer** e salve. Recomece U1 (consulta de apoio) e faça logout em todo lugar.

| # | Faça | Esperado |
|---|---|---|
| **C1** | U1 entra em **C1** | entra direto |
| **C2** | U1 entra em **E1** (outro navegador, mesma máquina) | **tela de escolha** (é outro dispositivo) |
| **C3** | em E1, escolha **Permanecer lá e sair daqui** | E1 volta ao login; **C1 continua logado** |
| **C4** | U1 entra em **I1** (IDE, mesma máquina de C1) | entra direto: a IDE tem vaga própria |
| **C5** | U1 entra em **I2** (IDE na M2) | **tela de escolha**, falando em IDE |
| **C6** | em I2, escolha **Permanecer lá** | I2 volta ao login; I1 continua logada |
| **C7** | U1 entra em **C2** (navegador da M2) | **tela de escolha** (a vaga web está com C1) |
| **C8** | em I1 e C1, mexa na tela por 1 minuto | continuam funcionando (o batimento mantém as vagas) |

- [ ] C1 · [ ] C2 · [ ] C3 · [ ] C4 · [ ] C5 · [ ] C6 · [ ] C7 · [ ] C8

## D. A tela de escolha
Provoque a tela (por exemplo, C7).
- [ ] **D1.** Mostra **dispositivo** (navegador e sistema), **onde** (cidade e região; fora da Vercel aparece "Local desconhecido"), **conectado desde** e **última atividade**, no seu idioma.
- [ ] **D2.** Digitar a URL de /auth/sessao-ativa **sem estar logado**: vai para o login (a tela não revela nada antes de autenticar).
- [ ] **D3.** Trocar o idioma (pt, en, es): todos os textos acompanham.
- [ ] **D4.** Tema claro e escuro: legível.
- [ ] **D5.** Atualizar a página (F5) na tela de escolha: continua nela, sem erro.
- [ ] **D6.** Tentar abrir /client/dashboard à mão estando na escolha: volta para a tela de escolha.
- [ ] **D7.** `next` seguro: abra `/auth/sessao-ativa?next=https://evil.com` já autenticado: depois de escolher você vai para o **dashboard**, nunca para o outro site.

## E. Todos os caminhos de login levam à mesma tela
Com a vaga web ocupada por C1, tente entrar com U1 em C2 por cada caminho (faça logout em C2 entre os testes):
- [ ] **E1.** E-mail e senha.
- [ ] **E2.** Google.
- [ ] **E3.** Passkey (biometria), se U1 tiver uma.
- [ ] **E4.** Com MFA obrigatório (`enforce_mfa`): digita a senha, o código do app e **depois** vê a escolha (nunca antes do MFA).
- [ ] **E5.** Na **IDE**: senha e Google (o Google abre o navegador e volta pela IDE): na I2, com I1 logada, vê a escolha.
- [ ] **E6.** Link de convite ou de recuperação de senha: abre, define a senha e cai na regra normalmente.

## F. Encerrar a outra sessão (troca) e o aviso a quem foi derrubado
Estado: U1 em C1 (vaga web). Em C2, entre com U1 e escolha **Encerrar a outra sessão e entrar aqui**.
- [ ] **F1.** C2 entra no dashboard.
- [ ] **F2.** Em **C1**, em até ~1 minuto aparece o modal **"Sua sessão foi encerrada"** com cidade e horário do novo login e a frase sobre os arquivos locais.
- [ ] **F3.** Em C1, o botão **Entrar novamente** leva ao login com o **aviso amarelo** de sessão encerrada.
- [ ] **F4.** Em C1, se você navegar para outra tela **antes** do modal (clique rápido), vai direto para o login com o mesmo aviso.
- [ ] **F5.** **E-mail de segurança** chega ao e-mail de U1 (assunto "Sua sessão no MetaBuilder PRO foi encerrada"; confira a caixa de spam), com dispositivo, onde e quando. Repita com o idioma do site em **en** e **es** e confira a tradução.
- [ ] **F6.** **O mais importante:** depois de C1 clicar em "Entrar novamente" (que faz logout), **C2 continua logado** (o logout só vale para o próprio dispositivo).
- [ ] **F7.** Mesma coisa na IDE: I1 derrubada por I2 mostra o modal; os arquivos locais do projeto continuam na pasta e sincronizam no próximo login.
- [ ] **F8.** Consulta de eventos: `takeover` registrado, com os dados da sessão derrubada.
- [ ] **F9.** Cerca de 15 min depois, a consulta de `auth.sessions` não mostra mais a sessão derrubada (ou rode `select public.mb_purge_revoked_auth_sessions(1)` pelo SQL Editor depois de 1 min para ver o efeito).

## G. Ociosidade (com 2 min nos ajustes)
- [ ] **G1.** U1 entra em C1, fecha a janela **sem sair** e espera mais de 2 minutos.
- [ ] **G2.** U1 entra em C2. *Esperado:* **entra direto**, sem escolha.
- [ ] **G3.** Consulta de eventos: `idle_release`.
- [ ] **G4.** Reabrir C1 depois: mostra o aviso de sessão encerrada.
- [ ] **G5.** Refaça deixando C1 **aberta e em uso** (clicando nas telas): C2 deve ver a escolha (a atividade mantém a vaga).

## H. Limite de trocas por dia e código por e-mail (limite 3)
Faça **três trocas** seguidas entre C1, C2 e E1 (cada uma em "Encerrar a outra e entrar aqui").
- [ ] **H1.** As três passam, sem código.
- [ ] **H2.** A **quarta** troca mostra o passo do código ("Confirme por e-mail") e o e-mail chega com o código de 6 dígitos (e-mail mascarado na tela).
- [ ] **H3.** Código **errado**: mensagem de erro; a vaga **não** muda.
- [ ] **H4.** Código **certo**: a troca acontece.
- [ ] **H5.** Peça outro código antes de 1 minuto: "Aguarde um minuto". Depois de 1 minuto: o botão **Enviar outro código** envia e o código antigo deixa de valer.
- [ ] **H6.** Erre o código **5 vezes**: "Muitas tentativas"; o código é apagado e precisa de um novo.
- [ ] **H7.** Espere mais de 10 minutos com um código pedido: "O código venceu".
- [ ] **H8.** No SuperAdmin: "Limite atingido (7 dias)" mostra 1 e U1 aparece destacado em "Quem trocou mais". Eventos `cap_reached` e `code_failed` (após H6) aparecem na tabela.
- [ ] **H9.** O contador é de 24 horas móveis: para repetir sem esperar, use a consulta de "recomeçar".

## I. Logout
- [ ] **I1.** U1 sai em C1. Consulta: a vaga fica com `revoked_reason = logout`. C2 entra **direto**.
- [ ] **I2.** U1 em C1 e C2 (via escolha). Em C2, clique **Permanecer lá e sair daqui**: C2 vai ao login e **C1 continua logado e funcionando**.
- [ ] **I3.** O menu do usuário > Sair (navegador e IDE) funciona e libera a vaga.
- [ ] **I4.** Na tela de login com sessão a retomar, o botão **"Não sou eu — entrar como outro usuário"** sai só deste dispositivo.
- [ ] **I5.** Sair numa tela com `passkey_authenticated` ativo (login por passkey) também limpa tudo.

## J. Meus dispositivos (usuário comum)
Em /client/dashboard > Segurança (e no perfil, aba Segurança):
- [ ] **J1.** Lista as sessões ativas (tipo, dispositivo, cidade, desde, última atividade) com o selo **Este dispositivo** na atual.
- [ ] **J2.** Na sessão de outro dispositivo, **Encerrar** pede confirmação (modal do app, também na IDE) e encerra; o outro dispositivo cai em até ~1 minuto com o aviso.
- [ ] **J3.** Na sessão atual **não** há botão de encerrar.
- [ ] **J4.** **Histórico recente** (recolhido) mostra as encerradas com o motivo (substituída, inativa, saiu, encerrada por você, pelo administrador, novo login no mesmo dispositivo).
- [ ] **J5.** Botão de atualizar funciona; sem sessões, mostra "Nenhuma sessão ativa registrada".
- [ ] **J6.** Idiomas pt, en e es.

## K. SuperAdmin
- [ ] **K1.** SA entra em C1, C2 e I1 ao mesmo tempo: **sem escolha** e sem derrubar (isento). Consulta: nenhuma vaga de SA.
- [ ] **K2.** A tela mostra os totais, "Quem trocou mais", "Sessões ativas agora" (com e-mail) e "Eventos recentes".
- [ ] **K3.** **Encerrar** uma sessão de U1 pela tela: pede confirmação; U1 cai em até ~1 minuto; motivo "Encerrada pelo administrador" no histórico de U1.
- [ ] **K4.** Valores inválidos (0, 99999, vazio) são recusados com a mensagem de valores fora do permitido; os válidos salvam e a tela recarrega com eles.
- [ ] **K5.** Ao trocar para **Valer**, aparece a pergunta sobre Termos e Privacidade. Cancelar não salva.
- [ ] **K6.** Um usuário que **não** é SuperAdmin não consegue abrir /admin/platform (e chamar as ações direto também falha).
- [ ] **K7.** Atualizar a tela mostra dados novos; sem o script SQL rodado a tela avisa para rodá-lo.

## L. Convidados e licenças
- [ ] **L1.** U1 em C1 e U2 (convidado de U1) em C2 ao mesmo tempo: **sem conflito** (usuários diferentes, vagas diferentes).
- [ ] **L2.** O painel de licenças de U1 continua mostrando "2 / 2" (a regra não muda a contagem de licenças).
- [ ] **L3.** U2 em duas máquinas: vê a escolha dele, sem afetar U1.

## M. Áreas dentro e fora da regra
- [ ] **M1.** **Dentro:** /admin/..., /client/..., /workspace, /ide-local, /bpm, /tunnel-logs, /parceiro. Com a vaga tomada por outro dispositivo, todos redirecionam para a escolha (ou para o aviso de encerrada).
- [ ] **M2.** **Fora:** home, /features/*, /parceiros, /terms, /privacy, /checkout e /login abrem sem mexer na vaga.
- [ ] **M3.** **Apps publicados dos clientes** (ex.: `/kika-projetos/vendas-pg/clientes`) e domínios próprios dos clientes: nada muda para o usuário final e **nenhuma vaga é criada** por eles.
- [ ] **M4.** **APIs sensíveis** (por exemplo, exportar ou compilar): com a sessão encerrada respondem **401** (veja em Rede/DevTools) e a tela mostra o aviso pelo batimento.
- [ ] **M5.** Túnel e CLI (`/api/tunnel/*`): o Agente CLI continua funcionando **normalmente** (não passa pelas vagas).
- [ ] **M6.** Cron diário: `GET /api/cron/empty-trash` (com o segredo de cron) responde com `deviceAuthSessions` e `deviceRowsPurged` sem erro.

## N. IDE: detalhes
- [ ] **N1.** IDE **já logada antes do deploy**: abrir a IDE depois de ligar o modo Valer não a derruba nem a coloca na vaga do navegador (depois do primeiro batimento a consulta mostra `kind = ide`).
- [ ] **N2.** IDE e navegador na mesma máquina, os dois abertos o dia todo: nenhum cai.
- [ ] **N3.** IDE sem rede por alguns minutos e depois com rede: volta a funcionar sem pedir login (a menos que a vaga tenha sido tomada nesse tempo).
- [ ] **N4.** Fechar a IDE sem sair e abrir de novo na mesma máquina em menos de 2 minutos: entra direto (mesmo dispositivo).
- [ ] **N5.** Janelas internas da IDE (preview publicado, popouts da comunidade e downloads): funcionam, sem criar vaga extra.
- [ ] **N6.** Atualização automática da IDE (AutoUpdater) e deep link do Google: continuam funcionando.

## O. Tentativas de burlar (para conhecer os limites)
- [ ] **O1.** **Cookie de tipo forjado:** em C2, no DevTools (Application > Cookies), crie `mb_kind=ide` e atualize. *Esperado:* passa a usar a vaga da IDE (**limite conhecido**: dá no máximo 2 pessoas ao mesmo tempo, nunca 10). Apague o cookie depois.
- [ ] **O2.** **Cookie de conferência adulterado:** mude um caractere do `mb_slot` e atualize. *Esperado:* ignorado; o servidor confere no banco e a página abre normalmente (ou a escolha, se for o caso).
- [ ] **O3.** **Apagar o cookie `mb_device`** em C1 (logado) e atualizar: a mesma sessão aparece como outro dispositivo; *esperado:* passa, e um evento "Mesma sessão em outro dispositivo" aparece no SuperAdmin (uma vez por 30 min).
- [ ] **O4.** **Copiar os cookies de login** `sb-...` de C1 para C2 (DevTools): *esperado:* C2 entra com a mesma sessão (sem escolha), o evento acima aparece, e em alguns minutos o Supabase derruba uma das duas por reuso do token de renovação. Anote o que viu.
- [ ] **O5.** **Duas abas** do mesmo navegador: contam como um dispositivo só; nenhuma escolha.
- [ ] **O6.** **Janela anônima** do mesmo navegador: é outro dispositivo (sem cookies); vê a escolha.
- [ ] **O7.** Disputa: abra o login em C2 e em E1 e envie os dois "Entrar" quase juntos com a vaga livre. *Esperado:* um entra e o outro vê a escolha (o banco só permite uma sessão ativa).

## P. Botão de emergência
- [ ] **P1.** Com U1 em C1 e C2 (via escolha, uma delas já encerrada), mude para **Desligado**. *Esperado:* em até ~1 minuto ninguém é mais bloqueado nem recebe o aviso de encerrada; entrar em qualquer máquina funciona direto.
- [ ] **P2.** Volte para **Valer** e confirme que a regra volta a valer (use a consulta de "recomeçar" para limpar o estado, se preciso).
- [ ] **P3.** Banco indisponível ou função ausente (simule renomeando temporariamente uma função, ou rodando antes do SQL): o site **abre normalmente** (falha segura) e o log do servidor registra `[vagas]`.

## Q. Regressões (o que não pode quebrar)
- [ ] Login, logout, cadastro e recuperação de senha. · [ ] Passkey: cadastrar e entrar. · [ ] MFA: configurar e desafiar.
- [ ] Dashboard BI, criação de workspace e projeto, Studio, publicar. · [ ] Ejetar e Sincronizar na IDE.
- [ ] Checkout e Asaas (não deve ser tocado). · [ ] Programa de parceiros: /parceiro e /parceiros.
- [ ] Lixeiras e Central de Downloads. · [ ] Idiomas pt, en e es nas telas novas.

## R. Ao terminar
- [ ] Voltei os ajustes para **ociosidade 15**, **trocas 3** e **conferência 60**.
- [ ] Deixei o modo no valor que quero para o uso real (sugestão: **Observar** por alguns dias; **Valer** depois da revisão dos Termos e da Privacidade com o advogado).
- [ ] Anotei os desvios e me passou o que falhou (com a tela e, se possível, a consulta das vagas e dos eventos).
