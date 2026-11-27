# Ação Download e 5 formatos no e-mail (2026-11-27)

Pedido do dono: (1) o anexo do e-mail oferecer os 5 formatos da exportação; (2) uma ação "Download" no fluxo que põe o arquivo do resultado de uma consulta na **Central de Downloads** só de quem for escolhido. Roteiro de testes: `docs/automacao-download-roteiro-teste.md`.

## Como a Central de Downloads funciona (lido no código)

- Cada exportação é uma linha em `download_jobs` com `user_id` (UUID do usuário do app; membro usa o id do MetaBuilder). A lista filtra por `user_id` (inclusive em tempo real); o download e a exclusão conferem o dono (403 se for de outro).
- O arquivo **não fica no servidor**: o Agente CLI o grava na pasta de exportações da máquina do cliente (`configData.downloadPath` ou `~/Downloads/MetaBuilderExports`, `cli/export_handler.js`) e o transmite sob demanda; só serve arquivos de dentro dessa pasta.

## O que foi feito

1. **Anexo do e-mail com 5 formatos** (`cli/attachments.js`): `json` (lista de objetos, rótulo da coluna como chave, tipos preservados) e `ofx` (mesma heurística de colunas da exportação das telas: valor, data, descrição, id achados pelo nome; sem coluna de valor sai 0,00). O servidor aceita as extensões novas (`emailGuard.ts`); limites do e-mail iguais (2 anexos, 2,5 MB).
2. **Ação Download** (`runDownloadAction` em `cli/bpmCore.js`): usa o resultado de uma consulta feita antes; formato, nome do arquivo com variáveis (limpo: sem acento, sem caminho), destinatários pelo mesmo seletor de perfis e usuários do e-mail (`emailGroupsUsers`), aviso por e-mail opcional (**desmarcado por padrão**). Só recebe quem tem id UUID (até 200); os demais são pulados com aviso; sem nenhum válido, erro anotado.
3. **Entrega** (`cli/automationDownload.js`): grava o arquivo na pasta de exportações com nome único e manda ao servidor um comando **assinado** pelo token do projeto (`POST /api/automations/download`, evento `automation_download`, `src/lib/tunnel/automationDownload.ts`), que insere uma linha **concluída** por destinatário. Se o servidor recusar, o arquivo é apagado e o erro vai ao fluxo.
4. **Arquivo compartilhado** (`src/lib/downloads/sharedFiles.ts`, usado nas 3 exclusões de `api/export/route.ts`): as linhas de vários usuários apontam para o mesmo `local_path`; o arquivo físico só é apagado quando nenhuma outra linha o usa (na dúvida, não apaga).
5. **Editor:** tipo de ação "Download (Central de Downloads)" com painel próprio; cartão do desenho; o selo "Vai no app exportado" avisa que Download (e Aguardar aprovação) não funcionam lá.
6. `recipients.js` ganhou `resolveSystemRecipientIds` (o e-mail e o Download usam a mesma coleta de usuários).

## Limites e decisões

- **App exportado:** não tem Central nem pasta do Agente; o fluxo para no passo, com aviso (como a aprovação).
- **Quem recebe precisa de acesso à Central** (matriz de permissões da tela "Central de Downloads"); o editor avisa no texto, não bloqueia.
- **Ordem de publicação:** servidor primeiro (endpoint novo, só acrescenta), depois a release da IDE. Com o CLI novo e o servidor antigo, a ação falha com erro anotado e não deixa arquivo.
- Sem mudança no motor para quem não usa Download; nada muda nas exportações pelas telas.
