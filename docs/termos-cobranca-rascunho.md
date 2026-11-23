# Termos de cobrança e privacidade: rascunho para revisão jurídica (versão 3.0, 23/11/2026)

**Status:** texto base já **implementado no site** (Termos de Serviço itens 6 a 10 e Política de Privacidade itens 6 e 7, em pt, en e es). Se o advogado mudar alguma coisa,
**basta alterar o texto** nos arquivos de tradução (`src/i18n/translations/{pt,en,es}.json`, chaves `terms.item6_*` a `terms.item10_*` e `privacy.item6_*`, `privacy.item7_*`).
Este documento reúne o texto em português, a lógica por trás de cada cláusula e os pontos que o advogado precisa confirmar. **Não é parecer jurídico.**

## Como o sistema se comporta (para o advogado conferir se o texto bate)

| Tema | O que o sistema faz hoje |
|---|---|
| Renovação | automática ao fim de cada ciclo (mensal, trimestral, semestral ou anual), pelo preço vigente no vencimento da renovação, até o cancelamento |
| Cancelamento | o próprio cliente cancela na aba Assinatura; as cobranças futuras param; o acesso vai até o fim do período já pago; sem multa; pode reativar |
| Reajuste | agendado pelo SuperAdmin; vale só nas renovações a partir da vigência; aumento exige aviso de 30 dias por e-mail com o valor atual e o novo; o período já pago nunca muda |
| Estorno | o SuperAdmin estorna total ou parcial (Pix e cartão); o cliente recebe e-mail; taxas do provedor de pagamento ficam com a AGTech |
| Arrependimento | o sistema emite a nota fiscal só **8 dias após o pagamento** (7 de arrependimento + 1), por isso a prática é aceitar o arrependimento de 7 dias |
| Campanha | o preço promocional visto na compra vale pelos meses da campanha: nunca sobe com reajuste e acompanha uma redução da tabela; substitui descontos de volume e de ciclo; só para cliente novo |
| Atraso | aviso por e-mail, carência configurável, depois suspensão; o pagamento restabelece o acesso sozinho; a suspensão não apaga dados; conta gratuita que só abriu o checkout não é suspensa e a cobrança aberta é cancelada após 10 dias |
| Dados de cobrança | CPF/CNPJ, endereço, telefone e dados do pagamento; cartão vai ao provedor e **não é guardado** (só bandeira e 4 últimos dígitos); nota fiscal por NFS-e |
| Parceiros | nome, e-mail, documento e chave Pix; repasse por Pix; o parceiro vê o e-mail do indicado parcialmente oculto |

## Termos de Serviço (texto em português)

**6. Planos, Preço e Renovação Automática.** O MetaBuilderPRO é oferecido por assinatura, por licença, nos ciclos mensal, trimestral, semestral ou anual, conforme o escolhido no checkout.
O valor, a quantidade de licenças e o ciclo ficam registrados na contratação. A assinatura renova automaticamente ao fim de cada ciclo, pelo preço vigente na data de vencimento da renovação,
até ser cancelada. A cobrança é feita pelo meio escolhido (cartão de crédito, Pix ou boleto) por meio de um provedor de pagamento terceirizado. Licenças acrescentadas no meio do ciclo são
cobradas de forma proporcional aos dias que faltam. O acesso ao plano pago vale pelo período efetivamente pago.

**7. Reajuste de Preço.** A AGTech pode reajustar o preço do plano. O reajuste vale apenas para renovações com vencimento a partir da data de vigência informada e nunca altera o período já pago.
Em caso de aumento, o titular é avisado por e-mail com antecedência mínima de 30 dias da data de vigência, com o valor atual e o novo valor do plano contratado. Quem não concordar pode cancelar
a renovação a qualquer momento, sem multa, e mantém o acesso até o fim do período pago. A continuidade da assinatura após a vigência representa a aceitação do novo valor.

**8. Cancelamento, Arrependimento e Reembolso.** O titular pode cancelar a renovação a qualquer momento na aba Assinatura: as cobranças futuras são interrompidas, não há multa e o acesso continua
até o fim do período já pago. Quando a contratação é feita à distância por consumidor, ele pode desistir em até 7 dias corridos da contratação, com devolução dos valores pagos (Código de Defesa do
Consumidor, art. 49). Fora dessa hipótese, valores de períodos já iniciados não são reembolsados, salvo cobrança indevida ou em duplicidade, falha comprovada do serviço ou decisão da AGTech.
O reembolso, total ou parcial, é feito pelo mesmo meio de pagamento (Pix ou cartão), e o prazo para o crédito depende da instituição financeira.

**9. Campanhas Promocionais.** Campanhas de preço têm regras próprias, informadas no checkout: percentual de desconto, número de meses e licenças incluídas. O preço promocional visto na contratação
vale pelos meses da campanha e, em caso de reajuste da tabela, nunca é maior do que o preço visto; se a tabela de preços diminuir, o preço promocional acompanha a redução. Durante a campanha o preço
promocional substitui os descontos de volume e de ciclo, e o desconto de indicação incide apenas sobre a parte cobrada a preço de tabela. Terminados os meses da campanha, vale o preço de tabela
vigente. Licenças acrescentadas depois da contratação pagam o preço de tabela. A campanha vale para clientes novos.

**10. Atraso, Carência e Suspensão.** A falta de pagamento até o vencimento coloca a assinatura em atraso. O titular é avisado por e-mail e pode manter o acesso durante um período de carência informado
nos avisos de cobrança. Encerrada a carência sem pagamento, a AGTech pode suspender o acesso até a regularização; o pagamento da cobrança em aberto restabelece o acesso automaticamente. A suspensão
não apaga os dados do titular. Contas gratuitas que apenas iniciaram o checkout e nunca pagaram não são suspensas, e a cobrança aberta delas pode ser cancelada após 10 dias.

## Política de Privacidade (texto em português)

**6. Dados de Cobrança e Fiscais.** Para cobrar a assinatura e emitir a nota fiscal de serviço (NFS-e), tratamos nome ou razão social, CPF ou CNPJ, e-mail, telefone, endereço e os dados da cobrança
(valor, ciclo, forma e data de pagamento). Os dados do cartão de crédito são enviados ao provedor de pagamento, que atua como operador, e não ficam armazenados em nossos servidores: guardamos apenas
a bandeira e os quatro últimos dígitos. Mantemos os registros de cobrança e fiscais pelo prazo exigido pela legislação tributária e contábil (execução do contrato e obrigação legal, LGPD, art. 7º,
incisos V e II).

**7. Parceiros e Indicações.** Os parceiros cadastrados informam nome, e-mail, documento e chave Pix para receber comissões, e os repasses são feitos por Pix por meio do provedor de pagamento.
O parceiro vê quem comprou por indicação apenas com o e-mail parcialmente ocultado (por exemplo, j***@empresa.com). O programa de indicações (iClub) guarda a relação entre quem indicou e quem foi
indicado para calcular descontos. Esses dados são usados apenas para apurar e pagar comissões e descontos e são mantidos pelo prazo necessário às obrigações fiscais.

## Pontos para o advogado confirmar

1. **Arrependimento de 7 dias** (art. 49 do CDC): vale só para consumidor (pessoa física). Como a maior parte dos clientes é empresa, confirmar se a redação "quando a contratação é feita à distância por consumidor" está adequada, ou se prefere oferecer o prazo a todos.
2. **Reajuste:** o prazo mínimo de 30 dias para aumento está no sistema (não dá para agendar menos). Confirmar se a "continuidade representa aceitação" é suficiente ou se exige novo aceite expresso.
3. **Reembolso fora do arrependimento:** o texto deixa a decisão com a AGTech em hipóteses abertas ("decisão da AGTech"). Confirmar se quer prazos e hipóteses mais objetivos.
4. **Suspensão:** o texto diz que a AGTech "pode" suspender depois da carência. A carência (dias) é configurável pelo SuperAdmin e informada nos avisos. Confirmar se quer o número de dias no próprio texto.
5. **Cartão de crédito:** confirmar a frase de que os dados passam pelo servidor do provedor e "não ficam armazenados" em nossos servidores.
6. **Base legal e prazo de guarda** dos dados fiscais (item 6 da Privacidade): confirmar a citação do art. 7º, incisos V e II e o prazo de retenção.
7. **Provedor de pagamento:** o texto não cita o nome (hoje Asaas). Confirmar se quer nomear, inclusive um segundo provedor no futuro.
8. **Programa de parceiros:** hoje não há termo próprio do programa (o parceiro aceita o formulário em /parceiros). Confirmar se quer um termo à parte, com regras de comissão, carência, mínimo de repasse, estorno (clawback) e rescisão.
9. **Cancelamento pelo SuperAdmin** (excluir ou bloquear cliente): não há cláusula; avaliar se deve haver.

## Como o aceite funciona no sistema

- **Versão vigente:** `src/lib/legal/legalVersions.ts` (`LEGAL_VERSION = '3.0'`). Mudou o texto de forma que o cliente precise aceitar de novo? Suba a versão aqui e a linha "DOCUMENTO OFICIAL V3.0" nos três idiomas (há teste que confere).
- **Checkout:** o cliente marca "Li e aceito os Termos de Serviço e a Política de Privacidade" (com links que abrem o texto). Sem marcar, o botão **Finalizar Assinatura** fica desabilitado. O aceite é gravado **antes** de a cobrança ser criada; se não gravar, o pagamento não segue.
- **Clientes que já existiam:** no painel aparece um aviso "Atualizamos os Termos de Serviço e a Política de Privacidade" com os links e o botão **Li e aceito**; "Depois" só esconde nesta visita.
- **Registro:** tabela `terms_acceptances` (usuário, documento, versão, data, origem e navegador), uma linha por documento e versão, gravada pelo servidor com a sessão do usuário. SQL em `scripts/aceite-termos.sql`.

## Fora desta entrega (decisões em aberto)

- **E-mail de aviso da atualização dos Termos** para os clientes atuais (o aviso hoje é só no painel). Quando houver clientes reais, vale reaproveitar o sistema de avisos por e-mail.
- **Link dos Termos no rodapé dos e-mails de cobrança.**
- **Termo próprio do programa de parceiros** (item 8 acima).
