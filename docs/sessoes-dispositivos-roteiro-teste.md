# Roteiro de teste: vagas de sessão (1 IDE + 1 navegador por usuário)

Desenho e regras: `docs/sessoes-dispositivos-desenho.md`. Em 16/11/2026 foi feita a primeira rodada em navegador e IDE reais (blocos A e B, boa parte de C, F e I, e itens de D, J e K), com a conta grátis LGPD, o note e a VM; as notas estão no fim do arquivo. Antes disso, só `tsc`, a suíte de testes, o build e o SQL num PostgreSQL de verdade (54 comportamentos) haviam verificado o desenho. Marque cada item com `[x]` ao passar e anote o que fugir do esperado.

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
- [x] Rodei `scripts/sessoes-dispositivos.sql` no SQL Editor (a última linha do resultado não pode ter erro; pode rodar de novo, é idempotente).
- [x] Fiz o deploy do site com esta versão.
- [x] Em **/admin/platform > Sistema > Sessões e dispositivos** a tela abre, mostra o modo **Desligado** e os valores 15, 3 e 60.
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
- [x] **A1.** Com o modo **Desligado**, entre com U1 em C1 e em C2 ao mesmo tempo. *Esperado:* os dois entram direto, como antes.
- [x] **A2.** Consulta das vagas. *Esperado:* **nenhuma linha** nova (no modo Desligado nada é registrado).
- [x] **A3.** Em C1 abra /client/dashboard > Segurança (conta grátis: em **Meu Perfil > Segurança**). *Esperado:* aparece **Meus dispositivos** com o aviso "O registro de sessões está desligado na plataforma..." e lista vazia. *(O texto do aviso mudou em 16/11: Desligado explica a lista vazia; Observar diz que as sessões só são registradas.)*
- [x] **A4.** Home, /features/tour, /parceiros, /login, /terms, /privacy. *Esperado:* normais. Termos e Privacidade mostram o **item 5** (pt, en e es: troque o idioma).

## B. Modo Observar (registra, não bloqueia)
Mude para **Observar** e salve. Faça logout de tudo e entre de novo (para criar sessões novas).
- [x] **B1.** U1 entra em C1. *Esperado:* entra; a consulta mostra 1 vaga `web` ativa com cidade (em produção) e "Chrome · Windows".
- [x] **B2.** U1 entra em C2 (outra máquina). *Esperado:* **entra sem tela de escolha**; nada é derrubado.
- [x] **B3.** Eventos de U1. *Esperado:* um evento `conflict` (e só um, mesmo que você atualize a página várias vezes).
- [x] **B4.** Na tela do SuperAdmin, "Tentativas em 2ª máquina (7 dias)" mostra 1 e U1 aparece em "Quem trocou mais".
- [x] **B5.** Em C2 clique em **Encerrar a outra e entrar aqui** não existe (não há tela). *Esperado:* ninguém é encerrado no modo Observar.

## C. Modo Valer: ocupação básica
Mude para **Valer** e salve. Recomece U1 (consulta de apoio) e faça logout em todo lugar.

| # | Faça | Esperado |
|---|---|---|
| **C1** | U1 entra em **C1** | entra direto |
| **C2** | U1 entra em **E1** (outro navegador, mesma máquina) | **tela de escolha** (é outro dispositivo) |
| **C3** | em E1, escolha **Permanecer lá e sair daqui** | E1 volta à **página inicial** com o aviso azul "Você saiu deste dispositivo" (antes ia ao login, sem aviso); **C1 continua logado** |
| **C4** | U1 entra em **I1** (IDE, mesma máquina de C1) | entra direto: a IDE tem vaga própria |
| **C5** | U1 entra em **I2** (IDE na M2) | **tela de escolha**, falando em IDE |
| **C6** | em I2, escolha **Permanecer lá** | I2 volta à página inicial da IDE com o aviso azul "Você saiu deste dispositivo"; I1 continua logada |
| **C7** | U1 entra em **C2** (navegador da M2) | **tela de escolha** (a vaga web está com C1) |
| **C8** | em I1 e C1, mexa na tela por 1 minuto | continuam funcionando (o batimento mantém as vagas) |

- [x] C1 · [ ] C2 · [x] C3 · [x] C4 · [x] C5 · [x] C6 · [x] C7 · [x] C8 *(17/11, tarde: C1, C3 e C7 repetidos com a conta agtechtrade no navegador, note e VM, sem erro; ver as anotações da tarde de 17/11.)*

*(16/11: C1, C3, C4, C5 e C7 foram feitos com o note e a VM, a IDE da VM e a IDE do note. C2 (E1, outro navegador na mesma máquina) não foi feito. C3 e C6 foram revistos depois do deploy do commit d881e3fa: "Permanecer lá e sair daqui" leva à página inicial com o aviso azul "Você saiu deste dispositivo", visto no navegador e na IDE. C8: as duas vagas ficaram vivas por mais de 10 minutos, vistas pelo `last_seen_at` no banco.)*

## D. A tela de escolha
Provoque a tela (por exemplo, C7).
- [x] **D1.** *(visto em português, no navegador e na IDE)* Mostra **dispositivo** (navegador e sistema), **onde** (cidade e região; fora da Vercel aparece "Local desconhecido"), **conectado desde** e **última atividade**, no seu idioma.
- [ ] **D2.** Digitar a URL de /auth/sessao-ativa **sem estar logado**: vai para o login (a tela não revela nada antes de autenticar).
- [ ] **D3.** Trocar o idioma (pt, en, es): todos os textos acompanham.
- [x] **D4.** Tema claro e escuro: legível. *(visto nos dois temas)*
- [ ] **D5.** Atualizar a página (F5) na tela de escolha: continua nela, sem erro.
- [ ] **D6.** Tentar abrir /client/dashboard à mão estando na escolha: volta para a tela de escolha.
- [ ] **D7.** `next` seguro: abra `/auth/sessao-ativa?next=https://evil.com` já autenticado: depois de escolher você vai para o **dashboard**, nunca para o outro site.

## E. Todos os caminhos de login levam à mesma tela
Com a vaga web ocupada por C1, tente entrar com U1 em C2 por cada caminho (faça logout em C2 entre os testes):
- [x] **E1.** E-mail e senha. *(16/11: coberto pelos testes C1, C3 e C6, com o note e a VM entrando por e-mail e senha e vendo a tela de escolha. Não foi repetido com dois navegadores na mesma máquina; isso fica no C2.)*
- [x] **E2.** Google. *(17/11: conta agtechtrade, C1 no note e C2 na VM em **janela anônima**: depois do Google a VM viu a tela de escolha, mostrando o note com "conectado desde" e "última atividade". Na aba normal da VM o Google falhou duas vezes (429 e "PKCE code verifier not found"): ver as anotações de 17/11.)*
- [x] **E3.** Passkey (biometria), se U1 tiver uma. *(17/11: o note entrou três vezes por biometria e a vaga foi ocupada normalmente. À tarde, com a vaga web ocupada pela VM, o note entrou por biometria e viu a tela de escolha; como já eram 3 trocas no dia, pediu o código por e-mail e, com o código certo, assumiu a vaga. Ver as anotações da tarde de 17/11.)*
- [x] **E4.** Com MFA obrigatório (`enforce_mfa`): digita a senha, o código do app e **depois** vê a escolha (nunca antes do MFA). *(17/11: na VM, Google mais código do app do agtechtrade e só depois a tela de escolha, segundo o relato do teste.)*
- [x] **E5.** *(Google + MFA feito em 18/11; a senha já tinha sido vista em C5, C6 e F7.)* Na **IDE**: senha e Google (o Google abre o navegador e volta pela IDE): na I2, com I1 logada, vê a escolha. *Passo a passo abaixo (E5a senha, E5b Google).*
  - **Antes:** modo **Valer**; as duas IDEs (I1 na M1, I2 na M2) deslogadas; no SuperAdmin, "Sessões ativas agora" sem sessão **IDE** da conta de teste. Para a senha use a conta que tem senha (ex.: a LGPD); para o Google, uma conta com Google (ex.: agtechtrade). O contador de trocas é de 24 h móveis: uma conta que já trocou 3 vezes hoje vai pedir o código por e-mail na próxima troca (isso também é válido, mas muda o roteiro; para só ver a escolha, use "Permanecer lá" no passo 4).
  - [ ] **E5a, senha.** 1) Em **I1**, entre com e-mail e senha (e o código do app, se a conta tiver MFA): entra direto; o painel mostra 1 sessão, tipo **IDE**. 2) Em **I2**, entre com a mesma conta e senha. *Esperado:* abre, dentro da IDE, a tela **"Sua conta já está em uso em outro dispositivo"**, falando de **IDE** (não de navegador), com dispositivo "IDE · Windows", onde, "conectado desde" e "última atividade" da I1. 3) O painel mostra "Tentativa em 2ª máquina" (evento `conflict`, tipo IDE), sem contar como troca. 4) Clique **Permanecer lá e sair daqui**: a I2 volta à página inicial da IDE com o aviso azul "Você saiu deste dispositivo"; a I1 continua logada (confira o painel e use a I1 por 1 minuto). 5) *(Opcional, conta sem limite estourado)* repita o 2 e clique **Encerrar a outra sessão e entrar aqui**: a I2 entra; a I1, em até ~1 minuto, mostra "Sua sessão foi encerrada" (os arquivos do projeto continuam na pasta); chega o e-mail de segurança; o painel registra "Troca de dispositivo".
  - [x] **E5b, Google.** *(18/11, ~00:35 a 00:46: feito com Google + MFA, I1 = IDE do note e I2 = IDE da VM. Passou: a I2 viu a tela de escolha falando de IDE; "Permanecer lá" voltou à página da IDE com o aviso azul; na segunda tentativa, "Encerrar a outra sessão" pediu o código por e-mail (já eram 4+ trocas), o código foi aceito e a I2 entrou; a I1 mostrou o modal "Sua sessão foi encerrada" com cidade e hora. Problema achado: o "Entrar novamente" da I1 caiu na página do site, ver F3.)* Com I1 e I2 deslogadas de novo (e a sessão IDE do painel encerrada). 1) Em **I1**, clique em entrar com Google: a IDE abre o **navegador do sistema**, você escolhe a conta e o site devolve para a IDE; a I1 entra (1 sessão IDE no painel). 2) Em **I2**, repita: Google no navegador da M2, volta para a IDE. *Esperado:* ao voltar, a I2 mostra a mesma tela de escolha (IDE), e as opções funcionam como no E5a. 3) **Observe e anote:** se o passo do Google no navegador da M2 criou também uma sessão de **navegador** no painel (o esperado é só a da IDE; se aparecer uma de navegador, anote o horário e o que estava aberto). 4) Se o Google falhar ou voltar sem entrar, anote o que apareceu (erro 429, "PKCE code verifier not found", ficou em "Autenticando…"), pois os mesmos sintomas já ocorreram no navegador em 17/11.
  - *Registre:* quando a escolha aparecer na I2, anote o horário e confira no banco (ou peça a leitura): evento `conflict` com `kind = ide`.
- [ ] **E6.** Link de convite ou de recuperação de senha: abre, define a senha e cai na regra normalmente.

## F. Encerrar a outra sessão (troca) e o aviso a quem foi derrubado
Estado: U1 em C1 (vaga web). Em C2, entre com U1 e escolha **Encerrar a outra sessão e entrar aqui**.
- [x] **F1.** C2 entra no dashboard.
- [x] **F2.** Em **C1**, em até ~1 minuto aparece o modal **"Sua sessão foi encerrada"** com cidade e horário do novo login e a frase sobre os arquivos locais.
- [x] **F3.** Em C1, o botão **Entrar novamente** leva à **página inicial** (do site ou da IDE) com o **aviso amarelo** de sessão encerrada. *(Revisto depois do deploy do commit d881e3fa: no navegador o aviso amarelo aparece na página inicial, com cidade e hora. Na IDE: **visto em 18/11 e deu errado**: "Entrar novamente" no modal "Sua sessão foi encerrada" da IDE levou à página inicial **do site** (com o aviso amarelo), e não à da IDE (cartão de entrada com Google/biometria). O "Permanecer lá e sair daqui" na IDE levou certo à página da IDE. Correção defensiva feita em `HomeClientRouter` (confere de novo a classe `is-tauri` depois de carregar). **Repetido em 18/11 (~01:11) depois da correção: passou.** Na IDE, "Entrar novamente" levou ao cartão de entrada da IDE (Google, biometria, e-mail e senha, "IDE Engine v1.0.1") com o aviso amarelo "Sua sessão foi encerrada… Você entrou em outro dispositivo (Belo Horizonte, MG) em 18/11/2026, 01:10:27".)*
- [ ] **F4.** Em C1, se você navegar para outra tela **antes** do modal (clique rápido), vai direto para o login com o mesmo aviso.
- [x] **F5.** *(Visto em português: um e-mail por troca, às 14:19, 14:30, 15:31 e 15:38 no horário de Brasília; falta conferir **en** e **es**.)* **E-mail de segurança** chega ao e-mail de U1 (assunto "Sua sessão no MetaBuilder PRO foi encerrada"; confira a caixa de spam), com dispositivo, onde e quando. Repita com o idioma do site em **en** e **es** e confira a tradução.
- [x] **F6.** **O mais importante:** depois de C1 clicar em "Entrar novamente" (que faz logout), **C2 continua logado** (o logout só vale para o próprio dispositivo).
- [x] **F7.** Mesma coisa na IDE: I1 derrubada por I2 mostra o modal; os arquivos locais do projeto continuam na pasta e sincronizam no próximo login.
- [x] **F8.** Consulta de eventos: `takeover` registrado, com os dados da sessão derrubada.
- [ ] **F9.** Cerca de 15 min depois, a consulta de `auth.sessions` não mostra mais a sessão derrubada (ou rode `select public.mb_purge_revoked_auth_sessions(1)` pelo SQL Editor depois de 1 min para ver o efeito). *(17/11: a limpeza **não roda sozinha aos 15 minutos**: roda junto com a próxima troca e no cron diário da lixeira (`/api/cron/empty-trash`). Por isso as sessões de trocas das 16:49 e 16:54 seguiam em `auth.sessions` duas horas depois. Ler este item como "some depois da próxima troca ou do cron"; falta conferir isso. Atenção: nesse intervalo a sessão do Auth continua viva e ainda renova o token, como visto na noite de 17/11.)*

## G. Ociosidade (com 2 min nos ajustes)
- [x] **G1.** U1 entra em C1, fecha a janela **sem sair** e espera mais de 2 minutos. *(17/11: agtechtrade entrou no Chrome do note às 19:46:13 e fechou o Chrome sem sair (última atividade 19:48:16); esperou ~1 h 25 min, com a ociosidade em **15 minutos**. Às 21:11 o painel marcava a sessão como "ociosa: a vaga se libera na próxima entrada".)*
- [x] **G2.** U1 entra em C2. *Esperado:* **entra direto**, sem escolha. *(17/11, 21:13:13: o agtechtrade entrou no Chrome da VM e foi direto ao workspace, sem a tela de escolha.)*
- [x] **G3.** Consulta de eventos: `idle_release`. *(Conferido no banco: evento `idle_release` (web, `idle_minutes: 15`) às 21:13:13, no mesmo instante do `claimed` da VM; a vaga antiga ficou com `revoked_reason = idle`. Não contou como troca: Trocas 7 dias seguiu em 10.)*
- [ ] **G4.** Reabrir C1 depois: mostra o aviso de sessão encerrada. *(17/11, **parcial**: ao reabrir o Chrome do note, a página inicial ainda mostrou o avatar como logado; depois do Ctrl+R mostrou "Entrar", **sem aviso** de sessão encerrada. Ver as anotações da noite: a página inicial pública não roda a conferência de vaga. Falta repetir abrindo uma área protegida, como /workspace, em vez da página inicial.)* **Correção feita (a testar depois do deploy):** a página inicial, quando o navegador ainda tem cookie de login, passa a **perguntar** ao servidor (`/api/session/heartbeat?peek=1`, só leitura: não ocupa vaga, não renova atividade, não grava cookie) se a vaga desta sessão foi encerrada e, se sim, mostra o mesmo modal "Sua sessão foi encerrada" no lugar de deixar o avatar. Roda ao abrir e ao voltar o foco, só no modo Valer. *Teste:* repita o G1 a G3 (entrar em C1, fechar sem sair, esperar a ociosidade, entrar em C2) e **reabra a página inicial em C1**: deve aparecer o modal; "Entrar novamente" leva à página inicial com o aviso amarelo.
- [ ] **G5.** Refaça deixando C1 **aberta e em uso** (clicando nas telas): C2 deve ver a escolha (a atividade mantém a vaga).

## H. Limite de trocas por dia e código por e-mail (limite 3)
Faça **três trocas** seguidas entre C1, C2 e E1 (cada uma em "Encerrar a outra e entrar aqui").
- [x] **H1.** As três passam, sem código. *(As três contadas em 16/11: web às 14:19, IDE às 14:30 e web às 15:31, no horário de Brasília.)*
- [x] **H2.** A **quarta** troca mostra o passo do código ("Confirme por e-mail") e o e-mail chega com o código de 6 dígitos (e-mail mascarado na tela).
- [x] **H3.** Código **errado**: mensagem de erro; a vaga **não** muda.
- [x] **H4.** Código **certo**: a troca acontece.
- [x] **H5.** Peça outro código antes de 1 minuto: "Aguarde um minuto". Depois de 1 minuto: o botão **Enviar outro código** envia e o código antigo deixa de valer.
- [x] **H6.** *(Feito na IDE: depois de 5 erros veio "Muitas tentativas erradas. Peça um novo código.")* Erre o código **5 vezes**: "Muitas tentativas"; o código é apagado e precisa de um novo.
- [x] **H7.** *(Feito na IDE: o código pedido às 16:06 foi usado depois das 16:20 e a tela disse "O código venceu. Peça outro.")* Espere mais de 10 minutos com um código pedido: "O código venceu".
- [x] **H8.** *(Visto às 16:22: Trocas 5, Tentativas em 2ª máquina 13, Limite atingido 3; o LGPD aparece destacado em "Quem trocou mais"; "Limite de trocas atingido" e "Código errado demais" aparecem nos eventos.)* No SuperAdmin: "Limite atingido (7 dias)" mostra 1 e U1 aparece destacado em "Quem trocou mais". Eventos `cap_reached` e `code_failed` (após H6) aparecem na tabela.
- [ ] **H9.** O contador é de 24 horas móveis: para repetir sem esperar, use a consulta de "recomeçar".

## I. Logout
- [x] **I1.** U1 sai em C1. Consulta: a vaga fica com `revoked_reason = logout`. C2 entra **direto**.
- [x] **I2.** U1 em C1 e C2 (via escolha). Em C2, clique **Permanecer lá e sair daqui**: C2 vai à página inicial com o aviso azul "Você saiu deste dispositivo" e **C1 continua logado e funcionando**. *(Revisto depois do deploy do commit d881e3fa: o aviso azul aparece na página inicial do site e da IDE.)*
- [ ] **I3.** O menu do usuário > Sair (navegador e IDE) funciona e libera a vaga. *(17/11: navegador OK, a vaga sumiu do painel na hora e o banco registrou `logout`; falta a IDE.)*
- [ ] **I4.** Na tela de login com sessão a retomar, o botão **"Não sou eu — entrar como outro usuário"** sai só deste dispositivo.
- [ ] **I5.** Sair numa tela com `passkey_authenticated` ativo (login por passkey) também limpa tudo.

## J. Meus dispositivos (usuário comum)
Em /client/dashboard > Segurança (e no perfil, aba Segurança):
- [x] **J1.** Lista as sessões ativas (tipo, dispositivo, cidade, desde, última atividade) com o selo **Este dispositivo** na atual.
- [ ] **J2.** Na sessão de outro dispositivo, **Encerrar** pede confirmação (modal do app, também na IDE) e encerra; o outro dispositivo cai em até ~1 minuto com o aviso.
- [x] **J3.** Na sessão atual **não** há botão de encerrar.
- [x] **J4.** *(visto só o motivo "Saiu"; os outros motivos ainda não)* **Histórico recente** (recolhido) mostra as encerradas com o motivo (substituída, inativa, saiu, encerrada por você, pelo administrador, novo login no mesmo dispositivo).
- [ ] **J5.** Botão de atualizar funciona; sem sessões, mostra "Nenhuma sessão ativa registrada".
- [ ] **J6.** Idiomas pt, en e es.

## K. SuperAdmin
- [ ] **K1.** SA entra em C1, C2 e I1 ao mesmo tempo: **sem escolha** e sem derrubar (isento). Consulta: nenhuma vaga de SA.
- [x] **K2.** A tela mostra os totais, "Quem trocou mais", "Sessões ativas agora" (com e-mail) e "Eventos recentes".
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

---

## Anotações da rodada de 16/11/2026
**Como foi feita:** conta grátis LGPD (não é a U1 assinante do roteiro) no Chrome do note (M1), no Chrome anônimo da VM (M2) e na IDE da M1 e da M2. Modos Desligado, Observar e Valer, com os ajustes nos valores padrão (15, 3 e 60).

**Passou:** A1 a A4, B1 a B5, C1, C3 a C8, D1, D4, F1, F2, F3, F5 (em português), F6, F7, F8, H1 a H8, I1, I2, J1, J3, J4 (parcial) e K2. A segunda rodada do dia (depois do deploy dos avisos novos e com a quarta troca) confirmou o limite de 3 trocas por dia: as 3 primeiras passam, a quarta mostra o passo do código por e-mail, o código errado é recusado, o pedido de outro código antes de 1 minuto é barrado, e o código antigo deixa de valer quando sai um novo.

**Pendências, por ordem de utilidade:**
1. **H9** (repetir o limite sem esperar 24 horas, com a consulta de "recomeçar"). O restante do bloco H está feito, inclusive na IDE: o código por e-mail também vale para a vaga da IDE, e H6 a H8 foram vistos nela.
2. **E** (caminhos de login: Google, biometria, MFA, convite) e **G** (ociosidade). Sobre o G: o banco mostra um `idle_release` às 18:27 UTC (uma sessão web parada por cerca de 27 minutos, com o padrão de 15), seguido de novo login direto; se isso foi proposital durante o intervalo, G2 e G3 passaram. Falta confirmar e fazer o G5.
3. Itens soltos dos blocos já iniciados: C2, D2, D3, D5 a D7, F4, F5 em **en** e **es**, F9, o aviso amarelo de sessão encerrada na **IDE**, I3 a I5, J2, J5 e J6, K1 e K3 a K7.
4. **L a Q** (convidados, áreas dentro e fora da regra, IDE, burlas, emergência, regressões) e o bloco **R**.

**Observações do teste:**
- A aba **Segurança** do Painel de Controle só aparece para assinante (conta grátis é "convidado" e vê só Downloads, MetaBuilders e MetaVoice); **Meus dispositivos** da conta grátis está em Meu Perfil > Segurança.
- No modo **Observar** a segunda máquina não ganha linha própria: fica só o evento `conflict` (a vaga é uma por tipo). O painel do SuperAdmin e o Meus dispositivos mostram a única sessão ocupada.
- **Mudanças feitas a partir do teste (commits do dia 16/11):** o item **Workspace** passou a aparecer no avatar da conta grátis; o aviso de Meus dispositivos muda com o modo; o login limpa a sessão local também no erro 429 (um cookie ruim na VM causou loop de renovação de token); quem é derrubado, e quem escolhe "Permanecer lá e sair daqui", volta à **página inicial** (site ou IDE) com aviso amarelo ou azul. Estes dois últimos avisos foram vistos em produção depois do deploy (amarelo no navegador, azul no navegador e na IDE).
- **Contador de trocas:** só **Encerrar a outra sessão e entrar aqui** conta (evento `takeover`); "Permanecer lá e sair daqui" não conta. A janela é de 24 horas móveis, por usuário, somando web e IDE. As trocas que passaram pelo código por e-mail também entram na conta.
- Ao fim da rodada, o modo continua **Valer** e os ajustes estão em 15, 3 e 60 (padrão). Lembre de voltar para **Observar** até a revisão dos Termos e da Privacidade.
- Duas máquinas parecidas (mesmo navegador, mesma cidade) aparecem iguais na tela de escolha ("Chrome · Windows, Belo Horizonte"); só o horário as distingue. Se incomodar, dá para acrescentar o nome do computador.

## Anotações da rodada de 17/11/2026 (E, com a conta agtechtrade)
**Passou:** E2 (Google) e E4 (Google com MFA), com o note como C1 e a VM como C2 em janela anônima. O painel do SuperAdmin acompanhou: entrada, saída e nova entrada do agtechtrade, e cada tentativa da VM como "Tentativa em 2ª máquina" (evento `conflict`, sem contar para o limite de trocas).

**Achados em aberto:**
1. **Loop de renovação de token na aba normal da VM.** O log do Supabase mostrou perto de 1.100 pedidos `refresh_token` por minuto (quase todos 429), de um Chrome, durante os testes de Google, e a aba normal da VM também mostrou "PKCE code verifier not found in storage". Fechar o Chrome da VM parou o loop; a janela anônima funcionou. O limite do Supabase é por IP e o note e a VM saem pelo mesmo IP, então o loop da VM bloqueou o login do note (erro 429). Causa exata ainda não achada no código; a suspeita é um cookie ou armazenamento antigo na VM (consequência de sessões derrubadas ao longo do dia). Para reproduzir: aba normal da VM com sessão antiga e DevTools > Network (coluna Initiator).
2. **Vaga "presa" depois de sair no note.** O agtechtrade saiu pelo avatar no note, mas o painel do SuperAdmin seguiu mostrando a sessão como ativa (desde 12:26:18, última atividade 12:26:24, sem encerramento) e a VM ainda via a escolha pedindo para derrubar uma sessão que já não tinha mais batimento. No banco, nenhuma liberação (`mb_release_device_slot`) atingiu essa sessão; as liberações vistas no log foram as da VM ("Permanecer lá e sair daqui"). Fica a investigar se o logout do avatar chegou a rodar nesse caso (a sessão tinha entrado por biometria, seis segundos antes do último batimento). Enquanto isso a vaga só se libera por ociosidade (15 minutos), e o painel lista sessões sem encerramento mesmo quando estão ociosas. **Correção feita (17/11, a testar depois do deploy):** o logout agora libera também pelo cookie do dispositivo quando o servidor não lê o id da sessão, e o painel do SuperAdmin marca como "ociosa" a sessão sem batimento além do limite. *Teste novo:* entre com U1 no navegador, saia pelo avatar e confira no painel que a sessão some na hora (e que o evento `logout` aparece).
3. **E5** (IDE) e **E6** seguem pendentes. (**E3** foi feito à tarde.)

## Anotações da tarde de 17/11/2026 (conta agtechtrade, note e VM, modo Valer 15/3/60)
Nesta rodada a vaga web do agtechtrade foi disputada entre o note e a VM (os horários abaixo são os do painel, em Brasília). Nenhum erro 429 nem "Autenticando…" foi relatado.

**Passou:**
1. **Escolha com a vaga ocupada (C7, D1):** com o note logado, a VM (login com MFA: código do app e só depois a escolha, E4) viu "Sua conta já está em uso em outro dispositivo", com Chrome · Windows, Belo Horizonte, conectado desde 16:36:47 e última atividade recente.
2. **"Permanecer lá e sair daqui" (C3):** a VM voltou à página inicial com o aviso azul "Você saiu deste dispositivo" e a sessão do note continuou ativa no painel (1 sessão ativa, navegador, desde 16:36:47). O evento "Tentativa em 2ª máquina" foi registrado e a contagem subiu (de 5 para 6 e depois 7), sem contar como troca.
3. **"Encerrar a outra sessão e entrar aqui" (F1, F8):** a VM entrou no workspace; o painel mostrou "Troca de dispositivo" às 16:45:08, Trocas 7 dias passou a 7 (agtechtrade: 1) e a sessão ativa passou a ser a da VM.
4. **Aviso a quem foi derrubado (F2, F3):** em cerca de 1–2 minutos o note mostrou o modal "Sua sessão foi encerrada" com a cidade e o horário do novo login (16:45:08) e a frase sobre os arquivos locais; "Entrar novamente" levou à página inicial com o aviso amarelo. Isto confirma F3 no navegador mais uma vez.
5. **E-mail de segurança (F5):** "Sua sessão no MetaBuilder PRO foi encerrada" chegou ao agtechtrade (Onde, Dispositivo, Quando 16:45 BRT, Sessão encerrada), um por troca (em português).
6. **Troca de volta e de novo:** o note entrou com MFA, viu a escolha e derrubou a VM (a VM mostrou o modal "Sua sessão foi encerrada"); depois a VM derrubou o note de novo, "funcionou 100%". Nas duas direções a sessão que ficou continuou logada (F6).
7. **Limite de trocas na web (H2, H4):** com 3 trocas no dia, o note entrou por **biometria (E3)**, viu a escolha, clicou em "Encerrar a outra sessão" e apareceu o passo "Confirme por e-mail" (e-mail mascarado, código de 6 dígitos que vale 10 minutos); o e-mail "Confirme a troca de dispositivo" chegou, o código certo foi aceito e o note entrou no workspace. Isto confirma H2 e H4 também no navegador (antes só na IDE) e que a biometria cai na mesma regra.

8. **Logout pelo avatar (correção do commit 787e51a0):** às 17:07 o agtechtrade saiu pelo avatar no note e foi para a página inicial; o painel passou a mostrar 0 sessões ativas na hora. No banco, a sessão (aberta às 16:59:13) ficou com `revoked_reason = logout`, revogada 3 segundos depois do último batimento, e o evento `logout` (web) foi registrado. Isto fecha o achado 2 da manhã e o I3 no navegador (a IDE segue por testar). Observação: o evento `logout` não aparece na lista "Eventos recentes" do painel (só no banco); a vaga some da lista de sessões ativas, que é o que importa.

9. **Marca "ociosa" no painel:** vista mais cedo no mesmo dia (sessão com última atividade 12:26:24 e a frase "ociosa: a vaga se libera na próxima entrada", em laranja, na coluna de última atividade).
10. **Teste simples na VM depois do deploy do `59867c77` (17/11, ~12:56 da VM):** a VM caía "toda hora" porque a avaliação do Windows tinha vencido (modo de notificação); `slmgr /rearm` renovou até 15/02/2027 (não sobra mais rearm: depois disso, imagem nova ou licença própria). Com a VM de volta, aba normal, sessão do agtechtrade: Console sem erros, 375 pedidos em 7,3 min todos 200 (nenhum 400 ou 429), e na lista de cookies só os `sb-…-auth-token` do escopo `.metabuilderpro.com` (nenhuma cópia só de `www`). No Supabase, últimos 60 min sem 5xx e sem rajada de 400/429. Isto mostra que o uso normal não regrediu; **não prova** a limpeza, porque não havia cookie preso para limpar.
11. **Cookies presos reproduzidos de propósito (VM, ~13:13):** com as cópias só do host `www` dos cookies `sb-…-auth-token`, sair pelo avatar e recarregar, os dois cookies `www` ficaram ("Session") e o Console mostrou 7 × `GET /auth/v1/user 403`; o Supabase registrou uma rajada de ~157 × 403 do servidor (prefetch da página inicial) e depois parou. **A limpeza não disparou**: ela só agia no 400 da renovação (token vencido) e aqui o token de acesso ainda valia. **Correção:** o cliente agora também limpa os cookies que carregam o token quando `GET /auth/v1/user` responde 403 `session_not_found`. **A primeira versão (commit 6729611d) não disparou**: o Supabase, na API nova (`X-Supabase-Api-Version: 2024-01-01`), manda o código em `code` (texto) e no cabeçalho `X-Sb-Error-Code`, não em `error_code`; achado ao olhar o corpo da resposta no Network. **Versão final (commit 11da3d97): confirmada na VM (17/11, ~14:14):** depois do deploy, Ctrl+Shift+R com os cookies `www` presos mostrou um único 403 e o aviso "[auth] sessão encerrada no servidor. Cookies de login antigos limpos: 2.", e os dois cookies `sb-…-auth-token` de `www.metabuilderpro.com` sumiram (ficaram só `app-language` e `mb_device`). Também explica o "login sozinho" ao voltar para a aba: era a sessão morta relida do cookie preso, sem sessão no servidor.

## Anotações da noite de 17/11/2026 (ociosidade, IDE nova na VM; horários do painel, Brasília)
- **G1, G2 e G3 passaram** (ver o bloco G): vaga web do note ociosa desde 19:48:16, liberada às 21:13:13 quando a VM entrou direto, com `idle_release` (`idle_minutes: 15`) no banco e a vaga antiga em `revoked_reason = idle`.
- **Release nova da IDE gerada** (versão 1.0.1, só Windows, pelo painel de Releases; levou o tempo do banho) e instalada na VM. O agtechtrade entrou na IDE da VM às 21:08:17: evento `claimed` com `kind = ide`, e o painel passou a mostrar 2 sessões (IDE e navegador) do mesmo usuário na mesma máquina, as duas com batimento vivo às 21:19. Isso confirma de novo que a IDE tem vaga própria (C4) e dá um primeiro sinal para o N2 (IDE e navegador juntos na mesma máquina); o N2 completo pede o dia todo. **E5 ainda não foi feito** (falta a IDE do note, I1, e as tentativas em I2).
- **Estranhamento do avatar (imagens 8 e 9): explicado.** Ao reabrir o Chrome do note, a página inicial mostrava o avatar como logado. No banco, a sessão do Supabase Auth da vaga liberada por ociosidade (`fa633cac`) tinha `updated_at` às 21:16:26: ela **ainda estava viva e renovou o token** quando o Chrome reabriu. É o desenho: a sessão do Auth só é apagada depois, junto com a próxima troca ou no cron diário. A **vaga** estava liberada, mas a página inicial pública não roda a conferência de vaga (só as áreas protegidas), então mostrou o usuário a partir do cookie até o Ctrl+R. A tela de escolha apareceu como esperado na tentativa de login do note às 21:18 (evento `conflict`, "Tentativa em 2ª máquina", conectado desde 21:13:13).
- **Possível melhoria (a decidir):** quando a vaga já foi liberada por ociosidade ou troca, a página inicial poderia deixar de mostrar o avatar e mostrar o aviso de sessão encerrada. Hoje o aviso só aparece ao abrir uma área protegida.
- **Detalhe de texto no painel:** com o modo **Valer** e nenhuma sessão ativa, a seção "Sessões ativas agora" mostra "Nenhuma sessão registrada ainda. No modo Desligado nada é registrado", frase que só faz sentido no modo Desligado.
- Mais um **logout pelo avatar** funcionou às 19:33 (sessão `26c20bfd`, `revoked_reason = logout`).

**Ainda pendente (17/11, fim do dia):** G4 completo (abrir uma área protegida em C1 depois da vaga liberada) e G5 (C1 aberto e em uso: C2 vê a escolha); E6 (convite e recuperação de senha); F9 depois da próxima troca ou do cron; o logout pelo menu na IDE (I3); e os itens soltos dos blocos D, J, K, L a Q e R. A limpeza de cookies presos já foi provada (item 11, commits 59867c77 e 11da3d97).
