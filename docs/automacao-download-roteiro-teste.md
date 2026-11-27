# Download na automação e 5 formatos no e-mail: roteiro de testes (27/11/2026)

Testa as duas novidades: **(1)** o anexo do e-mail agora aceita os 5 formatos da exportação (xlsx, csv, pdf, **json** e **ofx**) e **(2)** a nova ação **Download**, que gera o arquivo do resultado de uma consulta e o coloca na **Central de Downloads** de quem você escolher (cada um só vê o seu).
Marque cada item e me mande o que falhar, com a tela e o terminal do CLI.

## O que já foi verificado por mim (sem navegador seu, sem CLI real)

- `tsc`, `npm test` (2158 testes) e `npm run build` limpos.
- Geração do JSON e do OFX (colunas achadas pelo nome, débito/crédito, texto sem `< > &`, rótulo repetido numerado), com testes.
- Ação Download no motor: 5 formatos, nome com variáveis e sem caracteres perigosos, só destinatários com id UUID, limite de 200, aviso por e-mail só quando marcado, erro anotado (sem consulta antes, sem destinatário, servidor recusou), app exportado para com aviso.
- Agente: grava o arquivo na pasta de exportações com nome único, manda o comando **assinado** que o servidor aceita, e apaga o arquivo se o servidor recusar.
- Servidor: assinatura obrigatória (errada, outro evento, adulterada e repetida são recusadas), destinatários UUID sem repetir, uma linha por destinatário em `download_jobs`, e o arquivo compartilhado só sai do disco quando a **última** linha some.

## O que **não** foi testado (é o objetivo deste roteiro)

CLI real gravando na sua pasta de exportações, a Central de Downloads mostrando e baixando o arquivo, e-mail de verdade com os anexos novos, abrir os arquivos nos programas (Excel, leitor de OFX), usuários reais com id UUID.

## Preparação (ordem importa)

1. **Servidor primeiro, depois a IDE.** O endpoint novo (`/api/automations/download`) só acrescenta, então o deploy do servidor é seguro sozinho. Depois publique a release da IDE (ou, para testar antes, rode o CLI do código novo: `cd cli; node index.js`; o `.exe` só pega a mudança depois de `npm run build` dentro de `cli/`). Com o CLI novo e o servidor antigo, a ação Download falha com erro anotado.
2. Tenha **3 usuários no app com id UUID** em perfis diferentes (ex.: *Gerente* A e B, e *Funcionária* C) e confira que **a Central de Downloads está liberada** para os perfis deles (matriz de permissões: nem "Nenhum").
3. Monte e **publique** este fluxo de teste (Agendado ou "Ao criar" em uma tabela de pedidos):

```
[Gatilho] → [Consultar dados: pedidos (nome "pedidos")] → [Download: resultado "pedidos", formato Excel, destinatários: perfil Gerente]
```

## Parte 1: os 5 formatos no e-mail

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 1.1 | Em uma ação **Enviar e-mail** marcar "Anexar o resultado de uma consulta" e abrir a lista de formatos | Aparecem **5**: Excel, CSV, PDF, **JSON** e **OFX** | ☐ |
| 1.2 | Escolher **OFX** | Aparece o aviso em âmbar ("OFX é um extrato bancário... use só com dados financeiros") | ☐ |
| 1.3 | Disparar com **JSON** e abrir o anexo no e-mail | Arquivo `.json` válido: lista de objetos, rótulos das colunas como chaves, números como número, datas em ISO, vazio como `null` | ☐ |
| 1.4 | Disparar com **OFX** numa consulta com colunas de **valor**, **data** e **nome** | O `.ofx` abre em um leitor/banco de teste; débito para valor negativo, crédito para positivo | ☐ |
| 1.5 | Disparar com **OFX** numa consulta **sem** coluna de valor | Os lançamentos saem com 0,00 (esperado; é o aviso do item 1.2) | ☐ |
| 1.6 | Repetir com Excel, CSV e PDF | Continuam como antes (nada mudou) | ☐ |
| 1.7 | Anexo grande (consulta com milhares de linhas) | Continua o limite de 2,5 MB: o envio avisa que o anexo é grande demais (para arquivos grandes use o **Download**) | ☐ |

## Parte 2: ação Download

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 2.1 | No editor, na ação, abrir **Tipo de ação** | Existe **Download (Central de Downloads)** | ☐ |
| 2.2 | Escolher Download | Aparecem: resultado (as consultas do fluxo), formato (5), nome do arquivo (com **+ Variável**), **Quem recebe** (perfis/usuários, como no e-mail) e a caixinha de avisar por e-mail, **desmarcada** | ☐ |
| 2.3 | O cartão da ação no desenho | Mostra "Download (Central de Downloads)" e o formato escolhido | ☐ |
| 2.4 | Disparar o fluxo | O terminal do CLI mostra o arquivo entregue a N usuário(s); **nenhum erro** na execução | ☐ |
| 2.5 | Entrar como **Gerente A** e abrir a Central de Downloads | O arquivo aparece, **concluído**, com o nome e o formato certos, a quantidade de registros e a origem "Automação: <nome do fluxo>" (sem precisar recarregar, se a tela já estava aberta) | ☐ |
| 2.6 | Baixar o arquivo | Baixa com o nome escolhido (sem o carimbo da pasta) e abre certo | ☐ |
| 2.7 | Entrar como **Gerente B** | Vê o **dele** (uma linha própria) | ☐ |
| 2.8 | Entrar como **Funcionária C** (fora do perfil escolhido) | **Não** vê arquivo nenhum | ☐ |
| 2.9 | Na pasta de exportações do Agente | Há **um** arquivo só (compartilhado), com nome `AAAAMMDDhhmmss_xxxxxx_<nome>` | ☐ |
| 2.10 | Como Gerente A, **excluir** o arquivo da Central | A linha some; o Gerente B **continua** vendo e baixando o dele; o arquivo continua na pasta | ☐ |
| 2.11 | Como Gerente B, excluir o dele (ou "limpar histórico") | Agora o arquivo **sai da pasta** | ☐ |
| 2.12 | Testar cada formato (Excel, CSV, JSON, PDF, OFX) | Todos geram e baixam | ☐ |
| 2.13 | Nome com variável, ex.: `Pedidos_{{sistema.data}}` | O arquivo sai com a data do dia; sem nome, sai `<consulta>-AAAA-MM-DD` | ☐ |
| 2.14 | Marcar **Avisar por e-mail** e disparar | Os destinatários recebem "Arquivo disponível: <nome>" dizendo que está na Central; desmarcado, não sai e-mail | ☐ |
| 2.15 | Destinatário cujo id **não é UUID** (ou escolher um usuário assim) | Ele é pulado, com aviso no terminal; os demais recebem; a execução **não** vira erro | ☐ |
| 2.16 | Nenhum destinatário escolhido (ou só ids não UUID) | Nada é entregue e a execução é marcada com **erro** "nenhum destinatário válido" | ☐ |
| 2.17 | Download **sem** consulta antes no fluxo | Erro anotado "resultado não encontrado" e nenhum arquivo | ☐ |
| 2.18 | Perfil do destinatário com a Central de Downloads em **"Nenhum"** na matriz | O arquivo é entregue mas ele não consegue abrir a Central (esperado: libere o acesso) | ☐ |
| 2.19 | Servidor **sem** a rota nova (CLI novo com servidor antigo, se conseguir simular) | A execução registra erro e **não** sobra arquivo na pasta | ☐ |
| 2.20 | Política de retenção da Central (autolimpeza) | Passado o prazo, as linhas somem e o arquivo físico sai **quando a última** some | ☐ |

## Parte 3: app exportado e compatibilidade

| # | O que fazer | Esperado | ✔ |
|---|---|---|---|
| 3.1 | Abrir o fluxo com Download no editor e olhar o selo "Vai no app exportado" | O selo avisa (no texto ao passar o mouse) que **Download não funciona no app exportado: o fluxo para nesse passo** | ☐ |
| 3.2 | Exportar um app com esse fluxo | O app gera e roda; o fluxo **para** no Download com aviso (esperado) | ☐ |
| 3.3 | Rodar os itens de e-mail e consulta de `bpm-roteiro-testes.md` | Continuam como estavam | ☐ |
| 3.4 | Exportação normal pela tela (botão Exportar) e a Central de Downloads de **outro** usuário | Nada mudou: cada um vê só o que exportou | ☐ |
